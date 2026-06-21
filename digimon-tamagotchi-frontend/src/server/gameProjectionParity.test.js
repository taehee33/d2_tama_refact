import { applyLazyUpdate as applyFrontendLazyUpdate } from "../data/stats";

const { applyLazyUpdate: applyServerLazyUpdate } = require("../../api/_generated/gameProjection.cjs");

const clone = (value) => JSON.parse(JSON.stringify(value));

function createStats(overrides = {}) {
  return {
    isDead: false,
    birthTime: Date.parse("2026-06-20T00:00:00.000Z"),
    lifespanSeconds: 0,
    timeToEvolveSeconds: 999999,
    hungerTimer: 60,
    hungerCountdown: 60,
    fullness: 1,
    strengthTimer: 60,
    strengthCountdown: 60,
    strength: 1,
    poopTimer: 120,
    poopCountdown: 7200,
    poopCount: 0,
    callStatus: {
      hunger: { isActive: false, startedAt: null, isLogged: false },
      strength: { isActive: false, startedAt: null, isLogged: false },
      sleep: { isActive: false, startedAt: null, isLogged: false },
    },
    careMistakes: 0,
    careMistakeLedger: [],
    injuries: 0,
    isInjured: false,
    injuredAt: null,
    activityLogs: [],
    isFrozen: false,
    frozenAt: null,
    takeOutAt: null,
    lastHungerZeroAt: null,
    lastStrengthZeroAt: null,
    ...overrides,
  };
}

describe("서버 game projection parity", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test.each([
    ["13시간 오프라인", createStats(), { start: 23, end: 7, startMinute: 0, endMinute: 0 }],
    ["냉장고 포함", createStats({ frozenAt: Date.parse("2026-06-21T01:00:00.000Z") }), null],
    ["부상 방치", createStats({ isInjured: true, injuredAt: Date.parse("2026-06-20T23:00:00.000Z") }), null],
  ])("%s 계산 결과가 프론트와 같다", (_name, stats, sleepSchedule) => {
    const now = Date.parse("2026-06-21T13:00:00.000Z");
    const lastSavedAt = Date.parse("2026-06-21T00:00:00.000Z");
    jest.setSystemTime(now);

    const frontendResult = applyFrontendLazyUpdate(
      clone(stats),
      lastSavedAt,
      sleepSchedule,
      20,
      { nowMs: now }
    );
    const serverResult = applyServerLazyUpdate(
      clone(stats),
      lastSavedAt,
      sleepSchedule,
      20,
      { nowMs: now }
    );

    expect(serverResult).toEqual(frontendResult);
  });
});
