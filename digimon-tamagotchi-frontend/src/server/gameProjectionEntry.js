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
  CARE_MISTAKE_EFFECTIVE_INTEGRITY,
  CARE_MISTAKE_V2_CLASSIFICATION,
  CARE_MISTAKE_V2_DIAGNOSTIC,
  CARE_MISTAKE_V2_REPAIR_LIMIT,
  CARE_MISTAKE_V2_SCHEMA_VERSION,
  classifyCareMistakeSlotV2,
  isNonNegativeInteger,
  resolveCareMistakeV2Identity,
  resolveEffectiveCareMistakeIntegrity,
  validateCareMistakeV2Projection,
} from "../logic/stats/careMistakeV2Domain";
export {
  CARE_MISTAKE_CHAIN_DIAGNOSTIC,
  CARE_MISTAKE_CHAIN_STATUS,
  CARE_MISTAKE_EPOCH_OPERATION,
  CARE_MISTAKE_ORDERING_STATUS,
  advanceCareMistakeRevision,
  auditCareMistakeFullChain,
  buildLinkedHeadRepairPlan,
  compareCareMistakeIncidentOrder,
  selectCareMistakeV2UnresolvedIncidents,
  snapshotLinkedHeadProtectedFields,
  validateCareMistakeIncidentOrdering,
} from "../logic/stats/careMistakeV2Chain";
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
