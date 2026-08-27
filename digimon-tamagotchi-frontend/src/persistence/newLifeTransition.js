import { normalizeGameRevision, GameRevisionConflictError } from "./gameRevision";
import { buildEmptyCareMistakeStageProjection } from "../logic/stats/careMistakeProjection";

export const NEW_LIFE_TRANSITION_SCHEMA_VERSION = 1;

function requiredString(value, fieldName) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new TypeError(`${fieldName} 값이 필요합니다.`);
  return normalized;
}

function assertValidEventId(eventId) {
  if (eventId === "." || eventId === ".." || eventId.includes("/")) {
    throw new TypeError("새 생애 eventId 값이 올바르지 않습니다.");
  }
}

export function createNewLifeTransitionId(nowMs = Date.now()) {
  const randomUuid =
    typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `new-life:${nowMs}:${randomUuid}`;
}

export function buildNewLifeTransitionEnvelope({
  transitionId,
  sourceDigimon,
  targetDigimon,
  previousIdentity = {},
  nextCombatIdentity = {},
  logEntry = {},
  createdAt = Date.now(),
} = {}) {
  const normalizedTransitionId = requiredString(transitionId, "transitionId");
  const eventId = requiredString(
    logEntry.eventId || `activity:new-life:${normalizedTransitionId}`,
    "eventId"
  );
  assertValidEventId(eventId);
  const envelope = {
    schemaVersion: NEW_LIFE_TRANSITION_SCHEMA_VERSION,
    transitionId: normalizedTransitionId,
    sourceDigimon: requiredString(sourceDigimon, "sourceDigimon"),
    targetDigimon: requiredString(targetDigimon, "targetDigimon"),
    eventId,
    slotInstanceId: requiredString(previousIdentity.slotInstanceId, "slotInstanceId"),
    previousDigimonInstanceId: requiredString(
      previousIdentity.digimonInstanceId,
      "previousDigimonInstanceId"
    ),
    nextDigimonInstanceId: requiredString(
      nextCombatIdentity.digimonInstanceId,
      "nextDigimonInstanceId"
    ),
    nextArenaIdentitySchemaVersion: Number(nextCombatIdentity.arenaIdentitySchemaVersion),
    nextCombatRevision: Number(nextCombatIdentity.combatRevision),
    createdAt: Number.isFinite(Number(createdAt)) ? Number(createdAt) : Date.now(),
    logEntry: {
      ...logEntry,
      type: "NEW_START",
      eventId,
      transitionId: normalizedTransitionId,
      timestamp: Number.isFinite(Number(logEntry.timestamp))
        ? Number(logEntry.timestamp)
        : Number(createdAt),
    },
  };
  if (
    envelope.nextArenaIdentitySchemaVersion !== 1 ||
    !Number.isSafeInteger(envelope.nextCombatRevision) ||
    envelope.nextCombatRevision < 1
  ) {
    throw new TypeError("새 생애 combat identity가 올바르지 않습니다.");
  }
  return {
    ...envelope,
    requestFingerprint: JSON.stringify([
      `new-life-transition-v${NEW_LIFE_TRANSITION_SCHEMA_VERSION}`,
      envelope.transitionId,
      envelope.sourceDigimon,
      envelope.targetDigimon,
      envelope.eventId,
      envelope.slotInstanceId,
      envelope.previousDigimonInstanceId,
      envelope.nextDigimonInstanceId,
      envelope.nextCombatRevision,
    ]),
  };
}

function createIdentityConflict({ expectedRevision, actualRevision, remoteData, message }) {
  const error = new GameRevisionConflictError({
    expectedRevision,
    actualRevision,
    remoteData,
  });
  error.code = "game/new-life-source-conflict";
  error.message = message;
  return error;
}

/** 새 stats·형태·combat identity·NEW_START 로그를 한 transaction에 반영합니다. */
export async function commitNewLifeTransition({
  db,
  slotRef,
  logRef,
  baseRevision,
  updateData,
  transition,
  runTransaction,
} = {}) {
  if (!db || !slotRef || !logRef || typeof runTransaction !== "function") {
    throw new TypeError("새 생애 transaction 인수가 올바르지 않습니다.");
  }
  const envelope = buildNewLifeTransitionEnvelope({
    ...transition,
    previousIdentity: {
      slotInstanceId: transition?.slotInstanceId,
      digimonInstanceId: transition?.previousDigimonInstanceId,
    },
    nextCombatIdentity: {
      arenaIdentitySchemaVersion: transition?.nextArenaIdentitySchemaVersion,
      digimonInstanceId: transition?.nextDigimonInstanceId,
      combatRevision: transition?.nextCombatRevision,
    },
  });
  const expectedRevision = normalizeGameRevision(baseRevision);

  return runTransaction(db, async (transaction) => {
    const receiptSnapshot = await transaction.get(logRef);
    if (receiptSnapshot.exists()) {
      const receipt = receiptSnapshot.data() || {};
      if (receipt.requestFingerprint !== envelope.requestFingerprint) {
        const error = new Error("같은 새 생애 transitionId가 다른 요청에 재사용되었습니다.");
        error.code = "game/new-life-transition-id-reused";
        throw error;
      }
      return {
        revision: normalizeGameRevision(receipt.revisionAfter),
        nextDigimonInstanceId: receipt.digimonInstanceId,
        idempotent: true,
      };
    }

    const slotSnapshot = await transaction.get(slotRef);
    if (!slotSnapshot.exists()) {
      const error = new Error("새 생애를 시작할 슬롯 문서를 찾을 수 없습니다.");
      error.code = "game/slot-not-found";
      throw error;
    }
    const remoteData = slotSnapshot.data() || {};
    const actualRevision = normalizeGameRevision(remoteData.revision);
    if (actualRevision !== expectedRevision) {
      throw new GameRevisionConflictError({ expectedRevision, actualRevision, remoteData });
    }
    if (
      remoteData.slotInstanceId !== envelope.slotInstanceId ||
      remoteData.digimonInstanceId !== envelope.previousDigimonInstanceId ||
      remoteData.selectedDigimon !== envelope.sourceDigimon
    ) {
      throw createIdentityConflict({
        expectedRevision,
        actualRevision,
        remoteData,
        message: "새 생애 시작 전 서버 슬롯 identity가 현재 화면과 일치하지 않습니다.",
      });
    }

    const nextRevision = actualRevision + 1;
    const nextStageStartedAt =
      updateData?.digimonStats?.evolutionStageStartedAt ??
      updateData?.digimonStats?.birthTime ??
      envelope.createdAt;
    const nextStage = updateData?.digimonStats?.evolutionStage || envelope.targetDigimon;
    const nextCareProjection = buildEmptyCareMistakeStageProjection({
      digimonInstanceId: envelope.nextDigimonInstanceId,
      evolutionStageStartedAt: nextStageStartedAt,
      evolutionStage: nextStage,
    });
    transaction.update(slotRef, {
      ...(updateData || {}),
      digimonStats: {
        ...(updateData?.digimonStats || {}),
        ...nextCareProjection,
      },
      ...nextCareProjection,
      arenaIdentitySchemaVersion: envelope.nextArenaIdentitySchemaVersion,
      digimonInstanceId: envelope.nextDigimonInstanceId,
      combatRevision: envelope.nextCombatRevision,
      selectedDigimon: envelope.targetDigimon,
      lastEvolutionTransitionId: envelope.transitionId,
      lastEvolutionEventId: envelope.eventId,
      logIdentitySchemaVersion: 1,
      previousLifeCleanup: {
        schemaVersion: 1,
        slotInstanceId: envelope.slotInstanceId,
        digimonInstanceId: envelope.previousDigimonInstanceId,
        requestedAt: envelope.createdAt,
      },
      revision: nextRevision,
    });
    transaction.set(logRef, {
      ...envelope.logEntry,
      logIdentitySchemaVersion: 1,
      slotInstanceId: envelope.slotInstanceId,
      digimonInstanceId: envelope.nextDigimonInstanceId,
      transitionSchemaVersion: envelope.schemaVersion,
      requestFingerprint: envelope.requestFingerprint,
      sourceDigimonId: envelope.sourceDigimon,
      targetDigimonId: envelope.targetDigimon,
      previousDigimonInstanceId: envelope.previousDigimonInstanceId,
      revisionBefore: actualRevision,
      revisionAfter: nextRevision,
      committedAt: envelope.createdAt,
    });
    return {
      revision: nextRevision,
      nextDigimonInstanceId: envelope.nextDigimonInstanceId,
      idempotent: false,
    };
  });
}
