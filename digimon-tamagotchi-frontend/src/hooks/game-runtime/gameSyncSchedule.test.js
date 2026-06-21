import {
  formatSyncCountdown,
  getFeedSummaryBucketEndAt,
  getNextStateSyncAt,
} from "./gameSyncSchedule";

describe("gameSyncSchedule", () => {
  test("게임 상태의 다음 저장은 기준 시각부터 15분 뒤다", () => {
    expect(getNextStateSyncAt(1_000)).toBe(901_000);
  });

  test("먹이 기록은 다음 15분 정각 bucket 종료 시각을 사용한다", () => {
    const occurredAt = new Date("2026-06-21T15:07:30+09:00").getTime();
    const expected = new Date("2026-06-21T15:15:00+09:00").getTime();
    expect(getFeedSummaryBucketEndAt(occurredAt)).toBe(expected);
    expect(getFeedSummaryBucketEndAt(occurredAt + 60_000)).toBe(expected);
  });

  test("남은 시간과 실제 예정 시각을 함께 표시한다", () => {
    const now = new Date("2026-06-21T15:00:28+09:00").getTime();
    const target = new Date("2026-06-21T15:15:00+09:00").getTime();
    expect(formatSyncCountdown(target, now)).toContain("14분 32초 후");
    expect(formatSyncCountdown(target, now)).toContain("오후 3:15");
  });
});
