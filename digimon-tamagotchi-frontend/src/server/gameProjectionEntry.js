export { applyLazyUpdate, initializeStats, projectState } from "../data/stats";
export { adaptDataMapToOldFormat } from "../data/v1/adapter";
export {
  getJogressResult,
  resolveOnlineJogressPair,
} from "../logic/evolution/jogress";
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
  createRealtimeArenaCpuCandidates,
  selectRealtimeArenaCpuAction,
  selectRealtimeArenaFallbackAction,
  selectRealtimeArenaCpuOpponent,
} from "../logic/realtime-arena/cpu";
export {
  findDigimonEntryAcrossVersions,
  getDigimonDataMapByVersion,
  getDigimonEntryByVersion,
  getStarterDigimonId,
  isStarterDigimonId,
  normalizeDigimonVersionLabel,
} from "../utils/digimonVersionUtils";
