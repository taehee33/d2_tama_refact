import { calculateRealtimeArenaDamage, getRealtimeArenaAttributeBonus } from "./damage";
import { resolveRealtimeArenaRound } from "./resolveRound";
import { createRealtimeArenaRulesSnapshot, REALTIME_ARENA_RULESETS } from "./rulesets";

const rules = createRealtimeArenaRulesSnapshot();
const adult = (overrides = {}) => ({ stage: "Adult", attribute: "Free", sourcePower: 50, maxHp: 13, ...overrides });
const state = (overrides = {}) => ({
  participants: { host: adult(), guest: adult() },
  currentHp: { host: 13, guest: 13 },
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
  });

  test.each([
    ["attack", "attack", 3, 3],
    ["attack", "guard", 0, 0],
    ["attack", "special_attack", 1, 3],
    ["guard", "attack", 0, 0],
    ["guard", "guard", 0, 0],
    ["guard", "special_attack", 2, 0],
    ["special_attack", "attack", 3, 1],
    ["special_attack", "guard", 0, 2],
    ["special_attack", "special_attack", 4, 4],
  ])("Adult 중립 %s 대 %s", (hostAction, guestAction, hostTaken, guestTaken) => {
    const result = resolveRealtimeArenaRound({ battleState: state(), hostAction, guestAction, rules });
    expect(result.hostDamageTaken).toBe(hostTaken);
    expect(result.guestDamageTaken).toBe(guestTaken);
  });

  test("속성 보너스는 Vaccine > Virus 단방향이고 Free는 중립이다", () => {
    expect(getRealtimeArenaAttributeBonus("Vaccine", "Virus", rules)).toBe(1);
    expect(getRealtimeArenaAttributeBonus("Virus", "Vaccine", rules)).toBe(0);
    expect(getRealtimeArenaAttributeBonus("Vaccine", "Free", rules)).toBe(0);
  });

  test.each([[-1, 0], [0, 0], [24, 0], [25, 1], [99, 1], [100, 2]])("power gap %i", (gap, expected) => {
    const damage = calculateRealtimeArenaDamage({ attacker: adult({ sourcePower: 50 + gap }), defender: adult(), rules });
    expect(damage.powerGapAttack).toBe(expected);
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
    const result = resolveRealtimeArenaRound({ battleState: state({ timeoutStreaks: { host: 1, guest: 0 } }), hostAction: "no_action", guestAction: "guard", rules });
    expect(result.result).toEqual({ outcome: "guest_win", reason: "timeout" });
  });

  test("양쪽의 두 번째 연속 no_action은 무승부다", () => {
    const result = resolveRealtimeArenaRound({ battleState: state({ timeoutStreaks: { host: 1, guest: 1 } }), hostAction: "no_action", guestAction: "no_action", rules });
    expect(result.result).toEqual({ outcome: "draw", reason: "double_timeout" });
  });
});
