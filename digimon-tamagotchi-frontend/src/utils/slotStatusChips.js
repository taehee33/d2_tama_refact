import { getDigimonEntryByVersion } from "./digimonVersionUtils";
import { evaluateDeathConditions } from "../logic/stats/death";

const MAX_VISIBLE_STATUS_CHIPS = 2;

function hasEvolutionCandidate(slot) {
  const digimonEntry = getDigimonEntryByVersion(slot?.version, slot?.selectedDigimon);
  return Array.isArray(digimonEntry?.evolutions) && digimonEntry.evolutions.length > 0;
}

const SLOT_STATUS_DEFINITIONS = [
  {
    id: "dead",
    label: "사망",
    tone: "danger",
    isActive: (stats) => Boolean(stats.isDead),
  },
  {
    id: "frozen",
    label: "냉장고 보관",
    tone: "cool",
    isActive: (stats) => Boolean(stats.isFrozen),
  },
  {
    id: "injured",
    label: "치료 필요",
    tone: "danger",
    isActive: (stats) => Boolean(stats.isInjured),
  },
  {
    id: "poop",
    label: "배변 주의",
    tone: "warning",
    isActive: (stats) => Number(stats.poopCount || 0) >= 6,
  },
  {
    id: "evolution",
    label: "진화 가능",
    tone: "accent",
    isActive: (stats, slot) =>
      hasEvolutionCandidate(slot) &&
      stats.timeToEvolveSeconds != null &&
      Number(stats.timeToEvolveSeconds) <= 0,
  },
];

function getProjectedStats(slot) {
  const projectedStats = slot?.projectedDigimonStats || slot?.digimonStats || {};
  const deathEvaluation = evaluateDeathConditions(projectedStats);

  if (deathEvaluation.isDead) {
    return {
      ...projectedStats,
      isDead: true,
      deathReason: projectedStats.deathReason || deathEvaluation.reason,
      diedAt: projectedStats.diedAt || deathEvaluation.diedAt,
    };
  }

  return projectedStats;
}

export function getSlotStatusChips(slot) {
  const stats = getProjectedStats(slot);

  return SLOT_STATUS_DEFINITIONS
    .filter((definition) => definition.isActive(stats, slot))
    .slice(0, MAX_VISIBLE_STATUS_CHIPS)
    .map(({ id, label, tone }) => ({ id, label, tone }));
}
