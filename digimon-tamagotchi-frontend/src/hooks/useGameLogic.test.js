import {
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
