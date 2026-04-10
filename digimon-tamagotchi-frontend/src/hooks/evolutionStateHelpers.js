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

export function buildEvolutionTransitionState({
  currentStats = {},
  existingLogs = [],
  targetId,
  targetMap = {},
  logText,
  snapshotArgs = [],
}) {
  const targetDigimonData = targetMap[targetId] || {};
  const resetStats = buildEvolutionResetStats(currentStats, targetDigimonData);
  const nextStats = initializeStats(targetId, resetStats, targetMap);

  if (targetDigimonData?.sprite !== undefined) {
    nextStats.sprite = targetDigimonData.sprite;
  }

  const resultName = targetDigimonData.name || targetId;
  const updatedLogs = addActivityLog(
    Array.isArray(existingLogs) ? existingLogs : [],
    "EVOLUTION",
    logText || `Evolution: Evolved to ${resultName}!`,
    buildDigimonLogSnapshot(targetId, ...snapshotArgs)
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
