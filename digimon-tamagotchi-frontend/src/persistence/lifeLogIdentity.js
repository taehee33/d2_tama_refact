import { toEpochMs } from "../utils/time";

export const LOG_IDENTITY_SCHEMA_VERSION = 1;

export const LIFE_LOG_CLASSIFICATION = Object.freeze({
  CURRENT: "current",
  LEGACY_CURRENT: "legacy-current",
  OTHER: "other",
});

export function classifyLifeLogEntry(entry = {}, {
  slotInstanceId,
  digimonInstanceId,
  currentLifeStartedAt = null,
  slotCreatedAt = null,
  allowLegacy = false,
} = {}) {
  const hasSlotIdentity = typeof entry.slotInstanceId === "string" && entry.slotInstanceId.trim();
  const hasDigimonIdentity =
    typeof entry.digimonInstanceId === "string" && entry.digimonInstanceId.trim();

  if (hasSlotIdentity || hasDigimonIdentity) {
    return entry.slotInstanceId === slotInstanceId &&
      entry.digimonInstanceId === digimonInstanceId
      ? LIFE_LOG_CLASSIFICATION.CURRENT
      : LIFE_LOG_CLASSIFICATION.OTHER;
  }

  if (!allowLegacy) return LIFE_LOG_CLASSIFICATION.OTHER;

  const timestamp = toEpochMs(entry.timestamp);
  const lifeStartedAt = toEpochMs(currentLifeStartedAt);
  const createdAt = toEpochMs(slotCreatedAt);
  if (timestamp != null && lifeStartedAt != null && timestamp < lifeStartedAt) {
    return LIFE_LOG_CLASSIFICATION.OTHER;
  }
  if (timestamp != null && createdAt != null && timestamp < createdAt) {
    return LIFE_LOG_CLASSIFICATION.OTHER;
  }
  return LIFE_LOG_CLASSIFICATION.LEGACY_CURRENT;
}

/**
 * 입력 순서를 유지한 채 현재 생애 기록만 고르고 legacy backfill 대상도 함께 반환합니다.
 */
export function selectCurrentLifeLogs(entries = [], options = {}) {
  const maxCount = Number.isSafeInteger(options.maxCount) && options.maxCount >= 0
    ? options.maxCount
    : 50;
  const currentEntries = [];
  const legacyEntries = [];

  for (const entry of Array.isArray(entries) ? entries : []) {
    const classification = classifyLifeLogEntry(entry, options);
    if (classification === LIFE_LOG_CLASSIFICATION.OTHER) continue;
    if (classification === LIFE_LOG_CLASSIFICATION.LEGACY_CURRENT) {
      legacyEntries.push(entry);
    }
    if (currentEntries.length < maxCount) currentEntries.push(entry);
  }

  return { currentEntries, legacyEntries };
}

export function buildCurrentLifeLogIdentityPatch({
  slotInstanceId,
  digimonInstanceId,
} = {}) {
  if (!slotInstanceId || !digimonInstanceId) {
    throw new TypeError("로그 생애 identity가 필요합니다.");
  }
  return {
    logIdentitySchemaVersion: LOG_IDENTITY_SCHEMA_VERSION,
    slotInstanceId,
    digimonInstanceId,
  };
}
