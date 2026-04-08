import { useGameClock } from "./useGameClock";
import { useGameRealtimeLoop } from "./useGameRealtimeLoop";
import { useGameSaveOnLeave } from "./useGameSaveOnLeave";
import { useGameSleepStatusLoop } from "./useGameSleepStatusLoop";
import { useTakeOutCleanup } from "./useTakeOutCleanup";

export function useGameRuntimeEffects({
  setCustomTime,
  slotId,
  currentUser,
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
}) {
  useGameClock(setCustomTime);

  useGameSaveOnLeave({
    slotId,
    currentUser,
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
