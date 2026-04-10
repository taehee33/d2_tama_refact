import {
  buildEvolutionResetStats,
  buildEvolutionTransitionState,
} from "./evolutionStateHelpers";

describe("evolutionStateHelpers", () => {
  test("buildEvolutionResetStats는 진화 시 리셋되는 전투/케어 값을 초기화한다", () => {
    const resetStats = buildEvolutionResetStats(
      {
        careMistakes: 3,
        overfeeds: 2,
        proteinOverdose: 1,
        trainings: 9,
        sleepDisturbances: 4,
        strength: 7,
        effort: 8,
        battles: 11,
        battlesWon: 6,
        battlesLost: 5,
        winRate: 55,
      },
      {
        minWeight: 12,
        maxEnergy: 20,
      }
    );

    expect(resetStats).toMatchObject({
      careMistakes: 0,
      overfeeds: 0,
      proteinOverdose: 0,
      trainings: 0,
      sleepDisturbances: 0,
      strength: 0,
      effort: 0,
      energy: 20,
      weight: 12,
      battles: 0,
      battlesWon: 0,
      battlesLost: 0,
      winRate: 0,
    });
  });

  test("buildEvolutionTransitionState는 sprite와 activity log를 포함한 다음 상태를 만든다", () => {
    const existingLogs = [{ type: "OLD", text: "old log", timestamp: 1 }];

    const result = buildEvolutionTransitionState({
      currentStats: {
        age: 5,
        birthTime: 100,
        totalReincarnations: 1,
      },
      existingLogs,
      targetId: "Greymon",
      targetMap: {
        Greymon: {
          id: "Greymon",
          name: "그레이몬",
          sprite: 42,
          stats: {
            minWeight: 15,
            maxEnergy: 25,
          },
        },
      },
      logText: "조그레스 진화(온라인): 그레이몬!",
      snapshotArgs: [
        {
          Greymon: {
            id: "Greymon",
            name: "그레이몬",
          },
        },
      ],
    });

    expect(result.resultName).toBe("그레이몬");
    expect(result.targetDigimonData.sprite).toBe(42);
    expect(result.nextStats.sprite).toBe(42);
    expect(result.nextStats.weight).toBe(15);
    expect(result.nextStats.energy).toBe(25);
    expect(result.updatedLogs).toHaveLength(2);
    expect(result.updatedLogs[1]).toMatchObject({
      type: "EVOLUTION",
      text: "조그레스 진화(온라인): 그레이몬!",
      digimonId: "Greymon",
      digimonName: "그레이몬",
    });
    expect(result.nextStatsWithLogs.selectedDigimon).toBe("Greymon");
    expect(result.nextStatsWithLogs.activityLogs).toEqual(result.updatedLogs);
  });
});
