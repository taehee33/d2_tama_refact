import {
  formatTimestamp,
  getStartOfKstDayMs,
  isSameKstDay,
  toEpochMs,
} from "./time";

describe("time utils", () => {
  test("toEpochMs는 number, Date, Firestore Timestamp, ISO string을 정규화한다", () => {
    expect(toEpochMs(1234)).toBe(1234);
    expect(toEpochMs(new Date("2026-04-07T00:00:00.000Z"))).toBe(
      Date.parse("2026-04-07T00:00:00.000Z")
    );
    expect(
      toEpochMs({
        toMillis: () => 5678,
      })
    ).toBe(5678);
    expect(
      toEpochMs({
        toDate: () => new Date("2026-04-07T01:23:45.000Z"),
      })
    ).toBe(Date.parse("2026-04-07T01:23:45.000Z"));
    expect(
      toEpochMs({
        seconds: 1712559600,
        nanoseconds: 250000000,
      })
    ).toBe(1712559600250);
    expect(toEpochMs("2026-04-07T03:00:00.000Z")).toBe(
      Date.parse("2026-04-07T03:00:00.000Z")
    );
    expect(toEpochMs(null)).toBeNull();
  });

  test("KST day helper는 로컬 timezone과 무관하게 같은 일자를 판정한다", () => {
    const beforeMidnightKst = Date.parse("2026-04-07T14:59:59.000Z");
    const afterMidnightKst = Date.parse("2026-04-07T15:00:01.000Z");

    expect(getStartOfKstDayMs(beforeMidnightKst)).toBe(
      Date.parse("2026-04-06T15:00:00.000Z")
    );
    expect(getStartOfKstDayMs(afterMidnightKst)).toBe(
      Date.parse("2026-04-07T15:00:00.000Z")
    );
    expect(isSameKstDay(beforeMidnightKst, beforeMidnightKst + 500)).toBe(true);
    expect(isSameKstDay(beforeMidnightKst, afterMidnightKst)).toBe(false);
  });

  test("formatTimestamp는 KST 기준 문자열을 반환한다", () => {
    const value = Date.parse("2026-04-07T03:04:05.000Z");

    expect(formatTimestamp(value)).toBe("04/07 12:04");
    expect(formatTimestamp(value, "long")).toBe("2026-04-07 12:04:05");
    expect(formatTimestamp(value, "time")).toBe("12:04:05");
  });
});
