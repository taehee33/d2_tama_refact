import { initializeStats } from "../../data/stats";
import { checkEvolution } from "../../logic/evolution/checker";
import {
  buildEvolutionStatsForCheck,
  getNormalEvolutionCandidates,
  isIgnoringAllEvolutionConditions,
} from "../../logic/evolution/developerOptions";
import { getStarterDigimonId } from "../../utils/digimonVersionUtils";

const PERFECT_STAGES = ["Perfect", "Ultimate", "SuperUltimate"];

export function normalizeDigimonLookupId(digimonId) {
  return typeof digimonId === "string" ? digimonId.trim() : digimonId;
}

export function resolveDigimonDataFromMap(dataMap = {}, digimonId) {
  const normalizedId = normalizeDigimonLookupId(digimonId);

  if (!normalizedId || !dataMap || typeof dataMap !== "object") {
    return null;
  }

  if (dataMap[normalizedId]) {
    return {
      key: normalizedId,
      data: dataMap[normalizedId],
    };
  }

  const matchedKey = Object.keys(dataMap).find((key) => {
    const entry = dataMap[key];
    return entry?.id === normalizedId;
  });

  if (matchedKey) {
    return {
      key: matchedKey,
      data: dataMap[matchedKey],
    };
  }

  return null;
}

export function buildEvolutionButtonPresentation({
  hasNormalEvolution,
  isEvoEnabled,
  isEvolving,
}) {
  const isAvailable =
    hasNormalEvolution && isEvoEnabled && !isEvolving;

  return {
    isAvailable,
    label: isAvailable ? "진화!" : "진화?",
  };
}

export function buildResetDigimonState({
  currentStats,
  normalizedSlotVersion,
  digimonDataForSlot,
  now = () => Date.now(),
}) {
  const nowMs = now();
  const isPerfectStage = PERFECT_STAGES.includes(currentStats.evolutionStage);
  const updatedStats = {
    ...currentStats,
    totalReincarnations: (currentStats.totalReincarnations || 0) + 1,
    isDead: false,
    diedAt: null,
    age: 0,
    birthTime: nowMs,
    lastHungerZeroAt: null,
    hungerZeroFrozenDurationMs: 0,
    lastStrengthZeroAt: null,
    strengthZeroFrozenDurationMs: 0,
    injuredAt: null,
    injuryFrozenDurationMs: 0,
    isInjured: false,
    poopCount: 0,
    poopReachedMaxAt: null,
    lastPoopPenaltyAt: null,
    poopPenaltyFrozenDurationMs: 0,
  };

  if (isPerfectStage) {
    updatedStats.perfectReincarnations =
      (currentStats.perfectReincarnations || 0) + 1;
  } else {
    updatedStats.normalReincarnations =
      (currentStats.normalReincarnations || 0) + 1;
  }

  const initialDigimonId = getStarterDigimonId(normalizedSlotVersion);
  const inheritedLineageStats = {
    birthTime: nowMs,
    totalReincarnations: updatedStats.totalReincarnations,
    normalReincarnations: updatedStats.normalReincarnations,
    perfectReincarnations: updatedStats.perfectReincarnations,
    isNocturnal: Boolean(currentStats.isNocturnal),
  };
  const nextStats = initializeStats(
    initialDigimonId,
    inheritedLineageStats,
    digimonDataForSlot
  );

  Object.assign(nextStats, {
    isDead: false,
    deathReason: null,
    diedAt: null,
    age: 0,
    birthTime: nowMs,
    evolutionStageStartedAt: nowMs,
    lastSavedAt: new Date(nowMs),
    lifespanSeconds: 0,
    fullness: 0,
    strength: 0,
    effort: 0,
    careMistakes: 0,
    careMistakeLedger: [],
    trainings: 0,
    overfeeds: 0,
    consecutiveMeatFed: 0,
    proteinOverdose: 0,
    sleepDisturbances: 0,
    battlesForEvolution: 0,
    battles: 0,
    battlesWon: 0,
    battlesLost: 0,
    winRate: 0,
    totalBattles: 0,
    totalBattlesWon: 0,
    totalBattlesLost: 0,
    totalWinRate: 0,
    activityLogs: [],
    battleLogs: [],
    lastHungerZeroAt: null,
    hungerZeroFrozenDurationMs: 0,
    hungerMistakeDeadline: null,
    lastStrengthZeroAt: null,
    strengthZeroFrozenDurationMs: 0,
    strengthMistakeDeadline: null,
    injuredAt: null,
    injuryFrozenDurationMs: 0,
    isInjured: false,
    injuries: 0,
    healedDosesCurrent: 0,
    injuryReason: null,
    poopCount: 0,
    poopReachedMaxAt: null,
    lastPoopPenaltyAt: null,
    poopPenaltyFrozenDurationMs: 0,
    fastSleepStart: null,
    napUntil: null,
    wakeUntil: null,
    sleepLightOnStart: null,
    isFrozen: false,
    frozenAt: null,
    takeOutAt: null,
  });

  return {
    initialDigimonId,
    nextStats,
  };
}

export function shouldEnableEvolutionButton({
  isLoadingSlot,
  digimonStats,
  developerMode,
  ignoreEvolutionTime,
  selectedDigimon,
  evolutionDataForSlot,
  checkEvolutionFn = checkEvolution,
}) {
  if (isLoadingSlot) {
    return false;
  }

  if (digimonStats.isDead && !developerMode) {
    return false;
  }

  const resolvedCurrentDigimon = resolveDigimonDataFromMap(
    evolutionDataForSlot,
    selectedDigimon
  );
  const currentDigimonData = resolvedCurrentDigimon?.data;
  const currentDigimonKey = resolvedCurrentDigimon?.key || selectedDigimon;

  if (isIgnoringAllEvolutionConditions(developerMode, ignoreEvolutionTime)) {
    return getNormalEvolutionCandidates(currentDigimonData, evolutionDataForSlot).length > 0;
  }

  if (currentDigimonData?.evolutions) {
    const evolutionResult = checkEvolutionFn(
      buildEvolutionStatsForCheck(digimonStats, developerMode),
      currentDigimonData,
      currentDigimonKey,
      evolutionDataForSlot
    );

    if (evolutionResult.success) {
      return true;
    }
  }

  return false;
}
