import {
  buildEvolutionActivityLogEventId,
  buildEvolutionResetStats,
  buildEvolutionTransitionState,
} from "./evolutionStateHelpers";

describe("evolutionStateHelpers", () => {
  afterEach(() => {
    if (Date.now.mockRestore) {
      Date.now.mockRestore();
    }
  });

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

  test("transitionId가 있으면 EVOLUTION 로그에 transitionId와 명시 eventId를 남긴다", () => {
    const result = buildEvolutionTransitionState({
      currentStats: {},
      existingLogs: [],
      targetId: "Greymon",
      targetMap: {
        Greymon: {
          id: "Greymon",
          name: "그레이몬",
        },
      },
      transitionId: "evolution:1700000000000:Agumon:Greymon:abc123",
    });

    expect(result.updatedLogs[0]).toMatchObject({
      type: "EVOLUTION",
      transitionId: "evolution:1700000000000:Agumon:Greymon:abc123",
      eventId:
        "activity:evolution:evolution:1700000000000:Agumon:Greymon:abc123",
    });
  });

  test("같은 transitionId는 같은 eventId를 만들고 다른 transitionId는 다른 eventId를 만든다", () => {
    const first = buildEvolutionActivityLogEventId("evolution:1:Agumon:Greymon:a");
    const duplicate = buildEvolutionActivityLogEventId("evolution:1:Agumon:Greymon:a");
    const other = buildEvolutionActivityLogEventId("evolution:1:Agumon:Greymon:b");

    expect(first).toBe(duplicate);
    expect(first).not.toBe(other);
  });

  test("transitionId가 없으면 기존 timestamp 기반 EVOLUTION eventId 정책을 유지한다", () => {
    jest.spyOn(Date, "now").mockReturnValue(123456789);

    const result = buildEvolutionTransitionState({
      currentStats: {},
      existingLogs: [],
      targetId: "Greymon",
      targetMap: {
        Greymon: {
          id: "Greymon",
          name: "그레이몬",
        },
      },
    });

    expect(result.updatedLogs[0].transitionId).toBeUndefined();
    expect(result.updatedLogs[0].eventId).toMatch(
      /^activity:evolution:123456789:/
    );
  });
});
