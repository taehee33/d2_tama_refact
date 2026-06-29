import { useCallback, useEffect, useRef, useState } from "react";

export const GAME_PERIODIC_SYNC_INTERVAL_MS = 15 * 60 * 1000;
export const GAME_PERIODIC_SYNC_RETRY_MS = 30 * 1000;

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
  const [retryRevision, setRetryRevision] = useState(0);

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

  const syncLatestStatsWithVisibleRetry = useCallback(async (reason) => {
    const didSync = await syncLatestStats(reason);
    if (!didSync && document.visibilityState === "visible") {
      setRetryRevision((revision) => revision + 1);
    }
  }, [syncLatestStats]);

  useEffect(() => {
    if (!slotId || !currentUser || isLoadingSlot || !saveRef.current) {
      return undefined;
    }

    const numericNextSyncAt = Number(nextSyncAt);
    const isOverdue =
      nextSyncAt != null &&
      Number.isFinite(numericNextSyncAt) &&
      numericNextSyncAt <= Date.now();
    const timerDelay = isOverdue && retryRevision > 0
      ? GAME_PERIODIC_SYNC_RETRY_MS
      : Math.max(0, numericNextSyncAt - Date.now());
    const timer = nextSyncAt != null && Number.isFinite(numericNextSyncAt)
      ? window.setTimeout(() => {
          void syncLatestStatsWithVisibleRetry("15분 주기");
        }, timerDelay)
      : null;
    const handleOnline = () => {
      void syncLatestStatsWithVisibleRetry("온라인 복귀");
    };
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        nextSyncAt != null &&
        Number(nextSyncAt) <= Date.now()
      ) {
        void syncLatestStatsWithVisibleRetry("화면 재활성화");
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timer != null) window.clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    currentUser,
    isLoadingSlot,
    nextSyncAt,
    retryRevision,
    slotId,
    syncLatestStatsWithVisibleRetry,
  ]);
}
