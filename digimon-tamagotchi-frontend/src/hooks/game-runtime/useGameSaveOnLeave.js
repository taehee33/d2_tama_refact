import { useEffect, useRef } from "react";

export function useGameSaveOnLeave({
  slotId,
  currentUser,
  digimonStats,
  setDigimonStatsAndSave,
}) {
  const latestStatsRef = useRef(digimonStats);
  const saveRef = useRef(setDigimonStatsAndSave);
  const lastLeaveSaveAtRef = useRef(0);

  useEffect(() => {
    latestStatsRef.current = digimonStats;
  }, [digimonStats]);

  useEffect(() => {
    saveRef.current = setDigimonStatsAndSave;
  }, [setDigimonStatsAndSave]);

  useEffect(() => {
    if (!slotId || !currentUser || !saveRef.current) return;

    const saveBeforeLeave = () => {
      const now = Date.now();
      if (now - lastLeaveSaveAtRef.current < 1_000) return;
      lastLeaveSaveAtRef.current = now;
      saveRef.current(latestStatsRef.current).catch((err) =>
        console.warn("[Game] 탭 이탈 시 저장 실패:", err)
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") saveBeforeLeave();
    };

    const handleBeforeUnload = () => saveBeforeLeave();
    const handlePageHide = () => saveBeforeLeave();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [slotId, currentUser]);
}
