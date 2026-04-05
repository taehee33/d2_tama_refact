import {
  buildTickPoopInjuryLogs,
  getDisplayInjuryEntries,
} from "./injuryHistory";

describe("injuryHistory", () => {
  test("현재 단계 기준으로 부상 이력을 필터링하고 배틀 중복 로그를 한 건으로 합친다", () => {
    const stageStartedAt = Date.parse("2026-04-01T00:00:00.000Z");
    const poopInjuryAt = Date.parse("2026-04-01T09:00:00.000Z");
    const battleInjuryAt = Date.parse("2026-04-01T12:00:00.000Z");

    const entries = getDisplayInjuryEntries({
      currentStageStartedAt: stageStartedAt,
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
        },
        {
          type: "BATTLE",
          text: "Quest: Defeated by Devimon - Battle: Injured! (Chance hit)",
          timestamp: battleInjuryAt,
        },
      ],
      battleLogs: [
        {
          injury: true,
          text: "Quest: Defeated by Devimon - Battle: Injured! (Chance hit)",
          timestamp: battleInjuryAt,
        },
      ],
    });

    expect(entries).toHaveLength(2);
    expect(entries).toEqual([
      expect.objectContaining({
        timestamp: battleInjuryAt,
        source: "battle",
        inputSource: "battleLog",
      }),
      expect.objectContaining({
        timestamp: poopInjuryAt,
        source: "poop",
      }),
    ]);
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
      }
    );

    expect(logs).toHaveLength(2);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        type: "POOP",
        timestamp: penaltyAt,
        text: expect.stringContaining("1/2"),
      })
    );
    expect(logs[1]).toEqual(
      expect.objectContaining({
        type: "POOP",
        timestamp: penaltyAt + 1,
        text: expect.stringContaining("2/2"),
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
