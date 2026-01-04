// src/components/StatsPopup.jsx
import React, { useState, useEffect } from "react";
import { formatTimestamp as formatTimestampUtil } from "../utils/dateUtils";
import { getTimeUntilSleep, getTimeUntilWake, formatSleepSchedule } from "../utils/sleepUtils";

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

// timestamp 포맷팅은 utils/dateUtils에서 import
const formatTimestamp = formatTimestampUtil;

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
    isInjured=false,
    hungerCountdown=0,
    strengthCountdown=0,
    poopCountdown=0,
  } = stats || {};

  // devMode에서 select로 변경
  function handleChange(field, e){
    if(!onChangeStats) return;
    const val = parseInt(e.target.value, 10);

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
          <li>Hunger (Fullness): {fullnessDisplay(fullness, maxOverfeed)}</li>
          <li>Strength: {strength || 0}/5</li>
          <li>Energy (Current): {energy || 0}</li>
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
          <li>수면 상태: {sleepStatus === 'AWAKE' ? '깨어있음' : sleepStatus === 'SLEEPING' ? '수면 중' : sleepStatus === 'TIRED' ? '피곤함' : sleepStatus}</li>
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
            return (
              <li className="text-orange-600 font-semibold">
                수면 방해 중: {remainingMinutes}분 {remainingSeconds}초 남음
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
          {/* 불 끄기까지 항목 (항상 표시, 조건에 따라 다른 메시지) */}
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
                    불 끄기까지: {remainingMinutes}분 {remainingSeconds}초 남음 (30분 초과 시 케어 미스)
                  </li>
                );
              } else {
                return (
                  <li className="text-red-600 font-semibold">
                    케어 미스 발생! (불을 30분 이상 켜둠)
                  </li>
                );
              }
            }
            // 수면 시간이고 불이 꺼져 있을 때
            else if (sleepStatus === 'SLEEPING' && !isLightsOn) {
              return (
                <li className="text-green-600 font-semibold">
                  불 끄기까지: 불 꺼짐 ✓ (잠자는 중)
                </li>
              );
            }
            // 수면 시간이 아니거나 수면 방해로 깨어있을 때
            else if (sleepStatus === 'AWAKE') {
              if (wakeUntil && currentTime < wakeUntil) {
                return (
                  <li className="text-orange-500">
                    불 끄기까지: 수면 방해 중 (깨어있음)
                  </li>
                );
              } else {
                return (
                  <li className="text-gray-500">
                    불 끄기까지: 수면 시간이 아님
                  </li>
                );
              }
            }
            // TIRED 상태이지만 sleepLightOnStart가 없을 때 (방금 불을 켠 경우)
            else if (sleepStatus === 'TIRED' && isLightsOn && !sleepLightOnStart) {
              return (
                <li className="text-yellow-500">
                  불 끄기까지: 불이 켜져 있음 (카운트 시작 대기 중)
                </li>
              );
            }
            // 기타 상태
            else {
              return (
                <li className="text-gray-500">
                  불 끄기까지: 현재 상태 - {sleepStatus === 'TIRED' ? '피곤함' : sleepStatus === 'SLEEPING' ? '수면 중' : '깨어있음'}
                </li>
              );
            }
          })()}
          <li>수면 방해 횟수: {sleepDisturbances || 0}회</li>
        </ul>
      </div>
      
      {/* Sec 5. 진화 판정 카운터 */}
      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">5. 진화 판정 카운터</h3>
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
        </ul>
      </div>
      
      {/* Sec 6. 내부/고급 카운터 */}
      <div className="pb-2">
        <h3 className="font-bold text-base mb-2">5. 내부/고급 카운터</h3>
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