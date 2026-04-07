import { act, renderHook } from "@testing-library/react";
import { useFridge } from "./useFridge";

function createCurrentStats(overrides = {}) {
  return {
    isDead: false,
    isFrozen: true,
    frozenAt: Date.parse("2026-04-07T11:55:00.000Z"),
    takeOutAt: null,
    fullness: 0,
    strength: 1,
    poopCount: 0,
    lastHungerZeroAt: Date.parse("2026-04-07T11:40:00.000Z"),
    lastStrengthZeroAt: null,
    hungerZeroFrozenDurationMs: 0,
    strengthZeroFrozenDurationMs: 0,
    injuryFrozenDurationMs: 0,
    poopPenaltyFrozenDurationMs: 0,
    hungerMistakeDeadline: Date.parse("2026-04-07T11:50:00.000Z"),
    strengthMistakeDeadline: null,
    callStatus: {
      hunger: { isActive: false, startedAt: Date.parse("2026-04-07T11:40:00.000Z"), sleepStartAt: null, isLogged: false },
      strength: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
      sleep: { isActive: false, startedAt: null },
    },
    activityLogs: [],
    ...overrides,
  };
}

function createParams(currentStats) {
  return {
    digimonStats: currentStats,
    setDigimonStatsAndSave: jest.fn().mockResolvedValue(undefined),
    applyLazyUpdateBeforeAction: jest.fn().mockResolvedValue(currentStats),
    setActivityLogs: jest.fn(),
    activityLogs: currentStats.activityLogs || [],
    appendLogToSubcollection: jest.fn().mockResolvedValue(undefined),
  };
}

describe("useFridge", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-07T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("냉장고에서 꺼내면 hunger zero 기준 시각은 유지하고 호출 창만 보관 시간만큼 민다", async () => {
    const currentStats = createCurrentStats();
    const params = createParams(currentStats);
    const { result } = renderHook(() => useFridge(params));

    await act(async () => {
      await result.current.takeOutFromFridge();
    });

    const [savedStats] = params.setDigimonStatsAndSave.mock.calls[0];
    const frozenDuration = Date.parse("2026-04-07T12:00:00.000Z") - currentStats.frozenAt;

    expect(savedStats.lastHungerZeroAt).toBe(currentStats.lastHungerZeroAt);
    expect(savedStats.hungerZeroFrozenDurationMs).toBe(frozenDuration);
    expect(savedStats.callStatus.hunger.startedAt).toBe(
      currentStats.callStatus.hunger.startedAt + frozenDuration
    );
    expect(savedStats.hungerMistakeDeadline).toBe(
      currentStats.hungerMistakeDeadline + frozenDuration
    );
  });

  test("냉장고에서 꺼내면 strength 호출 창도 같은 방식으로 이어진다", async () => {
    const currentStats = createCurrentStats({
      fullness: 1,
      strength: 0,
      lastHungerZeroAt: null,
      lastStrengthZeroAt: Date.parse("2026-04-07T11:42:00.000Z"),
      strengthMistakeDeadline: Date.parse("2026-04-07T11:52:00.000Z"),
      callStatus: {
        hunger: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
        strength: { isActive: false, startedAt: Date.parse("2026-04-07T11:42:00.000Z"), sleepStartAt: null, isLogged: false },
        sleep: { isActive: false, startedAt: null },
      },
    });
    const params = createParams(currentStats);
    const { result } = renderHook(() => useFridge(params));

    await act(async () => {
      await result.current.takeOutFromFridge();
    });

    const [savedStats] = params.setDigimonStatsAndSave.mock.calls[0];
    const frozenDuration = Date.parse("2026-04-07T12:00:00.000Z") - currentStats.frozenAt;

    expect(savedStats.lastStrengthZeroAt).toBe(currentStats.lastStrengthZeroAt);
    expect(savedStats.strengthZeroFrozenDurationMs).toBe(frozenDuration);
    expect(savedStats.callStatus.strength.startedAt).toBe(
      currentStats.callStatus.strength.startedAt + frozenDuration
    );
    expect(savedStats.strengthMistakeDeadline).toBe(
      currentStats.strengthMistakeDeadline + frozenDuration
    );
  });
});
