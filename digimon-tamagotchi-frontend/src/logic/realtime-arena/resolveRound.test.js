import { calculateRealtimeArenaDamage, getRealtimeArenaAttributeBonus } from "./damage";
import { resolveRealtimeArenaRound } from "./resolveRound";
import { createRealtimeArenaRulesSnapshot, REALTIME_ARENA_RULESETS } from "./rulesets";

const rules = createRealtimeArenaRulesSnapshot();
const legacyRules = createRealtimeArenaRulesSnapshot("mvp-1");
const adult = (overrides = {}) => ({ stage: "Adult", attribute: "Free", sourcePower: 50, maxHp: 13, ...overrides });
const state = (overrides = {}) => ({
  participants: { host: adult(), guest: adult() },
  currentHp: { host: 12, guest: 12 },
  timeoutStreaks: { host: 0, guest: 0 },
  round: 1,
  ...overrides,
});

describe("실시간 아레나 규칙", () => {
  test("registry와 중첩 규칙은 배포 후 변경할 수 없도록 고정한다", () => {
    expect(Object.isFrozen(REALTIME_ARENA_RULESETS)).toBe(true);
    expect(Object.isFrozen(REALTIME_ARENA_RULESETS["mvp-0"].hpByStage)).toBe(true);
  });

  test("mvp-0은 같은 단계 규칙을 보존하고 mvp-1은 성장기 이상 전체로 확장한다", () => {
    expect(REALTIME_ARENA_RULESETS["mvp-0"].matchingScope).toBe("same_stage_only");
    expect(REALTIME_ARENA_RULESETS["mvp-1"].matchingScope).toBe("eligible_stages");
    expect(REALTIME_ARENA_RULESETS["mvp-2"].selectionMode).toBe("latest_until_deadline");
    expect(REALTIME_ARENA_RULESETS["mvp-2"].specialAttack).toBeUndefined();
    expect(REALTIME_ARENA_RULESETS["mvp-2"].recovery.guardVsAttack).toBe(1);
  });

  test.each([
    ["attack", "attack", 3, 3, 0, 0, "hit", "hit"],
    ["attack", "guard", 0, 0, 0, 1, "blocked", "guard_success"],
    ["attack", "special_attack", 0, 3, 0, 0, "hit", "interrupted"],
    ["guard", "attack", 0, 0, 1, 0, "guard_success", "blocked"],
    ["guard", "guard", 0, 0, 0, 0, "none", "none"],
    ["guard", "special_attack", 3, 0, 0, 0, "breached", "hit"],
    ["special_attack", "attack", 3, 0, 0, 0, "interrupted", "hit"],
    ["special_attack", "guard", 0, 3, 0, 0, "hit", "breached"],
    ["special_attack", "special_attack", 3, 3, 0, 0, "hit", "hit"],
  ])("Adult 중립 %s 대 %s", (hostAction, guestAction, hostTaken, guestTaken, hostRecovered, guestRecovered, hostResult, guestResult) => {
    const result = resolveRealtimeArenaRound({ battleState: state(), hostAction, guestAction, rules });
    expect(result.hostDamageTaken).toBe(hostTaken);
    expect(result.guestDamageTaken).toBe(guestTaken);
    expect(result.hostHpRecovered).toBe(hostRecovered);
    expect(result.guestHpRecovered).toBe(guestRecovered);
    expect(result.hostActionResult).toBe(hostResult);
    expect(result.guestActionResult).toBe(guestResult);
  });

  test("방어가 속공을 막으면 HP를 1 회복하고 최대 HP를 넘지 않는다", () => {
    const result = resolveRealtimeArenaRound({
      battleState: state({ currentHp: { host: 12, guest: 13 } }),
      hostAction: "guard",
      guestAction: "attack",
      rules,
    });
    expect(result.currentHp).toEqual({ host: 13, guest: 13 });
    expect(result.hostHpRecovered).toBe(1);
  });

  test("이미 최대 HP인 방어 성공은 회복량이 0이다", () => {
    const result = resolveRealtimeArenaRound({
      battleState: state({ currentHp: { host: 13, guest: 13 } }),
      hostAction: "guard",
      guestAction: "attack",
      rules,
    });
    expect(result.currentHp).toEqual({ host: 13, guest: 13 });
    expect(result.hostHpRecovered).toBe(0);
  });

  test("속성 보너스는 Vaccine > Virus 단방향이고 Free는 중립이다", () => {
    expect(getRealtimeArenaAttributeBonus("Vaccine", "Virus", rules)).toBe(1);
    expect(getRealtimeArenaAttributeBonus("Virus", "Vaccine", rules)).toBe(0);
    expect(getRealtimeArenaAttributeBonus("Vaccine", "Free", rules)).toBe(0);
  });

  test.each([[-1, 0], [0, 0], [24, 0], [25, 1], [99, 1], [100, 2]])("power gap %i", (gap, expected) => {
    const damage = calculateRealtimeArenaDamage({ attacker: adult({ sourcePower: 50 + gap }), defender: adult(), rules });
    expect(damage.powerGapAttack).toBe(expected);
    expect(damage.attackPower).toBe(3 + expected);
    expect(damage).not.toHaveProperty("special");
  });

  test("서로 다른 최대 HP는 남은 HP 비율의 교차곱으로 판정한다", () => {
    const result = resolveRealtimeArenaRound({
      battleState: state({
        participants: { host: adult({ stage: "Child", maxHp: 10 }), guest: adult({ maxHp: 13 }) },
        currentHp: { host: 7, guest: 9 },
        round: 7,
      }),
      hostAction: "guard",
      guestAction: "guard",
      rules,
    });
    expect(result.result).toEqual({ outcome: "host_win", reason: "max_round" });
  });

  test("같은 참가자의 두 번째 연속 no_action은 패배다", () => {
    const result = resolveRealtimeArenaRound({ battleState: state({ timeoutStreaks: { host: 1, guest: 0 } }), hostAction: "no_action", guestAction: "guard", rules: legacyRules });
    expect(result.result).toEqual({ outcome: "guest_win", reason: "timeout" });
  });

  test("양쪽의 두 번째 연속 no_action은 무승부다", () => {
    const result = resolveRealtimeArenaRound({ battleState: state({ timeoutStreaks: { host: 1, guest: 1 } }), hostAction: "no_action", guestAction: "no_action", rules: legacyRules });
    expect(result.result).toEqual({ outcome: "draw", reason: "double_timeout" });
  });

  test("mvp-2는 시간 초과 연속 패배를 적용하지 않는다", () => {
    const result = resolveRealtimeArenaRound({ battleState: state({ timeoutStreaks: { host: 2, guest: 0 } }), hostAction: "attack", guestAction: "guard", rules });
    expect(result.result).toBeNull();
  });
});
