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
  test("수면 시간 + 불 켜짐이면 SLEEPING_LIGHT_ON 상태가 된다", () => {
    const result = getSleepStatus({
      sleepSchedule: { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      isLightsOn: true,
      wakeUntil: null,
      now: new Date(2026, 2, 31, 23, 0, 0),
    });

    expect(result).toBe("SLEEPING_LIGHT_ON");
  });

  test("수면 시간 + 불 꺼짐이면 15초 동안 FALLING_ASLEEP 상태가 유지된다", () => {
    const result = getSleepStatus({
      sleepSchedule: { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      isLightsOn: false,
      wakeUntil: null,
      fastSleepStart: new Date(2026, 2, 31, 22, 59, 50).getTime(),
      now: new Date(2026, 2, 31, 23, 0, 0),
    });

    expect(result).toBe("FALLING_ASLEEP");
  });

  test("수면 시간 + 불 꺼짐 15초 후 SLEEPING 상태가 된다", () => {
    const result = getSleepStatus({
      sleepSchedule: { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      isLightsOn: false,
      wakeUntil: null,
      fastSleepStart: new Date(2026, 2, 31, 22, 59, 40).getTime(),
      now: new Date(2026, 2, 31, 23, 0, 0),
    });

    expect(result).toBe("SLEEPING");
  });

  test("수면 시간이 아니고 낮잠 시간이면 NAPPING 상태가 된다", () => {
    const result = getSleepStatus({
      sleepSchedule: { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      isLightsOn: false,
      wakeUntil: null,
      napUntil: new Date(2026, 2, 31, 15, 0, 0).getTime(),
      now: new Date(2026, 2, 31, 12, 0, 0),
    });

    expect(result).toBe("NAPPING");
  });

  test("낮잠 중 불을 켜면 AWAKE 상태가 된다", () => {
    const result = getSleepStatus({
      sleepSchedule: { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      isLightsOn: true,
      wakeUntil: null,
      napUntil: new Date(2026, 2, 31, 15, 0, 0).getTime(),
      now: new Date(2026, 2, 31, 12, 0, 0),
    });

    expect(result).toBe("AWAKE");
  });

  test("wakeUntil이 남아 있으면 AWAKE_INTERRUPTED 상태가 된다", () => {
    const result = getSleepStatus({
      sleepSchedule: { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      isLightsOn: false,
      wakeUntil: new Date(2026, 2, 31, 23, 10, 0).getTime(),
      fastSleepStart: new Date(2026, 2, 31, 22, 59, 40).getTime(),
      now: new Date(2026, 2, 31, 23, 0, 0),
    });

    expect(result).toBe("AWAKE_INTERRUPTED");
  });

  test("잠든 동안 호출 타이머는 멈췄다가 깨어나면 이어진다", () => {
    const zeroAt = new Date(2026, 2, 31, 11, 49, 0).getTime();
    const sleepStartAt = new Date(2026, 2, 31, 23, 0, 0).getTime();
    const wakeAt = sleepStartAt + 5 * 1000;
    const baseStats = createBaseStats({
      fullness: 0,
      lastHungerZeroAt: zeroAt,
      hungerMistakeDeadline: zeroAt + 10 * 60 * 1000,
      callStatus: {
        hunger: { isActive: true, startedAt: zeroAt, sleepStartAt: null, isLogged: false },
        strength: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
        sleep: { isActive: false, startedAt: null },
      },
    });

    const sleepingResult = checkCalls(
      baseStats,
      false,
      { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      new Date(sleepStartAt),
      "SLEEPING"
    );

    expect(sleepingResult.callStatus.hunger.sleepStartAt).toBe(sleepStartAt);
    expect(sleepingResult.callStatus.hunger.startedAt).toBe(zeroAt);
    expect(sleepingResult.hungerMistakeDeadline).toBe(zeroAt + 10 * 60 * 1000);

    const resumedResult = checkCalls(
      sleepingResult,
      false,
      { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      new Date(wakeAt),
      "AWAKE_INTERRUPTED"
    );

    expect(resumedResult.callStatus.hunger.sleepStartAt).toBeNull();
    expect(resumedResult.callStatus.hunger.startedAt).toBe(zeroAt + 5 * 1000);
    expect(resumedResult.hungerMistakeDeadline).toBe(zeroAt + 10 * 60 * 1000 + 5 * 1000);
  });

  test("수면 조명 경고 30분 초과는 같은 사건에서 케어미스를 1회만 올린다", () => {
    const startedAt = new Date(2026, 2, 31, 22, 0, 0).getTime();
    const now = new Date(2026, 2, 31, 22, 31, 0);
    const baseStats = createBaseStats({
      callStatus: {
        hunger: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
        strength: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
        sleep: { isActive: true, startedAt, isLogged: false },
      },
    });

    const result = checkCallTimeouts(baseStats, now, "SLEEPING_LIGHT_ON");
    const repeatedResult = checkCallTimeouts(result, new Date(2026, 2, 31, 22, 45, 0), "SLEEPING_LIGHT_ON");

    expect(result.careMistakes).toBe(1);
    expect(result.callStatus.sleep.isLogged).toBe(true);
    expect(result.careMistakeLedger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reasonKey: "sleep_light_warning", resolvedAt: null }),
      ])
    );
    expect(repeatedResult.careMistakes).toBe(1);
  });

  test("수면 조명 경고는 불을 껐다가 다시 켜 새 사건이 시작되면 다시 1회 집계된다", () => {
    const firstStartedAt = new Date(2026, 2, 31, 22, 0, 0).getTime();
    const secondStartedAt = new Date(2026, 2, 31, 22, 40, 0).getTime();
    const firstIncidentResult = checkCallTimeouts(
      createBaseStats({
        callStatus: {
          hunger: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
          sleep: { isActive: true, startedAt: firstStartedAt, isLogged: false },
        },
      }),
      new Date(2026, 2, 31, 22, 31, 0),
      "SLEEPING_LIGHT_ON"
    );

    const resetIncident = checkCalls(
      {
        ...firstIncidentResult,
        callStatus: {
          ...firstIncidentResult.callStatus,
          sleep: {
            ...firstIncidentResult.callStatus.sleep,
            isActive: true,
            startedAt: secondStartedAt,
            isLogged: false,
          },
        },
        sleepLightOnStart: secondStartedAt,
      },
      true,
      { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      new Date(secondStartedAt),
      "SLEEPING_LIGHT_ON"
    );

    const secondIncidentResult = checkCallTimeouts(
      resetIncident,
      new Date(2026, 2, 31, 23, 11, 0),
      "SLEEPING_LIGHT_ON"
    );

    expect(firstIncidentResult.careMistakes).toBe(1);
    expect(secondIncidentResult.careMistakes).toBe(2);
  });

  test("수면 조명 경고 재계산 시 저장된 sleepLightOnStart를 현재 시각으로 덮어쓰지 않는다", () => {
    const persistedStart = new Date(2026, 2, 31, 22, 0, 0).getTime();
    const now = new Date(2026, 2, 31, 22, 18, 0);

    const result = checkCalls(
      createBaseStats({
        sleepLightOnStart: persistedStart,
        callStatus: {
          hunger: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
          sleep: { isActive: true, startedAt: null, isLogged: false },
        },
      }),
      true,
      { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      now,
      "SLEEPING_LIGHT_ON"
    );

    expect(result.callStatus.sleep.isActive).toBe(true);
    expect(result.callStatus.sleep.startedAt).toBe(persistedStart);
    expect(result.sleepLightOnStart).toBe(persistedStart);
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
      "AWAKE"
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
      "AWAKE"
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
      "AWAKE"
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
      "AWAKE"
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
      "AWAKE"
    );

    expect(result.careMistakes).toBe(2);
    expect(result.careMistakeLedger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reasonKey: "hunger_call", resolvedAt: null }),
        expect.objectContaining({ reasonKey: "strength_call", resolvedAt: null }),
      ])
    );
  });

  test("냉장고 상태에서는 호출 메타를 지우지 않고 활성 상태만 숨긴다", () => {
    const startedAt = new Date(2026, 2, 31, 11, 49, 0).getTime();
    const now = new Date(2026, 2, 31, 12, 1, 0);

    const result = checkCalls(
      createBaseStats({
        isFrozen: true,
        fullness: 0,
        strength: 0,
        lastHungerZeroAt: startedAt,
        lastStrengthZeroAt: startedAt,
        callStatus: {
          hunger: { isActive: true, startedAt, sleepStartAt: startedAt + 1000, isLogged: true },
          strength: { isActive: true, startedAt, sleepStartAt: startedAt + 2000, isLogged: false },
          sleep: { isActive: true, startedAt },
        },
      }),
      true,
      { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      now,
      "AWAKE"
    );

    expect(result.callStatus.hunger).toMatchObject({
      isActive: false,
      startedAt,
      isLogged: true,
    });
    expect(result.callStatus.strength).toMatchObject({
      isActive: false,
      startedAt,
      isLogged: false,
    });
    expect(result.callStatus.sleep).toEqual({
      isActive: false,
      startedAt: null,
      isLogged: false,
    });
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

  test("같은 케어미스 사건을 다시 추가해도 activityLogs에는 1건만 남는다", () => {
    const eventTime = new Date(2026, 2, 31, 12, 0, 0).getTime();
    const firstLogs = addActivityLog(
      [],
      "CAREMISTAKE",
      "케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]",
      eventTime
    );
    const duplicateLogs = addActivityLog(
      firstLogs,
      "CAREMISTAKE",
      "케어미스(사유: 배고픔 콜 10분 무시): 0 → 1",
      eventTime
    );

    expect(firstLogs).toHaveLength(1);
    expect(duplicateLogs).toHaveLength(1);
    expect(duplicateLogs[0].eventId).toBe(firstLogs[0].eventId);
  });

  test("같은 똥 부상 사건을 다시 추가해도 activityLogs에는 1건만 남는다", () => {
    const eventTime = new Date(2026, 2, 31, 12, 0, 0).getTime();
    const firstLogs = addActivityLog(
      [],
      "POOP",
      "Pooped (Total: 7→8) - Injury: Too much poop (8 piles)",
      eventTime
    );
    const duplicateLogs = addActivityLog(
      firstLogs,
      "POOP",
      "Pooped (Total: 8) - Injury: Too much poop (8 piles) [과거 재구성]",
      eventTime
    );

    expect(firstLogs).toHaveLength(1);
    expect(duplicateLogs).toHaveLength(1);
    expect(duplicateLogs[0].eventId).toBe(firstLogs[0].eventId);
  });
});
