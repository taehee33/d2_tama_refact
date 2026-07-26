// src/components/StatsPopup.jsx
import React, { useState, useEffect, useMemo } from "react";
import { formatTimestamp as formatTimestampUtil } from "../utils/dateUtils";
import { getTimeUntilSleep, getTimeUntilWake, formatSleepSchedule } from "../utils/sleepUtils";
import { addActivityLog, isSleepDisturbanceLog } from "../hooks/useGameLogic";
import {
  getActiveCareMistakeEntries,
  getDisplayCareMistakeEntries,
} from "../logic/stats/careMistakeLedger";
import { getDisplayInjuryEntries } from "../logic/stats/injuryHistory";
import { buildCallStatusViewModel } from "../utils/callStatusUtils";
import { toEpochMs } from "../utils/time";
import {
  buildCareViewModel,
  buildHealthRiskViewModel,
  buildOverviewViewModel,
  buildSleepViewModel,
  formatStatsPopupDuration,
  formatStatsPopupValueWithOverflow,
  getStatsPopupElapsedTimeExcludingFridge as getElapsedTimeExcludingFridge,
} from "./stats-popup/statsPopupViewModel";
import {
  buildStatsPopupNocturnalMutation,
  buildStatsPopupStatMutation,
} from "./stats-popup/statsPopupMutations";
import CareHistorySection from "./stats-popup/CareHistorySection";
import DiagnosticNotice from "./stats-popup/DiagnosticNotice";

/**
 * 수면 방해 이력 아코디언 컴포넌트
 * currentStageStartedAt: 현재 진화 단계 시작 시각(ms). 이 시점 이후 로그만 표시해 카운터와 일치시킴.
 */
function SleepDisturbanceHistory({ activityLogs, formatTimestamp, currentStageStartedAt }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // 수면 방해 관련 로그 필터링 + 현재 진화 단계 시작 시점 이후만 표시
  const sleepDisturbanceLogs = (activityLogs || []).filter(log => {
    return isSleepDisturbanceLog(log);
  }).filter(log => {
    const logMs = ensureTimestamp(log.timestamp);
    if (logMs == null) return false;
    if (currentStageStartedAt == null || currentStageStartedAt === undefined) return true;
    return logMs >= currentStageStartedAt;
  }).sort((a, b) => {
    // 최신순 정렬
    const timestampA = ensureTimestamp(a.timestamp);
    const timestampB = ensureTimestamp(b.timestamp);
    return (timestampB || 0) - (timestampA || 0);
  });
  
  return (
    <div className="mt-2 border-t pt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left flex items-center justify-between py-1 px-2 hover:bg-gray-100 rounded transition-colors"
      >
        <span className="text-sm font-semibold text-gray-700">
          수면 방해 이력 ({sleepDisturbanceLogs.length}건)
        </span>
        <span className="text-gray-500 text-xs">
          {isOpen ? '▲ 접기' : '▼ 펼치기'}
        </span>
      </button>
      
      {isOpen && (
        <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
          {sleepDisturbanceLogs.length === 0 ? (
            <div className="text-xs p-2 bg-gray-50 border border-gray-200 rounded text-gray-600">
              수면 방해 이력이 없습니다. (로그가 아직 기록되지 않았을 수 있습니다)
            </div>
          ) : (
            sleepDisturbanceLogs.map((log, index) => {
              const timestamp = ensureTimestamp(log.timestamp);
              const formattedTime = timestamp ? formatTimestamp(timestamp) : '시간 정보 없음';
              
              return (
                <div
                  key={index}
                  className="text-xs p-2 bg-red-50 border border-red-200 rounded"
                >
                  <div className="font-semibold text-red-700">
                    {log.text || '수면 방해 발생'}
                  </div>
                  <div className="text-red-600 mt-1">
                    {formattedTime}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 부상 이력 아코디언 컴포넌트
 * activityLogs / battleLogs를 이번 생 기준으로 정규화해 부상 카운터와 범위를 맞춘다.
 */
function InjuryHistory({
  activityLogs,
  battleLogs = [],
  formatTimestamp,
  currentLifeStartedAt = null,
  selectedDigimonId = null,
  slotVersion = "Ver.1",
  digimonDataMap = null,
  injuryLogs = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const displayLogs =
    injuryLogs ||
    getDisplayInjuryEntries({
      activityLogs,
      battleLogs,
      currentLifeStartedAt,
      currentDigimonId: selectedDigimonId,
      slotVersion,
      digimonDataMap,
    });
  
  return (
    <div className="mt-2 border-t pt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left flex items-center justify-between py-1 px-2 hover:bg-gray-100 rounded transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">
            부상 이력 ({displayLogs.length}건)
          </span>
          <span className="text-[10px] text-gray-400">이번 생 기준</span>
        </div>
        <span className="text-gray-500 text-xs">
          {isOpen ? '▲ 접기' : '▼ 펼치기'}
        </span>
      </button>
      
      {isOpen && (
        <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
          {displayLogs.length === 0 ? (
            <div className="text-xs p-2 bg-gray-50 border border-gray-200 rounded text-gray-600">
              이번 생 부상 이력이 없습니다. (로그가 아직 기록되지 않았을 수 있습니다)
            </div>
          ) : (
            displayLogs.map((log, index) => {
              const timestamp = ensureTimestamp(log.timestamp);
              const formattedTime = timestamp ? formatTimestamp(timestamp) : '시간 정보 없음';
              const digimonLabel = log.digimonName || log.digimonId || "확인 불가";
              
              // 부상 원인 추출
              let injuryType = '부상 발생';
              let bgColor = 'bg-red-50';
              let borderColor = 'border-red-200';
              let textColor = 'text-red-700';
              
              if (log.normalizedReason === 'poop') {
                injuryType = '💩 똥 8개로 인한 부상';
                bgColor = 'bg-brown-50';
                borderColor = 'border-brown-200';
                textColor = 'text-brown-700';
              } else if (log.normalizedReason === 'battle') {
                injuryType = '⚔️ 배틀로 인한 부상';
                bgColor = 'bg-purple-50';
                borderColor = 'border-purple-200';
                textColor = 'text-purple-700';
              }
              
              return (
                <div
                  key={index}
                  className={`text-xs p-2 ${bgColor} border ${borderColor} rounded`}
                >
                  <div className={`font-semibold ${textColor}`}>
                    {injuryType}
                  </div>
                  <div className={`${textColor} mt-1 text-[10px]`}>
                    {log.text}
                  </div>
                  <div className={`${textColor.replace('700', '600')} mt-1 text-[10px]`}>
                    {formattedTime}
                  </div>
                  <div className={`${textColor.replace('700', '600')} mt-1 text-[10px]`}>
                    당시 디지몬: {digimonLabel}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// timestamp 포맷팅은 utils/dateUtils에서 import
const formatTimestamp = formatTimestampUtil;

/**
 * Firestore Timestamp를 안전하게 변환하는 유틸 함수
 * @param {any} val - 변환할 값 (number, Date, Firestore Timestamp, string 등)
 * @returns {number|null} - timestamp (milliseconds) 또는 null
 */
function ensureTimestamp(val) {
  return toEpochMs(val);
}

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
    fullness, maxOverfeed, timeToEvolveSeconds, lifespanSeconds,
    age, sprite, evolutionStage, weight, isDead,
    deathReason=null,
    hungerTimer, strengthTimer, poopTimer,
    maxEnergy, maxStamina, minWeight, healing, attribute, power,
    attackSprite, altAttackSprite, careMistakes,
    strength, effort, winRate,
    energy,
    poopCount=0,
    poopReachedMaxAt: rawPoopReachedMaxAt=null,
    lastPoopPenaltyAt: rawLastPoopPenaltyAt=null,
    lastMaxPoopTime: legacyLastMaxPoopTime=null,
    lastHungerZeroAt=null,
    hungerZeroFrozenDurationMs=0,
    lastStrengthZeroAt=null,
    strengthZeroFrozenDurationMs=0,
    trainings=0,
    overfeeds=0,
    sleepDisturbances=0,
    battles=0,
    battlesWon=0,
    battlesLost=0,
    totalBattles=0,
    totalBattlesWon=0,
    totalBattlesLost=0,
    totalReincarnations=0,
    normalReincarnations=0,
    perfectReincarnations=0,
    isInjured=false,
    injuredAt=null,
    injuryFrozenDurationMs=0,
    injuries=0,
    healedDosesCurrent=0,
    fastSleepStart=null,
    napUntil=null,
    isNocturnal=false,
    isFrozen=false,
    frozenAt=null,
    takeOutAt=null,
    poopPenaltyFrozenDurationMs=0,
  } = currentStats || {};

  const poopReachedMaxAt = rawPoopReachedMaxAt ?? legacyLastMaxPoopTime;
  const lastPoopPenaltyAt = rawLastPoopPenaltyAt ?? poopReachedMaxAt;
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
  const {
    speciesData,
    currentSleepSchedule,
    sleepTime,
    speciesHungerTimer,
    speciesStrengthTimer,
    speciesPower,
    speciesHealDoses,
    wakeEnergyRecoveryText,
    nextEnergyRecoveryText,
    hungerTimerDisplay,
    strengthTimerDisplay,
    poopTimerDisplay,
  } = overviewViewModel;
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
  function handleChange(field, e){
    const val = parseInt(e.target.value, 10);
    commitStatChange(field, val);
  }

  function handleBooleanToggle(field, nextValue) {
    commitStatChange(field, nextValue);
  }

  // devMode용 select range
  const possibleFullness = [];
  for(let i=0; i<= 5 + (maxOverfeed||0); i++){
    possibleFullness.push(i);
  }
  const possibleWeight= [];
  for(let w=0; w<=50; w++){
    possibleWeight.push(w);
  }
  const possibleMistakes= [];
  for(let c=0; c<10; c++){
    possibleMistakes.push(c);
  }
  const possiblePoop= [];
  for(let i=0; i<=8; i++){
    possiblePoop.push(i);
  }
  const possibleStrength = [];
  // strength는 5를 넘을 수 있으며, proteinOverdose 트리거 포인트는 9, 13, 17, 21, 25, 29, 33
  // proteinOverdose 최대값 7을 달성하려면 strength가 최소 33까지 필요
  for(let i=0; i<=33; i++){
    possibleStrength.push(i);
  }
  // proteinCount 제거됨 - strength로 통합
  const possibleInjuries= [];
  for(let i=0; i<=15; i++){
    possibleInjuries.push(i);
  }
  const possibleHealedDoses= [];
  for(let i=0; i<=5; i++){
    possibleHealedDoses.push(i);
  }
  const possibleEffort = [];
  for(let i=0; i<=5; i++){
    possibleEffort.push(i);
  }
  const possibleEnergy = [];
  // energy는 0부터 maxEnergy까지 (최대 100으로 제한)
  const maxEnergyValue = maxEnergy || maxStamina || 100;
  for(let i=0; i<=maxEnergyValue; i++){
    possibleEnergy.push(i);
  }
  
  // Old 탭 렌더링
  const renderOldTab = () => (
    <>
      {/* 기본 스탯 표시 */}
      <ul className="text-sm space-y-1">
          <li>Age: {age || 0}</li>
          <li>Sprite: {sprite}</li>
          <li>Stage: {evolutionStage}</li>
          <li>Strength: {strength || 0}</li>
          <li>Energy (DP): {energy || 0}</li>
          <li>Effort: {effort || 0}</li>
          <li>WinRate: {winRate || 0}%</li>
          <li>CareMistakes: {careMistakes || 0} <span className="text-gray-500 text-xs">(진화 구간 기준)</span></li>

          <li>Lifespan: {formatStatsPopupDuration(lifespanSeconds)}</li>
          <li>TimeToEvolve: {formatStatsPopupDuration(timeToEvolveSeconds)}</li>
          <li>Fullness: {formatStatsPopupValueWithOverflow(fullness)}</li>
          <li>Weight: {weight || 0}</li>
          <li>MaxOverfeed: {maxOverfeed || 0}</li>
          <li>isDead: {isDead ? "Yes" : "No"}</li>

          <li>HungerTimer: {hungerTimer || 0} min</li>
          <li>StrengthTimer: {strengthTimer || 0} min</li>
          <li>PoopTimer: {poopTimer || 0} min</li>

          <li>MaxEnergy: {maxEnergy || maxStamina || 0}</li>
          <li>MinWeight: {minWeight || 0}</li>
          <li>Healing: {healing || 0}</li>
          <li>Attribute: {attribute || 0}</li>
          <li>Power: {power || 0}</li>
          <li>Attack Sprite: {attackSprite || 0}</li>
          <li>Alt Attack Sprite: {altAttackSprite || 0}</li>
          <li>Training: {trainings}회</li>

          <li>PoopCount: {poopCount}</li>
          <li>PoopReachedMaxAt: {formatTimestamp(poopReachedMaxAt)}</li>
          <li>LastPoopPenaltyAt: {formatTimestamp(lastPoopPenaltyAt)}</li>
          
          {/* 부상 관련 필드 */}
          <li className="mt-2 pt-2 border-t border-gray-300">--- 부상 관련 필드 ---</li>
          <li>isInjured: {isInjured ? "Yes" : "No"}</li>
          <li>injuredAt: {formatTimestamp(injuredAt)}</li>
          <li>injuries: {injuries || 0}</li>
          <li>healedDosesCurrent: {healedDosesCurrent || 0}</li>
          
          {/* 매뉴얼 기반 추가 필드 */}
          <li className="mt-2 pt-2 border-t border-gray-300">--- 매뉴얼 기반 필드 ---</li>
          <li>Protein Overdose: {stats.proteinOverdose || 0}</li>
          <li>Overfeeds: {stats.overfeeds || 0}</li>
          <li>Battles: {stats.battles || 0}</li>
          <li>Battles Won: {stats.battlesWon || 0}</li>
          <li>Battles Lost: {stats.battlesLost || 0}</li>
          <li>Battles for Evolution: {stats.battlesForEvolution || 0}</li>
        </ul>

        {/* devMode => select box */}
        {devMode && onChangeStats && (
          <div className="mt-2 border p-2 text-sm">
            <h3 className="font-bold mb-1">[Dev Mode] 스탯 수정</h3>

            {/* fullness */}
            <label className="block mt-1">
              Fullness:
              <select
                value={fullness}
                onChange={(e)=> handleChange("fullness",e)}
                className="border ml-2"
              >
                {possibleFullness.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>

            {/* proteinCount */}
            {/* proteinCount 제거됨 - strength로 통합 */}

            {/* strength */}
            <label className="block mt-1">
              Strength:
              <select
                value={strength || 0}
                onChange={(e)=> handleChange("strength",e)}
                className="border ml-2"
              >
                {possibleStrength.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            {/* effort */}
            <label className="block mt-1">
              Effort:
              <select
                value={effort || 0}
                onChange={(e)=> handleChange("effort",e)}
                className="border ml-2"
              >
                {possibleEffort.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </label>

            {/* energy */}
            <label className="block mt-1">
              Energy:
              <select
                value={energy || 0}
                onChange={(e)=> handleChange("energy",e)}
                className="border ml-2"
              >
                {possibleEnergy.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </label>

            {/* weight */}
            <label className="block mt-1">
              Weight:
              <select
                value={weight}
                onChange={(e)=> handleChange("weight",e)}
                className="border ml-2"
              >
                {possibleWeight.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </label>

            {/* careMistakes */}
            <label className="block mt-1">
              CareMistakes:
              <select
                value={careMistakes || 0}
                onChange={(e)=> handleChange("careMistakes",e)}
                className="border ml-2"
              >
                {possibleMistakes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            {/* poopCount */}
            <label className="block mt-1">
              PoopCount:
              <select
                value={poopCount}
                onChange={(e)=> handleChange("poopCount",e)}
                className="border ml-2"
              >
                {possiblePoop.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            
            {/* 부상 관련 필드 */}
            <div className="mt-2 pt-2 border-t border-gray-300">
              <h4 className="font-bold text-xs mb-1">부상 상태 테스트</h4>
              
              {/* isInjured */}
              <button
                type="button"
                onClick={() => handleBooleanToggle("isInjured", !(isInjured || false))}
                className={`mt-1 flex w-full items-center justify-between rounded border px-3 py-2 text-left transition-colors ${
                  isInjured
                    ? "border-red-400 bg-red-50 text-red-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
                aria-pressed={isInjured || false}
              >
                <span className="flex items-center gap-2">
                  <span className="text-lg leading-none" aria-hidden="true">
                    {isInjured ? "☑" : "☐"}
                  </span>
                  <span>isInjured (부상 상태)</span>
                </span>
                <span className="text-xs font-semibold">
                  {isInjured ? "ON" : "OFF"}
                </span>
              </button>
              
              {/* injuries */}
              <label className="block mt-1">
                injuries (부상 횟수):
                <select
                  value={injuries || 0}
                  onChange={(e)=> handleChange("injuries",e)}
                  className="border ml-2"
                >
                  {possibleInjuries.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </label>
              
              {/* healedDosesCurrent */}
              <label className="block mt-1">
                healedDosesCurrent (치료제 투여 횟수):
                <select
                  value={healedDosesCurrent || 0}
                  onChange={(e)=> handleChange("healedDosesCurrent",e)}
                  className="border ml-2"
                >
                  {possibleHealedDoses.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}
    </>
  );
  
  // New 탭 렌더링 (Ver.1 스펙 뷰)
  const renderNewTab = () => (
    <div className="space-y-4 text-sm">
      {/* Sec 1. 종(Species) 고정 파라미터 */}
      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">1. 종(Species) 고정 파라미터</h3>
        <ul className="space-y-1">
          <li>Power: {speciesPower}</li>
          <li>Min Weight: {speciesData.minWeight || minWeight || 0}</li>
          <li>Sleep Time: {sleepTime}</li>
          <li>Heal Doses: {speciesHealDoses}</li>
          <li>Energy (DP): {speciesData.maxEnergy || maxEnergy || maxStamina || 0}</li>
          <li>Hunger Loss: {speciesHungerTimer} Minutes</li>
          <li>Strength Loss: {speciesStrengthTimer} Minutes</li>
        </ul>
      </div>
      
      {/* Sec 2. 개체(Instance) 상태값 */}
      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">2. 개체(Instance) 상태값</h3>
        <ul className="space-y-1">
          <li>Age: {age || 0} days</li>
          <li>Weight: {weight || 0}g</li>
          <li>Hunger (Fullness): {formatStatsPopupValueWithOverflow(fullness)}/5</li>
          <li>Strength: {formatStatsPopupValueWithOverflow(strength || 0)}/5</li>
          <li className="ml-4 text-xs text-gray-600">
            • Protein Overdose: {stats.proteinOverdose || 0}/7
            {stats.proteinOverdose > 0 && (
              <span className="text-red-600 ml-1">
                (배틀 패배 시 부상 확률: {10 + (stats.proteinOverdose || 0) * 10}%)
              </span>
            )}
          </li>
          <li>Energy (Current): {energy || 0}/{maxEnergy || maxStamina || 0}</li>
          <li className="ml-4 text-xs text-gray-600">
            • 기상 시간 회복 (max): {wakeEnergyRecoveryText}
          </li>
          <li className="ml-4 text-xs text-gray-600">
            • 30분마다 회복 (+1): {nextEnergyRecoveryText}
          </li>
          <li>Win Ratio: {winRate || 0}%</li>
          <li className="mt-2 pt-1 border-t">Flags:</li>
          <li>- isSleeping: {isSleepingLikeStatus ? 'Yes' : 'No'}</li>
          <li>- isInjured: {isInjured ? 'Yes' : 'No'}</li>
          <li>- isDead: {isDead ? 'Yes' : 'No'}</li>
          <li>- PoopCount: {poopCount}/8</li>
          <li>- Sick: {isInjured ? 'Yes' : 'No'}</li>
        </ul>
      </div>
      
      {/* Sec 3. 행동 델타 규칙 (Action Delta) */}
      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">3. 행동 델타 규칙 (Action Delta)</h3>
        <ul className="space-y-1 font-mono text-xs">
          <li>Food: W+1, Hun+1</li>
          <li>Protein: W+2, Str+1, En+1</li>
          <li>Train: W-2, En-1, Str+1(Success)</li>
          <li>Battle: W-4, En-1</li>
        </ul>
      </div>
      
      {/* Sec 4. 수면 정보 */}
      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">4. {isFrozen ? '냉장고 상태' : '수면 정보'}</h3>
        {isFrozen ? (
          <ul className="space-y-1">
            <li className="text-blue-600 font-semibold">🧊 냉장고에 넣어서 얼어있음 (수면 개념 없음)</li>
          </ul>
        ) : (
        <ul className="space-y-1">
          <li>수면 시간: {currentSleepSchedule && currentSleepSchedule.start !== undefined ? (
            <span>
              {formatSleepSchedule(currentSleepSchedule)}
              {isNocturnal && <span className="text-blue-500 ml-1">🦉 야행성 🌙</span>}
            </span>
          ) : '정보 없음'}</li>
          <li>수면 상태: {(() => {
            // 낮잠 중인지 확인
            const isNapTime = napUntil && currentTime < napUntil;
            
            if (visibleSleepStatus === 'AWAKE') {
              return '깨어있음';
            } else if (visibleSleepStatus === 'SLEEPING' || visibleSleepStatus === 'NAPPING') {
              if (isNapTime) {
                // 낮잠 중: 남은 시간 계산
                const remainingMs = napUntil - currentTime;
                const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
                const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / 60000);
                const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
                
                let timeText = '';
                if (remainingHours > 0) {
                  timeText = `${remainingHours}시간 ${remainingMinutes}분`;
                } else if (remainingMinutes > 0) {
                  timeText = `${remainingMinutes}분 ${remainingSeconds}초`;
                } else {
                  timeText = `${remainingSeconds}초`;
                }
                
                return <span>낮잠 중 😴 <span className="text-blue-600">({timeText} 남음)</span></span>;
              } else {
                return '수면 중 😴';
              }
            } else if (visibleSleepStatus === 'SLEEPING_LIGHT_ON') {
              return '수면 중(불 켜짐 경고!)';
            } else if (visibleSleepStatus === 'FALLING_ASLEEP') {
              return '잠들기 준비 중';
            } else if (visibleSleepStatus === 'AWAKE_INTERRUPTED') {
              return '강제 기상 중';
            }
            return sleepStatusLabel;
          })()}</li>
          <li>잠들기: {(() => {
            // fastSleepStart가 있고 불이 꺼져 있을 때 (wakeUntil과 관계없이 표시)
            if (visibleSleepStatus === 'FALLING_ASLEEP' && fastSleepStart && !isLightsOn) {
              const elapsed = currentTime - fastSleepStart;
              const remainingSeconds = Math.max(0, 15 - Math.floor(elapsed / 1000));

              if (remainingSeconds > 0 && remainingSeconds <= 15) {
                return <span className="text-blue-500 font-semibold">{remainingSeconds}초 후 잠들어요</span>;
              } else if (remainingSeconds <= 0) {
                // 15초가 지났으면 즉시 잠들 수 있음
                return <span className="text-green-500 font-semibold">즉시 잠들 수 있음</span>;
              }
            }
            
            // 조건이 아닐 때 수면 상태 값 그대로 표시
            const statusText = sleepStatusLabel;
            return <span className="text-gray-500">{statusText}</span>;
          })()}</li>
          <li>조명 상태: {isLightsOn ? <span className="text-yellow-600 font-semibold">켜짐 🔆</span> : <span className="text-blue-600 font-semibold">꺼짐 🌙</span>}</li>
          {visibleSleepStatus === 'AWAKE' && !wakeUntil && currentSleepSchedule && currentSleepSchedule.start !== undefined && (
            <li>수면까지: {getTimeUntilSleep(currentSleepSchedule, new Date())}</li>
          )}
          {visibleSleepStatus === 'SLEEPING' && (() => {
            // 낮잠 중인지 확인
            const isNapTime = napUntil && currentTime < napUntil;
            
            if (isNapTime) {
              // 낮잠 중: napUntil까지 남은 시간 계산
              const remainingMs = napUntil - currentTime;
              const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
              const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / 60000);
              const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
              
              let timeText = '';
              if (remainingHours > 0) {
                timeText = `${remainingHours}시간 ${remainingMinutes}분`;
              } else if (remainingMinutes > 0) {
                timeText = `${remainingMinutes}분 ${remainingSeconds}초`;
              } else {
                timeText = `${remainingSeconds}초`;
              }
              
              return (
                <li className="text-blue-600 font-semibold">
                  낮잠 중: {timeText} 후 기상
                </li>
              );
            } else if (currentSleepSchedule && currentSleepSchedule.start !== undefined) {
              // 정규 수면 중: 정규 수면 시간의 기상 시간 계산
              return (
                <li>기상까지: {getTimeUntilWake(currentSleepSchedule, new Date())}</li>
              );
            }
            return null;
          })()}
          {wakeUntil && currentTime < wakeUntil && (() => {
            const remainingMs = wakeUntil - currentTime;
            const remainingMinutes = Math.floor(remainingMs / 60000);
            const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
            return (
              <li className="text-orange-600 font-semibold">
                수면 방해 중: {remainingMinutes}분 {remainingSeconds}초 후 다시 잠들 예정
                <span className="text-yellow-600 ml-2">(강제로 깨운 횟수로만 수면 방해가 집계됩니다)</span>
              </li>
            );
          })()}
          {/* 빠른 잠들기 안내 */}
          {!isLightsOn && fastSleepStart && visibleSleepStatus === 'FALLING_ASLEEP' && (() => {
            const elapsedSinceFastSleepStart = currentTime - fastSleepStart;
            const remainingSeconds = Math.max(0, 15 - Math.floor(elapsedSinceFastSleepStart / 1000));
            if (remainingSeconds > 0 && remainingSeconds <= 15) {
              return (
                <li className="text-green-600 text-sm">
                  💡 빠른 잠들기: {remainingSeconds}초 후 자동으로 잠듭니다
                </li>
              );
            } else if (remainingSeconds <= 0) {
              // 15초가 지났으면 즉시 잠들 수 있음
              return (
                <li className="text-green-600 text-sm">
                  💡 빠른 잠들기: 즉시 잠들 수 있습니다 (wakeUntil 만료 시 자동 잠듦)
                </li>
              );
            }
            return null;
          })()}
          {/* 수면상태확인 항목 (항상 표시, 조건에 따라 다른 메시지) */}
          {(() => {
            // 수면 중이고 불이 켜져 있을 때만 카운트다운
            if (visibleSleepStatus === 'SLEEPING_LIGHT_ON' && isLightsOn && sleepLightOnStart) {
              const elapsedMs = currentTime - sleepLightOnStart;
              const thresholdMs = 30 * 60 * 1000; // 30분
              const remainingMs = thresholdMs - elapsedMs;
              if (remainingMs > 0) {
                const remainingMinutes = Math.floor(remainingMs / 60000);
                const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
                return (
                  <li className="text-yellow-600 font-semibold">
                    수면상태확인: 수면 중(불 켜짐 경고!) → {remainingMinutes}분 {remainingSeconds}초 남음 (30분 초과 시 케어 미스)
                  </li>
                );
              } else {
                return (
                  <li className="text-red-600 font-semibold">
                    수면상태확인: 케어 미스 발생! (불을 30분 이상 켜둠)
                  </li>
                );
              }
            }
            // 수면 시간이고 불이 꺼져 있을 때
            else if (visibleSleepStatus === 'SLEEPING' && !isLightsOn) {
              return (
                <li className="text-green-600 font-semibold">
                  수면상태확인: 수면 중, 조명(꺼짐!) → 잠자는 중 ✓
                </li>
              );
            }
            // 수면 시간이 아니거나 수면 방해로 깨어있을 때
            else if (visibleSleepStatus === 'AWAKE' || visibleSleepStatus === 'AWAKE_INTERRUPTED') {
              if (wakeUntil && currentTime < wakeUntil) {
                // 15초 빠른 잠들기 대기 중인지 확인 (fastSleepStart가 있고 15초 안 지났을 때)
                const isWaitingFastSleep = !isLightsOn && stats.fastSleepStart;
                if (isWaitingFastSleep) {
                  const elapsedSinceFastSleepStart = currentTime - stats.fastSleepStart;
                  const remainingSeconds = Math.max(0, 15 - Math.floor(elapsedSinceFastSleepStart / 1000));
                  if (remainingSeconds > 0 && remainingSeconds <= 15) {
                    return (
                      <li className="text-blue-500">
                        수면상태확인: 잠들기 준비 중 ({remainingSeconds}초 남음)
                      </li>
                    );
                  }
                }
                const remainingMs = wakeUntil - currentTime;
                const remainingMinutes = Math.floor(remainingMs / 60000);
                const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
                return (
                  <li className="text-orange-500">
                    수면상태확인: {isLightsOn ? (
                      `강제 기상 중 (${remainingMinutes}분 ${remainingSeconds}초 남음)`
                    ) : (
                      `강제 기상 회복 중 (${remainingMinutes}분 ${remainingSeconds}초 남음)`
                    )}
                  </li>
                );
              } else {
                // 수면 시간이 아니고 wakeUntil도 없을 때
                const isWaitingFastSleep = !isLightsOn && stats.fastSleepStart;
                if (isWaitingFastSleep) {
                  const elapsedSinceFastSleepStart = currentTime - stats.fastSleepStart;
                  const remainingSeconds = Math.max(0, 15 - Math.floor(elapsedSinceFastSleepStart / 1000));
                  if (remainingSeconds > 0 && remainingSeconds <= 15) {
                    return (
                      <li className="text-blue-500">
                        수면상태확인: 잠들기 준비 중 ({remainingSeconds}초 남음)
                      </li>
                    );
                  }
                }
                return (
                  <li className="text-gray-500">
                    수면상태확인: 수면 시간이 아님
                  </li>
                );
              }
            }
            // 수면 중(불 켜짐 경고!) 상태이지만 sleepLightOnStart가 없을 때 (방금 불을 켠 경우)
            else if (visibleSleepStatus === 'SLEEPING_LIGHT_ON' && isLightsOn && !sleepLightOnStart) {
              return (
                <li className="text-yellow-500">
                  수면상태확인: 수면 중(불 켜짐 경고!) → 카운트 시작 대기 중
                </li>
              );
            }
            // 기타 상태
            else {
              return (
                <li className="text-gray-500">
                  수면상태확인: 현재 상태 - {sleepStatusLabel}
                </li>
              );
            }
          })()}
          <li>
                수면 방해 횟수: {sleepDisturbances || 0}회
                <span
                  className="text-gray-500 text-xs ml-1"
                  title="실제로 잠든 상태에서 강제로 깨운 횟수만 집계됩니다. 현재 진화 단계 시작 이후의 이력 기준입니다."
                >
                  (진화 구간 기준)
                </span>
              </li>
        </ul>
        )}
        
        {/* 수면 방해 이력 아코디언 */}
        {!isFrozen && sleepDisturbances > 0 && (
          <SleepDisturbanceHistory 
            activityLogs={displayActivityLogs} 
            formatTimestamp={formatTimestamp}
            currentStageStartedAt={currentStageStartedAt}
          />
        )}
        
        {/* 야행성 모드 토글 버튼 */}
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">🦉 야행성 모드 🌙</span>
              {isNocturnal && <span className="text-xs text-blue-500 font-semibold">(활성화됨)</span>}
            </div>
            <button
              onClick={() => {
                if (!onChangeStats) return;
                const mutation = buildStatsPopupNocturnalMutation({
                  stats,
                  activityLogs: displayActivityLogs,
                  nowMs: Date.now(),
                  addActivityLogFn: addActivityLog,
                });
                if (appendLogToSubcollection) appendLogToSubcollection(mutation.logPayload).catch(() => {});
                onChangeStats(mutation.nextStats);
              }}
              className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${
                isNocturnal 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isNocturnal ? 'ON 🌙' : 'OFF ☀️'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {isNocturnal 
              ? '수면 시간과 기상 시간이 각각 3시간씩 미뤄집니다. (예: 22시 → 새벽 1시, 6시 → 9시)'
              : '야행성 모드를 활성화하면 수면 시간과 기상 시간이 각각 3시간씩 미뤄집니다.'}
          </p>
        </div>
      </div>
      
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

      {/* Sec 6. 진화 판정 카운터 */}
      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">6. 진화 판정 카운터</h3>
        <ul className="space-y-1">
          <li title="현재 시스템에서는 아직 해소되지 않은 케어미스 수를 표시합니다. 놀아주기/간식주기로 감소할 수 있으며, 진화 판정도 현재 값을 그대로 사용합니다.">
            Care Mistakes: {careMistakes || 0}
            <span className="text-gray-500 text-xs font-normal ml-1">(현재 활성 기준, 감소 가능)</span>
          </li>
          <li>Training Count: {trainings || 0}</li>
          <li>Overfeeds: {overfeeds || 0}</li>
          <li title="실제로 잠든 상태에서 강제로 깨운 횟수만 집계됩니다.">Sleep Disturbances: {sleepDisturbances || 0} (진화 구간 기준)</li>
          <li className="mt-2 pt-1 border-t">
            <strong>배틀 기록 (현재 디지몬):</strong>
          </li>
          <li className="ml-2">배틀: {battles || 0} (승: {battlesWon || 0}, 패: {battlesLost || 0})</li>
          <li className="ml-2">승률: {battles > 0 ? Math.round((battlesWon / battles) * 100) : 0}%</li>
          <li className="mt-2 pt-1 border-t">
            <strong>배틀 기록 (이번 생애):</strong>
          </li>
          <li className="ml-2">총 배틀: {totalBattles || 0} (승: {totalBattlesWon || 0}, 패: {totalBattlesLost || 0})</li>
          <li className="ml-2">총 승률: {totalBattles > 0 ? Math.round((totalBattlesWon / totalBattles) * 100) : 0}%</li>
          <li className="mt-2 pt-1 border-t">
            <strong>환생 기록:</strong>
          </li>
          <li className="ml-2">토탈 환생 횟수: {totalReincarnations || 0}회</li>
          <li className="ml-2">일반 사망 환생: {normalReincarnations || 0}회</li>
          <li className="ml-2">Perfect 이상 환생: {perfectReincarnations || 0}회</li>
        </ul>
      </div>
      
      {/* Sec 7. 내부/고급 카운터 */}
      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">7. 내부/고급 카운터</h3>
        {isFrozen && (
          <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded">
            <div className="text-blue-600 font-semibold text-sm">
              🧊 냉장고에 넣어서 얼어서 멈춤
            </div>
            <div className="text-[10px] text-blue-500 mt-1">
              모든 타이머가 멈춰있습니다. 냉장고에서 꺼내면 타이머가 다시 시작됩니다.
            </div>
          </div>
        )}
        <ul className="space-y-1">
          <li>
            HungerTimer: {hungerTimerDisplay.label}
            {hungerTimerDisplay.showCountdown
              ? ` (남은 시간: ${hungerTimerDisplay.countdownLabel})`
              : ""}
            {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}
          </li>
          <li>
            StrengthTimer: {strengthTimerDisplay.label}
            {strengthTimerDisplay.showCountdown
              ? ` (남은 시간: ${strengthTimerDisplay.countdownLabel})`
              : ""}
            {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}
          </li>
          <li>
            PoopTimer: {poopTimerDisplay.label}
            {poopTimerDisplay.showCountdown
              ? ` (남은 시간: ${poopTimerDisplay.countdownLabel})`
              : ""}
            {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}
          </li>
          <li>PoopCount: {poopCount}/8 {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
          <li>PoopReachedMaxAt: {formatTimestamp(poopReachedMaxAt)}</li>
          <li>LastPoopPenaltyAt: {formatTimestamp(lastPoopPenaltyAt)}</li>
          <li>Lifespan: {formatStatsPopupDuration(lifespanSeconds)} {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
          <li>Time to Evolve: {formatStatsPopupDuration(timeToEvolveSeconds)} {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
        </ul>
      </div>
      
      {/* Sec 8. 사망/질병 카운터 */}
      <div className="pb-2">
        <h3 className="font-bold text-base mb-2 text-red-700 flex items-center">
          <span className="mr-2">⚠️</span> 8. 사망/질병 카운터
        </h3>
        <ul className="space-y-3 text-sm">
          {/* 배고픔 0 사망 카운터 - 항상 표시 */}
          {(() => {
            const hungerZeroTime = ensureTimestamp(lastHungerZeroAt);
            const isActive = fullness === 0 && hungerZeroTime;
            const isDeadFromStarvation = isDead && deathReason === 'STARVATION (굶주림)';
            
            return (
              <li className={`border-l-4 pl-2 p-2 rounded ${isActive || isDeadFromStarvation ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50 opacity-60'}`}>
                <div className={`font-semibold mb-1 ${isActive || isDeadFromStarvation ? 'text-red-600' : 'text-gray-500'}`}>
                  🍖 배고픔 0 지속:
                </div>
                <div className="space-y-1 text-xs">
                  {hungerZeroTime ? (
                    <>
                      <div className="text-gray-600">
                        배고픔 0 발생 시간: <span className="font-mono">{formatTimestamp(hungerZeroTime)}</span>
                      </div>
                      {isDeadFromStarvation ? (
                        <div className="text-red-800 font-bold">💀 사망 (카운터 정지)</div>
                      ) : isActive ? (() => {
                        const nowMs = Date.now();
                        const elapsedMs = getElapsedTimeExcludingFridge(hungerZeroTime, nowMs, frozenAt, takeOutAt, hungerZeroFrozenDurationMs);
                        const elapsed = Math.floor(elapsedMs / 1000);
                        const threshold = 43200; // 12시간(초)
                        const remaining = Math.max(0, threshold - elapsed);
                        const deathDeadlineMs = hungerZeroTime + threshold * 1000;
                        if (isFrozen) {
                          return (
                            <div className="text-blue-600 font-semibold">
                              🧊 냉장고에 넣어서 얼어서 멈춤
                              <div className="text-[10px] text-blue-500 mt-1">
                                (냉장고에서 꺼내면 타이머가 다시 시작됩니다)
                              </div>
                            </div>
                          );
                        }
                        return remaining > 0 ? (
                          <div className="text-red-600 font-mono">
                            {Math.floor(remaining / 3600)}시간 {Math.floor((remaining % 3600) / 60)}분 {remaining % 60}초 남음
                            <div className="text-[10px] text-red-500 mt-1">(12시간 초과 시 사망)</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">데드라인: {formatTimestamp(deathDeadlineMs)}</div>
                          </div>
                        ) : (
                          <div className="text-red-800 font-bold">⚠️ 사망 위험!</div>
                        );
                      })(                      ) : (
                        <div className="text-gray-500">
                          ✓ 조건 미충족 (현재 배고픔: {fullness})
                          {isFrozen && (
                            <div className="text-blue-600 font-semibold mt-1">
                              🧊 냉장고에 넣어서 얼어서 멈춤 (타이머가 멈춰있습니다)
                            </div>
                          )}
                        </div>
                      )}
                      {(isActive || isDeadFromStarvation) && (
                        <>
                          <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mt-2 mb-1">
                            {(() => {
                              const nowMs = Date.now();
                              return [...Array(12)].map((_, i) => {
                                const elapsedMs = isDeadFromStarvation 
                                  ? 43200 * 1000 
                                  : getElapsedTimeExcludingFridge(hungerZeroTime, nowMs, frozenAt, takeOutAt, hungerZeroFrozenDurationMs);
                              const hourElapsed = Math.floor(elapsedMs / 1000 / 3600);
                              const isFilled = i < hourElapsed;
                              return (
                                <div 
                                  key={i}
                                  className={`flex-1 border-r border-white last:border-0 ${
                                    isFilled
                                      ? hourElapsed >= 12
                                        ? 'bg-red-700'
                                        : hourElapsed >= 10
                                        ? 'bg-red-600'
                                        : hourElapsed >= 8
                                        ? 'bg-red-500'
                                        : 'bg-red-400'
                                      : 'bg-gray-300'
                                  }`}
                                  title={`${i + 1}시간 경과`}
                                />
                              );
                            });
                            })()}
                          </div>
                          <div className="text-[10px] text-gray-500">12시간 게이지 (각 박스 = 1시간)</div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-gray-500 mb-2">
                        조건 미충족 (배고픔 0 발생 이력 없음)
                        {isFrozen && (
                          <div className="text-blue-600 font-semibold mt-1">
                            🧊 냉장고에 넣어서 얼어서 멈춤 (타이머가 멈춰있습니다)
                          </div>
                        )}
                      </div>
                      {/* 조건 미충족 시에도 게이지 표시 (모두 회색) */}
                      <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mb-1">
                        {[...Array(12)].map((_, i) => (
                          <div 
                            key={i}
                            className="flex-1 border-r border-white last:border-0 bg-gray-300"
                            title={`${i + 1}시간`}
                          />
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-500">12시간 게이지 (각 박스 = 1시간)</div>
                    </>
                  )}
                </div>
              </li>
            );
          })()}

          {/* 힘 0 사망 카운터 - 항상 표시 */}
          {(() => {
            const strengthZeroTime = ensureTimestamp(lastStrengthZeroAt);
            const isActive = strength === 0 && strengthZeroTime;
            const isDeadFromExhaustion = isDead && deathReason === 'EXHAUSTION (힘 소진)';
            
            return (
              <li className={`border-l-4 pl-2 p-2 rounded ${isActive || isDeadFromExhaustion ? 'border-orange-500 bg-orange-50' : 'border-gray-300 bg-gray-50 opacity-60'}`}>
                <div className={`font-semibold mb-1 ${isActive || isDeadFromExhaustion ? 'text-orange-600' : 'text-gray-500'}`}>
                  💪 힘 0 지속:
                </div>
                <div className="space-y-1 text-xs">
                  {strengthZeroTime ? (
                    <>
                      <div className="text-gray-600">
                        힘 0 발생 시간: <span className="font-mono">{formatTimestamp(strengthZeroTime)}</span>
                      </div>
                      {isDeadFromExhaustion ? (
                        <div className="text-orange-800 font-bold">💀 사망 (카운터 정지)</div>
                      ) : isActive ? (() => {
                        const nowMs = Date.now();
                        const elapsedMs = getElapsedTimeExcludingFridge(strengthZeroTime, nowMs, frozenAt, takeOutAt, strengthZeroFrozenDurationMs);
                        const elapsed = Math.floor(elapsedMs / 1000);
                        const threshold = 43200; // 12시간(초)
                        const remaining = Math.max(0, threshold - elapsed);
                        const deathDeadlineMs = strengthZeroTime + threshold * 1000;
                        if (isFrozen) {
                          return (
                            <div className="text-blue-600 font-semibold">
                              🧊 냉장고에 넣어서 얼어서 멈춤
                              <div className="text-[10px] text-blue-500 mt-1">
                                (냉장고에서 꺼내면 타이머가 다시 시작됩니다)
                              </div>
                            </div>
                          );
                        }
                        return remaining > 0 ? (
                          <div className="text-orange-600 font-mono">
                            {Math.floor(remaining / 3600)}시간 {Math.floor((remaining % 3600) / 60)}분 {remaining % 60}초 남음
                            <div className="text-[10px] text-orange-500 mt-1">(12시간 초과 시 사망)</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">데드라인: {formatTimestamp(deathDeadlineMs)}</div>
                          </div>
                        ) : (
                          <div className="text-orange-800 font-bold">⚠️ 사망 위험!</div>
                        );
                      })(                      ) : (
                        <div className="text-gray-500">
                          ✓ 조건 미충족 (현재 힘: {strength})
                          {isFrozen && (
                            <div className="text-blue-600 font-semibold mt-1">
                              🧊 냉장고에 넣어서 얼어서 멈춤 (타이머가 멈춰있습니다)
                            </div>
                          )}
                        </div>
                      )}
                      {(isActive || isDeadFromExhaustion) && (
                        <>
                          <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mt-2 mb-1">
                            {(() => {
                              const nowMs = Date.now();
                              return [...Array(12)].map((_, i) => {
                                const elapsedMs = isDeadFromExhaustion 
                                  ? 43200 * 1000 
                                  : getElapsedTimeExcludingFridge(strengthZeroTime, nowMs, frozenAt, takeOutAt, strengthZeroFrozenDurationMs);
                                const hourElapsed = Math.floor(elapsedMs / 1000 / 3600);
                                const isFilled = i < hourElapsed;
                                return (
                                  <div 
                                    key={i}
                                    className={`flex-1 border-r border-white last:border-0 ${
                                      isFilled
                                        ? hourElapsed >= 12
                                          ? 'bg-orange-700'
                                          : hourElapsed >= 10
                                          ? 'bg-orange-600'
                                          : hourElapsed >= 8
                                          ? 'bg-orange-500'
                                          : 'bg-orange-400'
                                        : 'bg-gray-300'
                                    }`}
                                    title={`${i + 1}시간 경과`}
                                  />
                                );
                              });
                            })()}
                          </div>
                          <div className="text-[10px] text-gray-500">12시간 게이지 (각 박스 = 1시간)</div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-gray-500 mb-2">
                        조건 미충족 (힘 0 발생 이력 없음)
                        {isFrozen && (
                          <div className="text-blue-600 font-semibold mt-1">
                            🧊 냉장고에 넣어서 얼어서 멈춤 (타이머가 멈춰있습니다)
                          </div>
                        )}
                      </div>
                      {/* 조건 미충족 시에도 게이지 표시 (모두 회색) */}
                      <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mb-1">
                        {[...Array(12)].map((_, i) => (
                          <div 
                            key={i}
                            className="flex-1 border-r border-white last:border-0 bg-gray-300"
                            title={`${i + 1}시간`}
                          />
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-500">12시간 게이지 (각 박스 = 1시간)</div>
                    </>
                  )}
                </div>
              </li>
            );
          })()}

          {/* 똥 가득참 부상 발생 시간 카운터 - 조건 충족 시 배고픔/힘처럼 진하게 표시 */}
          {(() => {
            const poopReachedTime = ensureTimestamp(poopReachedMaxAt);
            const poopPenaltyTime = ensureTimestamp(lastPoopPenaltyAt) || poopReachedTime;
            const isActive = poopCount >= 8 && poopReachedTime;
            
            return (
              <li className={`border-l-4 pl-2 p-2 rounded ${isActive ? 'border-amber-600 bg-amber-50' : 'border-gray-300 bg-gray-50 opacity-60'}`}>
                <div className={`font-semibold mb-1 ${isActive ? 'text-amber-800' : 'text-gray-500'}`}>
                  💩 똥 가득참 (8개):
                </div>
                <div className="space-y-1 text-xs">
                  {isActive ? (
                    <>
                      <div className={isActive ? 'text-amber-700' : 'text-gray-600'}>
                        즉시 부상 발생 시간: <span className="font-mono">{formatTimestamp(poopReachedTime)}</span>
                      </div>
                      {(() => {
                        if (!poopPenaltyTime) return null;

                        const nowMs = Date.now();
                        const elapsedMs = getElapsedTimeExcludingFridge(poopPenaltyTime, nowMs, frozenAt, takeOutAt, poopPenaltyFrozenDurationMs);
                        const elapsed = Math.max(0, Math.floor(elapsedMs / 1000));
                        const threshold = 28800; // 8시간 = 28800초
                        const nextInjuryIn = Math.max(0, threshold - (elapsed % threshold));
                        const hours = Math.floor(nextInjuryIn / 3600);
                        const minutes = Math.floor((nextInjuryIn % 3600) / 60);
                        const seconds = nextInjuryIn % 60;
                        
                        // 냉장고 상태일 때 표시
                        if (isFrozen) {
                          return (
                            <>
                              <div className="text-blue-600 font-semibold">
                                🧊 냉장고에 넣어서 얼어서 멈춤
                                <div className="text-[10px] text-blue-500 mt-1">
                                  (냉장고에서 꺼내면 타이머가 다시 시작됩니다)
                                </div>
                              </div>
                              <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mt-2 mb-1">
                                {[...Array(8)].map((_, i) => {
                                  const hourElapsed = Math.floor((elapsed % threshold) / 3600);
                                  const isFilled = i < hourElapsed;
                                  return (
                                    <div 
                                      key={i}
                                      className={`flex-1 border-r border-white last:border-0 ${
                                        isFilled
                                          ? hourElapsed >= 8
                                            ? 'bg-amber-700'
                                            : hourElapsed >= 6
                                            ? 'bg-amber-600'
                                            : hourElapsed >= 4
                                            ? 'bg-amber-500'
                                            : 'bg-amber-400'
                                          : 'bg-gray-300'
                                      }`}
                                      title={`${i + 1}시간 경과`}
                                    />
                                  );
                                })}
                              </div>
                              <div className="text-[10px] text-amber-600">
                                8시간 게이지 (각 박스 = 1시간, 8시간마다 추가 부상 발생)
                              </div>
                            </>
                          );
                        }
                        
                        // 냉장고 상태가 아닐 때 정상 표시 (다음 부상 데드라인 = 현재 + nextInjuryIn)
                        const nextInjuryDeadlineMs = nowMs + nextInjuryIn * 1000;
                        return (
                          <>
                            <div className="text-amber-700 font-mono font-semibold">
                              다음 추가 부상까지: {hours}시간 {minutes}분 {seconds}초
                              <div className="text-[10px] text-amber-600 mt-0.5 font-normal">데드라인: {formatTimestamp(nextInjuryDeadlineMs)}</div>
                            </div>
                            <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mt-2 mb-1">
                              {[...Array(8)].map((_, i) => {
                                const hourElapsed = Math.floor((elapsed % threshold) / 3600);
                                const isFilled = i < hourElapsed;
                                return (
                                  <div 
                                    key={i}
                                    className={`flex-1 border-r border-white last:border-0 ${
                                      isFilled
                                        ? hourElapsed >= 8
                                          ? 'bg-amber-700'
                                          : hourElapsed >= 6
                                          ? 'bg-amber-600'
                                          : hourElapsed >= 4
                                          ? 'bg-amber-500'
                                          : 'bg-amber-400'
                                        : 'bg-gray-300'
                                    }`}
                                    title={`${i + 1}시간 경과`}
                                  />
                                );
                              })}
                            </div>
                            <div className="text-[10px] text-amber-600">
                              8시간 게이지 (각 박스 = 1시간, 8시간마다 추가 부상 발생)
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <div className="text-gray-500 mb-2">
                        조건 미충족 (현재 똥: {poopCount || 0}/8)
                        {isFrozen && (
                          <div className="text-blue-600 font-semibold mt-1">
                            🧊 냉장고에 넣어서 얼어서 멈춤 (타이머가 멈춰있습니다)
                          </div>
                        )}
                      </div>
                      {/* 조건 미충족 시에도 게이지 표시 (모두 회색) */}
                      <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mb-1">
                        {[...Array(8)].map((_, i) => (
                          <div 
                            key={i}
                            className="flex-1 border-r border-white last:border-0 bg-gray-300"
                            title={`${i + 1}시간`}
                          />
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-500">8시간 게이지 (각 박스 = 1시간)</div>
                    </>
                  )}
                </div>
              </li>
            );
          })()}

          {/* 부상 방치 사망 카운터 - 항상 표시 */}
          {(() => {
            const injuredTime = ensureTimestamp(injuredAt);
            const isActive = isInjured && injuredTime;
            const isDeadFromInjuryNeglect = isDead && deathReason === 'INJURY NEGLECT (부상 방치: 6시간)';
            
            return (
              <li className={`border-l-4 pl-2 p-2 rounded ${isActive || isDeadFromInjuryNeglect ? 'border-red-600 bg-red-50' : 'border-gray-300 bg-gray-50 opacity-60'}`}>
                <div className={`font-semibold mb-1 ${isActive || isDeadFromInjuryNeglect ? 'text-red-700' : 'text-gray-500'}`}>
                  🏥 부상 방치 (6시간):
                </div>
                <div className="space-y-1 text-xs">
                  {injuredTime ? (
                    <>
                      <div className="text-gray-600">
                        부상 발생 시간: <span className="font-mono">{formatTimestamp(injuredTime)}</span>
                      </div>
                      {isDeadFromInjuryNeglect ? (
                        <div className="text-red-800 font-bold">💀 사망 (6시간 방치)</div>
                      ) : isActive ? (() => {
                        // 부상 방치 경과: 매 렌더 시점의 현재 시각 사용(줄어들지 않는 버그 방지)
                        const nowMs = Date.now();
                        const elapsedMs = getElapsedTimeExcludingFridge(injuredTime, nowMs, frozenAt, takeOutAt, injuryFrozenDurationMs);
                        const elapsed = Math.floor(elapsedMs / 1000);
                        const threshold = 21600; // 6시간 = 21600초
                        const remaining = Math.max(0, threshold - elapsed);
                        const neglectDeadlineMs = injuredTime + threshold * 1000;
                        if (isFrozen) {
                          return (
                            <div className="text-blue-600 font-semibold">
                              🧊 냉장고에 넣어서 얼어서 멈춤
                              <div className="text-[10px] text-blue-500 mt-1">
                                (냉장고에서 꺼내면 타이머가 다시 시작됩니다)
                              </div>
                            </div>
                          );
                        }
                        return remaining > 0 ? (
                          <div className="text-red-600 font-mono">
                            {Math.floor(remaining / 3600)}시간 {Math.floor((remaining % 3600) / 60)}분 {remaining % 60}초 남음
                            <div className="text-[10px] text-red-500 mt-1">(6시간 초과 시 사망)</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">데드라인: {formatTimestamp(neglectDeadlineMs)}</div>
                          </div>
                        ) : (
                          <div className="text-red-800 font-bold">⚠️ 사망 위험!</div>
                        );
                      })(                      ) : (
                        <div className="text-gray-500">
                          ✓ 조건 미충족 (현재 부상 상태 아님)
                          {isFrozen && (
                            <div className="text-blue-600 font-semibold mt-1">
                              🧊 냉장고에 넣어서 얼어서 멈춤 (타이머가 멈춰있습니다)
                            </div>
                          )}
                        </div>
                      )}
                      {(isActive || isDeadFromInjuryNeglect) && (
                        <>
                          <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mt-2 mb-1">
                            {[...Array(6)].map((_, i) => {
                              const nowMs = Date.now();
                              const elapsedMs = isDeadFromInjuryNeglect 
                                ? 21600 * 1000 
                                : getElapsedTimeExcludingFridge(injuredTime, nowMs, frozenAt, takeOutAt, injuryFrozenDurationMs);
                              const hourElapsed = Math.floor(elapsedMs / 1000 / 3600);
                              const isFilled = i < hourElapsed;
                              return (
                                <div 
                                  key={i}
                                  className={`flex-1 border-r border-white last:border-0 ${
                                    isFilled
                                      ? hourElapsed >= 6
                                        ? 'bg-red-700'
                                        : hourElapsed >= 5
                                        ? 'bg-red-600'
                                        : hourElapsed >= 4
                                        ? 'bg-red-500'
                                        : 'bg-red-400'
                                      : 'bg-gray-300'
                                  }`}
                                  title={`${i + 1}시간 경과`}
                                />
                              );
                            })}
                          </div>
                          <div className="text-[10px] text-gray-500">6시간 게이지 (각 박스 = 1시간)</div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-gray-500 mb-2">
                        조건 미충족 (부상 발생 이력 없음)
                        {isFrozen && (
                          <div className="text-blue-600 font-semibold mt-1">
                            🧊 냉장고에 넣어서 얼어서 멈춤 (타이머가 멈춰있습니다)
                          </div>
                        )}
                      </div>
                      {/* 조건 미충족 시에도 게이지 표시 (모두 회색) */}
                      <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mb-1">
                        {[...Array(6)].map((_, i) => (
                          <div 
                            key={i}
                            className="flex-1 border-r border-white last:border-0 bg-gray-300"
                            title={`${i + 1}시간`}
                          />
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-500">6시간 게이지 (각 박스 = 1시간)</div>
                    </>
                  )}
                </div>
              </li>
            );
          })()}

          {/* 부상 과다 사망 카운터 - 항상 표시 */}
          {(() => {
            const isActive = (injuries || 0) >= 15;
            const isDeadFromInjuryOverload = isDead && deathReason === 'INJURY OVERLOAD (부상 과다: 15회)';
            
            return (
              <li className={`border-l-4 pl-2 p-2 rounded ${isActive || isDeadFromInjuryOverload ? 'border-red-600 bg-red-50' : 'border-gray-300 bg-gray-50 opacity-60'}`}>
                <div className={`font-semibold mb-1 ${isActive || isDeadFromInjuryOverload ? 'text-red-700' : 'text-gray-500'}`}>
                  🩹 부상 과다 (15회):
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-center mb-2">
                    <span className={`font-bold text-lg ${isActive || isDeadFromInjuryOverload ? 'text-red-700' : injuries >= 12 ? 'text-red-600' : injuries >= 10 ? 'text-orange-600' : 'text-gray-500'}`}>
                      {injuries || 0} / 15 회
                    </span>
                    {(isActive || isDeadFromInjuryOverload || injuries >= 12) && (
                      <span className="text-xs text-red-500 animate-pulse font-bold">⚠️ 경고!</span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 mb-2">
                    이번 생 누적 부상 횟수
                  </div>
                  {/* 부상 과다 게이지 */}
                  <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mb-1">
                    {[...Array(15)].map((_, i) => (
                      <div 
                        key={i}
                        className={`flex-1 border-r border-white last:border-0 ${
                          i < (injuries || 0) 
                            ? injuries >= 15
                              ? 'bg-red-700' 
                              : injuries >= 12 
                              ? 'bg-red-600' 
                              : injuries >= 10 
                              ? 'bg-orange-500' 
                              : 'bg-red-400'
                            : 'bg-gray-300'
                        }`}
                        title={`부상 ${i + 1}회`}
                      />
                    ))}
                  </div>
                  {isDeadFromInjuryOverload ? (
                    <div className="text-red-800 font-bold">💀 사망 (부상 15회 도달)</div>
                  ) : isActive ? (
                    <div className="text-red-700 font-bold">⚠️ 사망 위험! (부상 15회 도달)</div>
                  ) : injuries >= 12 ? (
                    <div className="text-red-600 font-semibold">⚠️ 경고: 부상 횟수가 한도에 도달했습니다. 사망 위험이 매우 높습니다!</div>
                  ) : injuries >= 10 ? (
                    <div className="text-orange-500">※ 주의: 부상 횟수가 증가하고 있습니다.</div>
                  ) : (
                    <div className="text-gray-500">
                      조건 미충족 (이번 생 누적 부상: {injuries || 0}/15)
                    </div>
                  )}
                  
                  {/* 부상 이력 아코디언 - 항상 표시 */}
                  <div className="mt-2">
                    <InjuryHistory 
                      activityLogs={displayActivityLogs}
                      battleLogs={currentStats?.battleLogs || stats?.battleLogs || []}
                      formatTimestamp={formatTimestamp}
                      currentLifeStartedAt={currentLifeStartedAt}
                      selectedDigimonId={selectedDigimonId}
                      slotVersion={slotVersion}
                      digimonDataMap={digimonDataMap}
                      injuryLogs={injuryHistoryEntries}
                    />
                  </div>
                  <DiagnosticNotice>{injuryDiagnosticMessage}</DiagnosticNotice>
                </div>
              </li>
            );
          })()}

          {/* 수명 표시 (사망 기능 제거됨) */}
          {(() => {
            // 수명은 가변적이므로, 현재 수명을 기준으로 게이지 표시 (최대 20일 기준)
            const currentLifespan = lifespanSeconds || 0;
            const lifespanDays = Math.floor(currentLifespan / 86400);
            const maxDaysForDisplay = 20;
            
            return (
              <li className="border-l-4 pl-2 p-2 rounded border-gray-300 bg-gray-50">
                <div className="font-semibold mb-1 text-gray-500">
                  ⏰ 수명 :
                </div>
                <div className="space-y-1 text-xs">
                  <div className="text-gray-500 mb-2">
                    현재 수명: {formatStatsPopupDuration(currentLifespan)}
                    {isFrozen && (
                      <div className="text-blue-600 font-semibold mt-1">
                        🧊 냉장고에 넣어서 얼어서 멈춤 (수명이 증가하지 않습니다)
                      </div>
                    )}
                  </div>
                  {currentLifespan > 0 && (
                    <>
                      <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mb-1">
                        {[...Array(maxDaysForDisplay)].map((_, i) => {
                          const isFilled = i < Math.min(lifespanDays, maxDaysForDisplay);
                          return (
                            <div 
                              key={i}
                              className={`flex-1 border-r border-white last:border-0 ${
                                isFilled
                                  ? lifespanDays >= maxDaysForDisplay
                                    ? 'bg-gray-600'
                                    : lifespanDays >= 15
                                    ? 'bg-gray-500'
                                    : lifespanDays >= 10
                                    ? 'bg-gray-400'
                                    : 'bg-gray-300'
                                  : 'bg-gray-200'
                              }`}
                              title={`${i + 1}일 경과`}
                            />
                          );
                        })}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        수명 게이지 (현재: {lifespanDays}일, 최대 표시: 20일)
                        {isFrozen && <span className="text-blue-600 ml-1">🧊 멈춤</span>}
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })()}

        </ul>
      </div>
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
