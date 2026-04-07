import { useEffect } from "react";

export function getTakeOutRemainingMs(takeOutAt, nowMs = Date.now()) {
  if (!takeOutAt) {
    return null;
  }

  const takeOutTime =
    typeof takeOutAt === "number" ? takeOutAt : new Date(takeOutAt).getTime();
  const elapsedMs = nowMs - takeOutTime;

  return Math.max(0, 3500 - elapsedMs);
}

export function useTakeOutCleanup({ takeOutAt, setDigimonStats }) {
  useEffect(() => {
    if (!takeOutAt) {
      return;
    }

    const clearTakeOutAnimation = () => {
      setDigimonStats((prevStats) => {
        if (!prevStats.takeOutAt) {
          return prevStats;
        }

        return {
          ...prevStats,
          takeOutAt: null,
        };
      });
    };

    const remainingMs = getTakeOutRemainingMs(takeOutAt);

    if (remainingMs === 0) {
      clearTakeOutAnimation();
      return;
    }

    const timer = setTimeout(clearTakeOutAnimation, remainingMs);

    return () => clearTimeout(timer);
  }, [takeOutAt, setDigimonStats]);
}
