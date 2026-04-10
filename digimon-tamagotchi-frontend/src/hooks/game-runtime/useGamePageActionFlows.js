import { useCallback } from "react";
import { addActivityLog } from "../useGameLogic";
import { DEATH_FORM_IDS } from "./gameAnimationViewModel";
import { buildResetDigimonState } from "./gamePageActionHelpers";
import { buildDigimonLogSnapshot } from "../../utils/digimonLogSnapshot";

function getConfirmDialog(confirmFn) {
  if (typeof confirmFn === "function") {
    return confirmFn;
  }

  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    return window.confirm.bind(window);
  }

  return () => true;
}

function getAnimationFrameRunner(requestAnimationFrameFn) {
  if (typeof requestAnimationFrameFn === "function") {
    return requestAnimationFrameFn;
  }

  if (
    typeof window !== "undefined" &&
    typeof window.requestAnimationFrame === "function"
  ) {
    return window.requestAnimationFrame.bind(window);
  }

  return (callback) => {
    callback();
    return 0;
  };
}

export function useGamePageActionFlows({
  applyLazyUpdateBeforeAction,
  eatCycleFromHook,
  setCurrentAnimation,
  setDigimonStats,
  setFeedStep,
  setFeedType,
  toggleModal,
  selectedDigimon,
  normalizedSlotVersion,
  digimonDataForSlot,
  evolutionDataForSlot,
  appendLogToSubcollection,
  setSelectedDigimon,
  setDigimonStatsAndSave,
  setSelectedDigimonAndSave,
  setHasSeenDeathPopup,
  requestAnimationFrameFn,
  confirmFn,
}) {
  const runFeedAnimation = getAnimationFrameRunner(requestAnimationFrameFn);
  const confirmDialog = getConfirmDialog(confirmFn);

  const runOverfeedFlow = useCallback(
    async (shouldRefuse) => {
      toggleModal("overfeedConfirm", false);

      const updatedStats = await applyLazyUpdateBeforeAction();
      if (updatedStats.isDead) {
        return;
      }

      setDigimonStats(updatedStats);
      setFeedType("meat");
      setCurrentAnimation(shouldRefuse ? "foodRejectRefuse" : "eat");
      toggleModal("food", !shouldRefuse);
      setFeedStep(0);

      runFeedAnimation(() => {
        eatCycleFromHook(0, "meat", shouldRefuse);
      });
    },
    [
      applyLazyUpdateBeforeAction,
      eatCycleFromHook,
      runFeedAnimation,
      setCurrentAnimation,
      setDigimonStats,
      setFeedStep,
      setFeedType,
      toggleModal,
    ]
  );

  const handleOverfeedConfirm = useCallback(() => {
    return runOverfeedFlow(false);
  }, [runOverfeedFlow]);

  const handleOverfeedCancel = useCallback(() => {
    return runOverfeedFlow(true);
  }, [runOverfeedFlow]);

  const resetDigimon = useCallback(async () => {
    try {
      const isDeathForm = DEATH_FORM_IDS.includes(selectedDigimon);
      if (!isDeathForm && !confirmDialog("정말로 초기화?")) {
        return;
      }

      const currentStats = await applyLazyUpdateBeforeAction();
      const { initialDigimonId, nextStats } = buildResetDigimonState({
        currentStats,
        normalizedSlotVersion,
        digimonDataForSlot,
      });

      const currentLogs = nextStats.activityLogs || currentStats.activityLogs || [];
      const newStartLogs = addActivityLog(
        currentLogs,
        "NEW_START",
        `New start: Reborn as ${initialDigimonId}`,
        buildDigimonLogSnapshot(
          initialDigimonId,
          digimonDataForSlot,
          evolutionDataForSlot
        )
      );

      const nextActivityLogs = Array.isArray(newStartLogs)
        ? newStartLogs
        : currentLogs;
      const latestNewStartLog =
        nextActivityLogs[nextActivityLogs.length - 1];

      if (appendLogToSubcollection && latestNewStartLog) {
        Promise.resolve(
          appendLogToSubcollection(latestNewStartLog)
        ).catch(() => {});
      }

      const nextStatsWithLogs = {
        ...nextStats,
        activityLogs: nextActivityLogs,
        selectedDigimon: initialDigimonId,
      };

      setSelectedDigimon(initialDigimonId);
      setDigimonStats(nextStatsWithLogs);
      await setDigimonStatsAndSave(nextStatsWithLogs, nextActivityLogs);
      await setSelectedDigimonAndSave(initialDigimonId);
      toggleModal("deathModal", false);
      setHasSeenDeathPopup(false);
    } catch (error) {
      console.error("[resetDigimon] 오류 발생:", error);
    }
  }, [
    appendLogToSubcollection,
    applyLazyUpdateBeforeAction,
    confirmDialog,
    digimonDataForSlot,
    evolutionDataForSlot,
    normalizedSlotVersion,
    selectedDigimon,
    setDigimonStats,
    setDigimonStatsAndSave,
    setHasSeenDeathPopup,
    setSelectedDigimon,
    setSelectedDigimonAndSave,
    toggleModal,
  ]);

  return {
    handleOverfeedConfirm,
    handleOverfeedCancel,
    resetDigimon,
  };
}
