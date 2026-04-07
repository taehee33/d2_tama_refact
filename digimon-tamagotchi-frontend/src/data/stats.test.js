import {
  applyLazyUpdate,
  clearActiveInjuryState,
  clearPoopOverflowState,
  initializeStats,
} from "./stats";

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
      sleep: { isActive: false, startedAt: null },
    },
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

  test("새로운 시작에서는 누적 부상 횟수를 0으로 초기화한다", () => {
    const result = initializeStats(
      "Digitama",
      {
        birthTime: Date.parse("2026-03-31T00:00:00.000Z"),
        injuries: 4,
        isInjured: true,
        injuredAt: Date.parse("2026-04-01T08:00:00.000Z"),
        totalReincarnations: 2,
      },
      initializeDataMap
    );

    expect(result.injuries).toBe(0);
    expect(result.isInjured).toBe(false);
    expect(result.injuredAt).toBeNull();
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
    expect(result.lastSavedAt).toBe(cleanedAt);
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
