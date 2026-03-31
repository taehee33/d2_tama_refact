import {
  calculateHitrate,
  calculateInjuryChance,
  calculatePower,
  getAttributeAdvantage,
} from "./hitrate";

describe("battle/hitrate", () => {
  test("속성 상성은 유리하면 +5, 불리하면 -5, Free면 0을 반환한다", () => {
    expect(getAttributeAdvantage("Vaccine", "Virus")).toBe(5);
    expect(getAttributeAdvantage("Virus", "Vaccine")).toBe(-5);
    expect(getAttributeAdvantage("Free", "Virus")).toBe(0);
    expect(getAttributeAdvantage("Data", "Data")).toBe(0);
  });

  test("calculateHitrate는 파워 비율과 속성 상성을 함께 반영한다", () => {
    const result = calculateHitrate(
      { power: 30, type: "Vaccine" },
      { power: 20, type: "Virus" }
    );

    expect(result).toBeCloseTo(65, 5);
  });

  test("calculatePower는 strength, traitedEgg, effort 보너스를 스테이지 기준으로 합산하고 cap을 적용한다", () => {
    const result = calculatePower(
      {
        strength: 8,
        traitedEgg: true,
        effort: 9,
      },
      {
        stage: "Adult",
        stats: {
          basePower: 20,
        },
      },
      true
    );

    expect(result).toEqual({
      power: 61,
      details: {
        basePower: 20,
        strengthBonus: 8,
        traitedEggBonus: 8,
        effortBonus: 25,
      },
    });
  });

  test("calculateInjuryChance는 패배 시 프로틴 과다에 따라 증가하고 80%에서 cap된다", () => {
    expect(calculateInjuryChance(true, 99)).toBe(20);
    expect(calculateInjuryChance(false, 3)).toBe(40);
    expect(calculateInjuryChance(false, 10)).toBe(80);
  });
});
