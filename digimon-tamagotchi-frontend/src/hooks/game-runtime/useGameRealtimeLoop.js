import { useEffect, useRef } from "react";
import {
  addActivityLog,
  checkCalls,
  checkCallTimeouts,
  getSleepStatus,
} from "../useGameLogic";
import { getSleepSchedule, isWithinSleepSchedule } from "../useGameHandlers";
import { updateLifespan } from "../../data/stats";
import { handleHungerTick } from "../../logic/stats/hunger";
import { handleStrengthTick } from "../../logic/stats/strength";
import { handleEnergyRecovery } from "../../logic/stats/stats";
import {
  initializeCareMistakeLedger,
  repairCareMistakeLedger,
} from "../../logic/stats/careMistakeLedger";
import { buildTickPoopInjuryLogs } from "../../logic/stats/injuryHistory";
import { evaluateDeathConditions } from "../../logic/stats/death";
import { buildDigimonLogSnapshot } from "../../utils/digimonLogSnapshot";

export function useGameRealtimeLoop({
  digimonStats,
  setDigimonStats,
  setActivityLogs,
  setIsSleeping,
  setDailySleepMistake,
  setDeathReason,
  setHasSeenDeathPopup,
  digimonDataForSlot,
  selectedDigimon,
  isLightsOn,
  wakeUntil,
  dailySleepMistake,
  deathReason,
  hasSeenDeathPopup,
  slotId,
  currentUser,
  appendLogToSubcollection,
  setDigimonStatsAndSave,
  persistDeathSnapshot,
}) {
  const lastUpdateTimeRef = useRef(Date.now());
  const prevSleepingRef = useRef(null);
  const lastAddedCareMistakeKeysRef = useRef(new Set());
  const runtimeRef = useRef({
    digimonDataForSlot,
    selectedDigimon,
    isLightsOn,
    wakeUntil,
    dailySleepMistake,
    deathReason,
    hasSeenDeathPopup,
    slotId,
    currentUser,
    appendLogToSubcollection,
    setDigimonStatsAndSave,
    persistDeathSnapshot,
  });

  useEffect(() => {
    runtimeRef.current = {
      digimonDataForSlot,
      selectedDigimon,
      isLightsOn,
      wakeUntil,
      dailySleepMistake,
      deathReason,
      hasSeenDeathPopup,
      slotId,
      currentUser,
      appendLogToSubcollection,
      setDigimonStatsAndSave,
      persistDeathSnapshot,
    };
  }, [
    digimonDataForSlot,
    selectedDigimon,
    isLightsOn,
    wakeUntil,
    dailySleepMistake,
    deathReason,
    hasSeenDeathPopup,
    slotId,
    currentUser,
    appendLogToSubcollection,
    setDigimonStatsAndSave,
    persistDeathSnapshot,
  ]);

  useEffect(() => {
    if (digimonStats.isDead) {
      return;
    }

    lastUpdateTimeRef.current = Date.now();

    const timer = setInterval(() => {
      const now = Date.now();
      const actualElapsedSeconds = Math.floor(
        (now - lastUpdateTimeRef.current) / 1000
      );
      lastUpdateTimeRef.current = now;

      if (actualElapsedSeconds <= 0) {
        return;
      }

      const safeElapsedSeconds = Math.min(actualElapsedSeconds, 60);

      setDigimonStats((prevStats) => {
        const live = runtimeRef.current;

        if (prevStats.isDead || prevStats.isFrozen) {
          return prevStats;
        }

        const currentDigimonName = prevStats.evolutionStage
          ? Object.keys(live.digimonDataForSlot).find(
              (key) =>
                live.digimonDataForSlot[key]?.evolutionStage ===
                prevStats.evolutionStage
            ) || "Digitama"
          : "Digitama";
        const currentDigimonSnapshot = buildDigimonLogSnapshot(
          live.selectedDigimon || currentDigimonName,
          live.digimonDataForSlot
        );
        const schedule = getSleepSchedule(
          currentDigimonName,
          live.digimonDataForSlot,
          prevStats
        );
        const nowMs = Date.now();
        const nowDate = new Date(nowMs);
        const inSchedule = isWithinSleepSchedule(schedule, nowDate);
        const wakeOverride = live.wakeUntil && nowMs < live.wakeUntil;
        const sleepingNow = inSchedule && !wakeOverride;
        const currentSleepStatus = getSleepStatus({
          sleepSchedule: schedule,
          isLightsOn: live.isLightsOn,
          wakeUntil: live.wakeUntil,
          fastSleepStart: prevStats.fastSleepStart || null,
          napUntil: prevStats.napUntil || null,
          now: nowDate,
        });
        const isActuallySleeping =
          currentSleepStatus === "SLEEPING" || currentSleepStatus === "TIRED";

        let updatedStats = updateLifespan(
          prevStats,
          safeElapsedSeconds,
          isActuallySleeping
        );
        const currentDigimonData =
          live.digimonDataForSlot[currentDigimonName] ||
          live.digimonDataForSlot.Digitama;

        updatedStats = handleHungerTick(
          updatedStats,
          currentDigimonData,
          safeElapsedSeconds,
          isActuallySleeping
        );
        updatedStats = handleStrengthTick(
          updatedStats,
          currentDigimonData,
          safeElapsedSeconds,
          isActuallySleeping
        );

        const maxEnergy =
          currentDigimonData?.stats?.maxEnergy ||
          updatedStats.maxEnergy ||
          updatedStats.maxStamina ||
          0;
        updatedStats = handleEnergyRecovery(
          updatedStats,
          schedule,
          maxEnergy,
          nowDate
        );

        updatedStats.sleepDisturbances = updatedStats.sleepDisturbances || 0;
        updatedStats.fastSleepStart = prevStats.fastSleepStart || null;
        updatedStats.napUntil = prevStats.napUntil || null;

        if (updatedStats.napUntil && nowMs >= updatedStats.napUntil) {
          updatedStats.napUntil = null;
        }

        updatedStats.tiredStartAt = prevStats.tiredStartAt || null;
        updatedStats.tiredCounted = prevStats.tiredCounted || false;

        const todayStartMs = new Date(
          nowDate.getFullYear(),
          nowDate.getMonth(),
          nowDate.getDate()
        ).getTime();
        const storedSleepMistake = updatedStats.sleepMistakeDate;
        const isNewDay =
          typeof storedSleepMistake === "number"
            ? storedSleepMistake !== todayStartMs
            : storedSleepMistake !== nowDate.toDateString();

        if (isNewDay) {
          updatedStats.sleepMistakeDate = todayStartMs;
          updatedStats.dailySleepMistake = false;
          setDailySleepMistake(false);
        }

        if (sleepingNow && live.isLightsOn) {
          if (!updatedStats.sleepLightOnStart) {
            updatedStats.sleepLightOnStart = nowMs;
          }
          updatedStats.fastSleepStart = null;
        } else {
          updatedStats.sleepLightOnStart = null;
        }

        const wasSleeping = prevSleepingRef.current;
        if (wasSleeping !== null) {
          const timeStr = new Date(nowMs).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const currentLogs = updatedStats.activityLogs || [];

          if (!wasSleeping && sleepingNow) {
            const newLogs = addActivityLog(
              currentLogs,
              "SLEEP_START",
              `잠들음 (${timeStr})`
            );
            updatedStats.activityLogs = newLogs;
            if (live.appendLogToSubcollection) {
              live.appendLogToSubcollection(
                newLogs[newLogs.length - 1]
              ).catch(() => {});
            }
          } else if (wasSleeping && !sleepingNow) {
            const newLogs = addActivityLog(
              currentLogs,
              "SLEEP_END",
              `깨어남 (${timeStr})`
            );
            updatedStats.activityLogs = newLogs;
            if (live.appendLogToSubcollection) {
              live.appendLogToSubcollection(
                newLogs[newLogs.length - 1]
              ).catch(() => {});
            }
          }
        }
        prevSleepingRef.current = sleepingNow;

        setIsSleeping(sleepingNow);

        if (!updatedStats.isDead) {
          const deathEvaluation = evaluateDeathConditions(updatedStats, Date.now());
          if (deathEvaluation.isDead) {
            updatedStats.isDead = true;
            if (deathEvaluation.reason) {
              updatedStats.deathReason = deathEvaluation.reason;
              setDeathReason(deathEvaluation.reason);
            }
          }
        }

        const sleepSchedule = getSleepSchedule(
          live.selectedDigimon,
          live.digimonDataForSlot,
          prevStats
        );
        const oldCallStatus = { ...prevStats.callStatus };
        updatedStats = checkCalls(
          updatedStats,
          live.isLightsOn,
          sleepSchedule,
          new Date(),
          isActuallySleeping
        );

        if (
          !oldCallStatus?.hunger?.isActive &&
          updatedStats.callStatus?.hunger?.isActive
        ) {
          setActivityLogs((prevLogs) => {
            const currentLogs = updatedStats.activityLogs || prevLogs || [];
            const nextLogs = addActivityLog(currentLogs, "CALL", "Call: Hungry!");
            if (live.appendLogToSubcollection) {
              live.appendLogToSubcollection(
                nextLogs[nextLogs.length - 1]
              ).catch(() => {});
            }
            return nextLogs;
          });
        }

        if (
          !oldCallStatus?.strength?.isActive &&
          updatedStats.callStatus?.strength?.isActive
        ) {
          setActivityLogs((prevLogs) => {
            const currentLogs = updatedStats.activityLogs || prevLogs || [];
            const nextLogs = addActivityLog(
              currentLogs,
              "CALL",
              "Call: No Energy!"
            );
            if (live.appendLogToSubcollection) {
              live.appendLogToSubcollection(
                nextLogs[nextLogs.length - 1]
              ).catch(() => {});
            }
            return nextLogs;
          });
        }

        if (
          !oldCallStatus?.sleep?.isActive &&
          updatedStats.callStatus?.sleep?.isActive
        ) {
          setActivityLogs((prevLogs) => {
            const currentLogs = updatedStats.activityLogs || prevLogs || [];
            const nextLogs = addActivityLog(currentLogs, "CALL", "Call: Sleepy!");
            if (live.appendLogToSubcollection) {
              live.appendLogToSubcollection(
                nextLogs[nextLogs.length - 1]
              ).catch(() => {});
            }
            return nextLogs;
          });
        }

        const repairedPrevStats = repairCareMistakeLedger(
          prevStats,
          prevStats.activityLogs || []
        ).nextStats;
        const oldCareMistakes = repairedPrevStats.careMistakes || 0;
        const previousLedger = initializeCareMistakeLedger(
          repairedPrevStats.careMistakeLedger
        );
        updatedStats = checkCallTimeouts(updatedStats, new Date(), isActuallySleeping);

        let nextLedger = initializeCareMistakeLedger(updatedStats.careMistakeLedger);
        const previousLedgerIds = new Set(previousLedger.map((entry) => entry.id));
        const duplicateEventIds = [];
        const newCareMistakeEntries = nextLedger
          .filter((entry) => !previousLedgerIds.has(entry.id))
          .filter((entry) => {
            if (!entry?.id) return false;
            if (lastAddedCareMistakeKeysRef.current.has(entry.id)) {
              duplicateEventIds.push(entry.id);
              return false;
            }
            lastAddedCareMistakeKeysRef.current.add(entry.id);
            return true;
          });

        if (duplicateEventIds.length > 0) {
          nextLedger = nextLedger.filter(
            (entry) => !duplicateEventIds.includes(entry.id)
          );
          updatedStats = {
            ...updatedStats,
            careMistakes: Math.max(
              oldCareMistakes + newCareMistakeEntries.length,
              (updatedStats.careMistakes || 0) - duplicateEventIds.length
            ),
            careMistakeLedger: nextLedger,
          };
        }

        if (newCareMistakeEntries.length > 0) {
          const orderedEntries = [...newCareMistakeEntries].sort(
            (a, b) => (a.occurredAt || 0) - (b.occurredAt || 0)
          );
          let currentLogs = updatedStats.activityLogs || prevStats.activityLogs || [];

          orderedEntries.forEach((entry) => {
            const nextLogs = addActivityLog(
              currentLogs,
              "CAREMISTAKE",
              entry.text,
              entry.occurredAt
            );
            const appendedLog = nextLogs[nextLogs.length - 1];
            const wasAdded = nextLogs.length > currentLogs.length;
            currentLogs = nextLogs;
            if (wasAdded && live.appendLogToSubcollection && appendedLog) {
              live.appendLogToSubcollection(appendedLog).catch(() => {});
            }
          });

          setActivityLogs(currentLogs);
          updatedStats = { ...updatedStats, activityLogs: currentLogs };
        }

        const oldPoopCount = prevStats.poopCount || 0;
        if ((updatedStats.poopCount || 0) > oldPoopCount) {
          const newPoopCount = updatedStats.poopCount || 0;
          let logText = `Pooped (Total: ${oldPoopCount}→${newPoopCount})`;
          const poopInjuryTs =
            newPoopCount === 8 &&
            updatedStats.isInjured &&
            updatedStats.poopReachedMaxAt
              ? typeof updatedStats.poopReachedMaxAt === "number"
                ? updatedStats.poopReachedMaxAt
                : new Date(updatedStats.poopReachedMaxAt).getTime()
              : undefined;

          if (newPoopCount === 8 && updatedStats.isInjured) {
            logText += " - Injury: Too much poop (8 piles)";
          }

          const currentLogs = updatedStats.activityLogs || prevStats.activityLogs || [];
          const nextLogs = addActivityLog(currentLogs, "POOP", logText, {
            timestamp: poopInjuryTs,
            ...currentDigimonSnapshot,
          });
          setActivityLogs(nextLogs);
          if (live.appendLogToSubcollection) {
            live.appendLogToSubcollection(nextLogs[nextLogs.length - 1]).catch(
              () => {}
            );
          }
          updatedStats = { ...updatedStats, activityLogs: nextLogs };
        }

        const tickPoopInjuryLogs = buildTickPoopInjuryLogs(
          prevStats,
          updatedStats,
          currentDigimonSnapshot
        );
        if (tickPoopInjuryLogs.length > 0) {
          let currentLogs = updatedStats.activityLogs || prevStats.activityLogs || [];

          tickPoopInjuryLogs.forEach((entry) => {
            const nextLogs = addActivityLog(
              currentLogs,
              entry.type,
              entry.text,
              {
                timestamp: entry.timestamp,
                digimonId: entry.digimonId,
                digimonName: entry.digimonName,
              }
            );
            const appendedLog = nextLogs[nextLogs.length - 1];
            const wasAdded = nextLogs.length > currentLogs.length;
            currentLogs = nextLogs;
            if (wasAdded && live.appendLogToSubcollection && appendedLog) {
              live.appendLogToSubcollection(appendedLog).catch(() => {});
            }
          });

          setActivityLogs(currentLogs);
          updatedStats = { ...updatedStats, activityLogs: currentLogs };
        }

        if (!prevStats.isDead && updatedStats.isDead && !live.hasSeenDeathPopup) {
          const reason =
            live.deathReason || updatedStats.deathReason || "Unknown";
          setActivityLogs((prevLogs) => {
            const currentLogs = updatedStats.activityLogs || prevLogs || [];
            const nextLogs = addActivityLog(
              currentLogs,
              "DEATH",
              `Death: Passed away (Reason: ${reason})`
            );

            if (live.appendLogToSubcollection) {
              live.appendLogToSubcollection(
                nextLogs[nextLogs.length - 1]
              ).catch(() => {});
            }
            if (live.persistDeathSnapshot) {
              live.persistDeathSnapshot(updatedStats).catch((error) => {
                console.error("사망 스탯 저장 오류:", error);
              });
            }
            return nextLogs;
          });
          setHasSeenDeathPopup(true);
        }

        updatedStats.isLightsOn = live.isLightsOn;
        updatedStats.wakeUntil = live.wakeUntil;
        if (typeof updatedStats.dailySleepMistake !== "boolean") {
          updatedStats.dailySleepMistake = live.dailySleepMistake;
        }

        const zeroAtChanged =
          updatedStats.lastHungerZeroAt !== prevStats.lastHungerZeroAt ||
          updatedStats.lastStrengthZeroAt !== prevStats.lastStrengthZeroAt;
        const deadlineChanged =
          updatedStats.hungerMistakeDeadline !== prevStats.hungerMistakeDeadline ||
          updatedStats.strengthMistakeDeadline !==
            prevStats.strengthMistakeDeadline;
        const careMistakeJustIncreased =
          (updatedStats.careMistakes || 0) > (prevStats.careMistakes || 0);
        const injuryJustHappened =
          (updatedStats.poopCount || 0) > (prevStats.poopCount || 0) &&
          updatedStats.isInjured &&
          (updatedStats.poopCount || 0) >= 8;

        if (
          live.slotId &&
          live.currentUser &&
          live.setDigimonStatsAndSave &&
          (zeroAtChanged ||
            deadlineChanged ||
            careMistakeJustIncreased ||
            injuryJustHappened)
        ) {
          setTimeout(() => live.setDigimonStatsAndSave(updatedStats).catch(() => {}), 0);
        }

        return updatedStats;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [
    digimonStats.isDead,
    setActivityLogs,
    setDailySleepMistake,
    setDeathReason,
    setDigimonStats,
    setHasSeenDeathPopup,
    setIsSleeping,
  ]);
}
