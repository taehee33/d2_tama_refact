import { selectCurrentStageSleepDisturbanceLogs } from "./sleepDisturbanceLogs";

describe("selectCurrentStageSleepDisturbanceLogs", () => {
  test("현재 진화 구간의 수면 방해만 최신순으로 반환한다", () => {
    const result = selectCurrentStageSleepDisturbanceLogs({
      currentStageStartedAt: 2000,
      activityLogs: [
        { type: "SLEEP_DISTURBANCE", text: "두 번째", timestamp: 4000 },
        { type: "SLEEP_START", text: "잠듦", timestamp: 3500 },
        { type: "CAREMISTAKE", text: "수면 방해 레거시", timestamp: 3000 },
        { type: "SLEEP_DISTURBANCE", text: "이전 구간", timestamp: 1000 },
        { type: "SLEEP_DISTURBANCE", text: "시각 없음" },
      ],
    });

    expect(result.isLegacyRange).toBe(false);
    expect(result.logs.map((log) => log.text)).toEqual([
      "두 번째",
      "수면 방해 레거시",
    ]);
  });

  test("단계 시작 시각이 없으면 보유 중인 전체 수면 방해 로그를 반환한다", () => {
    const result = selectCurrentStageSleepDisturbanceLogs({
      activityLogs: [
        { type: "SLEEP_DISTURBANCE", text: "최신", timestamp: 3000 },
        { type: "SLEEP_DISTURBANCE", text: "과거", timestamp: 1000 },
      ],
    });

    expect(result.isLegacyRange).toBe(true);
    expect(result.logs.map((log) => log.text)).toEqual(["최신", "과거"]);
  });
});
