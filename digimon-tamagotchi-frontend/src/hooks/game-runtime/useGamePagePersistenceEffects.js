import { useEffect, useRef } from "react";
import { getMasterDataSnapshotForSync } from "../../utils/masterDataUtils";

function syncRemainingByElapsed(previousTotal, nextTotal, currentRemaining) {
  const safeNextTotal = Math.max(0, Number(nextTotal) || 0);

  if (safeNextTotal === 0) {
    return 0;
  }

  const safeCurrentRemaining = Number.isFinite(currentRemaining)
    ? currentRemaining
    : safeNextTotal;
  const safePreviousTotal = Math.max(0, Number(previousTotal) || 0);

  if (safePreviousTotal === 0) {
    return safeNextTotal;
  }

  const elapsed = Math.max(0, safePreviousTotal - safeCurrentRemaining);
  return Math.max(0, Math.min(safeNextTotal, safeNextTotal - elapsed));
}

export function useGamePagePersistenceEffects({
  slotId,
  isLoadingSlot,
  selectedDigimon,
  digimonStats,
  activityLogs,
  slotVersion,
  masterDataRevision,
  backgroundSettings,
  saveBackgroundSettings,
  width,
  height,
  clearedQuestIndex,
  setClearedQuestIndex,
  setDigimonStats,
  setDigimonStatsAndSave,
}) {
  const masterDataSyncSnapshotRef = useRef(null);
  const backgroundSettingsLoadedRef = useRef(false);

  useEffect(() => {
    if (!selectedDigimon || !digimonStats || isLoadingSlot) {
      return;
    }

    const versionLabel = slotVersion === "Ver.2" ? "Ver.2" : "Ver.1";
    const currentSnapshot = getMasterDataSnapshotForSync(
      versionLabel,
      selectedDigimon
    );

    if (!currentSnapshot) {
      return;
    }

    const previousSnapshot = masterDataSyncSnapshotRef.current;

    if (
      !previousSnapshot ||
      previousSnapshot.digimonId !== currentSnapshot.digimonId ||
      previousSnapshot.versionLabel !== currentSnapshot.versionLabel
    ) {
      masterDataSyncSnapshotRef.current = currentSnapshot;
      return;
    }

    const speciesChanged = [
      "sprite",
      "hungerTimer",
      "strengthTimer",
      "poopTimer",
      "maxOverfeed",
      "minWeight",
      "maxEnergy",
      "basePower",
      "attackSprite",
      "altAttackSprite",
      "type",
      "timeToEvolveSeconds",
    ].some((key) => previousSnapshot[key] !== currentSnapshot[key]);

    if (!speciesChanged) {
      masterDataSyncSnapshotRef.current = currentSnapshot;
      return;
    }

    const syncedStats = {
      ...digimonStats,
      sprite: currentSnapshot.sprite,
      hungerTimer: currentSnapshot.hungerTimer,
      strengthTimer: currentSnapshot.strengthTimer,
      poopTimer: currentSnapshot.poopTimer,
      maxOverfeed: currentSnapshot.maxOverfeed,
      minWeight: currentSnapshot.minWeight,
      maxStamina: currentSnapshot.maxEnergy,
      maxEnergy: currentSnapshot.maxEnergy,
      power: currentSnapshot.basePower,
      attackSprite: currentSnapshot.attackSprite,
      altAttackSprite: currentSnapshot.altAttackSprite,
      type: currentSnapshot.type,
      hungerCountdown: syncRemainingByElapsed(
        previousSnapshot.hungerTimer * 60,
        currentSnapshot.hungerTimer * 60,
        digimonStats.hungerCountdown
      ),
      strengthCountdown: syncRemainingByElapsed(
        previousSnapshot.strengthTimer * 60,
        currentSnapshot.strengthTimer * 60,
        digimonStats.strengthCountdown
      ),
      poopCountdown: syncRemainingByElapsed(
        previousSnapshot.poopTimer * 60,
        currentSnapshot.poopTimer * 60,
        digimonStats.poopCountdown
      ),
      timeToEvolveSeconds: syncRemainingByElapsed(
        previousSnapshot.timeToEvolveSeconds,
        currentSnapshot.timeToEvolveSeconds,
        digimonStats.timeToEvolveSeconds
      ),
    };

    masterDataSyncSnapshotRef.current = currentSnapshot;

    if (setDigimonStatsAndSave) {
      void setDigimonStatsAndSave(syncedStats, activityLogs);
      return;
    }

    setDigimonStats(syncedStats);
  }, [
    activityLogs,
    digimonStats,
    isLoadingSlot,
    selectedDigimon,
    setDigimonStats,
    setDigimonStatsAndSave,
    slotVersion,
    masterDataRevision,
  ]);

  useEffect(() => {
    backgroundSettingsLoadedRef.current = false;
  }, [slotId]);

  useEffect(() => {
    if (!isLoadingSlot && slotId) {
      const timer = setTimeout(() => {
        backgroundSettingsLoadedRef.current = true;
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isLoadingSlot, slotId]);

  useEffect(() => {
    if (!slotId || !backgroundSettings) return;
    if (isLoadingSlot) return;
    if (!backgroundSettingsLoadedRef.current) return;

    if (saveBackgroundSettings) {
      saveBackgroundSettings(backgroundSettings);
    }
  }, [backgroundSettings, slotId, saveBackgroundSettings, isLoadingSlot]);

  useEffect(() => {
    try {
      const settings = {
        width,
        height,
      };
      localStorage.setItem("digimon_view_settings", JSON.stringify(settings));
    } catch (error) {
      console.error("Sprite settings 저장 오류:", error);
    }
  }, [width, height]);

  useEffect(() => {
    const savedClearedQuestIndex = localStorage.getItem(
      `slot${slotId}_clearedQuestIndex`
    );

    if (savedClearedQuestIndex !== null) {
      setClearedQuestIndex(parseInt(savedClearedQuestIndex, 10));
    }
  }, [setClearedQuestIndex, slotId]);

  useEffect(() => {
    localStorage.setItem(
      `slot${slotId}_clearedQuestIndex`,
      clearedQuestIndex.toString()
    );
  }, [clearedQuestIndex, slotId]);
}
