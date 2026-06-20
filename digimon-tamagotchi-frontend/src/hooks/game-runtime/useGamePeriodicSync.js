import { useCallback, useEffect, useRef } from "react";

export const GAME_PERIODIC_SYNC_INTERVAL_MS = 15 * 60 * 1000;

export function useGamePeriodicSync({
  slotId,
  currentUser,
  isLoadingSlot = false,
  digimonStats,
  setDigimonStatsAndSave,
  intervalMs = GAME_PERIODIC_SYNC_INTERVAL_MS,
}) {
  const latestStatsRef = useRef(digimonStats);
  const saveRef = useRef(setDigimonStatsAndSave);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    latestStatsRef.current = digimonStats;
  }, [digimonStats]);

  useEffect(() => {
    saveRef.current = setDigimonStatsAndSave;
  }, [setDigimonStatsAndSave]);

  const syncLatestStats = useCallback(async (reason) => {
    if (
      !slotId ||
      !currentUser ||
      isLoadingSlot ||
      !saveRef.current ||
      saveRef.current.isInFlight?.() ||
      isSyncingRef.current ||
      document.visibilityState === "hidden"
    ) {
      return false;
    }

    isSyncingRef.current = true;
    try {
      await saveRef.current(latestStatsRef.current);
      return true;
    } catch (error) {
      console.warn(`[Game] ${reason} 동기화 실패:`, error);
      return false;
    } finally {
      isSyncingRef.current = false;
    }
  }, [currentUser, isLoadingSlot, slotId]);

  useEffect(() => {
    if (!slotId || !currentUser || isLoadingSlot || !saveRef.current) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void syncLatestStats("15분 주기");
    }, intervalMs);
    const handleOnline = () => {
      void syncLatestStats("온라인 복귀");
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", handleOnline);
    };
  }, [currentUser, intervalMs, isLoadingSlot, slotId, syncLatestStats]);
}
