import {
  addActivityLog,
  checkCalls,
  checkCallTimeouts,
  getSleepStatus,
  hasDuplicateSleepDisturbanceLog,
} from "./useGameLogic";

function createBaseStats(overrides = {}) {
  return {
    isFrozen: false,
    fullness: 2,
    strength: 2,
    careMistakes: 0,
    careMistakeLedger: [],
    lastHungerZeroAt: null,
    lastStrengthZeroAt: null,
    hungerMistakeDeadline: null,
    strengthMistakeDeadline: null,
    callStatus: {
      hunger: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
      strength: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
      sleep: { isActive: false, startedAt: null },
    },
    ...overrides,
  };
}

describe("useGameLogic sleep-related warning rules", () => {
  test("수면 시간 + 불 켜짐이면 TIRED 상태가 된다", () => {
    const result = getSleepStatus({
      sleepSchedule: { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      isLightsOn: true,
      wakeUntil: null,
      now: new Date(2026, 2, 31, 23, 0, 0),
    });

    expect(result).toBe("TIRED");
  });

  test("수면 시간 + 불 켜짐이면 sleep call이 활성화된다", () => {
    const now = new Date(2026, 2, 31, 23, 0, 0);

    const result = checkCalls(
      createBaseStats(),
      true,
      { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      now,
      false
    );

    expect(result.callStatus.sleep.isActive).toBe(true);
    expect(result.callStatus.sleep.startedAt).toBe(now.getTime());
  });

  test("실제로 잠든 상태면 sleep call은 비활성화된다", () => {
    const now = new Date(2026, 2, 31, 23, 0, 0);

    const result = checkCalls(
      createBaseStats({
        callStatus: {
          hunger: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
          sleep: { isActive: true, startedAt: now.getTime() - 5 * 60 * 1000 },
        },
      }),
      true,
      { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      now,
      true
    );

    expect(result.callStatus.sleep.isActive).toBe(false);
    expect(result.callStatus.sleep.startedAt).toBeNull();
  });

  test("sleep call 60분 초과는 케어미스를 올리지 않고 경고 상태를 유지한다", () => {
    const startedAt = new Date(2026, 2, 31, 22, 0, 0).getTime();
    const now = new Date(2026, 2, 31, 23, 1, 0);
    const baseStats = createBaseStats({
      callStatus: {
        hunger: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
        strength: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
        sleep: { isActive: true, startedAt },
      },
    });

    const result = checkCallTimeouts(
      baseStats,
      now,
      false
    );

    expect(result).toBe(baseStats);
  });

  test("수면 방해 로그는 10분 이내 중복을 감지한다", () => {
    const now = new Date(2026, 2, 31, 23, 0, 0).getTime();

    expect(
      hasDuplicateSleepDisturbanceLog(
        [
          {
            type: "SLEEP_DISTURBANCE",
            text: "수면 방해(사유: 훈련): 10분 동안 깨어있음",
            timestamp: now - 5 * 60 * 1000,
          },
        ],
        now
      )
    ).toBe(true);

    expect(
      hasDuplicateSleepDisturbanceLog(
        [
          {
            type: "CARE_MISTAKE",
            text: "수면 방해(사유: 치료): 10분 동안 깨어있음",
            timestamp: now - 11 * 60 * 1000,
          },
        ],
        now
      )
    ).toBe(false);
  });
});

describe("useGameLogic hunger/strength call consistency", () => {
  test("배고픔 호출 타임아웃 후에도 lastHungerZeroAt는 유지된다", () => {
    const startedAt = new Date(2026, 2, 31, 11, 49, 0).getTime();
    const now = new Date(2026, 2, 31, 12, 0, 0);

    const result = checkCallTimeouts(
      createBaseStats({
        fullness: 0,
        lastHungerZeroAt: startedAt,
        callStatus: {
          hunger: { isActive: true, startedAt, sleepStartAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      }),
      now,
      false
    );

    expect(result.careMistakes).toBe(1);
    expect(result.callStatus.hunger.isActive).toBe(false);
    expect(result.callStatus.hunger.startedAt).toBeNull();
    expect(result.callStatus.hunger.isLogged).toBe(true);
    expect(result.lastHungerZeroAt).toBe(startedAt);
    expect(result.hungerMistakeDeadline).toBeNull();
  });

  test("힘 호출 타임아웃 후에도 lastStrengthZeroAt는 유지된다", () => {
    const startedAt = new Date(2026, 2, 31, 11, 49, 0).getTime();
    const now = new Date(2026, 2, 31, 12, 0, 0);

    const result = checkCallTimeouts(
      createBaseStats({
        strength: 0,
        lastStrengthZeroAt: startedAt,
        callStatus: {
          hunger: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
          strength: { isActive: true, startedAt, sleepStartAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      }),
      now,
      false
    );

    expect(result.careMistakes).toBe(1);
    expect(result.callStatus.strength.isActive).toBe(false);
    expect(result.callStatus.strength.startedAt).toBeNull();
    expect(result.callStatus.strength.isLogged).toBe(true);
    expect(result.lastStrengthZeroAt).toBe(startedAt);
    expect(result.strengthMistakeDeadline).toBeNull();
  });

  test("이미 처리된 배고픔 0 구간은 호출이 다시 열리지 않는다", () => {
    const zeroAt = new Date(2026, 2, 31, 11, 49, 0).getTime();
    const now = new Date(2026, 2, 31, 12, 1, 0);

    const result = checkCalls(
      createBaseStats({
        fullness: 0,
        lastHungerZeroAt: zeroAt,
        callStatus: {
          hunger: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: true },
          strength: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      }),
      true,
      { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      now,
      false
    );

    expect(result.callStatus.hunger.isActive).toBe(false);
    expect(result.callStatus.hunger.startedAt).toBeNull();
    expect(result.callStatus.hunger.isLogged).toBe(true);
    expect(result.lastHungerZeroAt).toBe(zeroAt);
    expect(result.hungerMistakeDeadline).toBeNull();
  });

  test("이미 처리된 힘 0 구간은 호출이 다시 열리지 않는다", () => {
    const zeroAt = new Date(2026, 2, 31, 11, 49, 0).getTime();
    const now = new Date(2026, 2, 31, 12, 1, 0);

    const result = checkCalls(
      createBaseStats({
        strength: 0,
        lastStrengthZeroAt: zeroAt,
        callStatus: {
          hunger: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: true },
          sleep: { isActive: false, startedAt: null },
        },
      }),
      true,
      { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      now,
      false
    );

    expect(result.callStatus.strength.isActive).toBe(false);
    expect(result.callStatus.strength.startedAt).toBeNull();
    expect(result.callStatus.strength.isLogged).toBe(true);
    expect(result.lastStrengthZeroAt).toBe(zeroAt);
    expect(result.strengthMistakeDeadline).toBeNull();
  });

  test("같은 틱에 배고픔/힘 호출이 함께 만료되면 ledger에도 2건이 남는다", () => {
    const startedAt = new Date(2026, 2, 31, 11, 49, 0).getTime();
    const now = new Date(2026, 2, 31, 12, 1, 0);

    const result = checkCallTimeouts(
      createBaseStats({
        fullness: 0,
        strength: 0,
        lastHungerZeroAt: startedAt,
        lastStrengthZeroAt: startedAt,
        callStatus: {
          hunger: { isActive: true, startedAt, sleepStartAt: null, isLogged: false },
          strength: { isActive: true, startedAt, sleepStartAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      }),
      now,
      false
    );

    expect(result.careMistakes).toBe(2);
    expect(result.careMistakeLedger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reasonKey: "hunger_call", resolvedAt: null }),
        expect.objectContaining({ reasonKey: "strength_call", resolvedAt: null }),
      ])
    );
  });

  test("15분 이내라도 서로 다른 사유의 케어미스 로그는 각각 남는다", () => {
    const baseTime = new Date(2026, 2, 31, 12, 0, 0).getTime();
    const logsWithHunger = addActivityLog(
      [],
      "CAREMISTAKE",
      "케어미스(사유: 배고픔 콜 10분 무시): 0 → 1",
      baseTime
    );
    const finalLogs = addActivityLog(
      logsWithHunger,
      "CAREMISTAKE",
      "케어미스(사유: 힘 콜 10분 무시): 1 → 2",
      baseTime + 5 * 60 * 1000
    );

    expect(finalLogs).toHaveLength(2);
  });
});
