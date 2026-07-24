import { useGameClock } from "./useGameClock";
import { useGamePeriodicSync } from "./useGamePeriodicSync";
import { useGameRealtimeLoop } from "./useGameRealtimeLoop";
import { useGameSleepStatusLoop } from "./useGameSleepStatusLoop";
import { useTakeOutCleanup } from "./useTakeOutCleanup";

export function useGameRuntimeEffects({
  setCustomTime,
  slotId,
  currentUser,
  isLoadingSlot,
  isGameplayReady = true,
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

  useGamePeriodicSync({
    slotId,
    currentUser,
    isLoadingSlot,
    digimonStats,
    setDigimonStatsAndSave,
    nextSyncAt: nextStateSyncAt,
  });

  useGameRealtimeLoop({
    enabled: isGameplayReady,
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
