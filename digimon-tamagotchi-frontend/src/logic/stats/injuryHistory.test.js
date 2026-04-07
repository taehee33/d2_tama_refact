import {
  buildTickPoopInjuryLogs,
  getDisplayInjuryEntries,
} from "./injuryHistory";

const digimonDataMap = {
  Digitama: { name: "디지타마" },
  Botamon: { name: "봇몬" },
  Koromon: { name: "코로몬" },
  Agumon: { name: "아구몬" },
  Greymon: { name: "그레이몬" },
};

describe("injuryHistory", () => {
  test("이번 생 시작 시각 이전 부상 로그는 제외하고, 스냅샷이 있으면 당시 디지몬을 그대로 보여준다", () => {
    const lifeStartedAt = Date.parse("2026-04-01T00:00:00.000Z");
    const poopInjuryAt = Date.parse("2026-04-01T09:00:00.000Z");
    const battleInjuryAt = Date.parse("2026-04-01T12:00:00.000Z");

    const entries = getDisplayInjuryEntries({
      currentLifeStartedAt: lifeStartedAt,
      slotVersion: "Ver.1",
      digimonDataMap,
      activityLogs: [
        {
          type: "POOP",
          text: "Pooped (Total: 8) - Injury: Too much poop (8 piles)",
          timestamp: Date.parse("2026-03-31T23:00:00.000Z"),
        },
        {
          type: "POOP",
          text: "Pooped (Total: 8) - Injury: Too much poop (8 piles)",
          timestamp: poopInjuryAt,
          digimonId: "Agumon",
          digimonName: "아구몬",
        },
        {
          type: "BATTLE",
          text: "Quest: Defeated by Devimon - Battle: Injured! (Chance hit)",
          timestamp: battleInjuryAt,
          digimonId: "Greymon",
          digimonName: "그레이몬",
        },
      ],
      battleLogs: [
        {
          injury: true,
          text: "Quest: Defeated by Devimon - Battle: Injured! (Chance hit)",
          timestamp: battleInjuryAt,
          digimonId: "Greymon",
          digimonName: "그레이몬",
        },
      ],
    });

    expect(entries).toHaveLength(2);
    expect(entries).toEqual([
      expect.objectContaining({
        timestamp: battleInjuryAt,
        source: "battle",
        inputSource: "battleLog",
        digimonId: "Greymon",
        digimonName: "그레이몬",
        resolvedFromFallback: false,
      }),
      expect.objectContaining({
        timestamp: poopInjuryAt,
        source: "poop",
        digimonId: "Agumon",
        digimonName: "아구몬",
        resolvedFromFallback: false,
      }),
    ]);
  });

  test("당시 디지몬 스냅샷이 없는 기존 로그는 진화 로그를 역추적해 복원한다", () => {
    const lifeStartedAt = Date.parse("2026-04-01T00:00:00.000Z");
    const evolutionToKoromonAt = Date.parse("2026-04-01T02:00:00.000Z");
    const evolutionToAgumonAt = Date.parse("2026-04-01T06:00:00.000Z");
    const injuryAt = Date.parse("2026-04-01T09:00:00.000Z");

    const entries = getDisplayInjuryEntries({
      currentLifeStartedAt: lifeStartedAt,
      slotVersion: "Ver.1",
      digimonDataMap,
      activityLogs: [
        {
          type: "NEW_START",
          text: "New start: Reborn as Digitama",
          timestamp: lifeStartedAt,
        },
        {
          type: "EVOLUTION",
          text: "Evolution: Evolved to 코로몬!",
          timestamp: evolutionToKoromonAt,
        },
        {
          type: "EVOLUTION",
          text: "Evolution: Evolved to 아구몬!",
          timestamp: evolutionToAgumonAt,
        },
        {
          type: "POOP",
          text: "Pooped (Total: 8) - Injury: Too much poop (8 piles)",
          timestamp: injuryAt,
        },
      ],
      battleLogs: [],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        timestamp: injuryAt,
        digimonId: "Agumon",
        digimonName: "아구몬",
        resolvedFromFallback: true,
      })
    );
  });

  test("이번 생 시작 이전의 부상 로그는 표시하지 않는다", () => {
    const lifeStartedAt = Date.parse("2026-04-01T00:00:00.000Z");
    const oldInjuryAt = Date.parse("2026-03-31T23:30:00.000Z");
    const newInjuryAt = Date.parse("2026-04-01T01:00:00.000Z");

    const entries = getDisplayInjuryEntries({
      currentLifeStartedAt: lifeStartedAt,
      slotVersion: "Ver.1",
      digimonDataMap,
      activityLogs: [
        {
          type: "POOP",
          text: "Pooped (Total: 8) - Injury: Too much poop (8 piles)",
          timestamp: oldInjuryAt,
          digimonId: "Digitama",
          digimonName: "디지타마",
        },
        {
          type: "POOP",
          text: "Pooped (Total: 8) - Injury: Too much poop (8 piles)",
          timestamp: newInjuryAt,
          digimonId: "Botamon",
          digimonName: "봇몬",
        },
      ],
      battleLogs: [],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        timestamp: newInjuryAt,
        digimonId: "Botamon",
        digimonName: "봇몬",
      })
    );
  });

  test("똥 8개 추가 부상은 같은 틱에 증가한 횟수만큼 분리 로그를 만든다", () => {
    const penaltyAt = Date.parse("2026-04-01T08:00:00.000Z");

    const logs = buildTickPoopInjuryLogs(
      {
        injuries: 1,
        poopCount: 8,
        lastPoopPenaltyAt: Date.parse("2026-04-01T00:00:00.000Z"),
      },
      {
        injuries: 3,
        poopCount: 8,
        injuryReason: "poop",
        lastPoopPenaltyAt: penaltyAt,
        injuredAt: penaltyAt,
      },
      {
        digimonId: "Agumon",
        digimonName: "아구몬",
      }
    );

    expect(logs).toHaveLength(2);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        type: "POOP",
        timestamp: penaltyAt,
        text: expect.stringContaining("1/2"),
        digimonId: "Agumon",
        digimonName: "아구몬",
      })
    );
    expect(logs[1]).toEqual(
      expect.objectContaining({
        type: "POOP",
        timestamp: penaltyAt + 1,
        text: expect.stringContaining("2/2"),
        digimonId: "Agumon",
        digimonName: "아구몬",
      })
    );
  });

  test("7→8 즉시 부상은 기존 poop 증가 로그 경로를 사용하므로 중복 생성하지 않는다", () => {
    const logs = buildTickPoopInjuryLogs(
      { injuries: 0, poopCount: 7 },
      {
        injuries: 1,
        poopCount: 8,
        injuryReason: "poop",
        poopReachedMaxAt: Date.parse("2026-04-01T09:00:00.000Z"),
      }
    );

    expect(logs).toEqual([]);
  });
});
