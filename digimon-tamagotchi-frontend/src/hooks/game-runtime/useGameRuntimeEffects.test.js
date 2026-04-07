import { renderHook } from "@testing-library/react";
import { useGameRuntimeEffects } from "./useGameRuntimeEffects";

const mockUseGameClock = jest.fn();
const mockUseGameSaveOnLeave = jest.fn();
const mockUseGameRealtimeLoop = jest.fn();
const mockUseGameSleepStatusLoop = jest.fn();
const mockUseTakeOutCleanup = jest.fn();

jest.mock("./useGameClock", () => ({
  useGameClock: (...args) => mockUseGameClock(...args),
}));

jest.mock("./useGameSaveOnLeave", () => ({
  useGameSaveOnLeave: (...args) => mockUseGameSaveOnLeave(...args),
}));

jest.mock("./useGameRealtimeLoop", () => ({
  useGameRealtimeLoop: (...args) => mockUseGameRealtimeLoop(...args),
}));

jest.mock("./useGameSleepStatusLoop", () => ({
  useGameSleepStatusLoop: (...args) => mockUseGameSleepStatusLoop(...args),
}));

jest.mock("./useTakeOutCleanup", () => ({
  useTakeOutCleanup: (...args) => mockUseTakeOutCleanup(...args),
}));

describe("useGameRuntimeEffects", () => {
  beforeEach(() => {
    mockUseGameClock.mockReset();
    mockUseGameSaveOnLeave.mockReset();
    mockUseGameRealtimeLoop.mockReset();
    mockUseGameSleepStatusLoop.mockReset();
    mockUseTakeOutCleanup.mockReset();
  });

  test("기존 runtime 하위 hook들을 같은 계약으로 호출한다", () => {
    const options = {
      setCustomTime: jest.fn(),
      slotId: "1",
      currentUser: { uid: "user-1" },
      digimonStats: {
        takeOutAt: 1234,
      },
      selectedDigimon: "Agumon",
      digimonDataForSlot: { Agumon: { sprite: 100 } },
      isLightsOn: true,
      wakeUntil: 5678,
      dailySleepMistake: false,
      deathReason: null,
      hasSeenDeathPopup: false,
      appendLogToSubcollection: jest.fn(),
      persistDeathSnapshot: jest.fn(),
      setDigimonStats: jest.fn(),
      setDigimonStatsAndSave: jest.fn(),
      setActivityLogs: jest.fn(),
      setSleepStatus: jest.fn(),
      setIsSleeping: jest.fn(),
      setDailySleepMistake: jest.fn(),
      setDeathReason: jest.fn(),
      setHasSeenDeathPopup: jest.fn(),
    };

    renderHook(() => useGameRuntimeEffects(options));

    expect(mockUseGameClock).toHaveBeenCalledWith(options.setCustomTime);
    expect(mockUseGameSaveOnLeave).toHaveBeenCalledWith({
      slotId: "1",
      currentUser: options.currentUser,
      digimonStats: options.digimonStats,
      setDigimonStatsAndSave: options.setDigimonStatsAndSave,
    });
    expect(mockUseGameRealtimeLoop).toHaveBeenCalledWith({
      digimonStats: options.digimonStats,
      setDigimonStats: options.setDigimonStats,
      setActivityLogs: options.setActivityLogs,
      setIsSleeping: options.setIsSleeping,
      setDailySleepMistake: options.setDailySleepMistake,
      setDeathReason: options.setDeathReason,
      setHasSeenDeathPopup: options.setHasSeenDeathPopup,
      digimonDataForSlot: options.digimonDataForSlot,
      selectedDigimon: options.selectedDigimon,
      isLightsOn: options.isLightsOn,
      wakeUntil: options.wakeUntil,
      dailySleepMistake: options.dailySleepMistake,
      deathReason: options.deathReason,
      hasSeenDeathPopup: options.hasSeenDeathPopup,
      slotId: options.slotId,
      currentUser: options.currentUser,
      appendLogToSubcollection: options.appendLogToSubcollection,
      setDigimonStatsAndSave: options.setDigimonStatsAndSave,
      persistDeathSnapshot: options.persistDeathSnapshot,
    });
    expect(mockUseGameSleepStatusLoop).toHaveBeenCalledWith({
      selectedDigimon: options.selectedDigimon,
      digimonDataForSlot: options.digimonDataForSlot,
      digimonStats: options.digimonStats,
      isLightsOn: options.isLightsOn,
      wakeUntil: options.wakeUntil,
      setSleepStatus: options.setSleepStatus,
    });
    expect(mockUseTakeOutCleanup).toHaveBeenCalledWith({
      takeOutAt: 1234,
      setDigimonStats: options.setDigimonStats,
    });
  });
});
