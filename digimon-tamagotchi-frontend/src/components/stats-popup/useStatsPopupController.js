import { useEffect, useMemo, useRef, useState } from "react";
import { addActivityLog } from "../../hooks/useGameLogic";
import {
  getActiveCareMistakeEntries,
  getDisplayCareMistakeEntries,
} from "../../logic/stats/careMistakeLedger";
import { getDisplayInjuryEntries } from "../../logic/stats/injuryHistory";
import { buildStatsPopupCommandIntent } from "../../logic/stats/statsPopupCommands";
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
  saveContextKey = null,
  devMode,
  onSaveCommand,
  onChangeStats,
  sleepSchedule,
  sleepStatus,
  isLightsOn,
  appendLogToSubcollection,
}) {
  const [activeTab, setActiveTab] = useState("NEW");
  const [editableStats, setEditableStats] = useState(() => ({ ...(stats || {}) }));
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [saveState, setSaveState] = useState({
    status: "idle",
    failedIntent: null,
    failedReceipt: null,
  });
  const saveSequenceRef = useRef(0);
  const nocturnalTargetRef = useRef(Boolean(stats?.isNocturnal));
  const isMountedRef = useRef(true);
  const latestStatsRef = useRef(stats);
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
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      saveSequenceRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!isUsingEditableStats) setEditableStats({ ...(stats || {}) });
  }, [isUsingEditableStats, stats]);

  useEffect(() => {
    latestStatsRef.current = stats;
    nocturnalTargetRef.current = Boolean(stats?.isNocturnal);
  }, [stats]);

  useEffect(() => {
    saveSequenceRef.current += 1;
    setSaveState({ status: "idle", failedIntent: null, failedReceipt: null, receipt: null });
    setEditableStats({ ...(latestStatsRef.current || {}) });
    nocturnalTargetRef.current = Boolean(latestStatsRef.current?.isNocturnal);
  }, [saveContextKey]);

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
    if (!onSaveCommand && !onChangeStats) return;
    const occurredAt = Date.now();
    const nextStats = buildStatsPopupStatMutation({
      stats: currentStats || {},
      field,
      value,
      nowMs: occurredAt,
    });
    setEditableStats(nextStats);
    if (!onSaveCommand) {
      persistStatsPopupChange({ onChangeStats, nextStats });
      return;
    }
    submitStatsCommand(buildStatsPopupCommandIntent({ field, value, occurredAt }));
  }

  function submitStatsCommand(intent, previousReceipt = null) {
    const requestSequence = ++saveSequenceRef.current;
    setSaveState({ status: "saving", failedIntent: null, failedReceipt: null, receipt: null });
    Promise.resolve().then(() => previousReceipt
      ? onSaveCommand(intent, previousReceipt)
      : onSaveCommand(intent)).then((receipt) => {
      if (!isMountedRef.current || requestSequence !== saveSequenceRef.current) return;
      const rawStatus = receipt?.status || "failed";
      const status = receipt?.localCleanup === "failed" ? "warning" : rawStatus;
      const retryable = receipt?.retryable === true ||
        (rawStatus === "failed" && receipt?.retryable !== false);
      if ((status === "failed" || status === "warning") && retryable) {
        setSaveState({
          status,
          failedIntent: intent,
          failedReceipt: receipt?._retry ? receipt : null,
          receipt,
        });
        return;
      }
      if (status === "blocked" || status === "conflict") {
        setEditableStats({ ...(stats || {}) });
        nocturnalTargetRef.current = Boolean(stats?.isNocturnal);
      }
      setSaveState({ status, failedIntent: null, failedReceipt: null, receipt });
    }).catch(() => {
      if (!isMountedRef.current || requestSequence !== saveSequenceRef.current) return;
      setSaveState({
        status: "failed",
        failedIntent: intent,
        failedReceipt: null,
        receipt: null,
      });
    });
  }

  function handleNocturnalToggle() {
    if (onSaveCommand) {
      const occurredAt = Date.now();
      const targetValue = !nocturnalTargetRef.current;
      nocturnalTargetRef.current = targetValue;
      setEditableStats({ ...(currentStats || {}), isNocturnal: targetValue });
      submitStatsCommand(buildStatsPopupCommandIntent({
        field: "isNocturnal",
        value: targetValue,
        occurredAt,
      }));
      return;
    }
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

  const saveMessages = {
    saving: "변경사항 저장 중",
    synced: "변경사항 저장됨",
    queued: "기기에 저장됨 · 연결되면 동기화",
    saved: "상태와 활동 기록 저장됨",
    pending: "기기에 저장됨 · 연결되면 상태와 활동 기록 동기화",
    warning: "일부 저장 실패",
    failed: "저장 실패",
    blocked: "슬롯 변경으로 저장하지 않음",
    conflict: "다른 기기의 변경사항 확인 필요",
  };
  let saveMessage = saveMessages[saveState.status] || "";
  if (
    saveState.status === "blocked" &&
    saveState.receipt?.errorCode === "stats-popup/superseded-command"
  ) {
    saveMessage = "더 최신 변경이 있어 이전 재시도를 취소함";
  } else if (
    saveState.status === "warning" &&
    saveState.receipt?.localCleanup === "failed"
  ) {
    saveMessage = "원격 저장 완료 · 기기 대기 항목 정리 필요";
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
    canEdit: Boolean(onSaveCommand || onChangeStats),
    saveStatus: saveState.status,
    saveMessage,
    canRetrySave:
      (saveState.status === "failed" || saveState.status === "warning") &&
      Boolean(saveState.failedIntent),
    handleRetrySave: () => {
      if (saveState.failedIntent && onSaveCommand) {
        submitStatsCommand(saveState.failedIntent, saveState.failedReceipt);
      }
    },
    handleNumericChange: commitStatChange,
    handleBooleanChange: commitStatChange,
    handleNocturnalToggle,
  };
}
