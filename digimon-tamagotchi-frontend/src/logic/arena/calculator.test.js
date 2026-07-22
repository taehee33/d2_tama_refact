import {
  ARENA_BATTLE_RULES_VERSION,
  calculateArenaBattle,
  calculateArenaHitRate,
} from "./calculator";

describe("결정적 아레나 배틀", () => {
  const input = {
    seed: "fixed-seed",
    attacker: { name: "공격몬", power: 105, attribute: "Vaccine" },
    defender: { name: "방어몬", power: 101, attribute: "Virus" },
    battleRulesVersion: ARENA_BATTLE_RULES_VERSION,
  };

  test("같은 seed와 입력은 byte-equivalent 결과를 만든다", () => {
    expect(JSON.stringify(calculateArenaBattle(input))).toBe(
      JSON.stringify(calculateArenaBattle(input))
    );
  });

  test("속성 보너스를 적용하고 hit rate를 범위 안으로 제한한다", () => {
    expect(calculateArenaHitRate(0, 0, 5)).toBe(55);
    expect(calculateArenaHitRate(100, 0, 5)).toBe(100);
  });

  test("지원하지 않는 rules version은 거부한다", () => {
    expect(() => calculateArenaBattle({ ...input, battleRulesVersion: "future" })).toThrow(
      "지원하지 않는"
    );
  });
});
