import React from "react";
import { renderHook, act } from "@testing-library/react";
import { useGameHandlers } from "./useGameHandlers";

function createDefaultParams(overrides = {}) {
  return {
    selectedDigimon: "Koromon",
    digimonStats: {
      activityLogs: [],
      callStatus: {
        hunger: { isActive: false, startedAt: null, isLogged: false },
        strength: { isActive: false, startedAt: null, isLogged: false },
        sleep: { isActive: true, startedAt: Date.now() - 1000 },
      },
    },
    setDigimonStats: jest.fn(),
    wakeUntil: null,
    setWakeUntil: jest.fn(),
    isLightsOn: true,
    setIsLightsOn: jest.fn(),
    activeMenu: null,
    setActiveMenu: jest.fn(),
    currentQuestArea: null,
    clearedQuestIndex: 0,
    setCurrentQuestArea: jest.fn(),
    setCurrentQuestRound: jest.fn(),
    setCurrentQuestVersion: jest.fn(),
    setBattleType: jest.fn(),
    setSparringEnemySlot: jest.fn(),
    setClearedQuestIndex: jest.fn(),
    setActivityLogs: jest.fn(),
    appendLogToSubcollection: jest.fn().mockResolvedValue(undefined),
    toggleModal: jest.fn(),
    setDigimonStatsAndSave: jest.fn().mockResolvedValue(undefined),
    applyLazyUpdateBeforeAction: jest.fn(),
    handleCleanPoopFromHook: jest.fn(),
    startHealCycle: jest.fn(),
    setHealModalStats: jest.fn(),
    quests: [],
    digimonDataVer1: {
      Koromon: {
        sleepSchedule: { start: 22, end: 6, startMinute: 0, endMinute: 0 },
      },
    },
    slotId: "1",
    currentUser: { uid: "tester" },
    logout: jest.fn(),
    navigate: jest.fn(),
    setIsSleeping: jest.fn(),
    onSleepDisturbance: jest.fn(),
    ...overrides,
  };
}

describe("useGameHandlers handleToggleLights", () => {
  test("조명 토글 시 최신 isLightsOn 값을 stats에 실어 save 경로 한 번으로 저장한다", async () => {
    const params = createDefaultParams();
    const { result } = renderHook(() => useGameHandlers(params));

    await act(async () => {
      await result.current.handleToggleLights();
    });

    expect(params.setIsLightsOn).toHaveBeenCalledWith(false);
    expect(params.setDigimonStatsAndSave).toHaveBeenCalledTimes(1);
    expect(params.setDigimonStatsAndSave).toHaveBeenCalledWith(
      expect.objectContaining({
        isLightsOn: false,
      }),
      expect.any(Array)
    );
  });
});
