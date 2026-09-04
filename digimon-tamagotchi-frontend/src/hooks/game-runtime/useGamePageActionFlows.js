import { useCallback } from "react";
import { addActivityLog } from "../useGameLogic";
import { DEATH_FORM_IDS } from "./gameAnimationViewModel";
import { buildResetDigimonState } from "./gamePageActionHelpers";
import { buildDigimonLogSnapshot } from "../../utils/digimonLogSnapshot";
import { createNewLifeTransitionId } from "../../persistence/newLifeTransition";

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
  setActivityLogs,
  setFeedStep,
  setFeedType,
  toggleModal,
  selectedDigimon,
  normalizedSlotVersion,
  digimonDataForSlot,
  evolutionDataForSlot,
  setSelectedDigimon,
  saveNewLifeTransition,
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
        return { status: "blocked", errorCode: "game/new-life-cancelled" };
      }

      const currentStats = await applyLazyUpdateBeforeAction();
      const { initialDigimonId, nextStats } = buildResetDigimonState({
        currentStats,
        normalizedSlotVersion,
        digimonDataForSlot,
      });

      const transitionCreatedAt = Date.now();
      const transitionId = createNewLifeTransitionId(transitionCreatedAt);
      const currentLogs = [];
      const newStartLogs = addActivityLog(
        currentLogs,
        "NEW_START",
        `New start: Reborn as ${initialDigimonId}`,
        {
          ...buildDigimonLogSnapshot(
            initialDigimonId,
            digimonDataForSlot,
            evolutionDataForSlot
          ),
          timestamp: transitionCreatedAt,
          transitionId,
          eventId: `activity:new-life:${transitionId}`,
        }
      );

      const nextActivityLogs = Array.isArray(newStartLogs)
        ? newStartLogs
        : currentLogs;
      const latestNewStartLog =
        nextActivityLogs[nextActivityLogs.length - 1];

      const nextStatsWithLogs = {
        ...nextStats,
        activityLogs: nextActivityLogs,
        battleLogs: [],
        selectedDigimon: initialDigimonId,
      };

      if (typeof saveNewLifeTransition !== "function" || !latestNewStartLog) {
        throw new Error("새 생애 원자 저장 경계를 사용할 수 없습니다.");
      }
      const receipt = await saveNewLifeTransition({
        statsSnapshot: nextStatsWithLogs,
        transition: {
          transitionId,
          sourceDigimon: selectedDigimon,
          targetDigimon: initialDigimonId,
          logEntry: latestNewStartLog,
          createdAt: transitionCreatedAt,
        },
        nowMs: transitionCreatedAt,
      });
      if (receipt?.status !== "synced") {
        return receipt || {
          status: "failed",
          errorCode: "game/new-life-missing-receipt",
        };
      }
      setSelectedDigimon(initialDigimonId);
      setDigimonStats(nextStatsWithLogs);
      if (typeof setActivityLogs === "function") setActivityLogs(nextActivityLogs);
      toggleModal("deathModal", false);
      setHasSeenDeathPopup(false);
      return receipt;
    } catch (error) {
      console.error("[resetDigimon] 오류 발생:", error);
      return {
        status: "failed",
        errorCode: error?.code || "game/new-life-failed",
        message: error?.message || "새 생애를 저장하지 못했습니다.",
      };
    }
  }, [
    applyLazyUpdateBeforeAction,
    confirmDialog,
    digimonDataForSlot,
    evolutionDataForSlot,
    normalizedSlotVersion,
    selectedDigimon,
    saveNewLifeTransition,
    setActivityLogs,
    setDigimonStats,
    setHasSeenDeathPopup,
    setSelectedDigimon,
    toggleModal,
  ]);

  return {
    handleOverfeedConfirm,
    handleOverfeedCancel,
    resetDigimon,
  };
}
