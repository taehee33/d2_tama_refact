export { applyLazyUpdate, projectState } from "../data/stats";
export {
  ARENA_BATTLE_RULES_VERSION,
  calculateArenaBattle,
  calculateArenaHitRate,
  createSeededRandom,
} from "../logic/arena/calculator";
export { calculatePower } from "../logic/battle/hitrate";
export {
  findDigimonEntryAcrossVersions,
  getDigimonEntryByVersion,
  getStarterDigimonId,
  isStarterDigimonId,
  normalizeDigimonVersionLabel,
} from "../utils/digimonVersionUtils";
