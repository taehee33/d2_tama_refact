import { collection, doc } from "firebase/firestore";

const SAFE_REPLAY_FIELDS = {
  FEED: [
    "fullness",
    "weight",
    "strength",
    "energy",
    "proteinOverdose",
    "consecutiveMeatFed",
    "overfeeds",
  ],
  TRAIN: ["weight", "energy", "strength", "trainings", "effort"],
  CLEAN: [
    "poopCount",
    "poopReachedMaxAt",
    "lastPoopPenaltyAt",
    "poopPenaltyFrozenDurationMs",
  ],
  DIET: ["fullness"],
  REST: ["strength"],
  DETOX: ["proteinOverdose"],
  ACTION: ["isLightsOn", "wakeUntil", "isNocturnal"],
};

const CARE_MISTAKE_PROJECTION_FIELDS = Object.freeze([
  "careMistakes",
  "unresolvedCareMistakeCount",
  "latestUnresolvedCareMistakeIncidentId",
  "latestCareMistakeAt",
  "careMistakeSchemaVersion",
  "careMistakeReconciliationVersion",
  "careMistakeReconciliationStatus",
  "evolutionStageInstanceId",
  "careMistakeReconciliationChecksum",
  "lastGameTransitionId",
]);

export const UNSAFE_REPLAY_TYPES = new Set([
  "DEATH",
  "EVOLUTION",
  "REINCARNATION",
  "NEW_START",
  "FRIDGE",
  "BATTLE",
  "PLAY_OR_SNACK",
]);

export class GameRevisionConflictError extends Error {
  constructor({ expectedRevision, actualRevision, remoteData = null } = {}) {
    super(`게임 상태 revision 충돌: ${expectedRevision} → ${actualRevision}`);
    this.name = "GameRevisionConflictError";
    this.code = "game/revision-conflict";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
    this.remoteData = remoteData;
  }
}

export function normalizeGameRevision(value) {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

export function createMutationId(nowMs = Date.now()) {
  const randomUuid = typeof crypto !== "undefined" ? crypto.randomUUID?.() : null;
  if (randomUuid) return randomUuid;
  return `mutation:${nowMs}:${Math.random().toString(36).slice(2)}`;
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildFieldOperation(field, beforeValue, afterValue) {
  if (valuesEqual(beforeValue, afterValue)) return null;

  if (typeof beforeValue === "number" && typeof afterValue === "number") {
    return { field, kind: "delta", value: afterValue - beforeValue };
  }

  return { field, kind: "set", value: afterValue ?? null };
}

export function buildReplayAction({
  eventId,
  type,
  timestamp = Date.now(),
  beforeStats = {},
  afterStats = {},
} = {}) {
  const normalizedType = typeof type === "string" ? type.toUpperCase() : "";
  const fields = SAFE_REPLAY_FIELDS[normalizedType];
  const isSafe = Boolean(fields) && !UNSAFE_REPLAY_TYPES.has(normalizedType);
  const operations = isSafe
    ? fields
        .map((field) => buildFieldOperation(field, beforeStats?.[field], afterStats?.[field]))
        .filter(Boolean)
    : [];

  return {
    eventId: eventId || `state:${normalizedType || "unknown"}:${timestamp}`,
    type: normalizedType || "UNKNOWN",
    timestamp,
    safe: isSafe,
    operations,
  };
}

function applyNumericBounds(field, value, stats) {
  const nonNegativeFields = new Set([
    "fullness",
    "weight",
    "strength",
    "energy",
    "proteinOverdose",
    "consecutiveMeatFed",
    "overfeeds",
    "trainings",
    "effort",
    "poopCount",
    "poopPenaltyFrozenDurationMs",
  ]);
  let nextValue = nonNegativeFields.has(field) ? Math.max(0, value) : value;

  if (field === "strength" || field === "effort") nextValue = Math.min(5, nextValue);
  if (field === "proteinOverdose") nextValue = Math.min(7, nextValue);
  if (field === "fullness") nextValue = Math.min(5 + (stats.maxOverfeed || 0), nextValue);
  if (field === "energy") {
    const maxEnergy = stats.maxEnergy ?? stats.maxStamina;
    if (Number.isFinite(maxEnergy)) nextValue = Math.min(maxEnergy, nextValue);
  }

  return nextValue;
}

export function replaySafeActions(remoteStats = {}, actions = []) {
  const orderedActions = [...(actions || [])].sort(
    (left, right) => (left.timestamp || 0) - (right.timestamp || 0)
  );
  const unsafeAction = orderedActions.find((action) => !action?.safe);
  if (unsafeAction) {
    return {
      status: "conflict",
      stats: remoteStats,
      unsafeAction,
    };
  }

  const nextStats = { ...remoteStats };
  orderedActions.forEach((action) => {
    (action.operations || []).forEach((operation) => {
      if (operation.kind === "delta") {
        const currentValue = Number(nextStats[operation.field]) || 0;
        nextStats[operation.field] = applyNumericBounds(
          operation.field,
          currentValue + operation.value,
          nextStats
        );
      } else if (operation.kind === "set") {
        nextStats[operation.field] = operation.value;
      }
    });
  });

  return {
    status: "replayed",
    stats: nextStats,
    unsafeAction: null,
  };
}

function hasOwn(value, key) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

/**
 * legacy snapshot 저장이 care projection과 transition identity를 덮어쓰지
 * 않도록 transaction 시점의 원격 값을 다시 주입합니다.
 *
 * @param {Object} updateData
 * @param {Object} remoteData
 * @returns {Object}
 */
export function protectCareMistakeProjection(updateData = {}, remoteData = {}) {
  const safeUpdateData = { ...(updateData || {}) };
  CARE_MISTAKE_PROJECTION_FIELDS.forEach((field) => {
    if (hasOwn(remoteData, field)) {
      safeUpdateData[field] = remoteData[field];
    } else {
      delete safeUpdateData[field];
    }
  });

  const remoteStats = remoteData?.digimonStats;
  if (hasOwn(updateData, "digimonStats") && updateData.digimonStats &&
      typeof updateData.digimonStats === "object" && !Array.isArray(updateData.digimonStats)) {
    const safeStats = { ...updateData.digimonStats };
    delete safeStats.careMistakeLedger;
    CARE_MISTAKE_PROJECTION_FIELDS
      .filter((field) => field !== "careMistakeReconciliationChecksum" && field !== "lastGameTransitionId")
      .forEach((field) => {
        if (hasOwn(remoteStats, field)) {
          safeStats[field] = remoteStats[field];
        } else {
          delete safeStats[field];
        }
      });
    safeUpdateData.digimonStats = safeStats;
  }

  return safeUpdateData;
}

export async function commitRevisionedSlot({
  db,
  slotRef,
  baseRevision,
  updateData,
  runTransaction,
  activityEvents = [],
  activityLogIdentity = {},
}) {
  return runTransaction(db, async (transaction) => {
    const slotSnapshot = await transaction.get(slotRef);
    const remoteData = slotSnapshot.exists() ? slotSnapshot.data() : {};
    const actualRevision = normalizeGameRevision(remoteData?.revision);
    const expectedRevision = normalizeGameRevision(baseRevision);

    if (actualRevision !== expectedRevision) {
      throw new GameRevisionConflictError({
        expectedRevision,
        actualRevision,
        remoteData,
      });
    }

    const nextRevision = actualRevision + 1;
    (Array.isArray(activityEvents) ? activityEvents : []).forEach((event) => {
      if (!event?.eventId) return;
      transaction.set(
        doc(collection(slotRef, "logs"), String(event.eventId)),
        {
          ...event,
          eventId: String(event.eventId),
          ...(activityLogIdentity.slotInstanceId
            ? { slotInstanceId: activityLogIdentity.slotInstanceId }
            : {}),
          ...(activityLogIdentity.digimonInstanceId
            ? { digimonInstanceId: activityLogIdentity.digimonInstanceId }
            : {}),
        },
        { merge: true }
      );
    });
    transaction.update(slotRef, {
      ...protectCareMistakeProjection(updateData, remoteData),
      revision: nextRevision,
    });
    return { revision: nextRevision };
  });
}
