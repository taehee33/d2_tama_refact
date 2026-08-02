export const DEFAULT_REALTIME_ARENA_RULES_VERSION = "mvp-2";

const MVP_0 = {
  schemaVersion: 1,
  maxRounds: 7,
  selectionWindowMs: 7000,
  eligibleStages: ["Child", "Adult", "Perfect", "Ultimate", "Super Ultimate"],
  matchingScope: "same_stage_only",
  hpByStage: { Child: 10, Adult: 13, Perfect: 16, Ultimate: 19, "Super Ultimate": 20 },
  baseAttackByStage: { Child: 2, Adult: 3, Perfect: 4, Ultimate: 5, "Super Ultimate": 5 },
  powerGap: { formulaId: "floor_sqrt_positive_gap_over_unit", unit: 25 },
  attribute: {
    formulaId: "one_way_cycle_bonus",
    advantageBonus: 1,
    disadvantagePenalty: 0,
    freeIsNeutral: true,
  },
  recovery: {
    guardVsAttack: 1,
  },
  timeout: { missingAction: "no_action", consecutiveLossCount: 2 },
};

const MVP_1 = {
  ...MVP_0,
  matchingScope: "eligible_stages",
};

const MVP_2 = {
  ...MVP_1,
  presentationWindowMs: 2200,
  initialSelectionCountdownMs: 2000,
  selectionMode: "latest_until_deadline",
  timeout: {
    missingAction: "deterministic_random",
    consecutiveLossCount: null,
  },
};

function deepFreeze(value) {
  Object.values(value).forEach((nested) => {
    if (nested && typeof nested === "object" && !Object.isFrozen(nested)) deepFreeze(nested);
  });
  return Object.freeze(value);
}

export const REALTIME_ARENA_RULESETS = deepFreeze({
  "mvp-0": MVP_0,
  "mvp-1": MVP_1,
  "mvp-2": MVP_2,
});

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

export function assertRealtimeArenaRules(rules) {
  if (!rules || rules.schemaVersion !== 1) throw new Error("지원하지 않는 실시간 아레나 규칙입니다.");
  if (rules.powerGap?.formulaId !== "floor_sqrt_positive_gap_over_unit") throw new Error("지원하지 않는 power gap 공식입니다.");
  if (rules.attribute?.formulaId !== "one_way_cycle_bonus") throw new Error("지원하지 않는 속성 공식입니다.");
  const guardRecovery = Number(rules.recovery?.guardVsAttack ?? 1);
  if (!Number.isFinite(guardRecovery) || guardRecovery < 0) throw new Error("방어 회복 규칙이 올바르지 않습니다.");
  if (!Number.isInteger(rules.maxRounds) || rules.maxRounds < 1 || rules.maxRounds > 7) throw new Error("라운드 제한이 올바르지 않습니다.");
  if (!Number.isFinite(rules.selectionWindowMs) || rules.selectionWindowMs < 1000) throw new Error("행동 선택 시간이 올바르지 않습니다.");
  if (
    rules.initialSelectionCountdownMs !== undefined &&
    (!Number.isFinite(rules.initialSelectionCountdownMs) || rules.initialSelectionCountdownMs < 0)
  ) throw new Error("첫 라운드 시작 대기 시간이 올바르지 않습니다.");
  if (rules.presentationWindowMs !== undefined && (!Number.isFinite(rules.presentationWindowMs) || rules.presentationWindowMs < 0)) {
    throw new Error("라운드 판정 연출 시간이 올바르지 않습니다.");
  }
  return rules;
}

export function createRealtimeArenaRulesSnapshot(version = DEFAULT_REALTIME_ARENA_RULES_VERSION) {
  const rules = REALTIME_ARENA_RULESETS[version];
  if (!rules) throw new Error(`알 수 없는 실시간 아레나 규칙 버전입니다: ${version}`);
  return clonePlain(assertRealtimeArenaRules(rules));
}
