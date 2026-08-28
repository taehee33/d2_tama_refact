import {
  collection,
  doc,
  runTransaction as firestoreRunTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { toEpochMs } from "../utils/time";
import {
  CARE_MISTAKE_RECONCILIATION_STATUS,
  CARE_MISTAKE_SCHEMA_VERSION,
  CARE_MISTAKE_TRANSITION_TYPES,
  buildCareMistakeIncidentId,
  buildCareMistakeTransitionEventId,
  getCareMistakeReasonKey,
  normalizeCareMistakeIdentity,
  normalizeCareMistakeIncident,
} from "../logic/stats/careMistakeProjection";

export const GAME_TRANSITION_SCHEMA_VERSION = 1;

const CARE_PROJECTION_FIELDS = Object.freeze([
  "careMistakes",
  "unresolvedCareMistakeCount",
  "latestUnresolvedCareMistakeIncidentId",
  "latestCareMistakeAt",
  "careMistakeSchemaVersion",
  "careMistakeReconciliationVersion",
  "careMistakeReconciliationStatus",
  "evolutionStageInstanceId",
]);

export class GameTransitionConflictError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "GameTransitionConflictError";
    this.code = details.code || "game/transition-conflict";
    Object.assign(this, details);
  }
}

export class GameTransitionIdempotencyError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "GameTransitionIdempotencyError";
    this.code = details.code || "game/transition-idempotency-conflict";
    Object.assign(this, details);
  }
}

function normalizeRequiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${fieldName}가 필요합니다.`);
  }
  return value.trim();
}

function normalizeRevision(value, fieldName = "revision") {
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 0) {
    throw new TypeError(`${fieldName}은(는) 0 이상의 정수여야 합니다.`);
  }
  return revision;
}

function normalizeTimestamp(value, fallback = Date.now()) {
  const timestamp = toEpochMs(value);
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function hashText(value = "") {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
}

function stableHash(value) {
  return hashText(JSON.stringify(stableValue(value)));
}

export function buildGameTransitionId({
  slotInstanceId,
  clientInstanceId,
  localSequence,
  transitionType,
} = {}) {
  const slot = normalizeRequiredString(slotInstanceId, "slotInstanceId");
  const client = normalizeRequiredString(clientInstanceId, "clientInstanceId");
  const sequence = normalizeRevision(localSequence, "localSequence");
  const type = normalizeRequiredString(transitionType, "transitionType");
  return `transition:${slot}:${client}:${sequence}:${type}`;
}

function normalizeOperations(transition = {}) {
  const operations = Array.isArray(transition.operations)
    ? transition.operations
    : [transition];
  return operations.map((operation, index) => ({
    ...operation,
    index: Number.isInteger(operation.index) ? operation.index : index,
    transitionType: operation.transitionType || transition.transitionType,
  }));
}

export function buildGameTransitionEnvelope({
  identity = {},
  transitionType,
  transitionId = null,
  clientInstanceId,
  localSequence,
  parentTransitionId = null,
  baseRevision = 0,
  createdAt = Date.now(),
  operations,
  resultingState = null,
  activityEvents = [],
  incidentIds = [],
  updateData = null,
  resultingStateHash = null,
  careMistakeReconciliationVersion = null,
  reasonKey,
  occurredAt,
  text,
  incidentId,
  eventId,
  resolvedAt,
  resolvedBy,
} = {}) {
  const normalizedIdentity = normalizeCareMistakeIdentity(identity);
  const normalizedType = normalizeRequiredString(transitionType, "transitionType");
  const normalizedClient = normalizeRequiredString(clientInstanceId, "clientInstanceId");
  const normalizedSequence = normalizeRevision(localSequence, "localSequence");
  const normalizedCreatedAt = normalizeTimestamp(createdAt);
  const normalizedOperations = normalizeOperations({
    ...identity,
    transitionType: normalizedType,
    operations,
    reasonKey,
    occurredAt,
    text,
    incidentId,
    eventId,
    resolvedAt,
    resolvedBy,
  });
  const normalizedTransitionId =
    transitionId ||
    buildGameTransitionId({
      slotInstanceId: normalizedIdentity.slotInstanceId,
      clientInstanceId: normalizedClient,
      localSequence: normalizedSequence,
      transitionType: normalizedType,
    });

  const operationsWithDeterministicEventIds = normalizedOperations.map((operation, index) => ({
    ...operation,
    eventId:
      buildCareMistakeTransitionEventId(
        normalizedTransitionId,
        operation.transitionType || normalizedType,
        operation.index ?? index
      ) || operation.eventId,
  }));
  const derivedEventIds = operationsWithDeterministicEventIds
    .map((operation) => operation.eventId)
    .filter(Boolean);
  const derivedIncidentIds = operationsWithDeterministicEventIds
    .filter((operation) =>
      operation.transitionType === CARE_MISTAKE_TRANSITION_TYPES.OCCURRED ||
      operation.transitionType === CARE_MISTAKE_TRANSITION_TYPES.RESOLVED
    )
    .map((operation) => operation.incidentId)
    .filter(Boolean);
  const normalizedEventIds = Array.from(new Set(derivedEventIds));
  const normalizedIncidentIds = Array.from(new Set([...(incidentIds || []), ...derivedIncidentIds]));
  const normalizedActivityEvents = (activityEvents || []).map((event, index) => ({
    ...event,
    eventId:
      event.eventId ||
      normalizedEventIds[index] ||
      buildCareMistakeTransitionEventId(normalizedTransitionId, normalizedType, index),
    transitionId: normalizedTransitionId,
    timestamp: normalizeTimestamp(event.timestamp, normalizedCreatedAt),
  }));
  const fingerprint = stableHash({
    transitionId: normalizedTransitionId,
    clientInstanceId: normalizedClient,
    localSequence: normalizedSequence,
    parentTransitionId,
    transitionType: normalizedType,
    baseRevision: normalizeRevision(baseRevision, "baseRevision"),
    identity: normalizedIdentity,
    operations: operationsWithDeterministicEventIds,
    resultingState,
    updateData,
    eventIds: normalizedEventIds,
    incidentIds: normalizedIncidentIds,
  });

  return {
    schemaVersion: GAME_TRANSITION_SCHEMA_VERSION,
    transitionId: normalizedTransitionId,
    clientInstanceId: normalizedClient,
    localSequence: normalizedSequence,
    parentTransitionId: parentTransitionId || null,
    transitionType: normalizedType,
    baseRevision: normalizeRevision(baseRevision, "baseRevision"),
    resultRevision: null,
    ...normalizedIdentity,
    createdAt: normalizedCreatedAt,
    operations: operationsWithDeterministicEventIds,
    eventIds: normalizedEventIds,
    incidentIds: normalizedIncidentIds,
    activityEvents: normalizedActivityEvents,
    resultingState,
    updateData,
    resultingStateHash: resultingStateHash || stableHash({ resultingState, updateData }),
    requestFingerprint: fingerprint,
    ...(careMistakeReconciliationVersion == null
      ? {}
      : { careMistakeReconciliationVersion }),
  };
}

function getSlotCareProjection(slotData = {}) {
  const stats = slotData.digimonStats || {};
  const careMistakes = Math.max(
    0,
    Number(slotData.unresolvedCareMistakeCount ?? slotData.careMistakes ?? stats.careMistakes) || 0
  );
  return {
    careMistakes,
    unresolvedCareMistakeCount: careMistakes,
    latestUnresolvedCareMistakeIncidentId:
      slotData.latestUnresolvedCareMistakeIncidentId ??
      stats.latestUnresolvedCareMistakeIncidentId ??
      null,
    latestCareMistakeAt:
      toEpochMs(slotData.latestCareMistakeAt ?? stats.latestCareMistakeAt),
    careMistakeSchemaVersion:
      slotData.careMistakeSchemaVersion ?? CARE_MISTAKE_SCHEMA_VERSION,
    careMistakeReconciliationVersion:
      slotData.careMistakeReconciliationVersion ?? stats.careMistakeReconciliationVersion ?? null,
    careMistakeReconciliationStatus:
      slotData.careMistakeReconciliationStatus ??
      stats.careMistakeReconciliationStatus ??
      CARE_MISTAKE_RECONCILIATION_STATUS.NOT_STARTED,
    evolutionStageInstanceId:
      slotData.evolutionStageInstanceId ?? stats.evolutionStageInstanceId ?? null,
  };
}

function omitCareProjectionFields(value = {}) {
  const result = { ...value };
  CARE_PROJECTION_FIELDS.forEach((field) => {
    delete result[field];
  });
  delete result.careMistakeLedger;
  return result;
}

function buildNestedStatsUpdate(remoteStats = {}, requestedStats = {}, projection = {}) {
  const nextStats = {
    ...omitCareProjectionFields(remoteStats),
    ...omitCareProjectionFields(requestedStats),
    ...projection,
  };
  delete nextStats.careMistakeLedger;
  return nextStats;
}

function assertTransitionIdentity(slotData, transition) {
  if (
    slotData.slotInstanceId !== transition.slotInstanceId ||
    slotData.digimonInstanceId !== transition.digimonInstanceId
  ) {
    throw new GameTransitionConflictError("슬롯 생애 identity가 현재 전이와 일치하지 않습니다.", {
      code: "game/transition-identity-conflict",
    });
  }
  if (
    transition.evolutionStageInstanceId &&
    slotData.evolutionStageInstanceId &&
    slotData.evolutionStageInstanceId !== transition.evolutionStageInstanceId
  ) {
    throw new GameTransitionConflictError("현재 stage identity가 전이와 일치하지 않습니다.", {
      code: "game/transition-stage-conflict",
    });
  }
}

function assertIncidentIdentity(incident, transition) {
  if (!incident) return;
  if (
    incident.slotInstanceId !== transition.slotInstanceId ||
    incident.digimonInstanceId !== transition.digimonInstanceId ||
    incident.evolutionStageInstanceId !== transition.evolutionStageInstanceId
  ) {
    throw new GameTransitionConflictError("다른 생애 또는 stage incident를 변경할 수 없습니다.", {
      code: "game/incident-identity-conflict",
    });
  }
}

function buildIncidentFromOperation(operation, transition, previousUnresolvedIncidentId = null) {
  const reasonKey = getCareMistakeReasonKey(operation.text, operation.reasonKey);
  const occurredAt = normalizeTimestamp(operation.occurredAt, transition.createdAt);
  const incidentId =
    operation.incidentId ||
    buildCareMistakeIncidentId({
      reasonKey,
      occurredAt,
      slotInstanceId: transition.slotInstanceId,
      digimonInstanceId: transition.digimonInstanceId,
      evolutionStageInstanceId: transition.evolutionStageInstanceId,
    });
  if (!incidentId) {
    throw new TypeError("incidentId를 결정할 수 없습니다.");
  }
  return {
    incidentId,
    transitionId: transition.transitionId,
    eventId:
      operation.eventId ||
      buildCareMistakeTransitionEventId(
        transition.transitionId,
        CARE_MISTAKE_TRANSITION_TYPES.OCCURRED,
        operation.index ?? 0
      ),
    slotInstanceId: transition.slotInstanceId,
    digimonInstanceId: transition.digimonInstanceId,
    evolutionStageInstanceId: transition.evolutionStageInstanceId,
    occurredAt,
    reasonKey,
    text: String(operation.text || "케어미스 발생"),
    status: "unresolved",
    resolvedAt: null,
    resolvedBy: null,
    previousUnresolvedIncidentId: previousUnresolvedIncidentId || null,
  };
}

function buildActivityLogPayload(event, transition) {
  return {
    ...event,
    eventId: event.eventId,
    transitionId: transition.transitionId,
    slotInstanceId: transition.slotInstanceId,
    digimonInstanceId: transition.digimonInstanceId,
    evolutionStageInstanceId: transition.evolutionStageInstanceId,
    timestamp: normalizeTimestamp(event.timestamp, transition.createdAt),
  };
}

function buildTransitionResult({
  transition,
  revision,
  projection,
  activityEvents,
  incidentIds,
  idempotent = false,
}) {
  return {
    transitionId: transition.transitionId,
    revision,
    resultRevision: revision,
    projection,
    eventIds: activityEvents.map((event) => event.eventId),
    incidentIds,
    idempotent,
    receipt: {
      transitionId: transition.transitionId,
      clientInstanceId: transition.clientInstanceId,
      localSequence: transition.localSequence,
      parentTransitionId: transition.parentTransitionId,
      transitionType: transition.transitionType,
      baseRevision: transition.baseRevision,
      resultRevision: revision,
      eventIds: activityEvents.map((event) => event.eventId),
      incidentIds,
      resultingStateHash: transition.resultingStateHash,
    },
  };
}

/**
 * 케어미스 관련 상태·incident·활동 로그·receipt를 하나의 Firestore transaction으로 확정합니다.
 */
export async function commitGameTransition({
  db,
  slotRef,
  transition,
  baseRevision = null,
  updateData = {},
  runTransaction = firestoreRunTransaction,
  committedAtValue,
} = {}) {
  if (!db || !slotRef || !transition) {
    throw new TypeError("db, slotRef, transition이 필요합니다.");
  }
  const normalizedTransition = buildGameTransitionEnvelope({
    ...transition,
    identity: transition.identity || transition,
    ...(transition.baseRevision == null && baseRevision != null ? { baseRevision } : {}),
  });
  const transitionRef = doc(collection(slotRef, "gameTransitions"), normalizedTransition.transitionId);
  const operations = normalizedTransition.operations;
  const incidentRefs = new Map();
  operations.forEach((operation) => {
    if (!operation.incidentId) return;
    incidentRefs.set(
      operation.incidentId,
      doc(collection(slotRef, "careMistakeIncidents"), operation.incidentId)
    );
  });

  return runTransaction(db, async (transaction) => {
    const receiptSnapshot = await transaction.get(transitionRef);
    if (receiptSnapshot.exists()) {
      const existingReceipt = receiptSnapshot.data() || {};
      if (
        existingReceipt.requestFingerprint &&
        existingReceipt.requestFingerprint !== normalizedTransition.requestFingerprint
      ) {
        throw new GameTransitionIdempotencyError("같은 transitionId에 다른 payload를 재사용했습니다.", {
          transitionId: normalizedTransition.transitionId,
        });
      }
      return buildTransitionResult({
        transition: normalizedTransition,
        revision: normalizeRevision(existingReceipt.resultRevision, "resultRevision"),
        projection: existingReceipt.projection || null,
        activityEvents: (existingReceipt.eventIds || []).map((eventId) => ({ eventId })),
        incidentIds: existingReceipt.incidentIds || [],
        idempotent: true,
      });
    }

    let parentSnapshot = null;
    if (normalizedTransition.parentTransitionId) {
      const parentRef = doc(
        collection(slotRef, "gameTransitions"),
        normalizedTransition.parentTransitionId
      );
      parentSnapshot = await transaction.get(parentRef);
      if (!parentSnapshot.exists()) {
        throw new GameTransitionConflictError("선행 transition receipt가 없습니다.", {
          code: "game/transition-parent-missing",
        });
      }
      const parentData = parentSnapshot.data() || {};
      if (parentData.resultRevision == null) {
        throw new GameTransitionConflictError("선행 transition이 아직 commit되지 않았습니다.", {
          code: "game/transition-parent-pending",
        });
      }
      if (
        parentData.slotInstanceId !== normalizedTransition.slotInstanceId ||
        parentData.digimonInstanceId !== normalizedTransition.digimonInstanceId
      ) {
        throw new GameTransitionConflictError("다른 생애의 transition을 parent로 사용할 수 없습니다.", {
          code: "game/transition-parent-identity-conflict",
        });
      }
      if (normalizeRevision(parentData.resultRevision, "parentResultRevision") !==
        normalizedTransition.baseRevision) {
        throw new GameTransitionConflictError("선행 transition 결과와 base revision이 일치하지 않습니다.", {
          code: "game/transition-parent-revision-conflict",
        });
      }
    }

    const slotSnapshot = await transaction.get(slotRef);
    if (!slotSnapshot.exists()) {
      throw new GameTransitionConflictError("슬롯 문서를 찾을 수 없습니다.", {
        code: "game/transition-slot-missing",
      });
    }
    const slotData = slotSnapshot.data() || {};
    const actualRevision = normalizeRevision(slotData.revision ?? 0);
    if (actualRevision !== normalizedTransition.baseRevision) {
      throw new GameTransitionConflictError("슬롯 revision이 일치하지 않습니다.", {
        code: "game/transition-revision-conflict",
        expectedRevision: normalizedTransition.baseRevision,
        actualRevision,
        remoteData: slotData,
      });
    }
    assertTransitionIdentity(slotData, normalizedTransition);

    // 모든 incident 조회는 transaction write 전에 완료한다.
    const incidentSnapshots = new Map();
    for (const [incidentId, incidentRef] of incidentRefs.entries()) {
      incidentSnapshots.set(incidentId, await transaction.get(incidentRef));
    }

    let currentProjection = {
      ...getSlotCareProjection(slotData),
      // transaction으로 확정되는 순간부터 이 projection은 incident와
      // 함께 검증된 정본이다. legacy 슬롯의 not_started 값을 그대로
      // 전이 결과에 복사하지 않는다.
      careMistakeReconciliationStatus: CARE_MISTAKE_RECONCILIATION_STATUS.VERIFIED,
      careMistakeReconciliationVersion: CARE_MISTAKE_SCHEMA_VERSION,
      evolutionStageInstanceId:
        normalizedTransition.evolutionStageInstanceId ||
        getSlotCareProjection(slotData).evolutionStageInstanceId,
    };
    let nextProjection = { ...currentProjection };
    const incidentWrites = [];
    const changedIncidentIds = [];
    const generatedActivityEvents = normalizedTransition.operations
      .filter((operation) =>
        (operation.transitionType || normalizedTransition.transitionType) !==
        CARE_MISTAKE_TRANSITION_TYPES.CALL_HISTORY_ACKNOWLEDGED
      )
      .map((operation, index) => ({
        eventId:
          operation.eventId ||
          buildCareMistakeTransitionEventId(
            normalizedTransition.transitionId,
            operation.transitionType || normalizedTransition.transitionType,
            index
          ),
        type:
          operation.logType ||
          (operation.transitionType === CARE_MISTAKE_TRANSITION_TYPES.OCCURRED
            ? "CAREMISTAKE"
            : operation.transitionType === CARE_MISTAKE_TRANSITION_TYPES.RESOLVED
              ? "PLAY_OR_SNACK"
              : operation.transitionType),
        text: operation.text ||
          (operation.transitionType === CARE_MISTAKE_TRANSITION_TYPES.RESOLVED
            ? "교감 성공으로 케어미스를 해소했습니다."
            : "케어미스 전이"),
        timestamp: operation.occurredAt || normalizedTransition.createdAt,
      }));
    const explicitActivityEventIds = new Set(
      normalizedTransition.activityEvents.map((event) => event.eventId).filter(Boolean)
    );
    const activityEvents = [
      ...normalizedTransition.activityEvents,
      ...generatedActivityEvents.filter((event) =>
        event.eventId && !explicitActivityEventIds.has(event.eventId)
      ),
    ];

    for (const operation of operations) {
      const type = operation.transitionType || normalizedTransition.transitionType;
      if (type === CARE_MISTAKE_TRANSITION_TYPES.OCCURRED) {
        const previousId =
          operation.previousUnresolvedIncidentId ||
          nextProjection.latestUnresolvedCareMistakeIncidentId ||
          null;
        let previousSnapshot = null;
        if (previousId && !incidentSnapshots.has(previousId)) {
          previousSnapshot = await transaction.get(
            doc(collection(slotRef, "careMistakeIncidents"), previousId)
          );
          incidentSnapshots.set(previousId, previousSnapshot);
        }
        if (previousId && previousSnapshot && !previousSnapshot.exists()) {
          throw new GameTransitionConflictError("이전 unresolved incident를 찾을 수 없습니다.", {
            code: "game/incident-previous-missing",
          });
        }
        const incident = buildIncidentFromOperation(operation, normalizedTransition, previousId);
        const incidentRef = incidentRefs.get(incident.incidentId) ||
          doc(collection(slotRef, "careMistakeIncidents"), incident.incidentId);
        incidentRefs.set(incident.incidentId, incidentRef);
        const existingSnapshot = incidentSnapshots.has(incident.incidentId)
          ? incidentSnapshots.get(incident.incidentId)
          : await transaction.get(incidentRef);
        incidentSnapshots.set(incident.incidentId, existingSnapshot);
        if (existingSnapshot?.exists()) {
          const existing = normalizeCareMistakeIncident({
            incidentId: incident.incidentId,
            ...existingSnapshot.data(),
          });
          assertIncidentIdentity(existing, normalizedTransition);
          if (existing?.status !== "unresolved") {
            throw new GameTransitionConflictError("이미 해소된 incident를 다시 발생시킬 수 없습니다.", {
              code: "game/incident-reuse",
            });
          }
        } else {
          incidentWrites.push({
            kind: "create",
            ref: incidentRef,
            value: incident,
          });
          changedIncidentIds.push(incident.incidentId);
          nextProjection = {
            ...nextProjection,
            careMistakes: nextProjection.careMistakes + 1,
            unresolvedCareMistakeCount: nextProjection.unresolvedCareMistakeCount + 1,
            latestUnresolvedCareMistakeIncidentId: incident.incidentId,
            latestCareMistakeAt: incident.occurredAt,
            evolutionStageInstanceId: normalizedTransition.evolutionStageInstanceId,
            careMistakeSchemaVersion: CARE_MISTAKE_SCHEMA_VERSION,
          };
        }
      }

      if (type === CARE_MISTAKE_TRANSITION_TYPES.RESOLVED) {
        const targetId =
          operation.incidentId || nextProjection.latestUnresolvedCareMistakeIncidentId;
        if (!targetId) continue;
        const targetRef = incidentRefs.get(targetId) ||
          doc(collection(slotRef, "careMistakeIncidents"), targetId);
        const targetSnapshot = incidentSnapshots.get(targetId) || await transaction.get(targetRef);
        if (!targetSnapshot.exists()) {
          throw new GameTransitionConflictError("해소할 incident를 찾을 수 없습니다.", {
            code: "game/incident-missing",
          });
        }
        const target = normalizeCareMistakeIncident({ incidentId: targetId, ...targetSnapshot.data() });
        assertIncidentIdentity(target, normalizedTransition);
        if (target.status !== "unresolved") continue;
        if (
          nextProjection.latestUnresolvedCareMistakeIncidentId &&
          targetId !== nextProjection.latestUnresolvedCareMistakeIncidentId
        ) {
          throw new GameTransitionConflictError("최신 unresolved incident만 해소할 수 있습니다.", {
            code: "game/incident-not-head",
          });
        }
        const previousId = target.previousUnresolvedIncidentId || null;
        let previous = null;
        if (previousId) {
          const previousRef = incidentRefs.get(previousId) ||
            doc(collection(slotRef, "careMistakeIncidents"), previousId);
          const previousSnapshot = incidentSnapshots.get(previousId) ||
            await transaction.get(previousRef);
          incidentSnapshots.set(previousId, previousSnapshot);
          if (!previousSnapshot.exists()) {
            throw new GameTransitionConflictError("복원할 이전 unresolved incident를 찾을 수 없습니다.", {
              code: "game/incident-previous-missing",
            });
          }
          previous = normalizeCareMistakeIncident({
            incidentId: previousId,
            ...previousSnapshot.data(),
          });
          assertIncidentIdentity(previous, normalizedTransition);
          if (previous.status !== "unresolved") {
            throw new GameTransitionConflictError("이전 incident가 unresolved 상태가 아닙니다.", {
              code: "game/incident-previous-resolved",
            });
          }
        }
        incidentWrites.push({
          kind: "update",
          ref: targetRef,
          value: {
            status: "resolved",
            resolvedAt: normalizeTimestamp(operation.resolvedAt, normalizedTransition.createdAt),
            resolvedBy: operation.resolvedBy || "play_or_snack",
          },
        });
        changedIncidentIds.push(targetId);
        nextProjection = {
          ...nextProjection,
          careMistakes: Math.max(0, nextProjection.careMistakes - 1),
          unresolvedCareMistakeCount: Math.max(0, nextProjection.unresolvedCareMistakeCount - 1),
          latestUnresolvedCareMistakeIncidentId: previousId,
          latestCareMistakeAt: previous?.occurredAt ?? null,
        };
      }
    }

    if (
      nextProjection.latestUnresolvedCareMistakeIncidentId &&
      nextProjection.latestUnresolvedCareMistakeIncidentId === currentProjection.latestUnresolvedCareMistakeIncidentId &&
      nextProjection.careMistakes === 0
    ) {
      nextProjection.latestUnresolvedCareMistakeIncidentId = null;
      nextProjection.latestCareMistakeAt = null;
    }

    const nextRevision = actualRevision + 1;
    const requestedStats = updateData?.digimonStats || {};
    const nextStats = buildNestedStatsUpdate(
      slotData.digimonStats || {},
      requestedStats,
      nextProjection
    );
    const slotUpdate = {
      ...updateData,
      digimonStats: nextStats,
      ...nextProjection,
      lastGameTransitionId: normalizedTransition.transitionId,
      revision: nextRevision,
      updatedAt: serverTimestamp(),
    };

    incidentWrites.forEach((write) => {
      if (write.kind === "create") {
        transaction.create
          ? transaction.create(write.ref, write.value)
          : transaction.set(write.ref, write.value, { merge: true });
      } else {
        transaction.set(write.ref, write.value, { merge: true });
      }
    });
    activityEvents.forEach((event) => {
      if (!event?.eventId) return;
      transaction.set(
        doc(collection(slotRef, "logs"), event.eventId),
        buildActivityLogPayload(event, normalizedTransition),
        { merge: true }
      );
    });
    transaction.update(slotRef, slotUpdate);
    const receipt = {
      schemaVersion: GAME_TRANSITION_SCHEMA_VERSION,
      transitionId: normalizedTransition.transitionId,
      clientInstanceId: normalizedTransition.clientInstanceId,
      localSequence: normalizedTransition.localSequence,
      parentTransitionId: normalizedTransition.parentTransitionId,
      transitionType: normalizedTransition.transitionType,
      baseRevision: normalizedTransition.baseRevision,
      resultRevision: nextRevision,
      eventIds: activityEvents.map((event) => event.eventId).filter(Boolean),
      incidentIds: Array.from(new Set([...normalizedTransition.incidentIds, ...changedIncidentIds])),
      slotInstanceId: normalizedTransition.slotInstanceId,
      digimonInstanceId: normalizedTransition.digimonInstanceId,
      evolutionStageInstanceId: normalizedTransition.evolutionStageInstanceId,
      resultingStateHash: normalizedTransition.resultingStateHash,
      requestFingerprint: normalizedTransition.requestFingerprint,
      projection: nextProjection,
      lastGameTransitionId: normalizedTransition.transitionId,
      committedAt: committedAtValue || serverTimestamp(),
    };
    transaction.set(transitionRef, receipt);

    return buildTransitionResult({
      transition: normalizedTransition,
      revision: nextRevision,
      projection: nextProjection,
      activityEvents,
      incidentIds: receipt.incidentIds,
    });
  });
}
