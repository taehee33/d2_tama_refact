import { useEffect, useRef } from "react";
import { getSleepStatus } from "../useGameLogic";
import { getSleepSchedule } from "../useGameHandlers";

export function useGameSleepStatusLoop({
  selectedDigimon,
  digimonDataForSlot,
  digimonStats,
  isLightsOn,
  wakeUntil,
  setSleepStatus,
}) {
  const runtimeRef = useRef({
    selectedDigimon,
    digimonDataForSlot,
    digimonStats,
    isLightsOn,
    wakeUntil,
  });

  useEffect(() => {
    runtimeRef.current = {
      selectedDigimon,
      digimonDataForSlot,
      digimonStats,
      isLightsOn,
      wakeUntil,
    };
  }, [selectedDigimon, digimonDataForSlot, digimonStats, isLightsOn, wakeUntil]);

  useEffect(() => {
    const timer = setInterval(() => {
      const live = runtimeRef.current;
      const status = getSleepStatus({
        sleepSchedule: getSleepSchedule(
          live.selectedDigimon,
          live.digimonDataForSlot,
          live.digimonStats
        ),
        isLightsOn: live.isLightsOn,
        wakeUntil: live.wakeUntil,
        fastSleepStart: live.digimonStats.fastSleepStart || null,
        napUntil: live.digimonStats.napUntil || null,
        now: new Date(),
      });

      setSleepStatus(status);
    }, 1000);

    return () => clearInterval(timer);
  }, [setSleepStatus]);
}
