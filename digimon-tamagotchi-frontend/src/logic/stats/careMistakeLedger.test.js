import {
  appendCareMistakeEntry,
  getDisplayCareMistakeEntries,
  repairCareMistakeLedger,
  resolveLatestCareMistakeEntry,
} from "./careMistakeLedger";

describe("careMistakeLedger", () => {
  test("레거시 슬롯은 현재 단계 로그와 sync placeholder를 합쳐 카운터 수만큼 복원한다", () => {
    const stageStartedAt = Date.parse("2026-03-31T00:00:00.000Z");
    const eventAt = Date.parse("2026-03-31T09:18:00.000Z");
    const legacyStats = {
      careMistakes: 2,
      careMistakeLedger: [],
      evolutionStageStartedAt: stageStartedAt,
    };
    const activityLogs = [
      {
        type: "CAREMISTAKE",
        text: "케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]",
        timestamp: eventAt,
      },
    ];

    const result = repairCareMistakeLedger(legacyStats, activityLogs);

    expect(result.nextStats.careMistakeLedger).toHaveLength(2);
    expect(result.activeEntries).toHaveLength(2);
    expect(result.nextStats.careMistakeLedger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reasonKey: "hunger_call", source: "backfill" }),
        expect.objectContaining({ reasonKey: "sync_repair", source: "sync" }),
      ])
    );
  });

  test("놀아주기/간식주기 해소는 가장 최근 미해소 케어미스를 resolve한다", () => {
    const firstAt = Date.parse("2026-03-31T09:18:00.000Z");
    const secondAt = Date.parse("2026-03-31T10:18:00.000Z");
    const withEntries = appendCareMistakeEntry(
      appendCareMistakeEntry(
        { careMistakes: 0, careMistakeLedger: [], activityLogs: [] },
        {
          occurredAt: firstAt,
          reasonKey: "hunger_call",
          text: "케어미스(사유: 배고픔 콜 10분 무시): 0 → 1",
          source: "realtime",
        }
      ).nextStats,
      {
        occurredAt: secondAt,
        reasonKey: "tease",
        text: "케어미스(사유: 괜히 괴롭히기): 1 → 2",
        source: "interaction",
      }
    ).nextStats;

    const resolved = resolveLatestCareMistakeEntry(withEntries, {
      resolvedAt: Date.parse("2026-03-31T11:00:00.000Z"),
      resolvedBy: "play_or_snack",
    });

    expect(resolved.nextStats.careMistakes).toBe(1);
    expect(resolved.resolvedEntry).toEqual(
      expect.objectContaining({
        reasonKey: "tease",
        resolvedBy: "play_or_snack",
      })
    );
  });

  test("표시용 이력은 현재 careMistakes 수에 맞춰 sync placeholder까지 포함해 맞춘다", () => {
    const stageStartedAt = Date.parse("2026-03-31T00:00:00.000Z");
    const { entries } = getDisplayCareMistakeEntries(
      {
        careMistakes: 2,
        careMistakeLedger: [],
        evolutionStageStartedAt: stageStartedAt,
      },
      [
        {
          type: "CAREMISTAKE",
          text: "케어미스(사유: 힘 콜 10분 무시) [과거 재구성]",
          timestamp: Date.parse("2026-03-31T09:18:00.000Z"),
        },
      ]
    );

    expect(entries).toHaveLength(2);
  });
});
