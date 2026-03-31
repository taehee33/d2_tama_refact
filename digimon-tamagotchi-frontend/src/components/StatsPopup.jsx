// src/components/StatsPopup.jsx
import React, { useState, useEffect } from "react";
import { formatTimestamp as formatTimestampUtil } from "../utils/dateUtils";
import { getTimeUntilSleep, getTimeUntilWake, formatSleepSchedule } from "../utils/sleepUtils";
import { addActivityLog, isSleepDisturbanceLog } from "../hooks/useGameLogic";

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
 * 케어미스 발생 이력 아코디언 컴포넌트
 * currentStageStartedAt: 현재 진화 단계 시작 시각(ms). 이 시점 이후 로그만 표시해 카운터와 일치시킴.
 */
function CareMistakeHistory({ activityLogs, formatTimestamp, currentStageStartedAt }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // 케어미스 관련 로그 필터링 (수면 방해 제외) + 현재 진화 단계 시작 시점 이후만 표시
  const careMistakeLogs = (activityLogs || []).filter(log => {
    if (isSleepDisturbanceLog(log)) {
      return false;
    }
    // CARE_MISTAKE 또는 CAREMISTAKE 타입
    if (log.type === 'CARE_MISTAKE' || log.type === 'CAREMISTAKE') {
      return true;
    }
    return false;
  }).filter(log => {
    // 방법 B: 현재 진화 단계 시작 시점 이후 로그만 표시 (카운터와 일치)
    const logMs = ensureTimestamp(log.timestamp);
    if (logMs == null) return false;
    if (currentStageStartedAt == null || currentStageStartedAt === undefined) return true; // 구 데이터 호환: 없으면 전체 표시
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
          케어미스 발생 이력 ({careMistakeLogs.length}건)
        </span>
        <span className="text-gray-500 text-xs">
          {isOpen ? '▲ 접기' : '▼ 펼치기'}
        </span>
      </button>
      
      {isOpen && (
        <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
          {careMistakeLogs.length === 0 ? (
            <div className="text-xs p-2 bg-gray-50 border border-gray-200 rounded text-gray-600">
              케어미스 발생 이력이 없습니다. (로그가 아직 기록되지 않았을 수 있습니다)
            </div>
          ) : (
            careMistakeLogs.map((log, index) => {
              const timestamp = ensureTimestamp(log.timestamp);
              const formattedTime = timestamp ? formatTimestamp(timestamp) : '시간 정보 없음';
              
              return (
                <div
                  key={index}
                  className="text-xs p-2 bg-orange-50 border border-orange-200 rounded"
                >
                  <div className="font-semibold text-orange-700">
                    {log.text || '케어미스 발생'}
                  </div>
                  <div className="text-orange-600 mt-1">
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
 * activityLogs: 기존 활동 로그 (POOP/INJURY/BATTLE 타입)
 * battleLogs: 배틀 전용 로그 (injury 필드 또는 텍스트로 부상 여부 판단)
 */
function InjuryHistory({ activityLogs, battleLogs = [], formatTimestamp }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const fromActivity = (activityLogs || []).filter(log => {
    if (!log.text) return false;
    if (log.type === 'POOP' && log.text.includes('Injury')) return true;
    if (log.type === 'BATTLE' && (log.text.includes('Injury') || log.text.includes('부상'))) return true;
    if (log.type === 'INJURY') return true;
    return false;
  });
  
  const fromBattle = (battleLogs || []).filter(b => b.injury || (b.text && (b.text.includes('Injury') || b.text.includes('부상'))))
    .map(b => ({ timestamp: b.timestamp, text: b.text }));
  
  const injuryLogs = [...fromActivity, ...fromBattle].sort((a, b) => {
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
          부상 이력 ({injuryLogs.length}건)
        </span>
        <span className="text-gray-500 text-xs">
          {isOpen ? '▲ 접기' : '▼ 펼치기'}
        </span>
      </button>
      
      {isOpen && (
        <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
          {injuryLogs.length === 0 ? (
            <div className="text-xs p-2 bg-gray-50 border border-gray-200 rounded text-gray-600">
              부상 이력이 없습니다. (로그가 아직 기록되지 않았을 수 있습니다)
            </div>
          ) : (
            injuryLogs.map((log, index) => {
              const timestamp = ensureTimestamp(log.timestamp);
              const formattedTime = timestamp ? formatTimestamp(timestamp) : '시간 정보 없음';
              
              // 부상 원인 추출
              let injuryType = '부상 발생';
              let bgColor = 'bg-red-50';
              let borderColor = 'border-red-200';
              let textColor = 'text-red-700';
              
              if (log.text.includes('poop') || log.text.includes('똥')) {
                injuryType = '💩 똥 8개로 인한 부상';
                bgColor = 'bg-brown-50';
                borderColor = 'border-brown-200';
                textColor = 'text-brown-700';
              } else if (log.text.includes('battle') || log.text.includes('배틀') || log.text.includes('Battle')) {
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
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// 시간 포맷 (일/시간/분/초)
function formatTime(sec=0){
  const safeSec = typeof sec === 'number' && Number.isFinite(sec) ? sec : 0;
  const d = Math.floor(safeSec / 86400);
  const r = safeSec % 86400;
  const h = Math.floor(r / 3600);
  const m = Math.floor((r % 3600) / 60);
  const s = r % 60;
  return `${d} day ${h} hour ${m} min ${s} sec`;
}

// 진화까지 남은 시간 포맷 (일/시간/분/초)
function formatTimeToEvolve(sec=0){
  const safeSec = typeof sec === 'number' && Number.isFinite(sec) ? sec : 0;
  const d = Math.floor(safeSec / 86400);
  const r = safeSec % 86400;
  const h = Math.floor(r / 3600);
  const m = Math.floor((r % 3600) / 60);
  const s = r % 60;
  return `${d} day ${h} hour ${m} min ${s} sec`;
}

// fullness => 예) 7 => "5(+2)"
function fullnessDisplay(fullness=0, maxOverfeed=0){
  const base = Math.min(5, fullness);
  let over = 0;
  if(fullness > 5){
    over = fullness - 5;
  }
  return `${base}${over>0 ? "(+" + over + ")" : ""}`;
}

// strength => 예) strength가 8이면 "5(+3)" (5 이상일 때)
function strengthDisplay(strength=0){
  const base = Math.min(5, strength);
  const over = strength > 5 ? strength - 5 : 0;
  return `${base}${over>0 ? "(+" + over + ")" : ""}`;
}

// timestamp 포맷팅은 utils/dateUtils에서 import
const formatTimestamp = formatTimestampUtil;

/**
 * Firestore Timestamp를 안전하게 변환하는 유틸 함수
 * @param {any} val - 변환할 값 (number, Date, Firestore Timestamp, string 등)
 * @returns {number|null} - timestamp (milliseconds) 또는 null
 */
function ensureTimestamp(val) {
  if (!val) return null;
  if (typeof val === 'number') return val;
  // Firestore Timestamp 객체 처리
  if (val && typeof val === 'object' && 'seconds' in val) {
    return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
  }
  // Date 객체나 문자열 처리
  const date = new Date(val);
  return isNaN(date.getTime()) ? null : date.getTime();
}

export default function StatsPopup({
  stats,
  activityLogs: activityLogsProp = null, // 틱에서 즉시 반영된 로그 (부상/케어미스 새로고침 없이 표시)
  digimonData = null, // 종족 고정 파라미터 (digimonData)
  onClose,
  devMode=false,
  onChangeStats,
  sleepSchedule = null, // 수면 스케줄 { start, end }
  sleepStatus = "AWAKE", // 수면 상태
  wakeUntil = null, // 깨어있는 시간 (timestamp)
  sleepLightOnStart = null, // 수면 중 불 켜진 시작 시간 (timestamp)
  isLightsOn = false, // 조명 상태
  callStatus = null, // 호출 상태 { hunger: { isActive, startedAt }, strength: { isActive, startedAt }, sleep: { isActive, startedAt } }
  appendLogToSubcollection, // Firestore logs 서브컬렉션에 로그 추가 (선택)
}){
  const [activeTab, setActiveTab] = useState('NEW'); // 'OLD' | 'NEW'
  // 이력 표시: 틱에서 setActivityLogs로 갱신된 prop이 더 많거나 같으면 사용(즉시 반영), 아니면 stats.activityLogs
  const statsLogs = stats?.activityLogs ?? [];
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
    lastMaxPoopTime,
    lastHungerZeroAt=null,
    lastStrengthZeroAt=null,
    hungerMistakeDeadline=null,
    strengthMistakeDeadline=null,
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
    injuries=0,
    healedDosesCurrent=0,
    hungerCountdown=0,
    strengthCountdown=0,
    poopCountdown=0,
    fastSleepStart=null,
    napUntil=null,
    isNocturnal=false,
    isFrozen=false,
    frozenAt=null,
    takeOutAt=null,
  } = stats || {};

  // devMode에서 select로 변경
  function handleChange(field, e){
    if(!onChangeStats) return;
    let val;
    
    // boolean 필드는 checkbox로 처리
    if(field === "isInjured") {
      val = e.target.checked;
    } else {
      val = parseInt(e.target.value, 10);
    }

    // 기존 값
    const oldPoopCount = stats.poopCount || 0;

    const newStats = { ...stats, [field]: val };

    // ★ 여기서 poopCount가 8 이상이 되는 순간, lastMaxPoopTime이 없으면 기록
    if(field === "poopCount") {
      // 이전 값이 8 미만이고, 새 값이 8 이상이며 lastMaxPoopTime이 없으면 세팅
      if(oldPoopCount < 8 && val >= 8 && !newStats.lastMaxPoopTime) {
        newStats.lastMaxPoopTime = Date.now();
      }
    }
    
    // isInjured가 true로 설정될 때 injuredAt이 없으면 현재 시간으로 설정
    if(field === "isInjured" && val === true && !newStats.injuredAt) {
      newStats.injuredAt = Date.now();
    }
    // isInjured가 false로 설정될 때 injuredAt 초기화
    if(field === "isInjured" && val === false) {
      newStats.injuredAt = null;
      newStats.healedDosesCurrent = 0;
    }

    onChangeStats(newStats);
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
  
  // 타이머 남은 시간 계산 (초 단위)
  const formatCountdown = (countdown) => {
    if (!countdown || countdown <= 0) return '0s';
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return `${minutes}m ${seconds}s`;
  };
  
  /**
   * 냉장고 시간을 제외한 경과 시간 계산
   * @param {number} startTime - 시작 시간 (timestamp)
   * @param {number} endTime - 종료 시간 (timestamp, 기본값: 현재 시간)
   * @param {number|null} frozenAt - 냉장고에 넣은 시간 (timestamp)
   * @param {number|null} takeOutAt - 냉장고에서 꺼낸 시간 (timestamp)
   * @returns {number} 냉장고 시간을 제외한 경과 시간 (밀리초)
   */
  // 절대 시각 기반: 경과 시간은 항상 >= 0 (음수/미래 시각 차단 → T_rem = max(0, deadline - now) 일관성)
  const getElapsedTimeExcludingFridge = (startTime, endTime = currentTime, frozenAt = null, takeOutAt = null) => {
    if (!frozenAt || !startTime) {
      return Math.max(0, endTime - startTime);
    }
    const frozenTime = typeof frozenAt === 'number' ? frozenAt : new Date(frozenAt).getTime();
    const takeOutTime = takeOutAt ? (typeof takeOutAt === 'number' ? takeOutAt : new Date(takeOutAt).getTime()) : endTime;
    if (frozenTime < startTime) return Math.max(0, endTime - startTime);
    if (frozenTime >= endTime) return Math.max(0, endTime - startTime);
    
    // 냉장고에 넣은 시간부터 꺼낸 시간(또는 현재)까지의 시간을 제외
    const frozenDuration = takeOutTime - frozenTime;
    const totalElapsed = endTime - startTime;
    
    // 냉장고 시간을 제외한 경과 시간 반환
    return Math.max(0, totalElapsed - frozenDuration);
  };
  
  // 종족 고정 파라미터 추출
  const speciesData = digimonData?.stats || {};
  // props로 받은 sleepSchedule이 있으면 사용, 없으면 speciesData에서 가져옴
  const currentSleepSchedule = sleepSchedule || speciesData.sleepSchedule || {};
  
  // Energy 회복까지 남은 시간 계산 함수들
  const getTimeUntilNextEnergyRecovery = () => {
    const now = new Date(currentTime);
    const currentMinute = now.getMinutes();
    
    // 다음 정각(00분) 또는 30분까지 남은 시간 계산
    let nextRecoveryTime = new Date(now);
    nextRecoveryTime.setSeconds(0);
    nextRecoveryTime.setMilliseconds(0);
    
    if (currentMinute < 30) {
      // 다음 30분까지
      nextRecoveryTime.setMinutes(30);
    } else {
      // 다음 정각까지
      nextRecoveryTime.setMinutes(0);
      nextRecoveryTime.setHours(nextRecoveryTime.getHours() + 1);
    }
    
    const diffMs = nextRecoveryTime.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffSeconds = Math.floor((diffMs % 60000) / 1000);
    
    if (diffMinutes > 0) {
      return `${diffMinutes}분 ${diffSeconds}초 후`;
    } else {
      return `${diffSeconds}초 후`;
    }
  };
  
  // 기상 시간까지 남은 시간 (기상 시 maxEnergy 회복)
  const getTimeUntilWakeForEnergy = () => {
    if (!currentSleepSchedule || currentSleepSchedule.end === undefined) {
      return "정보 없음";
    }
    return getTimeUntilWake(currentSleepSchedule, new Date(currentTime));
  };
  
  // Sleep Time 포맷팅 (HH:MM 형식을 12시간 형식으로 변환)
  const formatSleepTime = () => {
    // sleepSchedule 형식: { start: 20, end: 8 }
    if (currentSleepSchedule.start !== undefined) {
      const startHour = currentSleepSchedule.start;
      const endHour = currentSleepSchedule.end;
      const startPeriod = startHour >= 12 ? 'PM' : 'AM';
      const endPeriod = endHour >= 12 ? 'PM' : 'AM';
      const startHour12 = startHour > 12 ? startHour - 12 : (startHour === 0 ? 12 : startHour);
      const endHour12 = endHour > 12 ? endHour - 12 : (endHour === 0 ? 12 : endHour);
      return `${startHour12}:00 ${startPeriod} - ${endHour12}:00 ${endPeriod}`;
    }
    // "HH:MM" 형식 (예: "20:00")
    const sleepTimeStr = speciesData.sleepTime;
    if (!sleepTimeStr || sleepTimeStr === 'N/A' || sleepTimeStr === null) return 'N/A';
    const [hour, minute] = sleepTimeStr.split(':').map(Number);
    if (isNaN(hour)) return sleepTimeStr;
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
  };
  
  const sleepTime = formatSleepTime();
  
  // hungerCycle을 hungerTimer로 변환 (분 단위)
  const speciesHungerTimer = speciesData.hungerCycle || hungerTimer || 0;
  const speciesStrengthTimer = speciesData.strengthCycle || strengthTimer || 0;
  
  // Power (basePower)
  const speciesPower = speciesData.basePower || power || 0;
  
  // Heal Doses (기본값 1)
  const speciesHealDoses = speciesData.healDoses || 1;

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

          <li>Lifespan: {formatTime(lifespanSeconds)}</li>
          <li>TimeToEvolve: {formatTimeToEvolve(timeToEvolveSeconds)}</li>
          <li>Fullness: {fullnessDisplay(fullness, maxOverfeed)}</li>
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
          {/* ★ lastMaxPoopTime 표시 */}
          <li>LastMaxPoopTime: {formatTimestamp(lastMaxPoopTime)}</li>
          
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
              <label className="block mt-1 flex items-center">
                <input
                  type="checkbox"
                  checked={isInjured || false}
                  onChange={(e)=> handleChange("isInjured",e)}
                  className="mr-2"
                />
                isInjured (부상 상태)
              </label>
              
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
          <li>Hunger (Fullness): {fullnessDisplay(fullness, maxOverfeed)}/5</li>
          <li>Strength: {strengthDisplay(strength || 0)}/5</li>
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
            • 기상 시간 회복 (max): {getTimeUntilWakeForEnergy()}
          </li>
          <li className="ml-4 text-xs text-gray-600">
            • 30분마다 회복 (+1): {getTimeUntilNextEnergyRecovery()}
          </li>
          <li>Win Ratio: {winRate || 0}%</li>
          <li className="mt-2 pt-1 border-t">Flags:</li>
          <li>- isSleeping: {sleepStatus === 'SLEEPING' ? 'Yes' : 'No'}</li>
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
            
            if (sleepStatus === 'AWAKE') {
              return '깨어있음';
            } else if (sleepStatus === 'SLEEPING') {
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
                
                return <span>수면 중 😴 <span className="text-blue-600">(낮잠: {timeText} 남음)</span></span>;
              } else {
                return '수면 중 😴';
              }
            } else if (sleepStatus === 'TIRED') {
              return 'SLEEPY(Lights Off plz)';
            }
            return sleepStatus;
          })()}</li>
          <li>잠들기: {(() => {
            // 디버깅: 값 확인 (개발 모드에서만)
            if (devMode) {
              console.log('[StatsPopup 잠들기] fastSleepStart:', fastSleepStart);
              console.log('[StatsPopup 잠들기] isLightsOn:', isLightsOn);
              console.log('[StatsPopup 잠들기] currentTime:', currentTime);
            }
            
            // fastSleepStart가 있고 불이 꺼져 있을 때 (wakeUntil과 관계없이 표시)
            if (fastSleepStart && !isLightsOn) {
              const elapsed = currentTime - fastSleepStart;
              const remainingSeconds = Math.max(0, 15 - Math.floor(elapsed / 1000));
              
              if (devMode) {
                console.log('[StatsPopup 잠들기] elapsed:', elapsed);
                console.log('[StatsPopup 잠들기] remainingSeconds:', remainingSeconds);
              }
              
              if (remainingSeconds > 0 && remainingSeconds <= 15) {
                return <span className="text-blue-500 font-semibold">{remainingSeconds}초 후 잠들어요</span>;
              } else if (remainingSeconds <= 0) {
                // 15초가 지났으면 즉시 잠들 수 있음
                return <span className="text-green-500 font-semibold">즉시 잠들 수 있음</span>;
              }
            } else {
              // 조건 불만족 시 이유 출력 (개발 모드에서만)
              if (devMode) {
                if (!fastSleepStart) console.log('[StatsPopup 잠들기] fastSleepStart가 없음');
                if (isLightsOn) console.log('[StatsPopup 잠들기] 불이 켜져 있음');
              }
            }
            
            // 조건이 아닐 때 수면 상태 값 그대로 표시 (TIRED는 SLEEPY(Lights Off plz)로 통일)
            const statusText = sleepStatus === 'AWAKE' ? 'AWAKE' : sleepStatus === 'SLEEPING' ? 'SLEEPING' : sleepStatus === 'TIRED' ? 'SLEEPY(Lights Off plz)' : sleepStatus;
            return <span className="text-gray-500">{statusText}</span>;
          })()}</li>
          <li>조명 상태: {isLightsOn ? <span className="text-yellow-600 font-semibold">켜짐 🔆</span> : <span className="text-blue-600 font-semibold">꺼짐 🌙</span>}</li>
          {sleepStatus === 'AWAKE' && !wakeUntil && currentSleepSchedule && currentSleepSchedule.start !== undefined && (
            <li>수면까지: {getTimeUntilSleep(currentSleepSchedule, new Date())}</li>
          )}
          {sleepStatus === 'SLEEPING' && (() => {
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
          {!isLightsOn && fastSleepStart && (() => {
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
            // 수면 시간이고 불이 켜져 있고 sleepLightOnStart가 있을 때만 카운트다운
            if (sleepStatus === 'TIRED' && isLightsOn && sleepLightOnStart) {
              const elapsedMs = currentTime - sleepLightOnStart;
              const thresholdMs = 30 * 60 * 1000; // 30분
              const remainingMs = thresholdMs - elapsedMs;
              if (remainingMs > 0) {
                const remainingMinutes = Math.floor(remainingMs / 60000);
                const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
                return (
                  <li className="text-yellow-600 font-semibold">
                    수면상태확인: 디지몬(조는중zZ), 조명(켜짐!) → {remainingMinutes}분 {remainingSeconds}초 남음 (30분 초과 시 케어 미스)
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
            else if (sleepStatus === 'SLEEPING' && !isLightsOn) {
              return (
                <li className="text-green-600 font-semibold">
                  수면상태확인: 디지몬(조는중zZ), 조명(꺼짐!) → 잠자는 중 ✓
                </li>
              );
            }
            // 수면 시간이 아니거나 수면 방해로 깨어있을 때
            else if (sleepStatus === 'AWAKE') {
              if (wakeUntil && currentTime < wakeUntil) {
                // 15초 빠른 잠들기 대기 중인지 확인 (fastSleepStart가 있고 15초 안 지났을 때)
                const isWaitingFastSleep = !isLightsOn && stats.fastSleepStart;
                if (isWaitingFastSleep) {
                  const elapsedSinceFastSleepStart = currentTime - stats.fastSleepStart;
                  const remainingSeconds = Math.max(0, 15 - Math.floor(elapsedSinceFastSleepStart / 1000));
                  if (remainingSeconds > 0 && remainingSeconds <= 15) {
                    return (
                      <li className="text-blue-500">
                        수면상태확인: 디지몬(조는중zZ), 조명(꺼짐!) → 잠들기 준비 중 ({remainingSeconds}초 남음)
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
                      `디지몬(조는중zZ), 조명(켜짐!) → 수면 방해 중 (${remainingMinutes}분 ${remainingSeconds}초 남음)`
                    ) : (
                      `디지몬(조는중zZ), 조명(꺼짐!) → 수면 방해 회복 중 (${remainingMinutes}분 ${remainingSeconds}초 남음)`
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
                        수면상태확인: 디지몬(조는중zZ), 조명(꺼짐!) → 낮잠 준비 중 ({remainingSeconds}초 남음)
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
            // TIRED 상태이지만 sleepLightOnStart가 없을 때 (방금 불을 켠 경우)
            else if (sleepStatus === 'TIRED' && isLightsOn && !sleepLightOnStart) {
              return (
                <li className="text-yellow-500">
                  수면상태확인: 디지몬(조는중zZ), 조명(켜짐!) → 카운트 시작 대기 중
                </li>
              );
            }
            // 기타 상태
            else {
              return (
                <li className="text-gray-500">
                  수면상태확인: 현재 상태 - {sleepStatus === 'TIRED' ? 'SLEEPY(Lights Off plz)' : sleepStatus === 'SLEEPING' ? '수면 중' : '깨어있음'}
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
            currentStageStartedAt={stats?.evolutionStageStartedAt ?? null}
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
                const newMode = !isNocturnal;
                const updatedStats = { ...stats, isNocturnal: newMode };
                
                // Activity Log 추가
                const currentLogs = displayActivityLogs;
                const logText = newMode 
                  ? '야행성 모드 ON: 수면/기상 시간이 3시간씩 미뤄집니다 🌙'
                  : '야행성 모드 OFF: 일반 수면 시간으로 복귀합니다 ☀️';
                const updatedLogs = addActivityLog(currentLogs, "ACTION", logText);
                if (appendLogToSubcollection) appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
                onChangeStats({ ...updatedStats, activityLogs: updatedLogs });
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
      
      {/* Sec 5. 케어미스 발생 조건 */}
      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">5. 케어미스 발생 조건</h3>
        <ul className="space-y-2 text-sm">
          {/* Hunger Call */}
          <li className="border-l-4 pl-2" style={{ borderColor: fullness === 0 ? '#ef4444' : '#e5e7eb' }}>
            <div className="font-semibold">🍖 Hunger Call (배고픔 호출)</div>
            <div className="text-xs text-gray-600 ml-2">
              조건: Fullness = 0
            </div>
            {fullness === 0 ? (
              callStatus?.hunger?.isActive && callStatus?.hunger?.startedAt ? (() => {
                // ensureTimestamp를 사용하여 안전하게 변환 (null 체크 포함)
                const startedAt = ensureTimestamp(callStatus.hunger.startedAt);
                if (!startedAt || startedAt <= 0) {
                  return <div className="text-yellow-600 ml-2">호출 대기 중...</div>;
                }
                
                // 냉장고 상태일 때 표시 (수면 체크보다 우선)
                if (isFrozen) {
                  return (
                    <div className="text-blue-600 font-semibold ml-2">
                      🧊 냉장고에 넣어서 얼어서 멈춤
                      <div className="text-[10px] text-blue-500 mt-1">
                        (냉장고에서 꺼내면 타이머가 다시 시작됩니다)
                      </div>
                    </div>
                  );
                }
                
                // 수면 중일 때는 타임아웃이 멈춤 (Timestamp Pushing 방식)
                // 수면 중에는 startedAt이 현재 시간으로 계속 업데이트되므로,
                // 경과 시간을 0으로 간주하여 마지막으로 깨어있던 시점의 남은 시간을 표시합니다.
                const timeout = 10 * 60 * 1000; // 10분
                // DB 데드라인 우선 사용 (새로고침 후에도 동일한 남은 시간 유지)
                const deadlineMs = (hungerMistakeDeadline && hungerMistakeDeadline > 0)
                  ? hungerMistakeDeadline
                  : (startedAt + timeout);
                const remaining = Math.max(0, deadlineMs - currentTime);
                if (sleepStatus === 'SLEEPING') {
                  if (remaining > 0) {
                    const minutes = Math.floor(remaining / 60000);
                    const seconds = Math.floor((remaining % 60000) / 1000);
                    return (
                      <div className="text-blue-600 font-semibold ml-2">
                        😴 수면중(멈춤) - 타임아웃까지: {minutes}분 {seconds}초 남음 (10분 초과 시 케어미스 +1)
                        <div className="text-[10px] text-gray-500 mt-1 font-normal">데드라인: {formatTimestamp(deadlineMs)}</div>
                      </div>
                    );
                  }
                  return (
                    <div className="text-red-600 font-semibold ml-2">
                      ❌ 타임아웃! 케어미스 발생
                    </div>
                  );
                }
                if (remaining > 0) {
                  const minutes = Math.floor(remaining / 60000);
                  const seconds = Math.floor((remaining % 60000) / 1000);
                  return (
                    <div className="text-red-600 font-semibold ml-2">
                      ⚠️ 활성화됨 - 타임아웃까지: {minutes}분 {seconds}초 남음 (10분 초과 시 케어미스 +1)
                      <div className="text-[10px] text-gray-500 mt-1 font-normal">데드라인: {formatTimestamp(deadlineMs)}</div>
                    </div>
                  );
                }
                return (
                  <div className="text-red-600 font-semibold ml-2">
                    ❌ 타임아웃! 케어미스 발생
                  </div>
                );
              })() : (
                <div className="text-yellow-600 ml-2">호출 대기 중...</div>
              )
            ) : (
              <div className="text-green-600 ml-2">✓ 조건 미충족 (Fullness: {fullness})</div>
            )}
          </li>

          {/* Strength Call */}
          <li className="border-l-4 pl-2" style={{ borderColor: strength === 0 ? '#ef4444' : '#e5e7eb' }}>
            <div className="font-semibold">💪 Strength Call (힘 호출)</div>
            <div className="text-xs text-gray-600 ml-2">
              조건: Strength = 0
            </div>
            {strength === 0 ? (
              callStatus?.strength?.isActive && callStatus?.strength?.startedAt ? (() => {
                // ensureTimestamp를 사용하여 안전하게 변환 (null 체크 포함)
                const startedAt = ensureTimestamp(callStatus.strength.startedAt);
                if (!startedAt || startedAt <= 0) {
                  return <div className="text-yellow-600 ml-2">호출 대기 중...</div>;
                }
                
                // 냉장고 상태일 때 표시 (수면 체크보다 우선)
                if (isFrozen) {
                  return (
                    <div className="text-blue-600 font-semibold ml-2">
                      🧊 냉장고에 넣어서 얼어서 멈춤
                      <div className="text-[10px] text-blue-500 mt-1">
                        (냉장고에서 꺼내면 타이머가 다시 시작됩니다)
                      </div>
                    </div>
                  );
                }
                
                const timeout = 10 * 60 * 1000; // 10분
                const deadlineMs = (strengthMistakeDeadline && strengthMistakeDeadline > 0)
                  ? strengthMistakeDeadline
                  : (startedAt + timeout);
                const remaining = Math.max(0, deadlineMs - currentTime);
                if (sleepStatus === 'SLEEPING') {
                  if (remaining > 0) {
                    const minutes = Math.floor(remaining / 60000);
                    const seconds = Math.floor((remaining % 60000) / 1000);
                    return (
                      <div className="text-blue-600 font-semibold ml-2">
                        😴 수면중(멈춤) - 타임아웃까지: {minutes}분 {seconds}초 남음 (10분 초과 시 케어미스 +1)
                        <div className="text-[10px] text-gray-500 mt-1 font-normal">데드라인: {formatTimestamp(deadlineMs)}</div>
                      </div>
                    );
                  }
                  return (
                    <div className="text-red-600 font-semibold ml-2">
                      ❌ 타임아웃! 케어미스 발생
                    </div>
                  );
                }
                if (remaining > 0) {
                  const minutes = Math.floor(remaining / 60000);
                  const seconds = Math.floor((remaining % 60000) / 1000);
                  return (
                    <div className="text-red-600 font-semibold ml-2">
                      ⚠️ 활성화됨 - 타임아웃까지: {minutes}분 {seconds}초 남음 (10분 초과 시 케어미스 +1)
                      <div className="text-[10px] text-gray-500 mt-1 font-normal">데드라인: {formatTimestamp(deadlineMs)}</div>
                    </div>
                  );
                }
                return (
                  <div className="text-red-600 font-semibold ml-2">
                    ❌ 타임아웃! 케어미스 발생
                  </div>
                );
              })() : (
                <div className="text-yellow-600 ml-2">호출 대기 중...</div>
              )
            ) : (
              <div className="text-green-600 ml-2">✓ 조건 미충족 (Strength: {strength})</div>
            )}
          </li>

          {/* Sleep Call */}
          {isFrozen ? (
            <li className="border-l-4 pl-2 border-blue-300">
              <div className="font-semibold">😴 Sleep Call (수면 호출)</div>
              <div className="text-blue-600 ml-2">
                🧊 냉장고 상태에서는 수면 개념이 없습니다
              </div>
            </li>
          ) : (
          <li className="border-l-4 pl-2" style={{ borderColor: (sleepStatus === 'TIRED' || (sleepStatus === 'SLEEPING' && isLightsOn)) ? '#ef4444' : '#e5e7eb' }}>
            <div className="font-semibold">😴 Sleep Call (수면 호출)</div>
            <div className="text-xs text-gray-600 ml-2">
              조건: 수면 시간 + 불 켜짐
            </div>
            {sleepStatus === 'TIRED' || (sleepStatus === 'SLEEPING' && isLightsOn) ? (
              callStatus?.sleep?.isActive && callStatus?.sleep?.startedAt ? (() => {
                // ensureTimestamp를 사용하여 안전하게 변환 (null 체크 포함)
                const startedAt = ensureTimestamp(callStatus.sleep.startedAt);
                if (!startedAt || startedAt <= 0) {
                  return <div className="text-yellow-600 ml-2">호출 대기 중...</div>;
                }
                const elapsed = Math.max(0, currentTime - startedAt);
                const timeout = 60 * 60 * 1000; // 60분
                const remaining = Math.max(0, timeout - elapsed);
                const deadlineMs = startedAt + timeout;
                if (remaining > 0) {
                  const minutes = Math.floor(remaining / 60000);
                  const seconds = Math.floor((remaining % 60000) / 1000);
                  return (
                    <div className="text-red-600 font-semibold ml-2">
                      ⚠️ 활성화됨 - 경고 유지 시간: {minutes}분 {seconds}초 남음 (케어미스는 증가하지 않음)
                      <div className="text-[10px] text-gray-500 mt-1 font-normal">데드라인: {formatTimestamp(deadlineMs)}</div>
                    </div>
                  );
                } else {
                  return (
                    <div className="text-yellow-600 font-semibold ml-2">
                      ⚠️ 경고 유지 중 - 불을 끄거나 실제로 잠들면 해제됩니다
                    </div>
                  );
                }
              })() : (
                <div className="text-yellow-600 ml-2">호출 대기 중...</div>
              )
            ) : (
              <div className="text-green-600 ml-2">
                ✓ 조건 미충족 (수면 상태: {sleepStatus === 'AWAKE' ? '깨어있음' : sleepStatus === 'SLEEPING' ? '수면 중 (불 꺼짐)' : sleepStatus}, 불: {isLightsOn ? '켜짐' : '꺼짐'})
              </div>
            )}
          </li>
          )
          }
        </ul>
        
        {/* 케어미스 발생 이력 (현재 진화 단계 시작 시점 이후만 표시 → Care Mistakes 카운터와 일치) */}
        <CareMistakeHistory 
          activityLogs={displayActivityLogs} 
          formatTimestamp={formatTimestamp}
          currentStageStartedAt={stats?.evolutionStageStartedAt ?? null}
        />
      </div>

      {/* Sec 6. 진화 판정 카운터 */}
      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">6. 진화 판정 카운터</h3>
        <ul className="space-y-1">
          <li title="현재 진화 단계(스테이지)가 시작된 이후의 케어미스만 집계됩니다.">
            Care Mistakes: {careMistakes || 0}
            <span className="text-gray-500 text-xs font-normal ml-1">(진화 구간 기준)</span>
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
            <strong>배틀 기록 (전체 생애):</strong>
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
          <li>HungerTimer: {hungerTimer || 0} min (남은 시간: {formatCountdown(hungerCountdown)}) {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
          <li>StrengthTimer: {strengthTimer || 0} min (남은 시간: {formatCountdown(strengthCountdown)}) {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
          <li>PoopTimer: {poopTimer || 0} min (남은 시간: {formatCountdown(poopCountdown)}) {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
          <li>PoopCount: {poopCount}/8 {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
          <li>LastMaxPoopTime: {formatTimestamp(lastMaxPoopTime)}</li>
          <li>Lifespan: {formatTime(lifespanSeconds)} {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
          <li>Time to Evolve: {formatTimeToEvolve(timeToEvolveSeconds)} {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
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
                        const elapsedMs = getElapsedTimeExcludingFridge(hungerZeroTime, nowMs, frozenAt, takeOutAt);
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
                                  : getElapsedTimeExcludingFridge(hungerZeroTime, nowMs, frozenAt, takeOutAt);
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
                        const elapsedMs = getElapsedTimeExcludingFridge(strengthZeroTime, nowMs, frozenAt, takeOutAt);
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
                                  : getElapsedTimeExcludingFridge(strengthZeroTime, nowMs, frozenAt, takeOutAt);
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
            const pooFullTime = ensureTimestamp(lastMaxPoopTime);
            const isActive = poopCount >= 8 && pooFullTime;
            
            return (
              <li className={`border-l-4 pl-2 p-2 rounded ${isActive ? 'border-amber-600 bg-amber-50' : 'border-gray-300 bg-gray-50 opacity-60'}`}>
                <div className={`font-semibold mb-1 ${isActive ? 'text-amber-800' : 'text-gray-500'}`}>
                  💩 똥 가득참 (8개):
                </div>
                <div className="space-y-1 text-xs">
                  {isActive ? (
                    <>
                      <div className={isActive ? 'text-amber-700' : 'text-gray-600'}>
                        즉시 부상 발생 시간: <span className="font-mono">{formatTimestamp(pooFullTime)}</span>
                      </div>
                      {(() => {
                        const nowMs = Date.now();
                        const elapsedMs = getElapsedTimeExcludingFridge(pooFullTime, nowMs, frozenAt, takeOutAt);
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
                        const elapsedMs = getElapsedTimeExcludingFridge(injuredTime, nowMs, frozenAt, takeOutAt);
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
                                : getElapsedTimeExcludingFridge(injuredTime, nowMs, frozenAt, takeOutAt);
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
                      조건 미충족 (현재 부상: {injuries || 0}/15)
                    </div>
                  )}
                  
                  {/* 부상 이력 아코디언 - 항상 표시 */}
                  <div className="mt-2">
                    <InjuryHistory 
                      activityLogs={displayActivityLogs}
                      battleLogs={stats?.battleLogs || []}
                      formatTimestamp={formatTimestamp}
                    />
                  </div>
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
                    현재 수명: {formatTime(currentLifespan)}
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-white p-4 rounded shadow-xl w-96 relative modal-mobile stats-popup-mobile flex flex-col"
        style={{ maxHeight: "80vh" }}
      >
        {/* 헤더 영역: 제목과 닫기 버튼 (상단 고정) */}
        <div className="flex-shrink-0 flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold">Digimon Status</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-bold"
            title="닫기"
          >
            ✕
          </button>
        </div>
        
        {/* 탭 UI (상단 고정) */}
        <div className="flex-shrink-0 flex gap-2 mb-4 border-b">
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
        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'OLD' && renderOldTab()}
          {activeTab === 'NEW' && renderNewTab()}
        </div>
      </div>
    </div>
  );
}
