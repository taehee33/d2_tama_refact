import {
  buildStatsPopupNocturnalMutation,
  buildStatsPopupStatMutation,
} from "./statsPopupMutations";

const NOW_MS = Date.parse("2026-07-26T12:00:00.000Z");

describe("statsPopupMutations", () => {
  test("일반 스탯은 원본을 바꾸지 않고 다음 stats를 만든다", () => {
    const stats = { fullness: 1 };
    const nextStats = buildStatsPopupStatMutation({
      stats,
      field: "fullness",
      value: 2,
      nowMs: NOW_MS,
    });

    expect(nextStats).toEqual({ fullness: 2 });
    expect(stats).toEqual({ fullness: 1 });
  });

  test("poop 7 → 8은 주입한 시각으로 연쇄 timestamp를 만든다", () => {
    expect(buildStatsPopupStatMutation({
      stats: { poopCount: 7 },
      field: "poopCount",
      value: 8,
      nowMs: NOW_MS,
    })).toEqual({
      poopCount: 8,
      poopReachedMaxAt: NOW_MS,
      lastPoopPenaltyAt: NOW_MS,
    });
  });

  test("poop 8 → 7은 연쇄 timestamp를 초기화한다", () => {
    expect(buildStatsPopupStatMutation({
      stats: {
        poopCount: 8,
        poopReachedMaxAt: NOW_MS - 1000,
        lastPoopPenaltyAt: NOW_MS - 500,
      },
      field: "poopCount",
      value: 7,
      nowMs: NOW_MS,
    })).toEqual({
      poopCount: 7,
      poopReachedMaxAt: null,
      lastPoopPenaltyAt: null,
    });
  });

  test("부상 ON/OFF 연쇄 필드를 기존 규칙대로 만든다", () => {
    expect(buildStatsPopupStatMutation({
      stats: { isInjured: false, injuredAt: null },
      field: "isInjured",
      value: true,
      nowMs: NOW_MS,
    })).toEqual({ isInjured: true, injuredAt: NOW_MS });

    expect(buildStatsPopupStatMutation({
      stats: { isInjured: true, injuredAt: NOW_MS, healedDosesCurrent: 3 },
      field: "isInjured",
      value: false,
      nowMs: NOW_MS + 1,
    })).toEqual({ isInjured: false, injuredAt: null, healedDosesCurrent: 0 });
  });

  test("야행성 다음 상태와 append 대상 로그 payload를 함께 만든다", () => {
    const mutation = buildStatsPopupNocturnalMutation({
      stats: { isNocturnal: false, fullness: 1 },
      activityLogs: [],
      nowMs: NOW_MS,
      addActivityLogFn: (logs, type, text, timestamp) => [
        ...logs,
        { type, text, timestamp },
      ],
    });

    expect(mutation.nextStats).toEqual(expect.objectContaining({
      isNocturnal: true,
      fullness: 1,
      activityLogs: [mutation.logPayload],
    }));
    expect(mutation.logPayload).toEqual(expect.objectContaining({
      type: "ACTION",
      text: "야행성 모드 ON: 수면/기상 시간이 3시간씩 미뤄집니다 🌙",
      timestamp: NOW_MS,
    }));
  });
});
