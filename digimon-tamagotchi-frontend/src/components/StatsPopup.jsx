// src/components/StatsPopup.jsx
import React, { useState, useEffect } from "react";
import { formatTimestamp as formatTimestampUtil } from "../utils/dateUtils";
import { getTimeUntilSleep, getTimeUntilWake, formatSleepSchedule } from "../utils/sleepUtils";

/**
 * 수면 방해 이력 아코디언 컴포넌트
 */
function SleepDisturbanceHistory({ activityLogs, formatTimestamp }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // 수면 방해 관련 로그 필터링
  const sleepDisturbanceLogs = (activityLogs || []).filter(log => {
    if (log.type === 'CARE_MISTAKE' && log.text) {
      return log.text.includes('수면 방해');
    }
    return false;
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

// 시간 포맷 (일/시간/분/초)
function formatTime(sec=0){
  const d = Math.floor(sec / 86400);
  const r = sec % 86400;
  const h = Math.floor(r / 3600);
  const m = Math.floor((r % 3600) / 60);
  const s = r % 60;
  return `${d} day ${h} hour ${m} min ${s} sec`;
}

// 진화까지 남은 시간 포맷 (일/시간/분/초)
function formatTimeToEvolve(sec=0){
  const d = Math.floor(sec / 86400);
  const r = sec % 86400;
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
}){
  const [activeTab, setActiveTab] = useState('NEW'); // 'OLD' | 'NEW'
  
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
    hungerTimer, strengthTimer, poopTimer,
    maxEnergy, maxStamina, minWeight, healing, attribute, power,
    attackSprite, altAttackSprite, careMistakes,
    strength, effort, winRate,
    energy,
    poopCount=0,
    lastMaxPoopTime,
    trainings=0,
    overfeeds=0,
    sleepDisturbances=0,
    battles=0,
    battlesWon=0,
    battlesLost=0,
    totalBattles=0,
    totalBattlesWon=0,
    totalBattlesLost=0,
    totalWinRate=0,
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
    tiredStartAt=null,
    tiredCounted=false,
    dailySleepMistake=false,
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
  for(let i=0; i<=5; i++){
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
  
  // 타이머 남은 시간 계산 (초 단위)
  const formatCountdown = (countdown) => {
    if (!countdown || countdown <= 0) return '0s';
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return `${minutes}m ${seconds}s`;
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
  const speciesPoopTimer = speciesData.poopCycle || poopTimer || 0;
  
  // Stomach Capacity 계산 (5 + maxOverfeed)
  const stomachCapacity = 5 + (speciesData.maxOverfeed || maxOverfeed || 0);
  
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
          <li>CareMistakes: {careMistakes || 0}</li>

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
    <div className="space-y-4 text-sm" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
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
          <li>- isSleeping: {stats.isSleeping !== undefined ? (stats.isSleeping ? 'Yes' : 'No') : 'N/A'}</li>
          <li>- isInjured: {isInjured ? 'Yes' : 'No'}</li>
          <li>- isDead: {isDead ? 'Yes' : 'No'}</li>
          <li>- PoopCount: {poopCount}/8</li>
          <li>- Sick: {stats.sick !== undefined ? (stats.sick ? 'Yes' : 'No') : 'N/A'}</li>
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
        <h3 className="font-bold text-base mb-2">4. 수면 정보</h3>
        <ul className="space-y-1">
          <li>수면 시간: {currentSleepSchedule && currentSleepSchedule.start !== undefined ? formatSleepSchedule(currentSleepSchedule) : '정보 없음'}</li>
          <li>수면 상태: {sleepStatus === 'AWAKE' ? '깨어있음' : sleepStatus === 'SLEEPING' ? '수면 중' : sleepStatus === 'TIRED' ? 'SLEEPY(Lights Off plz)' : sleepStatus}</li>
          <li>조명 상태: {isLightsOn ? <span className="text-yellow-600 font-semibold">켜짐 🔆</span> : <span className="text-blue-600 font-semibold">꺼짐 🌙</span>}</li>
          {sleepStatus === 'AWAKE' && !wakeUntil && currentSleepSchedule && currentSleepSchedule.start !== undefined && (
            <li>수면까지: {getTimeUntilSleep(currentSleepSchedule, new Date())}</li>
          )}
          {sleepStatus === 'SLEEPING' && currentSleepSchedule && currentSleepSchedule.start !== undefined && (
            <li>기상까지: {getTimeUntilWake(currentSleepSchedule, new Date())}</li>
          )}
          {wakeUntil && currentTime < wakeUntil && (() => {
            const remainingMs = wakeUntil - currentTime;
            const remainingMinutes = Math.floor(remainingMs / 60000);
            const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
            
            // TIRED 상태일 때 케어미스까지 남은 시간 계산
            let careMistakeRemaining = null;
            if (sleepStatus === 'TIRED' && stats.tiredStartAt && !stats.tiredCounted && !stats.dailySleepMistake) {
              const tiredElapsed = currentTime - stats.tiredStartAt;
              const thresholdMs = 30 * 60 * 1000; // 30분
              const careMistakeRemainingMs = thresholdMs - tiredElapsed;
              if (careMistakeRemainingMs > 0) {
                careMistakeRemaining = {
                  minutes: Math.floor(careMistakeRemainingMs / 60000),
                  seconds: Math.floor((careMistakeRemainingMs % 60000) / 1000)
                };
              }
            }
            
            return (
              <li className="text-orange-600 font-semibold">
                수면 방해 중: {remainingMinutes}분 {remainingSeconds}초 남음
                {careMistakeRemaining && (
                  <span className="text-yellow-600 ml-2">(케어미스까지 {careMistakeRemaining.minutes}분 {careMistakeRemaining.seconds}초 남음)</span>
                )}
                {!isLightsOn && (
                  <span className="text-green-600 ml-2">(불 꺼짐 → 10초 후 잠듦)</span>
                )}
              </li>
            );
          })()}
          {/* 빠른 잠들기 안내 */}
          {wakeUntil && currentTime < wakeUntil && !isLightsOn && stats.fastSleepStart && (() => {
            const elapsedSinceFastSleepStart = currentTime - stats.fastSleepStart;
            const remainingSeconds = Math.max(0, 10 - Math.floor(elapsedSinceFastSleepStart / 1000));
            if (remainingSeconds > 0 && remainingSeconds <= 10) {
              return (
                <li className="text-green-600 text-sm">
                  💡 빠른 잠들기: {remainingSeconds}초 후 자동으로 잠듭니다
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
          <li>수면 방해 횟수: {sleepDisturbances || 0}회</li>
        </ul>
        
        {/* 수면 방해 이력 아코디언 */}
        {sleepDisturbances > 0 && (
          <SleepDisturbanceHistory 
            activityLogs={stats?.activityLogs || []} 
            formatTimestamp={formatTimestamp}
          />
        )}
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
                
                // 수면 중일 때는 타임아웃이 멈춤 (Timestamp Pushing 방식)
                // 수면 중에는 startedAt이 현재 시간으로 계속 업데이트되므로,
                // 경과 시간을 0으로 간주하여 마지막으로 깨어있던 시점의 남은 시간을 표시합니다.
                if (sleepStatus === 'SLEEPING') {
                  // ⚠️ 중요: 수면 중에는 startedAt이 checkCallTimeouts에서 현재 시간으로 업데이트되지만,
                  // StatsPopup이 렌더링될 때는 아직 업데이트되지 않았을 수 있습니다.
                  // 따라서 수면 중일 때는 startedAt을 현재 시간으로 간주하여 경과 시간을 0으로 계산합니다.
                  const elapsed = 0; // 수면 중에는 경과 시간이 0 (타임아웃이 멈춤)
                  const timeout = 10 * 60 * 1000; // 10분
                  const remaining = timeout - elapsed;
                  if (remaining > 0) {
                    const minutes = Math.floor(remaining / 60000);
                    const seconds = Math.floor((remaining % 60000) / 1000);
                    return (
                      <div className="text-blue-600 font-semibold ml-2">
                        😴 수면중(멈춤) - 타임아웃까지: {minutes}분 {seconds}초 남음 (10분 초과 시 케어미스 +1)
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-red-600 font-semibold ml-2">
                        ❌ 타임아웃! 케어미스 발생
                      </div>
                    );
                  }
                }
                
                // 수면 중이 아닐 때는 정상적으로 카운트다운
                const elapsed = currentTime - startedAt;
                const timeout = 10 * 60 * 1000; // 10분
                const remaining = timeout - elapsed;
                if (remaining > 0) {
                  const minutes = Math.floor(remaining / 60000);
                  const seconds = Math.floor((remaining % 60000) / 1000);
                  return (
                    <div className="text-red-600 font-semibold ml-2">
                      ⚠️ 활성화됨 - 타임아웃까지: {minutes}분 {seconds}초 남음 (10분 초과 시 케어미스 +1)
                    </div>
                  );
                } else {
                  return (
                    <div className="text-red-600 font-semibold ml-2">
                      ❌ 타임아웃! 케어미스 발생
                    </div>
                  );
                }
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
                
                // 수면 중일 때는 타임아웃이 멈춤 (Timestamp Pushing 방식)
                // 수면 중에는 startedAt이 현재 시간으로 계속 업데이트되므로,
                // 경과 시간을 0으로 간주하여 마지막으로 깨어있던 시점의 남은 시간을 표시합니다.
                if (sleepStatus === 'SLEEPING') {
                  // ⚠️ 중요: 수면 중에는 startedAt이 checkCallTimeouts에서 현재 시간으로 업데이트되지만,
                  // StatsPopup이 렌더링될 때는 아직 업데이트되지 않았을 수 있습니다.
                  // 따라서 수면 중일 때는 startedAt을 현재 시간으로 간주하여 경과 시간을 0으로 계산합니다.
                  const elapsed = 0; // 수면 중에는 경과 시간이 0 (타임아웃이 멈춤)
                  const timeout = 10 * 60 * 1000; // 10분
                  const remaining = timeout - elapsed;
                  if (remaining > 0) {
                    const minutes = Math.floor(remaining / 60000);
                    const seconds = Math.floor((remaining % 60000) / 1000);
                    return (
                      <div className="text-blue-600 font-semibold ml-2">
                        😴 수면중(멈춤) - 타임아웃까지: {minutes}분 {seconds}초 남음 (10분 초과 시 케어미스 +1)
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-red-600 font-semibold ml-2">
                        ❌ 타임아웃! 케어미스 발생
                      </div>
                    );
                  }
                }
                
                // 수면 중이 아닐 때는 정상적으로 카운트다운
                const elapsed = currentTime - startedAt;
                const timeout = 10 * 60 * 1000; // 10분
                const remaining = timeout - elapsed;
                if (remaining > 0) {
                  const minutes = Math.floor(remaining / 60000);
                  const seconds = Math.floor((remaining % 60000) / 1000);
                  return (
                    <div className="text-red-600 font-semibold ml-2">
                      ⚠️ 활성화됨 - 타임아웃까지: {minutes}분 {seconds}초 남음 (10분 초과 시 케어미스 +1)
                    </div>
                  );
                } else {
                  return (
                    <div className="text-red-600 font-semibold ml-2">
                      ❌ 타임아웃! 케어미스 발생
                    </div>
                  );
                }
              })() : (
                <div className="text-yellow-600 ml-2">호출 대기 중...</div>
              )
            ) : (
              <div className="text-green-600 ml-2">✓ 조건 미충족 (Strength: {strength})</div>
            )}
          </li>

          {/* Sleep Call */}
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
                const elapsed = currentTime - startedAt;
                const timeout = 60 * 60 * 1000; // 60분
                const remaining = timeout - elapsed;
                if (remaining > 0) {
                  const minutes = Math.floor(remaining / 60000);
                  const seconds = Math.floor((remaining % 60000) / 1000);
                  return (
                    <div className="text-red-600 font-semibold ml-2">
                      ⚠️ 활성화됨 - 타임아웃까지: {minutes}분 {seconds}초 남음 (60분 초과 시 케어미스 +1)
                    </div>
                  );
                } else {
                  return (
                    <div className="text-red-600 font-semibold ml-2">
                      ❌ 타임아웃! 케어미스 발생
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
        </ul>
      </div>

      {/* Sec 6. 진화 판정 카운터 */}
      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">6. 진화 판정 카운터</h3>
        <ul className="space-y-1">
          <li>Care Mistakes: {careMistakes || 0}</li>
          <li>Training Count: {trainings || 0}</li>
          <li>Overfeeds: {overfeeds || 0}</li>
          <li>Sleep Disturbances: {sleepDisturbances || 0}</li>
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
      <div className="pb-2">
        <h3 className="font-bold text-base mb-2">7. 내부/고급 카운터</h3>
        <ul className="space-y-1">
          <li>HungerTimer: {hungerTimer || 0} min (남은 시간: {formatCountdown(hungerCountdown)})</li>
          <li>StrengthTimer: {strengthTimer || 0} min (남은 시간: {formatCountdown(strengthCountdown)})</li>
          <li>PoopTimer: {poopTimer || 0} min (남은 시간: {formatCountdown(poopCountdown)})</li>
          <li>PoopCount: {poopCount}/8</li>
          <li>LastMaxPoopTime: {formatTimestamp(lastMaxPoopTime)}</li>
          <li>Lifespan: {formatTime(lifespanSeconds)}</li>
          <li>Time to Evolve: {formatTimeToEvolve(timeToEvolveSeconds)}</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-white p-4 rounded shadow-xl w-96 relative modal-mobile stats-popup-mobile"
        style={{
          maxHeight: "80vh",    // 화면 80% 높이까지만
          overflowY: "auto",    // 세로 스크롤
        }}
      >
        {/* 헤더 영역: 제목과 닫기 버튼 */}
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold">Digimon Status</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-bold"
            title="닫기"
          >
            ✕
          </button>
        </div>
        
        {/* 탭 UI */}
        <div className="flex gap-2 mb-4 border-b">
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
        
        {/* 탭 콘텐츠 */}
        {activeTab === 'OLD' && renderOldTab()}
        {activeTab === 'NEW' && renderNewTab()}
      </div>
    </div>
  );
}