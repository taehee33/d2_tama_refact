import { useGameClock } from "./useGameClock";
import { useGamePeriodicSync } from "./useGamePeriodicSync";
import { useGameRealtimeLoop } from "./useGameRealtimeLoop";
import { useGameSaveOnLeave } from "./useGameSaveOnLeave";
import { useGameSleepStatusLoop } from "./useGameSleepStatusLoop";
import { useTakeOutCleanup } from "./useTakeOutCleanup";

export function useGameRuntimeEffects({
  setCustomTime,
  slotId,
  currentUser,
  isLoadingSlot,
  digimonStats,
  selectedDigimon,
  digimonDataForSlot,
  isLightsOn,
  wakeUntil,
  deathReason,
  hasSeenDeathPopup,
  appendLogToSubcollection,
  persistDeathSnapshot,
  setDigimonStats,
  setDigimonStatsAndSave,
  setActivityLogs,
  setSleepStatus,
  setIsSleeping,
  setDeathReason,
  setHasSeenDeathPopup,
  nextStateSyncAt,
}) {
  useGameClock(setCustomTime);

  useGameSaveOnLeave({
    slotId,
    currentUser,
    digimonStats,
    setDigimonStatsAndSave,
    nextSyncAt: nextStateSyncAt,
  });

  useGamePeriodicSync({
    slotId,
    currentUser,
    isLoadingSlot,
    digimonStats,
    setDigimonStatsAndSave,
  });

  useGameRealtimeLoop({
    digimonStats,
    setDigimonStats,
    setActivityLogs,
    setIsSleeping,
    setDeathReason,
    setHasSeenDeathPopup,
    digimonDataForSlot,
    selectedDigimon,
    isLightsOn,
    wakeUntil,
    deathReason,
    hasSeenDeathPopup,
    slotId,
    currentUser,
    appendLogToSubcollection,
    setDigimonStatsAndSave,
    persistDeathSnapshot,
  });

  useGameSleepStatusLoop({
    selectedDigimon,
    digimonDataForSlot,
    digimonStats,
    isLightsOn,
    wakeUntil,
    setSleepStatus,
  });

  useTakeOutCleanup({
    takeOutAt: digimonStats.takeOutAt,
    setDigimonStats,
  });
}
