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

export async function commitRevisionedSlot({
  db,
  slotRef,
  baseRevision,
  updateData,
  runTransaction,
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
    transaction.update(slotRef, {
      ...updateData,
      revision: nextRevision,
    });
    return { revision: nextRevision };
  });
}
