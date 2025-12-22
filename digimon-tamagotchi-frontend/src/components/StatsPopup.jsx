// src/components/StatsPopup.jsx
import React, { useState } from "react";

// 시간 포맷 (일/분/초)
function formatTime(sec=0){
  const d = Math.floor(sec / 86400);
  const r = sec % 86400;
  const m = Math.floor(r / 60);
  const s = r % 60;
  return `${d} day ${m} min ${s} sec`;
}

// [분:초]
function formatTimeToEvolve(sec=0){
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${mm}m ${ss}s`;
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

// timestamp -> 'YYYY.MM.DD HH:mm:ss' 식 변환
function formatTimestamp(ts){
  if(!ts) return "N/A";
  return new Date(ts).toLocaleString(); 
}

export default function StatsPopup({
  stats,
  digimonData = null, // 종족 고정 파라미터 (digimonData)
  onClose,
  devMode=false,
  onChangeStats
}){
  const [activeTab, setActiveTab] = useState('OLD'); // 'OLD' | 'NEW'
  
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
    trainingCount=0,
    trainings=0,
    overfeeds=0,
    sleepDisturbances=0,
    battles=0,
    battlesWon=0,
    battlesLost=0,
    isInjured=false,
    hungerCountdown=0,
    strengthCountdown=0,
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
  const sleepSchedule = speciesData.sleepSchedule || {};
  const sleepTime = sleepSchedule.start !== undefined 
    ? `${sleepSchedule.start}:00 - ${sleepSchedule.end}:00`
    : (speciesData.sleepTime || 'N/A');
  
  // hungerCycle을 hungerTimer로 변환 (분 단위)
  const speciesHungerTimer = speciesData.hungerCycle || hungerTimer || 0;
  const speciesStrengthTimer = speciesData.strengthCycle || strengthTimer || 0;
  const speciesPoopTimer = speciesData.poopCycle || poopTimer || 0;
  
  // Stomach Capacity 계산 (5 + maxOverfeed)
  const stomachCapacity = 5 + (speciesData.maxOverfeed || maxOverfeed || 0);

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
          <li>Training: {trainingCount}회</li>

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
          <li>Sleep Time: {sleepTime}</li>
          <li>Max DP (Energy): {speciesData.maxEnergy || maxEnergy || maxStamina || 0}</li>
          <li>Min Weight: {speciesData.minWeight || minWeight || 0}g</li>
          <li>Stomach Capacity: {stomachCapacity}</li>
          <li>Lifespan: {speciesData.lifespan ? `${speciesData.lifespan}h` : 'N/A'}</li>
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
      
      {/* Sec 4. 진화 판정 카운터 */}
      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">4. 진화 판정 카운터</h3>
        <ul className="space-y-1">
          <li>Care Mistakes: {careMistakes || 0}</li>
          <li>Training Count: {trainings || trainingCount || 0}</li>
          <li>Overfeeds: {overfeeds || 0}</li>
          <li>Sleep Disturbances: {sleepDisturbances || 0}</li>
          <li>Total Battles: {battles || 0} (Wins: {battlesWon || 0}, Losses: {battlesLost || 0})</li>
        </ul>
      </div>
      
      {/* Sec 5. 내부/고급 카운터 */}
      <div className="pb-2">
        <h3 className="font-bold text-base mb-2">5. 내부/고급 카운터</h3>
        <ul className="space-y-1">
          <li>HungerTimer: {hungerTimer || 0} min (남은 시간: {formatCountdown(hungerCountdown)})</li>
          <li>StrengthTimer: {strengthTimer || 0} min (남은 시간: {formatCountdown(strengthCountdown)})</li>
          <li>PoopTimer: {poopTimer || 0} min</li>
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
        className="bg-white p-4 rounded shadow-xl w-96 relative"
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