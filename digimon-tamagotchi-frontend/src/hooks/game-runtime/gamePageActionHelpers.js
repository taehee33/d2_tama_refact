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
  const nextStats = initializeStats(
    initialDigimonId,
    updatedStats,
    digimonDataForSlot
  );

  nextStats.isDead = false;
  nextStats.diedAt = null;
  nextStats.age = 0;
  nextStats.birthTime = nowMs;
  nextStats.lastSavedAt = new Date(nowMs);
  nextStats.fullness = 0;
  nextStats.strength = 0;
  nextStats.lastHungerZeroAt = null;
  nextStats.hungerZeroFrozenDurationMs = 0;
  nextStats.lastStrengthZeroAt = null;
  nextStats.strengthZeroFrozenDurationMs = 0;
  nextStats.injuredAt = null;
  nextStats.injuryFrozenDurationMs = 0;
  nextStats.isInjured = false;
  nextStats.injuries = 0;
  nextStats.poopCount = 0;
  nextStats.poopReachedMaxAt = null;
  nextStats.lastPoopPenaltyAt = null;
  nextStats.poopPenaltyFrozenDurationMs = 0;

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
