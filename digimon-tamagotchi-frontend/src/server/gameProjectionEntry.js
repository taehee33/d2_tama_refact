export { applyLazyUpdate, projectState } from "../data/stats";
export {
  ARENA_BATTLE_RULES_VERSION,
  calculateArenaBattle,
  calculateArenaHitRate,
  createSeededRandom,
} from "../logic/arena/calculator";
export { calculatePower } from "../logic/battle/hitrate";
export { formatKstTime } from "../utils/time";
export {
  DEFAULT_REALTIME_ARENA_RULES_VERSION,
  createRealtimeArenaRulesSnapshot,
  assertRealtimeArenaRules,
} from "../logic/realtime-arena/rulesets";
export { resolveRealtimeArenaRound } from "../logic/realtime-arena/resolveRound";
export {
  findDigimonEntryAcrossVersions,
  getDigimonEntryByVersion,
  getStarterDigimonId,
  isStarterDigimonId,
  normalizeDigimonVersionLabel,
} from "../utils/digimonVersionUtils";
