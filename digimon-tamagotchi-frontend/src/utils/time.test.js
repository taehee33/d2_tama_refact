import {
  formatKstTime,
  formatTimestamp,
  getKstDateParts,
  getKstDateTimeMs,
  getKstMinutesOfDay,
  getKstTimeOnDateMs,
  getNextKstHalfHourBoundaryMs,
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

  test("epoch에서 KST 날짜와 하루 중 분을 추출한다", () => {
    const value = Date.parse("2026-12-31T15:05:06.789Z");

    expect(getKstDateParts(value)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
      hours: 0,
      minutes: 5,
      seconds: 6,
      milliseconds: 789,
    });
    expect(getKstMinutesOfDay(value)).toBe(5);
  });

  test("KST 날짜와 시각을 월말·연말에도 같은 epoch로 변환한다", () => {
    expect(
      getKstDateTimeMs({
        year: 2026,
        month: 12,
        day: 31,
        hours: 23,
        minutes: 45,
      })
    ).toBe(Date.parse("2026-12-31T23:45:00+09:00"));

    expect(
      getKstDateTimeMs(
        {
          year: 2026,
          month: 12,
          day: 31,
          hours: 7,
          minutes: 15,
        },
        1
      )
    ).toBe(Date.parse("2027-01-01T07:15:00+09:00"));

    expect(
      getKstTimeOnDateMs(
        Date.parse("2026-12-31T16:00:00.000Z"),
        7,
        15
      )
    ).toBe(Date.parse("2027-01-01T07:15:00+09:00"));
  });

  test("KST 오전·오후 시각 문자열은 시스템 timezone과 무관하다", () => {
    expect(formatKstTime(Date.parse("2026-06-21T06:15:00.000Z"))).toBe(
      "오후 3:15"
    );
    expect(formatKstTime(Date.parse("2026-06-20T15:05:00.000Z"))).toBe(
      "오전 12:05"
    );
  });

  test("다음 KST 00분·30분 경계를 절대 시각으로 계산한다", () => {
    expect(
      getNextKstHalfHourBoundaryMs(
        Date.parse("2026-06-21T10:29:59.999+09:00")
      )
    ).toBe(Date.parse("2026-06-21T10:30:00+09:00"));
    expect(
      getNextKstHalfHourBoundaryMs(
        Date.parse("2026-06-21T10:30:00+09:00")
      )
    ).toBe(Date.parse("2026-06-21T11:00:00+09:00"));
    expect(
      getNextKstHalfHourBoundaryMs(
        Date.parse("2026-12-31T23:45:00+09:00")
      )
    ).toBe(Date.parse("2027-01-01T00:00:00+09:00"));
  });

  test("formatTimestamp는 KST 기준 문자열을 반환한다", () => {
    const value = Date.parse("2026-04-07T03:04:05.000Z");

    expect(formatTimestamp(value)).toBe("04/07 12:04");
    expect(formatTimestamp(value, "long")).toBe("2026-04-07 12:04:05");
    expect(formatTimestamp(value, "time")).toBe("12:04:05");
  });
});
