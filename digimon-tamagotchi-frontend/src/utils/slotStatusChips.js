import { getDigimonEntryByVersion } from "./digimonVersionUtils";
import { evaluateDeathConditions } from "../logic/stats/death";
import {
  buildDigimonStatusMessages,
  getSummaryDigimonStatusMessages,
} from "../components/digimonStatusMessages";
import { isTimeWithinSleepSchedule } from "./sleepUtils";
import { toEpochMs } from "./time";

const MAX_VISIBLE_STATUS_CHIPS = 3;

const STATUS_CATEGORY_TO_TONE = {
  critical: "danger",
  warning: "warning",
  action: "cool",
  info: "cool",
  good: "accent",
};

function normalizeStatsForStatusMessages(stats = {}) {
  return {
    ...stats,
    fullness: stats.fullness ?? 2,
    strength: stats.strength ?? 2,
    poopCount: stats.poopCount ?? 0,
    injuries: stats.injuries ?? 0,
    proteinOverdose: stats.proteinOverdose ?? 0,
  };
}

function hasEvolutionCandidate(slot) {
  const digimonEntry = getDigimonEntryByVersion(slot?.version, slot?.selectedDigimon);
  return Array.isArray(digimonEntry?.evolutions) && digimonEntry.evolutions.length > 0;
}

export function getProjectedSlotStats(slot) {
  const projectedStats = slot?.projectedDigimonStats || slot?.digimonStats || {};
  const deathEvaluation = evaluateDeathConditions(projectedStats);

  if (deathEvaluation.isDead) {
    return normalizeStatsForStatusMessages({
      ...projectedStats,
      isDead: true,
      deathReason: projectedStats.deathReason || deathEvaluation.reason,
      diedAt: projectedStats.diedAt || deathEvaluation.diedAt,
    });
  }

  return normalizeStatsForStatusMessages(projectedStats);
}

function resolveSlotSleepStatus(slot, stats, nowMs) {
  if (stats?.isFrozen) return "AWAKE";

  const wakeUntil = toEpochMs(stats?.wakeUntil ?? slot?.wakeUntil);
  if (wakeUntil != null && nowMs < wakeUntil) return "AWAKE_INTERRUPTED";

  const napUntil = toEpochMs(stats?.napUntil ?? slot?.napUntil);
  if (napUntil != null && nowMs < napUntil) return "NAPPING";

  if (stats?.fastSleepStart && stats?.isLightsOn === false) {
    return "FALLING_ASLEEP";
  }

  const sleepSchedule = stats?.sleepSchedule;
  if (sleepSchedule && isTimeWithinSleepSchedule(sleepSchedule, new Date(nowMs))) {
    const isLightsOn = slot?.isLightsOn ?? stats?.isLightsOn ?? true;
    return isLightsOn ? "SLEEPING_LIGHT_ON" : "SLEEPING";
  }

  return "AWAKE";
}

export function getSlotStatusMessages(slot, { currentTime = Date.now(), limit = MAX_VISIBLE_STATUS_CHIPS } = {}) {
  if (!slot) return [];
  const stats = getProjectedSlotStats(slot);
  const nowMs = toEpochMs(currentTime) ?? Date.now();
  const sleepStatus = resolveSlotSleepStatus(slot, stats, nowMs);
  const messages = buildDigimonStatusMessages({
    digimonStats: stats,
    sleepStatus,
    isDead: Boolean(stats.isDead),
    canEvolve:
      hasEvolutionCandidate(slot) &&
      stats.timeToEvolveSeconds != null &&
      Number(stats.timeToEvolveSeconds) <= 0,
    sleepSchedule: stats.sleepSchedule || null,
    wakeUntil: stats.wakeUntil ?? slot.wakeUntil ?? null,
    sleepLightOnStart: stats.sleepLightOnStart ?? null,
    deathReason: stats.deathReason || null,
    currentTime: nowMs,
  });

  return getSummaryDigimonStatusMessages(messages, limit);
}

export function getSlotStatusChips(slot) {
  return getSlotStatusMessages(slot).map((message) => ({
    id: message.id,
    label: message.text,
    tone: STATUS_CATEGORY_TO_TONE[message.category] || "cool",
  }));
}
