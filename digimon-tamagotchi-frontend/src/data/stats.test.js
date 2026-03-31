import { applyLazyUpdate } from "./stats";

const NOW_ISO = "2026-03-31T12:00:00.000Z";

function createBaseStats(overrides = {}) {
  return {
    isDead: false,
    birthTime: Date.parse("2026-03-31T00:00:00.000Z"),
    age: 0,
    lifespanSeconds: 0,
    timeToEvolveSeconds: 600,
    hungerTimer: 1,
    hungerCountdown: 60,
    fullness: 2,
    strengthTimer: 1,
    strengthCountdown: 60,
    strength: 2,
    poopTimer: 5,
    poopCountdown: 300,
    poopCount: 0,
    lastMaxPoopTime: null,
    callStatus: {
      hunger: { isActive: false, startedAt: null, isLogged: false },
      strength: { isActive: false, startedAt: null, isLogged: false },
      sleep: { isActive: false, startedAt: null },
    },
    careMistakes: 0,
    injuries: 0,
    isInjured: false,
    injuredAt: null,
    healedDosesCurrent: 0,
    activityLogs: [],
    isFrozen: false,
    frozenAt: null,
    takeOutAt: null,
    lastHungerZeroAt: null,
    lastStrengthZeroAt: null,
    hungerMistakeDeadline: null,
    strengthMistakeDeadline: null,
    ...overrides,
  };
}

describe("applyLazyUpdate", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW_ISO));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("마지막 저장 시각이 없으면 현재 시각만 기록하고 종료한다", () => {
    const result = applyLazyUpdate(createBaseStats(), null);

    expect(result.lastSavedAt).toBeInstanceOf(Date);
    expect(result.lastSavedAt.getTime()).toBe(Date.parse(NOW_ISO));
    expect(result.fullness).toBe(2);
    expect(result.strength).toBe(2);
  });

  test("기본 시간 경과에 따라 수명/진화시간과 콜 상태를 함께 갱신한다", () => {
    const result = applyLazyUpdate(
      createBaseStats({
        lifespanSeconds: 5,
        timeToEvolveSeconds: 200,
        hungerCountdown: 30,
        fullness: 2,
        strengthCountdown: 40,
        strength: 2,
      }),
      Date.parse("2026-03-31T11:57:50.000Z")
    );

    expect(result.lifespanSeconds).toBe(135);
    expect(result.timeToEvolveSeconds).toBe(70);
    expect(result.fullness).toBe(0);
    expect(result.strength).toBe(0);
    expect(result.lastHungerZeroAt).toEqual(expect.any(Number));
    expect(result.lastStrengthZeroAt).toEqual(expect.any(Number));
    expect(result.callStatus.hunger.isActive).toBe(true);
    expect(result.callStatus.hunger.startedAt).toBe(result.lastHungerZeroAt);
    expect(result.hungerMistakeDeadline).toBe(result.lastHungerZeroAt + 10 * 60 * 1000);
    expect(result.callStatus.strength.isActive).toBe(true);
    expect(result.callStatus.strength.startedAt).toBe(result.lastStrengthZeroAt);
    expect(result.strengthMistakeDeadline).toBe(result.lastStrengthZeroAt + 10 * 60 * 1000);
  });

  test("수면 시간은 hunger/strength/poop countdown에서 제외한다", () => {
    const sleepWindowStart = new Date(2026, 2, 31, 22, 0, 0);
    const sleepWindowEnd = new Date(2026, 2, 31, 23, 30, 0);
    jest.setSystemTime(sleepWindowEnd);

    const result = applyLazyUpdate(
      createBaseStats({
        lifespanSeconds: 10,
        timeToEvolveSeconds: 6000,
        hungerCountdown: 30,
        strengthCountdown: 40,
        poopCountdown: 50,
      }),
      sleepWindowStart.getTime(),
      { start: 22, end: 6, startMinute: 0, endMinute: 0 }
    );

    expect(result.lifespanSeconds).toBe(5410);
    expect(result.timeToEvolveSeconds).toBe(600);
    expect(result.fullness).toBe(2);
    expect(result.strength).toBe(2);
    expect(result.poopCount).toBe(0);
    expect(result.hungerCountdown).toBe(30);
    expect(result.strengthCountdown).toBe(40);
    expect(result.poopCountdown).toBe(50);
  });

  test("냉장고에 넣은 이후 시간은 경과 계산에서 제외한다", () => {
    const result = applyLazyUpdate(
      createBaseStats({
        lifespanSeconds: 10,
        timeToEvolveSeconds: 100,
        hungerCountdown: 50,
        isFrozen: true,
        frozenAt: Date.parse("2026-03-31T11:59:10.000Z"),
      }),
      Date.parse("2026-03-31T11:58:30.000Z")
    );

    expect(result.lifespanSeconds).toBe(50);
    expect(result.timeToEvolveSeconds).toBe(60);
    expect(result.fullness).toBe(2);
    expect(result.hungerCountdown).toBe(10);
  });

  test("reload 시 lastHungerZeroAt를 기준으로 hunger call을 복원한다", () => {
    const hungerZeroAt = Date.parse("2026-03-31T11:55:00.000Z");

    const result = applyLazyUpdate(
      createBaseStats({
        fullness: 0,
        hungerCountdown: 60,
        lastHungerZeroAt: hungerZeroAt,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.callStatus.hunger.isActive).toBe(true);
    expect(result.callStatus.hunger.startedAt).toBe(hungerZeroAt);
    expect(result.hungerMistakeDeadline).toBe(hungerZeroAt + 10 * 60 * 1000);
    expect(result.careMistakes).toBe(0);
  });

  test("hunger call 10분 초과는 케어미스를 한 번 올리고 호출을 닫는다", () => {
    const hungerZeroAt = Date.parse("2026-03-31T11:49:00.000Z");

    const result = applyLazyUpdate(
      createBaseStats({
        fullness: 0,
        lastHungerZeroAt: hungerZeroAt,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.careMistakes).toBe(1);
    expect(result.callStatus.hunger.isActive).toBe(false);
    expect(result.callStatus.hunger.startedAt).toBeNull();
    expect(result.lastHungerZeroAt).toBeNull();
    expect(result.hungerMistakeDeadline).toBeNull();
    expect(result.activityLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "CAREMISTAKE",
          text: expect.stringContaining("배고픔 콜 10분 무시"),
        }),
      ])
    );
  });

  test("reload 시 lastStrengthZeroAt를 기준으로 strength call을 복원한다", () => {
    const strengthZeroAt = Date.parse("2026-03-31T11:55:00.000Z");

    const result = applyLazyUpdate(
      createBaseStats({
        strength: 0,
        strengthCountdown: 60,
        lastStrengthZeroAt: strengthZeroAt,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.callStatus.strength.isActive).toBe(true);
    expect(result.callStatus.strength.startedAt).toBe(strengthZeroAt);
    expect(result.strengthMistakeDeadline).toBe(strengthZeroAt + 10 * 60 * 1000);
    expect(result.careMistakes).toBe(0);
  });

  test("strength call 10분 초과는 케어미스를 한 번 올리고 호출을 닫는다", () => {
    const strengthZeroAt = Date.parse("2026-03-31T11:49:00.000Z");

    const result = applyLazyUpdate(
      createBaseStats({
        strength: 0,
        lastStrengthZeroAt: strengthZeroAt,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.careMistakes).toBe(1);
    expect(result.callStatus.strength.isActive).toBe(false);
    expect(result.callStatus.strength.startedAt).toBeNull();
    expect(result.lastStrengthZeroAt).toBeNull();
    expect(result.strengthMistakeDeadline).toBeNull();
    expect(result.activityLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "CAREMISTAKE",
          text: expect.stringContaining("힘 콜 10분 무시"),
        }),
      ])
    );
  });

  test("배고픔 0이 12시간 이상 지속되면 굶주림 사망 처리한다", () => {
    const result = applyLazyUpdate(
      createBaseStats({
        fullness: 0,
        lastHungerZeroAt: Date.parse("2026-03-31T00:00:00.000Z"),
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.isDead).toBe(true);
    expect(result.deathReason).toBe("STARVATION (굶주림)");
  });

  test("힘 0이 12시간 이상 지속되면 힘 소진 사망 처리한다", () => {
    const result = applyLazyUpdate(
      createBaseStats({
        strength: 0,
        lastStrengthZeroAt: Date.parse("2026-03-31T00:00:00.000Z"),
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.isDead).toBe(true);
    expect(result.deathReason).toBe("EXHAUSTION (힘 소진)");
  });

  test("부상이 15회 이상이면 부상 과다 사망 처리한다", () => {
    const result = applyLazyUpdate(
      createBaseStats({
        injuries: 15,
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.isDead).toBe(true);
    expect(result.deathReason).toBe("INJURY OVERLOAD (부상 과다: 15회)");
  });

  test("부상 상태가 6시간 이상 지속되면 부상 방치 사망 처리한다", () => {
    const result = applyLazyUpdate(
      createBaseStats({
        isInjured: true,
        injuredAt: Date.parse("2026-03-31T05:30:00.000Z"),
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.isDead).toBe(true);
    expect(result.deathReason).toBe("INJURY NEGLECT (부상 방치: 6시간)");
  });
});
