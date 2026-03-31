import { checkEvolution, findEvolutionTarget } from "./checker";

function createStats(overrides = {}) {
  return {
    timeToEvolveSeconds: 0,
    careMistakes: 0,
    trainings: 0,
    overfeeds: 0,
    sleepDisturbances: 0,
    battlesWon: 0,
    battlesLost: 0,
    weight: 0,
    strength: 0,
    power: 0,
    basePower: 0,
    ...overrides,
  };
}

describe("evolution checker", () => {
  test("진화 시간이 남아 있으면 NOT_READY를 반환한다", () => {
    const result = checkEvolution(
      createStats({ timeToEvolveSeconds: 42 }),
      {
        evolutionCriteria: { timeToEvolveSeconds: 60 },
        evolutions: [{ targetId: "Koromon", targetName: "코로몬" }],
      },
      "Digitama",
      {}
    );

    expect(result).toEqual({
      success: false,
      reason: "NOT_READY",
      remainingTime: 42,
    });
  });

  test("단일 조건 그룹을 만족하면 첫 번째 진화 대상을 반환한다", () => {
    const digimonDataMap = {
      Agumon: { id: "Agumon", name: "아구몬" },
      Betamon: { id: "Betamon", name: "베타몬" },
    };

    const result = checkEvolution(
      createStats({
        careMistakes: 1,
        trainings: 5,
      }),
      {
        evolutionCriteria: { timeToEvolveSeconds: 0 },
        evolutions: [
          {
            targetId: "Agumon",
            targetName: "아구몬",
            conditions: {
              careMistakes: { max: 1 },
              trainings: { min: 5 },
            },
          },
          {
            targetId: "Betamon",
            targetName: "베타몬",
            conditions: {
              careMistakes: { min: 4 },
            },
          },
        ],
      },
      "Koromon",
      digimonDataMap
    );

    expect(result).toEqual({
      success: true,
      reason: "SUCCESS",
      targetId: "Agumon",
    });
  });

  test("OR 조건 그룹 중 하나라도 만족하면 진화 성공으로 본다", () => {
    const result = checkEvolution(
      createStats({
        battlesWon: 3,
        battlesLost: 1,
      }),
      {
        evolutionCriteria: { timeToEvolveSeconds: 0 },
        evolutions: [
          {
            targetId: "Greymon",
            targetName: "그레이몬",
            conditionGroups: [
              { trainings: { min: 10 } },
              { battles: { min: 4 }, winRatio: { min: 70 } },
            ],
          },
        ],
      },
      "Agumon",
      { Greymon: { id: "Greymon", name: "그레이몬" } }
    );

    expect(result).toEqual({
      success: true,
      reason: "SUCCESS",
      targetId: "Greymon",
    });
  });

  test("조건이 없는 자동 진화는 시간만 맞으면 성공한다", () => {
    const result = checkEvolution(
      createStats(),
      {
        evolutionCriteria: { timeToEvolveSeconds: 0 },
        evolutions: [{ targetId: "Botamon", targetName: "깜몬" }],
      },
      "Digitama",
      { Botamon: { id: "Botamon", name: "깜몬" } }
    );

    expect(result).toEqual({
      success: true,
      reason: "SUCCESS",
      targetId: "Botamon",
    });
  });

  test("조건을 만족하지 못하면 대상별 부족 조건을 details에 담는다", () => {
    const result = checkEvolution(
      createStats({
        careMistakes: 3,
        trainings: 1,
      }),
      {
        evolutionCriteria: { timeToEvolveSeconds: 0 },
        evolutions: [
          {
            targetId: "Greymon",
            targetName: "그레이몬",
            conditions: {
              careMistakes: { max: 1 },
              trainings: { min: 5 },
            },
          },
        ],
      },
      "Agumon",
      { Greymon: { id: "Greymon", name: "그레이몬" } }
    );

    expect(result.success).toBe(false);
    expect(result.reason).toBe("CONDITIONS_UNMET");
    expect(result.details).toEqual([
      {
        target: "그레이몬",
        missing: expect.stringContaining("케어 미스"),
      },
    ]);
    expect(result.details[0].missing).toContain("훈련");
  });

  test("findEvolutionTarget은 성공 시 targetId를 반환한다", () => {
    const digimonDataMap = {
      Agumon: {
        evolutionCriteria: { timeToEvolveSeconds: 0 },
        evolutions: [
          {
            targetId: "Greymon",
            targetName: "그레이몬",
            conditions: { trainings: { min: 3 } },
          },
        ],
      },
      Greymon: { id: "Greymon", name: "그레이몬" },
    };

    const result = findEvolutionTarget(
      "Agumon",
      createStats({ trainings: 3 }),
      digimonDataMap
    );

    expect(result).toBe("Greymon");
  });
});
