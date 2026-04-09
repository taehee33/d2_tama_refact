import {
  buildActivityLogEventId,
  buildCareMistakeActivityEventId,
  buildPoopInjuryActivityEventId,
  getPoopInjuryEventKindFromText,
} from "./activityLogEventId";

describe("activityLogEventId", () => {
  test("케어미스 로그는 사유와 시각 기준의 안정적인 eventId를 만든다", () => {
    const timestamp = Date.parse("2026-04-09T00:54:00.000Z");

    expect(
      buildActivityLogEventId({
        type: "CAREMISTAKE",
        text: "케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]",
        timestamp,
      })
    ).toBe(buildCareMistakeActivityEventId("hunger_call", timestamp));
  });

  test("똥 부상 로그는 즉시 부상과 추가 부상을 구분한 eventId를 만든다", () => {
    const timestamp = Date.parse("2026-04-09T00:54:00.000Z");

    expect(getPoopInjuryEventKindFromText("Pooped (Total: 8) - Injury: Too much poop (8 piles)")).toBe("max_poop");
    expect(getPoopInjuryEventKindFromText("똥 8개 방치 8시간 경과 - 추가 부상")).toBe("poop_penalty");
    expect(
      buildActivityLogEventId({
        type: "POOP",
        text: "똥 8개 방치 8시간 경과 - 추가 부상",
        timestamp,
      })
    ).toBe(buildPoopInjuryActivityEventId("poop_penalty", timestamp));
  });

  test("일반 액션 로그는 eventId를 만들지 않는다", () => {
    expect(
      buildActivityLogEventId({
        type: "FEED",
        text: "고기를 먹였다",
        timestamp: Date.parse("2026-04-09T00:54:00.000Z"),
      })
    ).toBeNull();
  });
});
