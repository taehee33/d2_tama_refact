import {
  applyLazyUpdate,
  clearActiveInjuryState,
  clearPoopOverflowState,
  initializeStats,
} from "./stats";
import { buildActivityLogEventId } from "../utils/activityLogEventId";

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
    poopReachedMaxAt: null,
    lastPoopPenaltyAt: null,
    lastMaxPoopTime: null,
    callStatus: {
      hunger: { isActive: false, startedAt: null, isLogged: false },
      strength: { isActive: false, startedAt: null, isLogged: false },
      sleep: { isActive: false, startedAt: null, isLogged: false },
    },
    isLightsOn: true,
    wakeUntil: null,
    fastSleepStart: null,
    napUntil: null,
    sleepLightOnStart: null,
    careMistakes: 0,
    careMistakeLedger: [],
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

const initializeDataMap = {
  Digitama: {
    evolutionStage: "Digitama",
    hungerTimer: 1,
    strengthTimer: 1,
    poopTimer: 1,
  },
  Agumon: {
    evolutionStage: "Child",
    hungerTimer: 1,
    strengthTimer: 1,
    poopTimer: 1,
    minWeight: 20,
    maxEnergy: 10,
  },
};

describe("initializeStats", () => {
  test("진화 시에는 이번 생 누적 부상 횟수를 유지하고 활성 부상 상태만 초기화한다", () => {
    const result = initializeStats(
      "Agumon",
      {
        birthTime: Date.parse("2026-03-31T00:00:00.000Z"),
        injuries: 4,
        isInjured: true,
        injuredAt: Date.parse("2026-04-01T08:00:00.000Z"),
        totalReincarnations: 1,
      },
      initializeDataMap
    );

    expect(result.injuries).toBe(4);
    expect(result.isInjured).toBe(false);
    expect(result.injuredAt).toBeNull();
  });

  test("일반 진화에서는 이번 생애 누적 배틀 기록을 유지한다", () => {
    const result = initializeStats(
      "Agumon",
      {
        birthTime: Date.parse("2026-03-31T00:00:00.000Z"),
        totalBattles: 7,
        totalBattlesWon: 5,
        totalBattlesLost: 2,
        totalWinRate: 71,
        totalReincarnations: 1,
      },
      initializeDataMap
    );

    expect(result.totalBattles).toBe(7);
    expect(result.totalBattlesWon).toBe(5);
    expect(result.totalBattlesLost).toBe(2);
    expect(result.totalWinRate).toBe(71);
  });

  test("새로운 시작에서는 누적 부상 횟수를 0으로 초기화한다", () => {
    const result = initializeStats(
      "Digitama",
      {
        birthTime: Date.parse("2026-03-31T00:00:00.000Z"),
        injuries: 4,
        isInjured: true,
        injuredAt: Date.parse("2026-04-01T08:00:00.000Z"),
        totalBattles: 9,
        totalBattlesWon: 6,
        totalBattlesLost: 3,
        totalWinRate: 67,
        totalReincarnations: 2,
      },
      initializeDataMap
    );

    expect(result.injuries).toBe(0);
    expect(result.isInjured).toBe(false);
    expect(result.injuredAt).toBeNull();
    expect(result.totalBattles).toBe(0);
    expect(result.totalBattlesWon).toBe(0);
    expect(result.totalBattlesLost).toBe(0);
    expect(result.totalWinRate).toBe(0);
  });
});

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

    expect(result.lastSavedAt).toBe(Date.parse(NOW_ISO));
    expect(result.fullness).toBe(2);
    expect(result.strength).toBe(2);
  });

  test("KST 자정 경계를 넘기면 lazy update가 나이를 하루 한 번만 증가시킨다", () => {
    jest.setSystemTime(new Date("2026-03-31T15:01:00.000Z"));

    const result = applyLazyUpdate(
      createBaseStats({
        age: 3,
        lastAgeUpdateDate: Date.parse("2026-03-30T15:00:00.000Z"),
        hungerTimer: 999,
        hungerCountdown: 999 * 60,
        strengthTimer: 999,
        strengthCountdown: 999 * 60,
        poopTimer: 999,
        poopCountdown: 999 * 60,
      }),
      Date.parse("2026-03-31T14:59:00.000Z")
    );

    expect(result.age).toBe(4);
    expect(result.lastAgeUpdateDate).toBe(Date.parse("2026-03-31T15:00:00.000Z"));
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

  test("낮잠 시간은 hunger/strength/poop countdown에서 제외한다", () => {
    const napStart = Date.parse("2026-03-31T11:00:15.000Z");
    const now = new Date("2026-03-31T12:00:15.000Z");
    jest.setSystemTime(now);

    const result = applyLazyUpdate(
      createBaseStats({
        isLightsOn: false,
        napUntil: Date.parse("2026-03-31T14:00:15.000Z"),
        lifespanSeconds: 10,
        timeToEvolveSeconds: 6000,
        hungerCountdown: 30,
        strengthCountdown: 40,
        poopCountdown: 50,
      }),
      napStart,
      { start: 22, end: 6, startMinute: 0, endMinute: 0 }
    );

    expect(result.lifespanSeconds).toBe(3610);
    expect(result.timeToEvolveSeconds).toBe(2400);
    expect(result.fullness).toBe(2);
    expect(result.strength).toBe(2);
    expect(result.poopCount).toBe(0);
    expect(result.hungerCountdown).toBe(30);
    expect(result.strengthCountdown).toBe(40);
    expect(result.poopCountdown).toBe(50);
  });

  test("낮잠 중이었던 시간은 hunger/strength/poop countdown에서 제외한다", () => {
    const napStart = Date.parse("2026-03-31T14:00:00.000Z");
    const napSleepStart = napStart + 15 * 1000;
    const napEnd = napSleepStart + 3 * 60 * 60 * 1000;
    jest.setSystemTime(new Date("2026-03-31T14:30:15.000Z"));

    const result = applyLazyUpdate(
      createBaseStats({
        hungerCountdown: 60,
        strengthCountdown: 60,
        poopCountdown: 300,
        isLightsOn: false,
        fastSleepStart: napStart,
        napUntil: napEnd,
      }),
      napStart,
      { start: 22, end: 6, startMinute: 0, endMinute: 0 }
    );

    expect(result.hungerCountdown).toBe(45);
    expect(result.strengthCountdown).toBe(45);
    expect(result.poopCountdown).toBe(285);
    expect(result.fullness).toBe(2);
    expect(result.strength).toBe(2);
    expect(result.poopCount).toBe(0);
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

  test("낮잠 중인 배고픔 호출은 sleep-like 시간만큼 deadline이 밀린다", () => {
    const hungerZeroAt = Date.parse("2026-03-31T11:00:00.000Z");
    jest.setSystemTime(new Date("2026-03-31T12:00:00.000Z"));

    const result = applyLazyUpdate(
      createBaseStats({
        fullness: 0,
        isLightsOn: false,
        napUntil: Date.parse("2026-03-31T14:05:15.000Z"),
        lastHungerZeroAt: hungerZeroAt,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null, isLogged: false },
        },
      }),
      Date.parse("2026-03-31T11:04:00.000Z"),
      { start: 22, end: 6, startMinute: 0, endMinute: 0 }
    );

    expect(result.careMistakes).toBe(0);
    expect(result.callStatus.hunger.isActive).toBe(true);
    expect(result.callStatus.hunger.startedAt).toBe(
      Date.parse("2026-03-31T11:54:45.000Z")
    );
    expect(result.hungerMistakeDeadline).toBe(
      Date.parse("2026-03-31T12:04:45.000Z")
    );
  });

  test("hunger call 10분 초과는 케어미스를 한 번 올리고 호출을 닫되 zeroAt는 유지한다", () => {
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
    expect(result.callStatus.hunger.isLogged).toBe(true);
    expect(result.lastHungerZeroAt).toBe(hungerZeroAt);
    expect(result.hungerMistakeDeadline).toBeNull();
    expect(result.activityLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "CAREMISTAKE",
          text: expect.stringContaining("배고픔 콜 10분 무시"),
        }),
      ])
    );
    expect(result.careMistakeLedger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonKey: "hunger_call",
          source: "backfill",
          text: expect.stringContaining("배고픔 콜 10분 무시"),
          resolvedAt: null,
        }),
      ])
    );
  });

  test("앱이 꺼져 있는 동안 수면 시간이 시작되어 불이 켜진 채 30분을 넘기면 수면 조명 케어미스를 복원한다", () => {
    jest.setSystemTime(new Date(2026, 2, 31, 22, 35, 0));

    const result = applyLazyUpdate(
      createBaseStats({
        isLightsOn: true,
        hungerTimer: 999,
        hungerCountdown: 999 * 60,
        strengthTimer: 999,
        strengthCountdown: 999 * 60,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null, isLogged: false },
        },
      }),
      new Date(2026, 2, 31, 21, 55, 0).getTime(),
      { start: 22, end: 6, startMinute: 0, endMinute: 0 }
    );

    const expectedStart = new Date(2026, 2, 31, 22, 0, 0).getTime();
    const expectedTimeout = new Date(2026, 2, 31, 22, 30, 0).getTime();

    expect(result.callStatus.sleep.isActive).toBe(true);
    expect(result.callStatus.sleep.startedAt).toBe(expectedStart);
    expect(result.callStatus.sleep.isLogged).toBe(true);
    expect(result.sleepLightOnStart).toBe(expectedStart);
    expect(result.careMistakes).toBe(1);
    expect(result.careMistakeLedger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonKey: "sleep_light_warning",
          occurredAt: expectedTimeout,
          source: "backfill",
        }),
      ])
    );
  });

  test("저장 경계를 넘긴 수면 조명 경고 사건은 기존 sleepLightOnStart를 이어서 계산한다", () => {
    const persistedStart = new Date(2026, 2, 31, 22, 0, 0).getTime();
    jest.setSystemTime(new Date(2026, 2, 31, 22, 40, 0));

    const result = applyLazyUpdate(
      createBaseStats({
        isLightsOn: true,
        sleepLightOnStart: persistedStart,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: true, startedAt: persistedStart, isLogged: false },
        },
      }),
      new Date(2026, 2, 31, 22, 20, 0).getTime(),
      { start: 22, end: 6, startMinute: 0, endMinute: 0 }
    );

    const expectedTimeout = new Date(2026, 2, 31, 22, 30, 0).getTime();

    expect(result.callStatus.sleep.startedAt).toBe(persistedStart);
    expect(result.callStatus.sleep.isLogged).toBe(true);
    expect(result.sleepLightOnStart).toBe(persistedStart);
    expect(result.careMistakes).toBe(1);
    expect(result.careMistakeLedger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonKey: "sleep_light_warning",
          occurredAt: expectedTimeout,
        }),
      ])
    );
  });

  test("저장된 sleepLightOnStart가 있으면 lazy update는 현재 시각이 아니라 그 시작 시각을 유지한다", () => {
    const persistedStart = new Date(2026, 2, 31, 22, 0, 0).getTime();
    jest.setSystemTime(new Date(2026, 2, 31, 22, 20, 0));

    const result = applyLazyUpdate(
      createBaseStats({
        isLightsOn: true,
        sleepLightOnStart: persistedStart,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: true, startedAt: null, isLogged: false },
        },
      }),
      new Date(2026, 2, 31, 21, 50, 0).getTime(),
      { start: 22, end: 6, startMinute: 0, endMinute: 0 }
    );

    expect(result.callStatus.sleep.startedAt).toBe(persistedStart);
    expect(result.sleepLightOnStart).toBe(persistedStart);
    expect(result.careMistakes).toBe(0);
  });

  test("이미 처리된 수면 조명 경고 사건은 저장 경계를 넘어도 다시 올리지 않는다", () => {
    const persistedStart = new Date(2026, 2, 31, 22, 0, 0).getTime();
    const timeoutOccurredAt = new Date(2026, 2, 31, 22, 30, 0).getTime();
    jest.setSystemTime(new Date(2026, 2, 31, 22, 50, 0));

    const result = applyLazyUpdate(
      createBaseStats({
        isLightsOn: true,
        careMistakes: 1,
        careMistakeLedger: [
          {
            id: `sleep_light_warning:${timeoutOccurredAt}`,
            occurredAt: timeoutOccurredAt,
            reasonKey: "sleep_light_warning",
            text: "케어미스(사유: 수면 조명 경고 30분 방치) [과거 재구성]",
            source: "backfill",
            resolvedAt: null,
            resolvedBy: null,
          },
        ],
        activityLogs: [
          {
            type: "CAREMISTAKE",
            text: "케어미스(사유: 수면 조명 경고 30분 방치) [과거 재구성]",
            timestamp: timeoutOccurredAt,
          },
        ],
        sleepLightOnStart: persistedStart,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: true, startedAt: persistedStart, isLogged: true },
        },
      }),
      new Date(2026, 2, 31, 22, 35, 0).getTime(),
      { start: 22, end: 6, startMinute: 0, endMinute: 0 }
    );

    expect(result.careMistakes).toBe(1);
    expect(result.activityLogs).toHaveLength(1);
    expect(result.careMistakeLedger).toHaveLength(1);
    expect(result.callStatus.sleep).toEqual({
      isActive: true,
      startedAt: persistedStart,
      isLogged: true,
    });
    expect(result.sleepLightOnStart).toBe(persistedStart);
  });

  test("같은 배고픔 콜 타임아웃 이벤트가 이미 ledger에 있으면 applyLazyUpdate가 다시 올리지 않는다", () => {
    const hungerZeroAt = Date.parse("2026-03-31T11:49:00.000Z");
    const timeoutOccurredAt = hungerZeroAt + 10 * 60 * 1000;

    const result = applyLazyUpdate(
      createBaseStats({
        fullness: 0,
        careMistakes: 1,
        lastHungerZeroAt: hungerZeroAt,
        careMistakeLedger: [
          {
            id: `hunger_call:${timeoutOccurredAt}`,
            occurredAt: timeoutOccurredAt,
            reasonKey: "hunger_call",
            text: "케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]",
            source: "backfill",
            resolvedAt: null,
            resolvedBy: null,
          },
        ],
        activityLogs: [
          {
            type: "CAREMISTAKE",
            text: "케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]",
            timestamp: timeoutOccurredAt,
          },
        ],
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.careMistakes).toBe(1);
    expect(result.activityLogs).toHaveLength(1);
    expect(result.careMistakeLedger).toHaveLength(1);
    expect(result.callStatus.hunger.isLogged).toBe(true);
  });

  test("실시간 케어미스 로그가 이미 있으면 lazy update가 과거 재구성 텍스트로 중복 추가하지 않는다", () => {
    const hungerZeroAt = Date.parse("2026-03-31T11:49:00.000Z");
    const timeoutOccurredAt = hungerZeroAt + 10 * 60 * 1000;

    const result = applyLazyUpdate(
      createBaseStats({
        fullness: 0,
        careMistakes: 1,
        lastHungerZeroAt: hungerZeroAt,
        activityLogs: [
          {
            type: "CAREMISTAKE",
            text: "케어미스(사유: 배고픔 콜 10분 무시): 0 → 1",
            timestamp: timeoutOccurredAt,
          },
        ],
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.careMistakes).toBe(1);
    expect(result.activityLogs).toHaveLength(1);
    expect(buildActivityLogEventId(result.activityLogs[0])).toBe(
      `caremistake:hunger_call:${timeoutOccurredAt}`
    );
  });

  test("hunger call이 이미 처리된 0 구간은 새로고침 후에도 다시 열리지 않는다", () => {
    const hungerZeroAt = Date.parse("2026-03-31T11:49:00.000Z");

    const result = applyLazyUpdate(
      createBaseStats({
        fullness: 0,
        lastHungerZeroAt: hungerZeroAt,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: true },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null },
        },
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.callStatus.hunger.isActive).toBe(false);
    expect(result.callStatus.hunger.startedAt).toBeNull();
    expect(result.callStatus.hunger.isLogged).toBe(true);
    expect(result.lastHungerZeroAt).toBe(hungerZeroAt);
    expect(result.careMistakes).toBe(0);
    expect(result.hungerMistakeDeadline).toBeNull();
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

  test("strength call 10분 초과는 케어미스를 한 번 올리고 호출을 닫되 zeroAt는 유지한다", () => {
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
    expect(result.callStatus.strength.isLogged).toBe(true);
    expect(result.lastStrengthZeroAt).toBe(strengthZeroAt);
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

  test("정규 수면 중 불 켜짐은 lazy update에서도 수면 조명 경고 케어미스를 복원한다", () => {
    jest.setSystemTime(new Date(2026, 2, 31, 22, 31, 0));

    const result = applyLazyUpdate(
      createBaseStats({
        isLightsOn: true,
        hungerTimer: 999,
        hungerCountdown: 999 * 60,
        strengthTimer: 999,
        strengthCountdown: 999 * 60,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null, isLogged: false },
        },
      }),
      new Date(2026, 2, 31, 21, 59, 0).getTime(),
      { start: 22, end: 6, startMinute: 0, endMinute: 0 }
    );

    expect(result.careMistakes).toBe(1);
    expect(result.callStatus.sleep).toEqual({
      isActive: true,
      startedAt: new Date(2026, 2, 31, 22, 0, 0).getTime(),
      isLogged: true,
    });
    expect(result.sleepLightOnStart).toBe(
      new Date(2026, 2, 31, 22, 0, 0).getTime()
    );
    expect(result.careMistakeLedger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonKey: "sleep_light_warning",
          occurredAt: new Date(2026, 2, 31, 22, 30, 0).getTime(),
          source: "backfill",
        }),
      ])
    );
  });

  test("강제 기상 중이었던 시간은 수면 제외 시간으로 빼지 않는다", () => {
    jest.setSystemTime(new Date(2026, 2, 31, 22, 5, 0));

    const result = applyLazyUpdate(
      createBaseStats({
        isLightsOn: false,
        wakeUntil: new Date(2026, 2, 31, 22, 10, 0).getTime(),
        hungerTimer: 10,
        strengthTimer: 10,
        poopTimer: 10,
        hungerCountdown: 600,
        strengthCountdown: 600,
        poopCountdown: 600,
      }),
      new Date(2026, 2, 31, 22, 0, 0).getTime(),
      { start: 22, end: 6, startMinute: 0, endMinute: 0 }
    );

    expect(result.hungerCountdown).toBe(300);
    expect(result.strengthCountdown).toBe(300);
    expect(result.poopCountdown).toBe(300);
    expect(result.wakeUntil).toBe(
      new Date(2026, 2, 31, 22, 10, 0).getTime()
    );
  });

  test("수면 조명 경고가 끝난 뒤 복귀해도 지난 사건의 케어미스는 lazy update에서 복원된다", () => {
    jest.setSystemTime(new Date(2026, 3, 1, 7, 10, 0));

    const result = applyLazyUpdate(
      createBaseStats({
        isLightsOn: true,
        hungerTimer: 999,
        hungerCountdown: 999 * 60,
        strengthTimer: 999,
        strengthCountdown: 999 * 60,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: { isActive: false, startedAt: null, isLogged: false },
        },
      }),
      new Date(2026, 2, 31, 21, 50, 0).getTime(),
      { start: 22, end: 6, startMinute: 0, endMinute: 0 }
    );

    expect(result.careMistakes).toBe(1);
    expect(result.callStatus.sleep).toEqual({
      isActive: false,
      startedAt: null,
      isLogged: false,
    });
    expect(result.sleepLightOnStart).toBeNull();
    expect(result.careMistakeLedger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonKey: "sleep_light_warning",
          occurredAt: new Date(2026, 2, 31, 22, 30, 0).getTime(),
        }),
      ])
    );
  });

  test("끝난 낮잠으로 남아 있던 fastSleepStart와 napUntil은 lazy update에서 정리된다", () => {
    jest.setSystemTime(new Date(2026, 2, 31, 15, 30, 0));

    const result = applyLazyUpdate(
      createBaseStats({
        isLightsOn: false,
        fastSleepStart: new Date(2026, 2, 31, 11, 0, 0).getTime(),
        napUntil: new Date(2026, 2, 31, 14, 0, 15).getTime(),
      }),
      new Date(2026, 2, 31, 14, 5, 0).getTime(),
      { start: 22, end: 6, startMinute: 0, endMinute: 0 }
    );

    expect(result.fastSleepStart).toBeNull();
    expect(result.napUntil).toBeNull();
  });

  test("strength call이 이미 처리된 0 구간은 새로고침 후에도 다시 열리지 않는다", () => {
    const strengthZeroAt = Date.parse("2026-03-31T11:49:00.000Z");

    const result = applyLazyUpdate(
      createBaseStats({
        strength: 0,
        lastStrengthZeroAt: strengthZeroAt,
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: true },
          sleep: { isActive: false, startedAt: null },
        },
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.callStatus.strength.isActive).toBe(false);
    expect(result.callStatus.strength.startedAt).toBeNull();
    expect(result.callStatus.strength.isLogged).toBe(true);
    expect(result.lastStrengthZeroAt).toBe(strengthZeroAt);
    expect(result.careMistakes).toBe(0);
    expect(result.strengthMistakeDeadline).toBeNull();
  });

  test("회복된 배고픔/힘은 기존 zeroAt를 정리하고 다시 0이 되면 새 시각으로 기록한다", () => {
    const oldZeroAt = Date.parse("2026-03-31T09:00:00.000Z");

    const result = applyLazyUpdate(
      createBaseStats({
        fullness: 1,
        hungerCountdown: 30,
        lastHungerZeroAt: oldZeroAt,
        strength: 1,
        strengthCountdown: 30,
        lastStrengthZeroAt: oldZeroAt,
      }),
      Date.parse("2026-03-31T11:59:00.000Z")
    );

    expect(result.fullness).toBe(0);
    expect(result.strength).toBe(0);
    expect(result.lastHungerZeroAt).toBe(Date.parse("2026-03-31T11:59:30.000Z"));
    expect(result.lastStrengthZeroAt).toBe(Date.parse("2026-03-31T11:59:30.000Z"));
  });

  test("poopCount가 7에서 8이 되면 즉시 부상과 새 시간 필드를 설정하고 케어미스는 올리지 않는다", () => {
    const result = applyLazyUpdate(
      createBaseStats({
        poopCount: 7,
        poopCountdown: 60,
        poopTimer: 5,
      }),
      Date.parse("2026-03-31T11:59:00.000Z")
    );

    expect(result.poopCount).toBe(8);
    expect(result.isInjured).toBe(true);
    expect(result.injuries).toBe(1);
    expect(result.poopReachedMaxAt).toBe(Date.parse(NOW_ISO));
    expect(result.lastPoopPenaltyAt).toBe(Date.parse(NOW_ISO));
    expect(result.injuredAt).toBe(Date.parse(NOW_ISO));
    expect(result.careMistakes).toBe(0);
  });

  test("poop 8개를 8시간 이상 방치하면 추가 부상만 발생하고 케어미스는 증가하지 않는다", () => {
    const poopReachedMaxAt = Date.parse("2026-03-31T04:00:00.000Z");

    const result = applyLazyUpdate(
      createBaseStats({
        poopCount: 8,
        poopCountdown: 300,
        poopReachedMaxAt,
        lastPoopPenaltyAt: poopReachedMaxAt,
        isInjured: true,
        injuredAt: poopReachedMaxAt,
        injuries: 1,
      }),
      Date.parse("2026-03-31T03:54:00.000Z")
    );

    expect(result.poopCount).toBe(8);
    expect(result.injuries).toBe(2);
    expect(result.careMistakes).toBe(0);
    expect(result.poopReachedMaxAt).toBe(poopReachedMaxAt);
    expect(result.lastPoopPenaltyAt).toBe(Date.parse(NOW_ISO));
    expect(result.injuredAt).toBe(Date.parse(NOW_ISO));
    expect(result.injuryReason).toBe("poop");
  });

  test("실시간 똥 부상 로그가 이미 있으면 lazy update가 같은 사건을 중복 기록하지 않는다", () => {
    const poopReachedMaxAt = Date.parse("2026-03-31T11:59:00.000Z");

    const result = applyLazyUpdate(
      createBaseStats({
        poopCount: 8,
        poopCountdown: 0,
        poopReachedMaxAt,
        lastPoopPenaltyAt: poopReachedMaxAt,
        isInjured: false,
        injuries: 0,
        activityLogs: [
          {
            type: "POOP",
            text: "Pooped (Total: 7→8) - Injury: Too much poop (8 piles)",
            timestamp: poopReachedMaxAt,
          },
        ],
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.injuries).toBe(1);
    expect(result.activityLogs).toHaveLength(1);
    expect(buildActivityLogEventId(result.activityLogs[0])).toBe(
      `poop:max_poop:${poopReachedMaxAt}`
    );
  });

  test("poopCount가 8 미만이면 legacy lastMaxPoopTime은 새 필드로 유지하지 않는다", () => {
    const result = applyLazyUpdate(
      createBaseStats({
        poopCount: 2,
        lastMaxPoopTime: Date.parse("2026-03-31T05:00:00.000Z"),
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.poopReachedMaxAt).toBeNull();
    expect(result.lastPoopPenaltyAt).toBeNull();
    expect(result.lastMaxPoopTime).toBeUndefined();
  });

  test("기존 저장 데이터의 lastMaxPoopTime은 poopCount가 8일 때 새 필드로 마이그레이션된다", () => {
    const legacyTime = Date.parse("2026-03-31T05:00:00.000Z");

    const result = applyLazyUpdate(
      createBaseStats({
        poopCount: 8,
        lastMaxPoopTime: legacyTime,
        poopReachedMaxAt: null,
        lastPoopPenaltyAt: null,
      }),
      Date.parse("2026-03-31T11:59:59.000Z")
    );

    expect(result.poopReachedMaxAt).toBe(legacyTime);
    expect(result.lastPoopPenaltyAt).toBe(legacyTime);
    expect(result.lastMaxPoopTime).toBeUndefined();
  });

  test("poop 청소는 poop 관련 시간 필드만 정리하고 부상 상태는 유지한다", () => {
    const cleanedAt = new Date(NOW_ISO);
    const result = clearPoopOverflowState(
      createBaseStats({
        poopCount: 8,
        poopReachedMaxAt: Date.parse("2026-03-31T10:00:00.000Z"),
        lastPoopPenaltyAt: Date.parse("2026-03-31T11:00:00.000Z"),
        isInjured: true,
        injuries: 3,
      }),
      cleanedAt
    );

    expect(result.poopCount).toBe(0);
    expect(result.poopReachedMaxAt).toBeNull();
    expect(result.lastPoopPenaltyAt).toBeNull();
    expect(result.isInjured).toBe(true);
    expect(result.injuries).toBe(3);
    expect(result.lastSavedAt).toBe(cleanedAt.getTime());
  });

  test("치료는 active injury만 정리하고 누적 injuries는 유지한다", () => {
    const result = clearActiveInjuryState(
      createBaseStats({
        isInjured: true,
        injuredAt: Date.parse("2026-03-31T11:00:00.000Z"),
        injuries: 4,
        healedDosesCurrent: 1,
        injuryReason: "poop",
      })
    );

    expect(result.isInjured).toBe(false);
    expect(result.injuredAt).toBeNull();
    expect(result.healedDosesCurrent).toBe(0);
    expect(result.injuryReason).toBeNull();
    expect(result.injuries).toBe(4);
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

  test("부상 방치 6시간 사망은 냉장고에 넣어둔 시간을 제외한다", () => {
    const result = applyLazyUpdate(
      createBaseStats({
        isInjured: true,
        injuredAt: Date.parse("2026-03-31T05:30:00.000Z"),
        frozenAt: Date.parse("2026-03-31T06:00:00.000Z"),
        takeOutAt: Date.parse("2026-03-31T10:00:00.000Z"),
      }),
      Date.parse("2026-03-31T11:59:30.000Z")
    );

    expect(result.isDead).toBe(false);
    expect(result.deathReason).toBeUndefined();
  });
});
