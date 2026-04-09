// Firestore에 영구 저장할 활동 로그 타입 정책
// write 절감 1차 단계에서는 핵심 이력만 남기고 반복성 높은 일반 액션 로그는 세션 내 메모리로만 유지한다.

import { buildActivityLogEventId } from "./activityLogEventId";

export const PERSISTED_ACTIVITY_LOG_TYPES = new Set([
  "CALL",
  "CAREMISTAKE",
  "CARE_MISTAKE",
  "SLEEP_DISTURBANCE",
  "SLEEP_START",
  "SLEEP_END",
  "POOP",
  "INJURY",
  "HEAL",
  "EVOLUTION",
  "REINCARNATION",
  "NEW_START",
  "DEATH",
  "FRIDGE",
]);

/**
 * Firestore 서브컬렉션에 남길 활동 로그인지 판별한다.
 * 핵심 케어/상태 전환/진화/사망 이력만 영구 저장하고,
 * 반복성 높은 일반 액션 로그는 세션 상태에서만 유지해 쓰기 수를 줄인다.
 *
 * @param {{ type?: string } | null | undefined} logEntry
 * @returns {boolean}
 */
export function shouldPersistActivityLog(logEntry) {
  const logType = logEntry?.type;
  if (!logType || typeof logType !== "string") {
    return false;
  }

  return PERSISTED_ACTIVITY_LOG_TYPES.has(logType);
}

export function buildPersistentActivityLogPayload(logEntry = {}) {
  const eventId = buildActivityLogEventId(logEntry);

  return {
    type: logEntry?.type,
    text: logEntry?.text ?? "",
    timestamp: logEntry?.timestamp ?? Date.now(),
    ...(eventId ? { eventId } : {}),
    ...(logEntry?.digimonId ? { digimonId: logEntry.digimonId } : {}),
    ...(logEntry?.digimonName ? { digimonName: logEntry.digimonName } : {}),
  };
}

export function getPersistentActivityLogDocId(logEntry) {
  return buildPersistentActivityLogPayload(logEntry).eventId || null;
}
