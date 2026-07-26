// src/components/StatsPopup.jsx
import React, { useState, useEffect, useMemo } from "react";
import { formatTimestamp as formatTimestampUtil } from "../utils/dateUtils";
import { getTimeUntilWake } from "../utils/sleepUtils";
import { addActivityLog } from "../hooks/useGameLogic";
import {
  getActiveCareMistakeEntries,
  getDisplayCareMistakeEntries,
} from "../logic/stats/careMistakeLedger";
import { getDisplayInjuryEntries } from "../logic/stats/injuryHistory";
import { buildCallStatusViewModel } from "../utils/callStatusUtils";
import {
  buildCareViewModel,
  buildHealthRiskViewModel,
  buildOverviewViewModel,
  buildSleepViewModel,
} from "./stats-popup/statsPopupViewModel";
import {
  buildStatsPopupNocturnalMutation,
  buildStatsPopupStatMutation,
} from "./stats-popup/statsPopupMutations";
import CareHistorySection from "./stats-popup/CareHistorySection";
import DeveloperStatsSection from "./stats-popup/DeveloperStatsSection";
import HealthRiskSection from "./stats-popup/HealthRiskSection";
import SleepSection from "./stats-popup/SleepSection";
import StatsOverviewSection from "./stats-popup/StatsOverviewSection";


// timestamp 포맷팅은 utils/dateUtils에서 import
const formatTimestamp = formatTimestampUtil;
export default function StatsPopup({
  stats,
  activityLogs: activityLogsProp = null, // 틱에서 즉시 반영된 로그 (부상/케어미스 새로고침 없이 표시)
  digimonData = null, // 종족 고정 파라미터 (digimonData)
  digimonDataMap = null,
  selectedDigimonId = null,
  slotVersion = "Ver.1",
  onClose,
  devMode=false,
  onChangeStats,
  sleepSchedule = null, // 수면 스케줄 { start, end }
  sleepStatus = "AWAKE", // 수면 상태
  wakeUntil = null, // 깨어있는 시간 (timestamp)
  sleepLightOnStart = null, // 수면 중 불 켜진 시작 시간 (timestamp)
  isLightsOn = false, // 조명 상태
  appendLogToSubcollection, // Firestore logs 서브컬렉션에 로그 추가 (선택)
}){
  const [activeTab, setActiveTab] = useState('NEW'); // 'OLD' | 'NEW'
  const [editableStats, setEditableStats] = useState(() => ({ ...(stats || {}) }));
  const isUsingEditableStats = devMode && activeTab === "OLD";
  const currentStats = isUsingEditableStats ? editableStats : stats;
  // 이력 표시: 틱에서 setActivityLogs로 갱신된 prop이 더 많거나 같으면 사용(즉시 반영), 아니면 stats.activityLogs
  const statsLogs = currentStats?.activityLogs ?? [];
  const displayActivityLogs = (activityLogsProp != null && activityLogsProp.length >= statsLogs.length)
    ? activityLogsProp
    : statsLogs;
  
  // 실시간 업데이트를 위한 상태
  const [currentTime, setCurrentTime] = useState(Date.now());

  // 1초마다 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isUsingEditableStats) {
      setEditableStats({ ...(stats || {}) });
    }
  }, [isUsingEditableStats, stats]);

  const sleepViewModel = useMemo(
    () => buildSleepViewModel({
      stats: currentStats || {},
      sleepStatus,
      isLightsOn,
    }),
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
  const {
    visibleSleepStatus,
    isSleepLightCareMistakeProcessed,
    isSleepingLikeStatus,
    sleepStatusLabel,
  } = sleepViewModel;
  const {
    activeCallMap,
    careMistakeHistoryEntries,
    careMistakeDiagnosticMessage,
  } = careViewModel;
  
  // stats 내부 항목 구조 분해
  const {
    fullness,
    strength,
    lastHungerZeroAt=null,
    lastStrengthZeroAt=null,
    isFrozen=false,
  } = currentStats || {};
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
  const { currentSleepSchedule } = overviewViewModel;
  const currentStageStartedAt = currentStats?.evolutionStageStartedAt ?? null;
  const currentLifeStartedAt = currentStats?.birthTime ?? null;
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
  const { injuryHistoryEntries, injuryDiagnosticMessage } = healthRiskViewModel;

  function commitStatChange(field, val) {
    if(!onChangeStats) return;
    const newStats = buildStatsPopupStatMutation({
      stats: currentStats || {},
      field,
      value: val,
      nowMs: Date.now(),
    });

    setEditableStats(newStats);
    onChangeStats(newStats);
  }

  // devMode에서 select로 변경
  function handleChange(field, value){
    commitStatChange(field, value);
  }

  function handleBooleanToggle(field, nextValue) {
    commitStatChange(field, nextValue);
  }

  function handleNocturnalToggle() {
    if (!onChangeStats) return;
    const mutation = buildStatsPopupNocturnalMutation({
      stats,
      activityLogs: displayActivityLogs,
      nowMs: Date.now(),
      addActivityLogFn: addActivityLog,
    });
    if (appendLogToSubcollection) {
      appendLogToSubcollection(mutation.logPayload).catch(() => {});
    }
    onChangeStats(mutation.nextStats);
  }

  // Old 탭 렌더링
  const renderOldTab = () => (
    <DeveloperStatsSection
      stats={currentStats}
      sourceStats={stats}
      devMode={devMode}
      canEdit={Boolean(onChangeStats)}
      onNumericChange={handleChange}
      onBooleanChange={handleBooleanToggle}
    />
  );
  
  // New 탭 렌더링 (Ver.1 스펙 뷰)
  const renderNewTab = () => (
    <div className="space-y-4 text-sm">
      <StatsOverviewSection
        stats={currentStats}
        sourceStats={stats}
        overview={overviewViewModel}
        isSleepingLikeStatus={isSleepingLikeStatus}
        part="summary"
      />
      
      <SleepSection
        stats={currentStats}
        currentTime={currentTime}
        currentSleepSchedule={currentSleepSchedule}
        visibleSleepStatus={visibleSleepStatus}
        sleepStatusLabel={sleepStatusLabel}
        isLightsOn={isLightsOn}
        wakeUntil={wakeUntil}
        sleepLightOnStart={sleepLightOnStart}
        activityLogs={displayActivityLogs}
        currentStageStartedAt={currentStageStartedAt}
        onToggleNocturnal={handleNocturnalToggle}
      />
      <CareHistorySection
        fullness={fullness}
        strength={strength}
        lastHungerZeroAt={lastHungerZeroAt}
        lastStrengthZeroAt={lastStrengthZeroAt}
        isFrozen={isFrozen}
        visibleSleepStatus={visibleSleepStatus}
        activeCallMap={activeCallMap}
        isSleepLightCareMistakeProcessed={isSleepLightCareMistakeProcessed}
        sleepStatusLabel={sleepStatusLabel}
        isLightsOn={isLightsOn}
        careMistakeHistoryEntries={careMistakeHistoryEntries}
        careMistakeDiagnosticMessage={careMistakeDiagnosticMessage}
        formatTimestamp={formatTimestamp}
      />

      <StatsOverviewSection
        stats={currentStats}
        sourceStats={stats}
        overview={overviewViewModel}
        isSleepingLikeStatus={isSleepingLikeStatus}
        part="counters"
      />
      
      <HealthRiskSection
        currentStats={currentStats}
        stats={stats}
        displayActivityLogs={displayActivityLogs}
        currentLifeStartedAt={currentLifeStartedAt}
        selectedDigimonId={selectedDigimonId}
        slotVersion={slotVersion}
        digimonDataMap={digimonDataMap}
        injuryHistoryEntries={injuryHistoryEntries}
        injuryDiagnosticMessage={injuryDiagnosticMessage}
      />
    </div>
  );

  return (
    <div className="stats-popup-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="stats-popup-modal__surface bg-white p-4 rounded shadow-xl w-96 relative modal-mobile stats-popup-mobile flex flex-col"
        style={{ maxHeight: "80vh" }}
      >
        {/* 헤더 영역: 제목과 닫기 버튼 (상단 고정) */}
        <div className="stats-popup-modal__header flex-shrink-0 flex justify-between items-center mb-2">
          <h2 className="stats-popup-modal__title text-lg font-bold">Digimon Status</h2>
          <button
            onClick={onClose}
            className="stats-popup-modal__close px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-bold"
            title="닫기"
          >
            ✕
          </button>
        </div>
        
        {/* 탭 UI (상단 고정) */}
        <div className="stats-popup-modal__tabs flex-shrink-0 flex gap-2 mb-4 border-b">
          <button
            onClick={() => setActiveTab('OLD')}
            className={`px-4 py-2 font-bold ${
              activeTab === 'OLD' 
                ? 'border-b-2 border-blue-500 text-blue-500' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            [ Old ]
          </button>
          <button
            onClick={() => setActiveTab('NEW')}
            className={`px-4 py-2 font-bold ${
              activeTab === 'NEW' 
                ? 'border-b-2 border-blue-500 text-blue-500' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            [ New ]
          </button>
        </div>
        
        {/* 탭 콘텐츠 (스크롤 영역만) */}
        <div className="stats-popup-modal__content flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'OLD' && renderOldTab()}
          {activeTab === 'NEW' && renderNewTab()}
        </div>
      </div>
    </div>
  );
}
