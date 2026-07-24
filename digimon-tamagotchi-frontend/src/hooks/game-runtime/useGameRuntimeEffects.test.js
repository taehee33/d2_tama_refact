import { renderHook } from "@testing-library/react";
import { useGameRuntimeEffects } from "./useGameRuntimeEffects";

const mockUseGameClock = jest.fn();
const mockUseGamePeriodicSync = jest.fn();
const mockUseGameRealtimeLoop = jest.fn();
const mockUseGameSleepStatusLoop = jest.fn();
const mockUseTakeOutCleanup = jest.fn();

jest.mock("./useGameClock", () => ({
  useGameClock: (...args) => mockUseGameClock(...args),
}));

jest.mock("./useGamePeriodicSync", () => ({
  useGamePeriodicSync: (...args) => mockUseGamePeriodicSync(...args),
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
    mockUseGamePeriodicSync.mockReset();
    mockUseGameRealtimeLoop.mockReset();
    mockUseGameSleepStatusLoop.mockReset();
    mockUseTakeOutCleanup.mockReset();
  });

  test("기존 runtime 하위 hook들을 같은 계약으로 호출한다", () => {
    const options = {
      setCustomTime: jest.fn(),
      slotId: "1",
      currentUser: { uid: "user-1" },
      isLoadingSlot: false,
      isGameplayReady: true,
      digimonStats: {
        takeOutAt: 1234,
      },
      selectedDigimon: "Agumon",
      digimonDataForSlot: { Agumon: { sprite: 100 } },
      isLightsOn: true,
      wakeUntil: 5678,
      deathReason: null,
      hasSeenDeathPopup: false,
      appendLogToSubcollection: jest.fn(),
      persistDeathSnapshot: jest.fn(),
      setDigimonStats: jest.fn(),
      setDigimonStatsAndSave: jest.fn(),
      setActivityLogs: jest.fn(),
      setSleepStatus: jest.fn(),
      setIsSleeping: jest.fn(),
      setDeathReason: jest.fn(),
      setHasSeenDeathPopup: jest.fn(),
      nextStateSyncAt: 123456,
    };

    renderHook(() => useGameRuntimeEffects(options));

    expect(mockUseGameClock).toHaveBeenCalledWith(options.setCustomTime);
    expect(mockUseGamePeriodicSync).toHaveBeenCalledWith({
      slotId: "1",
      currentUser: options.currentUser,
      isLoadingSlot: false,
      digimonStats: options.digimonStats,
      setDigimonStatsAndSave: options.setDigimonStatsAndSave,
      nextSyncAt: options.nextStateSyncAt,
    });
    expect(mockUseGameRealtimeLoop).toHaveBeenCalledWith({
      enabled: true,
      digimonStats: options.digimonStats,
      setDigimonStats: options.setDigimonStats,
      setActivityLogs: options.setActivityLogs,
      setIsSleeping: options.setIsSleeping,
      setDeathReason: options.setDeathReason,
      setHasSeenDeathPopup: options.setHasSeenDeathPopup,
      digimonDataForSlot: options.digimonDataForSlot,
      selectedDigimon: options.selectedDigimon,
      isLightsOn: options.isLightsOn,
      wakeUntil: options.wakeUntil,
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

  test("게임 상태가 ready가 아니면 realtime loop를 비활성화한다", () => {
    renderHook(() => useGameRuntimeEffects({
      setCustomTime: jest.fn(),
      slotId: "1",
      currentUser: { uid: "user-1" },
      isLoadingSlot: true,
      isGameplayReady: false,
      digimonStats: {},
      digimonDataForSlot: {},
      setDigimonStats: jest.fn(),
      setActivityLogs: jest.fn(),
      setSleepStatus: jest.fn(),
      setIsSleeping: jest.fn(),
      setDeathReason: jest.fn(),
      setHasSeenDeathPopup: jest.fn(),
    }));

    expect(mockUseGameRealtimeLoop).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });
});
