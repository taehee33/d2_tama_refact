import {
  calculateHitRate,
  calculateInjuryChance,
  simulateBattle,
} from "./calculator";

describe("battle/calculator", () => {
  test("calculateHitRate는 분모가 0이면 기본값 50%를 반환한다", () => {
    expect(calculateHitRate(0, 0, 0)).toBe(50);
  });

  test("calculateHitRate는 속성 보너스 적용 후 0~100으로 clamp한다", () => {
    expect(calculateHitRate(90, 10, 20)).toBe(100);
    expect(calculateHitRate(10, 90, -20)).toBe(0);
  });

  test("simulateBattle은 결정적인 난수 시퀀스에서 유저 승리를 재현한다", () => {
    const randomSpy = jest
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.10)
      .mockReturnValueOnce(0.90)
      .mockReturnValueOnce(0.20)
      .mockReturnValueOnce(0.90)
      .mockReturnValueOnce(0.30);

    const result = simulateBattle(
      {
        stage: "Adult",
        stats: { basePower: 20, type: "Vaccine" },
      },
      {
        strength: 5,
        effort: 1,
        traitedEgg: false,
      },
      {
        stage: "Adult",
        stats: { basePower: 20, type: "Virus" },
      },
      {
        power: 20,
      },
      "플레이어",
      "적"
    );

    randomSpy.mockRestore();

    expect(result.won).toBe(true);
    expect(result.rounds).toBe(3);
    expect(result.userHits).toBe(3);
    expect(result.enemyHits).toBe(0);
    expect(result.userAttrBonus).toBe(5);
    expect(result.enemyAttrBonus).toBe(-5);
    expect(result.userPower).toBe(33);
    expect(result.enemyPower).toBe(20);
    expect(result.log).toHaveLength(5);
    expect(result.log[0]).toMatchObject({
      attacker: "user",
      defender: "enemy",
      hit: true,
    });
    expect(result.log[1]).toMatchObject({
      attacker: "enemy",
      defender: "user",
      hit: false,
    });
  });

  test("calculateInjuryChance는 패배 시 프로틴 과다를 반영하고 80%에서 막는다", () => {
    expect(calculateInjuryChance(true, 9)).toBe(20);
    expect(calculateInjuryChance(false, 0)).toBe(10);
    expect(calculateInjuryChance(false, 8)).toBe(80);
  });
});
