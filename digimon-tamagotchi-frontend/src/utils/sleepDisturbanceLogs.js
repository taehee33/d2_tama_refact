import { toEpochMs } from "./time";

/** 신규 타입과 레거시 케어미스 타입의 수면 방해 로그를 판별합니다. */
export function isSleepDisturbanceLog(log) {
  if (!log) return false;
  if (log.type === "SLEEP_DISTURBANCE") return true;

  const text = (log.text || "").trim();
  if (!text.includes("수면 방해")) return false;
  return log.type === "CARE_MISTAKE" || log.type === "CAREMISTAKE";
}

/**
 * 현재 진화 구간의 수면 방해 로그를 최신순으로 선택합니다.
 * 단계 시작 시각을 알 수 없는 레거시 슬롯은 보유 중인 전체 수면 방해 로그를 반환합니다.
 *
 * @param {{activityLogs?: Array<Object>, currentStageStartedAt?: unknown}} input
 * @returns {{logs: Array<Object>, isLegacyRange: boolean}}
 */
export function selectCurrentStageSleepDisturbanceLogs({
  activityLogs = [],
  currentStageStartedAt = null,
} = {}) {
  const stageStartedAtMs = toEpochMs(currentStageStartedAt);
  const hasStageBoundary = stageStartedAtMs != null;
  const sourceLogs = Array.isArray(activityLogs) ? activityLogs : [];

  const logs = sourceLogs
    .filter(isSleepDisturbanceLog)
    .map((log) => ({ log, timestampMs: toEpochMs(log?.timestamp) }))
    .filter(({ timestampMs }) => (
      timestampMs != null && (!hasStageBoundary || timestampMs >= stageStartedAtMs)
    ))
    .sort((left, right) => right.timestampMs - left.timestampMs)
    .map(({ log }) => log);

  return {
    logs,
    isLegacyRange: !hasStageBoundary,
  };
}
