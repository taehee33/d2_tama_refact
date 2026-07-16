import {
  calculateSleepLikeSecondsInRange,
  calculateSleepSecondsInRange,
  getActiveSleepLikeStartedAt,
  getMostRecentSleepDate,
  getMostRecentWakeDate,
  getNextSleepDate,
  getNextWakeDate,
  getSleepLikeIntervalsInRange,
  hasCrossedWakeTimeSince,
  isTimeWithinSleepSchedule,
} from "./sleepUtils";

const overnightSchedule = {
  start: 22,
  end: 8,
  startMinute: 0,
  endMinute: 0,
};

describe("KST sleep utils", () => {
  test("같은 날 수면은 시작을 포함하고 종료를 제외한다", () => {
    const schedule = {
      start: 9,
      end: 17,
      startMinute: 0,
      endMinute: 0,
    };

    expect(
      isTimeWithinSleepSchedule(
        schedule,
        Date.parse("2026-06-21T09:00:00+09:00")
      )
    ).toBe(true);
    expect(
      isTimeWithinSleepSchedule(
        schedule,
        Date.parse("2026-06-21T16:59:59+09:00")
      )
    ).toBe(true);
    expect(
      isTimeWithinSleepSchedule(
        schedule,
        Date.parse("2026-06-21T17:00:00+09:00")
      )
    ).toBe(false);
  });

  test("자정을 넘는 수면을 KST 기준으로 판정한다", () => {
    expect(
      isTimeWithinSleepSchedule(
        overnightSchedule,
        Date.parse("2026-06-21T21:59:59+09:00")
      )
    ).toBe(false);
    expect(
      isTimeWithinSleepSchedule(
        overnightSchedule,
        Date.parse("2026-06-21T22:00:00+09:00")
      )
    ).toBe(true);
    expect(
      isTimeWithinSleepSchedule(
        overnightSchedule,
        Date.parse("2026-06-22T07:59:59+09:00")
      )
    ).toBe(true);
    expect(
      isTimeWithinSleepSchedule(
        overnightSchedule,
        Date.parse("2026-06-22T08:00:00+09:00")
      )
    ).toBe(false);
  });

  test("다음·최근 수면과 기상 시각은 월말·연말에도 KST를 유지한다", () => {
    const now = Date.parse("2026-12-31T23:30:00+09:00");

    expect(getMostRecentSleepDate(overnightSchedule, now).getTime()).toBe(
      Date.parse("2026-12-31T22:00:00+09:00")
    );
    expect(getNextSleepDate(overnightSchedule, now).getTime()).toBe(
      Date.parse("2027-01-01T22:00:00+09:00")
    );
    expect(getMostRecentWakeDate(overnightSchedule, now).getTime()).toBe(
      Date.parse("2026-12-31T08:00:00+09:00")
    );
    expect(getNextWakeDate(overnightSchedule, now).getTime()).toBe(
      Date.parse("2027-01-01T08:00:00+09:00")
    );
  });

  test("이전 저장 이후 KST 기상 시각을 지났는지 판정한다", () => {
    expect(
      hasCrossedWakeTimeSince(
        overnightSchedule,
        Date.parse("2026-06-22T07:30:00+09:00"),
        Date.parse("2026-06-22T08:10:00+09:00")
      )
    ).toBe(true);
    expect(
      hasCrossedWakeTimeSince(
        overnightSchedule,
        Date.parse("2026-06-22T08:05:00+09:00"),
        Date.parse("2026-06-22T08:10:00+09:00")
      )
    ).toBe(false);
  });

  test("자정을 넘는 수면 구간의 초를 동일하게 계산한다", () => {
    expect(
      calculateSleepSecondsInRange(
        Date.parse("2026-06-21T21:30:00+09:00"),
        Date.parse("2026-06-22T08:30:00+09:00"),
        overnightSchedule
      )
    ).toBe(10 * 60 * 60);
  });

  test("강제 기상 구간은 정규 수면에서 제외한다", () => {
    const start = Date.parse("2026-06-21T21:00:00+09:00");
    const end = Date.parse("2026-06-22T09:00:00+09:00");
    const wakeUntil = Date.parse("2026-06-21T22:40:00+09:00");
    const intervals = getSleepLikeIntervalsInRange(start, end, {
      schedule: overnightSchedule,
      isLightsOn: false,
      wakeUntil,
    });

    expect(intervals).toEqual([
      {
        start: Date.parse("2026-06-21T22:00:00+09:00"),
        end: Date.parse("2026-06-21T22:30:00+09:00"),
      },
      {
        start: Date.parse("2026-06-21T22:40:00+09:00"),
        end: Date.parse("2026-06-22T08:00:00+09:00"),
      },
    ]);
    expect(
      calculateSleepLikeSecondsInRange(start, end, {
        schedule: overnightSchedule,
        isLightsOn: false,
        wakeUntil,
      })
    ).toBe((10 * 60 - 10) * 60);
  });

  test("낮잠은 잠들기 대기 15초 뒤부터 3시간 구간으로 합친다", () => {
    const start = Date.parse("2026-06-21T11:00:00+09:00");
    const end = Date.parse("2026-06-21T16:00:00+09:00");
    const fastSleepStart = Date.parse("2026-06-21T12:00:00+09:00");
    const napUntil = Date.parse("2026-06-21T15:00:15+09:00");
    const context = {
      schedule: overnightSchedule,
      isLightsOn: false,
      fastSleepStart,
      napUntil,
    };

    expect(getSleepLikeIntervalsInRange(start, end, context)).toEqual([
      {
        start: Date.parse("2026-06-21T12:00:15+09:00"),
        end: napUntil,
      },
    ]);
    expect(calculateSleepLikeSecondsInRange(start, end, context)).toBe(
      3 * 60 * 60
    );
  });

  test("현재 정규 수면 구간의 KST 시작 시각을 반환한다", () => {
    expect(
      getActiveSleepLikeStartedAt(
        Date.parse("2026-06-22T07:30:00+09:00"),
        {
          schedule: overnightSchedule,
          isLightsOn: false,
        }
      )
    ).toBe(Date.parse("2026-06-21T22:00:00+09:00"));
  });

  test("시작과 종료가 같으면 비활성 수면 스케줄이다", () => {
    const inactiveSchedule = {
      start: 8,
      end: 8,
      startMinute: 0,
      endMinute: 0,
    };
    const start = Date.parse("2026-06-21T00:00:00+09:00");
    const end = Date.parse("2026-06-22T00:00:00+09:00");

    expect(isTimeWithinSleepSchedule(inactiveSchedule, start)).toBe(false);
    expect(getSleepLikeIntervalsInRange(start, end, {
      schedule: inactiveSchedule,
      isLightsOn: false,
    })).toEqual([]);
    expect(
      calculateSleepLikeSecondsInRange(start, end, {
        schedule: inactiveSchedule,
        isLightsOn: false,
      })
    ).toBe(0);
  });
});
