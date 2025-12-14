// src/components/StatsPopup.jsx
import React from "react";

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
  onClose,
  devMode=false,
  onChangeStats
}){
  // stats 내부 항목 구조 분해
  const {
    fullness, maxOverfeed, timeToEvolveSeconds, lifespanSeconds,
    age, sprite, evolutionStage, weight, health, isDead,
    hungerTimer, strengthTimer, poopTimer,
    maxStamina, minWeight, healing, attribute, power,
    attackSprite, altAttackSprite, careMistakes,
    strength, stamina, effort, winRate,
    poopCount=0,
    lastMaxPoopTime,
    trainingCount=0
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
  const possibleHealth= [0,1,2,3,4,5];
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-white p-4 rounded shadow-xl w-80"
        style={{
          maxHeight: "80vh",    // 화면 80% 높이까지만
          overflowY: "auto",    // 세로 스크롤
        }}
      >
        <h2 className="text-lg font-bold mb-2">Digimon Status</h2>
        
        {/* 기본 스탯 표시 */}
        <ul className="text-sm space-y-1">
          <li>Age: {age || 0}</li>
          <li>Sprite: {sprite}</li>
          <li>Stage: {evolutionStage}</li>
          <li>Strength: {strength || 0}</li>
          <li>Energy (DP): {stats.energy !== undefined ? stats.energy : (stamina || 0)}</li>
          <li>Effort: {effort || 0}</li>
          <li>WinRate: {winRate || 0}%</li>
          <li>CareMistakes: {careMistakes || 0}</li>

          <li>Lifespan: {formatTime(lifespanSeconds)}</li>
          <li>TimeToEvolve: {formatTimeToEvolve(timeToEvolveSeconds)}</li>
          <li>Fullness: {fullnessDisplay(fullness, maxOverfeed)}</li>
          <li>Health: {health || 0}</li>
          <li>Weight: {weight || 0}</li>
          <li>MaxOverfeed: {maxOverfeed || 0}</li>
          <li>isDead: {isDead ? "Yes" : "No"}</li>

          <li>HungerTimer: {hungerTimer || 0} min</li>
          <li>StrengthTimer: {strengthTimer || 0} min</li>
          <li>PoopTimer: {poopTimer || 0} min</li>

          <li>MaxStamina: {maxStamina || 0}</li>
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

            {/* health */}
            <label className="block mt-1">
              Health:
              <select
                value={health}
                onChange={(e)=> handleChange("health",e)}
                className="border ml-2"
              >
                {possibleHealth.map(h => <option key={h} value={h}>{h}</option>)}
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

        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
        >
          닫기
        </button>
      </div>
    </div>
  );
}