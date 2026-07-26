/**
 * @typedef {Object} MutableStats
 * @property {number} [poopCount]
 * @property {number|null} [poopReachedMaxAt]
 * @property {number|null} [lastPoopPenaltyAt]
 * @property {boolean} [isInjured]
 * @property {number|null} [injuredAt]
 * @property {number} [healedDosesCurrent]
 * @property {boolean} [isNocturnal]
 */

/**
 * @param {{stats?: MutableStats, field: string, value: number|boolean, nowMs: number}} input
 * @returns {MutableStats}
 */
export function buildStatsPopupStatMutation({ stats = {}, field, value, nowMs }) {
  const previousPoopCount = stats.poopCount || 0;
  const nextStats = { ...stats, [field]: value };

  if (field === "poopCount") {
    if (previousPoopCount < 8 && value >= 8 && !nextStats.poopReachedMaxAt) {
      nextStats.poopReachedMaxAt = nowMs;
      nextStats.lastPoopPenaltyAt = nowMs;
    } else if (value < 8) {
      nextStats.poopReachedMaxAt = null;
      nextStats.lastPoopPenaltyAt = null;
    }
  }

  if (field === "isInjured" && value === true && !nextStats.injuredAt) {
    nextStats.injuredAt = nowMs;
  }
  if (field === "isInjured" && value === false) {
    nextStats.injuredAt = null;
    nextStats.healedDosesCurrent = 0;
  }

  return nextStats;
}

/**
 * @param {{
 *   stats?: MutableStats,
 *   activityLogs?: Array<Object>,
 *   nowMs: number,
 *   addActivityLogFn: (logs: Array<Object>, type: string, text: string, timestampMs: number) => Array<Object>,
 * }} input
 */
export function buildStatsPopupNocturnalMutation({
  stats = {},
  activityLogs = [],
  nowMs,
  addActivityLogFn,
}) {
  const isNocturnal = !stats.isNocturnal;
  const logText = isNocturnal
    ? "야행성 모드 ON: 수면/기상 시간이 3시간씩 미뤄집니다 🌙"
    : "야행성 모드 OFF: 일반 수면 시간으로 복귀합니다 ☀️";
  const updatedLogs = addActivityLogFn(activityLogs, "ACTION", logText, nowMs);

  return {
    nextStats: { ...stats, isNocturnal, activityLogs: updatedLogs },
    logPayload: updatedLogs[updatedLogs.length - 1],
  };
}
