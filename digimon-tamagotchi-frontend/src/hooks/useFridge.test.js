import { act, renderHook } from "@testing-library/react";
import {
  buildPutInFridgeCommitState,
  buildTakeOutFridgeCommitState,
  buildTakeOutFridgeLogText,
  formatFridgeDurationText,
  useFridge,
} from "./useFridge";

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

  test("buildPutInFridgeCommitState는 호출 상태를 비활성화하고 frozenAt을 기록한다", () => {
    const currentStats = createCurrentStats({
      isFrozen: false,
      callStatus: {
        hunger: { isActive: true, startedAt: 10, sleepStartAt: 20, isLogged: false },
        strength: { isActive: true, startedAt: 30, sleepStartAt: 40, isLogged: false },
        sleep: { isActive: true, startedAt: 50, isLogged: true },
      },
    });

    expect(
      buildPutInFridgeCommitState(currentStats, Date.parse("2026-04-07T12:00:00.000Z"))
    ).toMatchObject({
      isFrozen: true,
      frozenAt: Date.parse("2026-04-07T12:00:00.000Z"),
      callStatus: {
        hunger: { isActive: false, sleepStartAt: null },
        strength: { isActive: false, sleepStartAt: null },
        sleep: { isActive: false, startedAt: null, isLogged: false },
      },
    });
  });

  test("formatFridgeDurationText는 초, 분, 시간 단위 문자열을 만든다", () => {
    expect(formatFridgeDurationText(45)).toBe("45초");
    expect(formatFridgeDurationText(180)).toBe("3분");
    expect(formatFridgeDurationText(3900)).toBe("1시간 5분");
  });

  test("buildTakeOutFridgeCommitState는 냉동 보관 시간을 스탯에 반영한다", () => {
    const currentStats = createCurrentStats({
      strength: 0,
      lastStrengthZeroAt: Date.parse("2026-04-07T11:45:00.000Z"),
      strengthMistakeDeadline: Date.parse("2026-04-07T11:55:00.000Z"),
      callStatus: {
        hunger: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
        strength: { isActive: false, startedAt: Date.parse("2026-04-07T11:45:00.000Z"), sleepStartAt: null, isLogged: false },
        sleep: { isActive: true, startedAt: 1234, isLogged: true },
      },
    });

    const result = buildTakeOutFridgeCommitState(
      currentStats,
      Date.parse("2026-04-07T12:00:00.000Z")
    );

    expect(result.frozenDurationSeconds).toBe(300);
    expect(result.updatedStats.isFrozen).toBe(false);
    expect(result.updatedStats.frozenAt).toBeNull();
    expect(result.updatedStats.strengthZeroFrozenDurationMs).toBe(300000);
    expect(result.updatedStats.callStatus.sleep).toMatchObject({
      isActive: false,
      startedAt: null,
      isLogged: false,
    });
  });

  test("buildTakeOutFridgeLogText는 보관 시간과 메시지를 함께 포맷한다", () => {
    expect(buildTakeOutFridgeLogText(300, "잘 잤다!")).toBe(
      "냉장고에서 꺼냈습니다. (5분 동안 보관) - 잘 잤다!"
    );
  });
});
