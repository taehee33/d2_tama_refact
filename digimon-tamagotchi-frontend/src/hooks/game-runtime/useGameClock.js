import { useEffect } from "react";

export function useGameClock(setCustomTime) {
  useEffect(() => {
    const clock = setInterval(() => setCustomTime(new Date()), 1000);

    return () => {
      clearInterval(clock);
    };
  }, [setCustomTime]);
}
