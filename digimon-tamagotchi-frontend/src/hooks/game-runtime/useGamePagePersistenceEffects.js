import { useEffect, useRef } from "react";
import { getMasterDataSnapshotForSync } from "../../utils/masterDataUtils";
import { normalizeDigimonVersionLabel } from "../../utils/digimonVersionUtils";

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

function isFiniteNumberLike(value) {
  return Number.isFinite(Number(value));
}

function hasObjectValue(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function needsProjectionRuntimeSelfHeal(digimonStats = {}) {
  if (!digimonStats || typeof digimonStats !== "object") {
    return false;
  }

  return (
    !isFiniteNumberLike(digimonStats.hungerTimer) ||
    !isFiniteNumberLike(digimonStats.strengthTimer) ||
    !isFiniteNumberLike(digimonStats.poopTimer) ||
    !isFiniteNumberLike(digimonStats.maxEnergy) ||
    !hasObjectValue(digimonStats.sleepSchedule)
  );
}

export function buildProjectionRuntimeSelfHealStats({
  digimonStats,
  currentSnapshot,
}) {
  if (!needsProjectionRuntimeSelfHeal(digimonStats) || !currentSnapshot) {
    return null;
  }

  const nextStats = { ...digimonStats };
  let changed = false;

  [
    "hungerTimer",
    "strengthTimer",
    "poopTimer",
    "maxEnergy",
  ].forEach((key) => {
    if (!isFiniteNumberLike(nextStats[key]) && isFiniteNumberLike(currentSnapshot[key])) {
      nextStats[key] = currentSnapshot[key];
      changed = true;
    }
  });

  if (!isFiniteNumberLike(nextStats.maxStamina) && isFiniteNumberLike(currentSnapshot.maxEnergy)) {
    nextStats.maxStamina = currentSnapshot.maxEnergy;
    changed = true;
  }

  if (!hasObjectValue(nextStats.sleepSchedule) && hasObjectValue(currentSnapshot.sleepSchedule)) {
    nextStats.sleepSchedule = currentSnapshot.sleepSchedule;
    changed = true;
  }

  return changed ? nextStats : null;
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
  immersiveSettings,
  saveImmersiveSettings,
  width,
  height,
  clearedQuestIndex,
  setClearedQuestIndex,
  setDigimonStats,
  setDigimonStatsAndSave,
}) {
  const masterDataSyncSnapshotRef = useRef(null);
  const projectionRuntimeSelfHealKeyRef = useRef(null);
  const backgroundSettingsLoadedRef = useRef(false);
  const immersiveSettingsLoadedRef = useRef(false);

  useEffect(() => {
    if (!selectedDigimon || !digimonStats || isLoadingSlot) {
      return;
    }

    const versionLabel = normalizeDigimonVersionLabel(slotVersion);
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
      void Promise.resolve(setDigimonStatsAndSave(syncedStats, activityLogs)).catch((error) => {
        console.error("마스터 데이터 동기화 저장 오류:", error);
      });
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
    if (!slotId || !selectedDigimon || !digimonStats || isLoadingSlot) {
      return;
    }

    if (!needsProjectionRuntimeSelfHeal(digimonStats)) {
      return;
    }

    const versionLabel = normalizeDigimonVersionLabel(slotVersion);
    const selfHealKey = `${slotId}:${versionLabel}:${selectedDigimon}`;

    if (projectionRuntimeSelfHealKeyRef.current === selfHealKey) {
      return;
    }

    const currentSnapshot = getMasterDataSnapshotForSync(
      versionLabel,
      selectedDigimon
    );
    const healedStats = buildProjectionRuntimeSelfHealStats({
      digimonStats,
      currentSnapshot,
    });

    if (!healedStats) {
      return;
    }

    projectionRuntimeSelfHealKeyRef.current = selfHealKey;

    if (setDigimonStatsAndSave) {
      void Promise.resolve(setDigimonStatsAndSave(healedStats, activityLogs)).catch((error) => {
        projectionRuntimeSelfHealKeyRef.current = null;
        console.error("알림 계산 런타임 보강 저장 오류:", error);
      });
      return;
    }

    setDigimonStats(healedStats);
  }, [
    activityLogs,
    digimonStats,
    isLoadingSlot,
    selectedDigimon,
    setDigimonStats,
    setDigimonStatsAndSave,
    slotId,
    slotVersion,
  ]);

  useEffect(() => {
    backgroundSettingsLoadedRef.current = false;
    immersiveSettingsLoadedRef.current = false;
  }, [slotId]);

  useEffect(() => {
    if (!isLoadingSlot && slotId) {
      const timer = setTimeout(() => {
        backgroundSettingsLoadedRef.current = true;
        immersiveSettingsLoadedRef.current = true;
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
    if (!slotId || !immersiveSettings) return;
    if (isLoadingSlot) return;
    if (!immersiveSettingsLoadedRef.current) return;

    if (saveImmersiveSettings) {
      saveImmersiveSettings(immersiveSettings);
    }
  }, [immersiveSettings, slotId, saveImmersiveSettings, isLoadingSlot]);

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
