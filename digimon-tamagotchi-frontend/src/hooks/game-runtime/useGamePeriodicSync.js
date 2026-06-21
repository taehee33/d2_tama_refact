import { useCallback, useEffect, useRef } from "react";

export const GAME_PERIODIC_SYNC_INTERVAL_MS = 15 * 60 * 1000;

export function useGamePeriodicSync({
  slotId,
  currentUser,
  isLoadingSlot = false,
  digimonStats,
  setDigimonStatsAndSave,
  nextSyncAt = null,
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

    const timer = nextSyncAt != null && Number.isFinite(Number(nextSyncAt))
      ? window.setTimeout(() => {
          void syncLatestStats("15분 주기");
        }, Math.max(0, Number(nextSyncAt) - Date.now()))
      : null;
    const handleOnline = () => {
      void syncLatestStats("온라인 복귀");
    };
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        nextSyncAt != null &&
        Number(nextSyncAt) <= Date.now()
      ) {
        void syncLatestStats("화면 재활성화");
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timer != null) window.clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentUser, isLoadingSlot, nextSyncAt, slotId, syncLatestStats]);
}
