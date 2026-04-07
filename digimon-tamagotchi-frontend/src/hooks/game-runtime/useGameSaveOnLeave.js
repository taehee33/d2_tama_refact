import { useEffect, useRef } from "react";

export function useGameSaveOnLeave({
  slotId,
  currentUser,
  digimonStats,
  setDigimonStatsAndSave,
}) {
  const latestStatsRef = useRef(digimonStats);
  const saveRef = useRef(setDigimonStatsAndSave);

  useEffect(() => {
    latestStatsRef.current = digimonStats;
  }, [digimonStats]);

  useEffect(() => {
    saveRef.current = setDigimonStatsAndSave;
  }, [setDigimonStatsAndSave]);

  useEffect(() => {
    if (!slotId || !currentUser || !saveRef.current) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveRef.current(latestStatsRef.current).catch((err) =>
          console.warn("[Game] 탭 이탈 시 저장 실패:", err)
        );
      }
    };

    const handleBeforeUnload = () => {
      saveRef.current(latestStatsRef.current).catch(() => {});
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [slotId, currentUser]);
}
