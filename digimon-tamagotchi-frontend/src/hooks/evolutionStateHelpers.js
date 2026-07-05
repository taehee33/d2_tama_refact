import { initializeStats } from "../data/stats";
import { buildDigimonLogSnapshot } from "../utils/digimonLogSnapshot";
import { addActivityLog } from "./useGameLogic";

export function buildEvolutionResetStats(currentStats = {}, targetDigimonData = {}) {
  const minWeight =
    targetDigimonData.stats?.minWeight ??
    targetDigimonData.minWeight ??
    0;
  const maxEnergy =
    targetDigimonData.stats?.maxEnergy ??
    targetDigimonData.stats?.maxStamina ??
    targetDigimonData.maxEnergy ??
    targetDigimonData.maxStamina ??
    0;

  return {
    ...currentStats,
    careMistakes: 0,
    overfeeds: 0,
    proteinOverdose: 0,
    trainings: 0,
    sleepDisturbances: 0,
    strength: 0,
    effort: 0,
    energy: maxEnergy,
    weight: minWeight,
    battles: 0,
    battlesWon: 0,
    battlesLost: 0,
    winRate: 0,
  };
}

export function buildEvolutionActivityLogEventId(transitionId) {
  const normalizedTransitionId =
    typeof transitionId === "string" ? transitionId.trim() : "";
  return normalizedTransitionId ? `activity:evolution:${normalizedTransitionId}` : null;
}

export function buildEvolutionTransitionState({
  currentStats = {},
  existingLogs = [],
  targetId,
  targetMap = {},
  logText,
  snapshotArgs = [],
  transitionId,
  eventId,
}) {
  const targetDigimonData = targetMap[targetId] || {};
  const resetStats = buildEvolutionResetStats(currentStats, targetDigimonData);
  const nextStats = initializeStats(targetId, resetStats, targetMap);

  if (targetDigimonData?.sprite !== undefined) {
    nextStats.sprite = targetDigimonData.sprite;
  }

  const resultName = targetDigimonData.name || targetId;
  const normalizedTransitionId =
    typeof transitionId === "string" ? transitionId.trim() : "";
  const normalizedEventId =
    normalizedTransitionId && typeof eventId === "string" ? eventId.trim() : "";
  const evolutionEventId =
    normalizedEventId || buildEvolutionActivityLogEventId(normalizedTransitionId);
  const logSnapshot = {
    ...buildDigimonLogSnapshot(targetId, ...snapshotArgs),
    ...(normalizedTransitionId ? { transitionId: normalizedTransitionId } : {}),
    ...(evolutionEventId ? { eventId: evolutionEventId } : {}),
  };
  const updatedLogs = addActivityLog(
    Array.isArray(existingLogs) ? existingLogs : [],
    "EVOLUTION",
    logText || `Evolution: Evolved to ${resultName}!`,
    logSnapshot
  );

  return {
    targetDigimonData,
    resultName,
    nextStats,
    updatedLogs,
    nextStatsWithLogs: {
      ...nextStats,
      activityLogs: updatedLogs,
      selectedDigimon: targetId,
    },
  };
}
