import { useEffect, useMemo, useState } from "react";
import { addActivityLog } from "../../hooks/useGameLogic";
import {
  getActiveCareMistakeEntries,
  getDisplayCareMistakeEntries,
} from "../../logic/stats/careMistakeLedger";
import { getDisplayInjuryEntries } from "../../logic/stats/injuryHistory";
import { buildCallStatusViewModel } from "../../utils/callStatusUtils";
import { getTimeUntilWake } from "../../utils/sleepUtils";
import {
  buildStatsPopupNocturnalMutation,
  buildStatsPopupStatMutation,
} from "./statsPopupMutations";
import {
  persistStatsPopupChange,
  persistStatsPopupNocturnalChange,
} from "./statsPopupPersistenceAdapter";
import {
  buildCareViewModel,
  buildHealthRiskViewModel,
  buildOverviewViewModel,
  buildSleepViewModel,
} from "./statsPopupViewModel";

/** StatsPopup의 상태 생명주기, view model, 사용자 intent를 조율합니다. */
export default function useStatsPopupController({
  stats,
  activityLogs: activityLogsProp,
  digimonData,
  digimonDataMap,
  selectedDigimonId,
  slotVersion,
  devMode,
  onChangeStats,
  sleepSchedule,
  sleepStatus,
  isLightsOn,
  appendLogToSubcollection,
}) {
  const [activeTab, setActiveTab] = useState("NEW");
  const [editableStats, setEditableStats] = useState(() => ({ ...(stats || {}) }));
  const [currentTime, setCurrentTime] = useState(Date.now());
  const isUsingEditableStats = devMode && activeTab === "OLD";
  const currentStats = isUsingEditableStats ? editableStats : stats;
  const statsLogs = currentStats?.activityLogs ?? [];
  const displayActivityLogs = activityLogsProp != null && activityLogsProp.length >= statsLogs.length
    ? activityLogsProp
    : statsLogs;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isUsingEditableStats) setEditableStats({ ...(stats || {}) });
  }, [isUsingEditableStats, stats]);

  const sleepViewModel = useMemo(
    () => buildSleepViewModel({ stats: currentStats || {}, sleepStatus, isLightsOn }),
    [currentStats, sleepStatus, isLightsOn]
  );
  const careViewModel = useMemo(
    () => buildCareViewModel({
      stats: currentStats || {},
      activityLogs: displayActivityLogs,
      sleepStatus,
      isLightsOn,
      currentTimeMs: currentTime,
      buildCallStatusFn: buildCallStatusViewModel,
      getDisplayCareMistakesFn: getDisplayCareMistakeEntries,
      getActiveCareMistakesFn: getActiveCareMistakeEntries,
    }),
    [currentStats, displayActivityLogs, sleepStatus, isLightsOn, currentTime]
  );
  const overviewViewModel = useMemo(
    () => buildOverviewViewModel({
      stats: currentStats || {},
      digimonData,
      sleepSchedule,
      currentTimeMs: currentTime,
      getTimeUntilWakeFn: getTimeUntilWake,
    }),
    [currentStats, digimonData, sleepSchedule, currentTime]
  );
  const healthRiskViewModel = useMemo(
    () => buildHealthRiskViewModel({
      stats: currentStats || {},
      fallbackStats: stats || {},
      activityLogs: displayActivityLogs,
      selectedDigimonId,
      slotVersion,
      digimonDataMap,
      getDisplayInjuriesFn: getDisplayInjuryEntries,
    }),
    [currentStats, stats, displayActivityLogs, selectedDigimonId, slotVersion, digimonDataMap]
  );

  function commitStatChange(field, value) {
    if (!onChangeStats) return;
    const nextStats = buildStatsPopupStatMutation({
      stats: currentStats || {},
      field,
      value,
      nowMs: Date.now(),
    });
    setEditableStats(nextStats);
    persistStatsPopupChange({ onChangeStats, nextStats });
  }

  function handleNocturnalToggle() {
    if (!onChangeStats) return;
    const mutation = buildStatsPopupNocturnalMutation({
      stats,
      activityLogs: displayActivityLogs,
      nowMs: Date.now(),
      addActivityLogFn: addActivityLog,
    });
    persistStatsPopupNocturnalChange({
      appendLogToSubcollection,
      onChangeStats,
      mutation,
    });
  }

  return {
    activeTab,
    setActiveTab,
    currentStats,
    displayActivityLogs,
    currentTime,
    sleepViewModel,
    careViewModel,
    overviewViewModel,
    healthRiskViewModel,
    currentStageStartedAt: currentStats?.evolutionStageStartedAt ?? null,
    currentLifeStartedAt: currentStats?.birthTime ?? null,
    canEdit: Boolean(onChangeStats),
    handleNumericChange: commitStatChange,
    handleBooleanChange: commitStatChange,
    handleNocturnalToggle,
  };
}
