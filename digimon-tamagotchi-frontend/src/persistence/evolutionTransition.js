import { buildFormTransitionCombatIdentity } from "../logic/arena/combatIdentity";
import {
  GameRevisionConflictError,
  normalizeGameRevision,
} from "./gameRevision";
import { buildEmptyCareMistakeStageProjection } from "../logic/stats/careMistakeProjection";

export const EVOLUTION_TRANSITION_SCHEMA_VERSION = 1;

function normalizeRequiredString(value, fieldName) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new TypeError(`${fieldName} 값이 필요합니다.`);
  }
  return normalized;
}

function assertValidEventId(eventId) {
  if (eventId === "." || eventId === ".." || eventId.includes("/")) {
    throw new TypeError("진화 eventId 값이 올바르지 않습니다.");
  }
}

/**
 * 의미가 같은 진화 명령은 항상 같은 문자열이 되도록 필드 순서를 고정합니다.
 */
export function buildEvolutionTransitionFingerprint({
  transitionId,
  sourceDigimon,
  targetDigimon,
  eventId,
  slotInstanceId,
  digimonInstanceId,
} = {}) {
  return JSON.stringify([
    `evolution-transition-v${EVOLUTION_TRANSITION_SCHEMA_VERSION}`,
    normalizeRequiredString(transitionId, "transitionId"),
    normalizeRequiredString(sourceDigimon, "sourceDigimon"),
    normalizeRequiredString(targetDigimon, "targetDigimon"),
    normalizeRequiredString(eventId, "eventId"),
    normalizeRequiredString(slotInstanceId, "slotInstanceId"),
    normalizeRequiredString(digimonInstanceId, "digimonInstanceId"),
  ]);
}

export function buildEvolutionTransitionEnvelope({
  transitionId,
  sourceDigimon,
  targetDigimon,
  logEntry = {},
  nowMs = Date.now(),
  identity = {},
} = {}) {
  const normalizedTransitionId = normalizeRequiredString(transitionId, "transitionId");
  const normalizedSource = normalizeRequiredString(sourceDigimon, "sourceDigimon");
  const normalizedTarget = normalizeRequiredString(targetDigimon, "targetDigimon");
  const eventId = normalizeRequiredString(
    logEntry.eventId || `activity:evolution:${normalizedTransitionId}`,
    "eventId"
  );
  assertValidEventId(eventId);
  const slotInstanceId = normalizeRequiredString(identity.slotInstanceId, "slotInstanceId");
  const digimonInstanceId = normalizeRequiredString(
    identity.digimonInstanceId,
    "digimonInstanceId"
  );
  const normalizedNowMs = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const envelope = {
    schemaVersion: EVOLUTION_TRANSITION_SCHEMA_VERSION,
    transitionId: normalizedTransitionId,
    sourceDigimon: normalizedSource,
    targetDigimon: normalizedTarget,
    eventId,
    slotInstanceId,
    digimonInstanceId,
    createdAt: normalizedNowMs,
    logEntry: {
      type: "EVOLUTION",
      text: typeof logEntry.text === "string" ? logEntry.text : "",
      timestamp: Number.isFinite(Number(logEntry.timestamp))
        ? Number(logEntry.timestamp)
        : normalizedNowMs,
      eventId,
      transitionId: normalizedTransitionId,
    },
  };
  return {
    ...envelope,
    requestFingerprint: buildEvolutionTransitionFingerprint(envelope),
  };
}

function createTransitionConflict({
  expectedRevision,
  actualRevision,
  remoteData,
  code,
  message,
}) {
  const error = new GameRevisionConflictError({
    expectedRevision,
    actualRevision,
    remoteData,
  });
  error.code = code;
  error.message = message;
  return error;
}

function assertTransitionMatchesRemote({ transition, remoteData, expectedRevision, actualRevision }) {
  const mismatch =
    remoteData?.selectedDigimon !== transition.sourceDigimon ||
    remoteData?.slotInstanceId !== transition.slotInstanceId ||
    remoteData?.digimonInstanceId !== transition.digimonInstanceId;
  if (!mismatch) return;
  throw createTransitionConflict({
    expectedRevision,
    actualRevision,
    remoteData,
    code: "game/evolution-source-conflict",
    message: "진화 시작 상태가 서버 슬롯의 최신 상태와 일치하지 않습니다.",
  });
}

/**
 * 슬롯 형태·스탯·combat identity·결정적 활동 로그를 한 transaction으로 커밋합니다.
 */
export async function commitEvolutionTransition({
  db,
  slotRef,
  logRef,
  baseRevision,
  updateData,
  transition,
  runTransaction,
} = {}) {
  if (!db || !slotRef || !logRef || typeof runTransaction !== "function") {
    throw new TypeError("진화 transaction 인수가 올바르지 않습니다.");
  }
  const expectedRevision = normalizeGameRevision(baseRevision);
  const normalizedTransition = buildEvolutionTransitionEnvelope({
    ...transition,
    identity: {
      slotInstanceId: transition?.slotInstanceId,
      digimonInstanceId: transition?.digimonInstanceId,
    },
  });

  return runTransaction(db, async (transaction) => {
    const receiptSnapshot = await transaction.get(logRef);
    if (receiptSnapshot.exists()) {
      const receipt = receiptSnapshot.data() || {};
      if (receipt.requestFingerprint !== normalizedTransition.requestFingerprint) {
        throw createTransitionConflict({
          expectedRevision,
          actualRevision: normalizeGameRevision(receipt.revisionAfter),
          remoteData: null,
          code: "game/evolution-transition-id-reused",
          message: "같은 진화 transitionId가 다른 요청 내용에 재사용되었습니다.",
        });
      }
      return {
        revision: normalizeGameRevision(receipt.revisionAfter),
        combatRevision: Number(receipt.combatRevisionAfter) || null,
        idempotent: true,
      };
    }

    const slotSnapshot = await transaction.get(slotRef);
    if (!slotSnapshot.exists()) {
      const error = new Error("진화할 슬롯 문서를 찾을 수 없습니다.");
      error.code = "game/slot-not-found";
      throw error;
    }
    const remoteData = slotSnapshot.data() || {};
    const actualRevision = normalizeGameRevision(remoteData.revision);
    if (actualRevision !== expectedRevision) {
      throw new GameRevisionConflictError({
        expectedRevision,
        actualRevision,
        remoteData,
      });
    }
    assertTransitionMatchesRemote({
      transition: normalizedTransition,
      remoteData,
      expectedRevision,
      actualRevision,
    });

    const combatIdentity = buildFormTransitionCombatIdentity(remoteData);
    const nextRevision = actualRevision + 1;
    const nextStageStartedAt =
      updateData?.digimonStats?.evolutionStageStartedAt ?? normalizedTransition.createdAt;
    const nextStage =
      updateData?.digimonStats?.evolutionStage ||
      remoteData.evolutionStage ||
      normalizedTransition.targetDigimon;
    const nextCareProjection = buildEmptyCareMistakeStageProjection({
      digimonInstanceId: remoteData.digimonInstanceId,
      evolutionStageStartedAt: nextStageStartedAt,
      evolutionStage: nextStage,
    });
    const nextStats = {
      ...(updateData?.digimonStats || {}),
      ...nextCareProjection,
    };
    transaction.update(slotRef, {
      ...(updateData || {}),
      digimonStats: nextStats,
      ...nextCareProjection,
      ...combatIdentity,
      selectedDigimon: normalizedTransition.targetDigimon,
      lastEvolutionTransitionId: normalizedTransition.transitionId,
      lastEvolutionEventId: normalizedTransition.eventId,
      revision: nextRevision,
    });
    transaction.set(logRef, {
      ...normalizedTransition.logEntry,
      logIdentitySchemaVersion: 1,
      slotInstanceId: normalizedTransition.slotInstanceId,
      digimonInstanceId: normalizedTransition.digimonInstanceId,
      transitionSchemaVersion: normalizedTransition.schemaVersion,
      requestFingerprint: normalizedTransition.requestFingerprint,
      sourceDigimonId: normalizedTransition.sourceDigimon,
      targetDigimonId: normalizedTransition.targetDigimon,
      revisionBefore: actualRevision,
      revisionAfter: nextRevision,
      combatRevisionBefore: remoteData.combatRevision,
      combatRevisionAfter: combatIdentity.combatRevision,
      committedAt: normalizedTransition.createdAt,
    });
    return {
      revision: nextRevision,
      combatRevision: combatIdentity.combatRevision,
      idempotent: false,
    };
  });
}
