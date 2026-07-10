import {
  applyLazyUpdate as applyFrontendLazyUpdate,
  projectState as projectFrontendState,
} from "../data/stats";

const {
  applyLazyUpdate: applyServerLazyUpdate,
  projectState: projectServerState,
} = require("../../api/_generated/gameProjection.cjs");

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
    [
      "수면 조명 케어미스",
      createStats({
        isLightsOn: true,
        wakeUntil: Date.parse("2026-06-21T00:30:00.000Z"),
        sleepLightOnStart: Date.parse("2026-06-21T00:00:00.000Z"),
        callStatus: {
          hunger: { isActive: false, startedAt: null, isLogged: false },
          strength: { isActive: false, startedAt: null, isLogged: false },
          sleep: {
            isActive: true,
            startedAt: Date.parse("2026-06-21T00:00:00.000Z"),
            isLogged: false,
          },
        },
      }),
      { start: 0, end: 8, startMinute: 0, endMinute: 0 },
    ],
    [
      "똥 다중 누적",
      createStats({
        hungerTimer: 999,
        hungerCountdown: 999 * 60,
        strengthTimer: 999,
        strengthCountdown: 999 * 60,
        poopTimer: 30,
        poopCountdown: 30 * 60,
        poopCount: 2,
      }),
      null,
    ],
    [
      "진화 가능 시점",
      createStats({
        selectedDigimon: "Agumon",
        currentDigimon: "Agumon",
        digimonId: "Agumon",
        timeToEvolveSeconds: 30,
      }),
      null,
    ],
    [
      "수면 후 energy 회복",
      createStats({
        energy: 2,
        lastEnergyRecoveryAt: Date.parse("2026-06-21T05:00:00.000Z"),
        hungerTimer: 999,
        hungerCountdown: 999 * 60,
        strengthTimer: 999,
        strengthCountdown: 999 * 60,
        poopTimer: 999,
        poopCountdown: 999 * 60,
      }),
      { start: 23, end: 7, startMinute: 0, endMinute: 0 },
    ],
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

  test("똥 부상 로그 문구와 포함 관계가 프론트와 서버에서 같다", () => {
    const now = Date.parse("2026-06-21T13:00:00.000Z");
    const maxLastSavedAt = Date.parse("2026-06-21T12:59:00.000Z");
    const penaltyReachedAt = Date.parse("2026-06-21T05:00:00.000Z");
    const penaltyLastSavedAt = Date.parse("2026-06-21T04:55:00.000Z");

    jest.setSystemTime(now);

    const maxStats = createStats({
      hungerTimer: 999,
      hungerCountdown: 999 * 60,
      strengthTimer: 999,
      strengthCountdown: 999 * 60,
      poopTimer: 5,
      poopCountdown: 60,
      poopCount: 7,
    });
    const penaltyStats = createStats({
      hungerTimer: 999,
      hungerCountdown: 999 * 60,
      strengthTimer: 999,
      strengthCountdown: 999 * 60,
      poopCount: 8,
      poopCountdown: 300,
      poopReachedMaxAt: penaltyReachedAt,
      lastPoopPenaltyAt: penaltyReachedAt,
      isInjured: true,
      injuredAt: penaltyReachedAt,
      injuries: 1,
    });

    const frontendMaxResult = applyFrontendLazyUpdate(clone(maxStats), maxLastSavedAt, null, 20, { nowMs: now });
    const serverMaxResult = applyServerLazyUpdate(clone(maxStats), maxLastSavedAt, null, 20, { nowMs: now });
    const frontendPenaltyResult = applyFrontendLazyUpdate(clone(penaltyStats), penaltyLastSavedAt, null, 20, { nowMs: now });
    const serverPenaltyResult = applyServerLazyUpdate(clone(penaltyStats), penaltyLastSavedAt, null, 20, { nowMs: now });

    const poopMaxText = "Pooped (Total: 8) - Injury: Too much poop (8 piles) [과거 재구성]";
    const poopPenaltyText = "똥 8개 방치 8시간 경과 x1 - 추가 부상 [과거 재구성]";

    expect(serverMaxResult).toEqual(frontendMaxResult);
    expect(serverPenaltyResult).toEqual(frontendPenaltyResult);
    expect(frontendMaxResult.activityLogs.map((log) => log.text)).toContain(poopMaxText);
    expect(frontendPenaltyResult.activityLogs.map((log) => log.text)).toContain(poopPenaltyText);
    expect(poopMaxText.includes("Too much poop")).toBe(true);
    expect(poopPenaltyText.includes("8시간 경과")).toBe(true);
  });

  test("projectState export도 같은 nowMs에서 프론트와 서버 결과가 같다", () => {
    const now = Date.parse("2026-06-21T13:00:00.000Z");
    const lastSavedAt = Date.parse("2026-06-21T00:00:00.000Z");
    const stats = createStats({
      lifespanSeconds: 120,
      timeToEvolveSeconds: 60 * 60,
      hungerCountdown: 30,
      strengthCountdown: 45,
      poopCountdown: 90,
    });

    const frontendResult = projectFrontendState(clone(stats), now, {
      lastSavedAt,
      sleepSchedule: { start: 23, end: 7, startMinute: 0, endMinute: 0 },
      maxEnergy: 20,
    });
    const serverResult = projectServerState(clone(stats), now, {
      lastSavedAt,
      sleepSchedule: { start: 23, end: 7, startMinute: 0, endMinute: 0 },
      maxEnergy: 20,
    });

    expect(serverResult).toEqual(frontendResult);
  });
});
