// src/components/StatsPanel.jsx
import React from "react";
import { formatTimestamp as formatTimestampUtil } from "../utils/dateUtils";
import StatusHearts from "./StatusHearts";

/**
 * fullnessDisplay:
 *  - fullness≥5 ⇒ 5까지만 표시 + (나머지 오버피드)
 *  - 예) fullness=7 => "5(+2)"
 */
function fullnessDisplay(fullness=0, maxOverfeed=0){
  const base = Math.min(5, fullness);
  let over = 0;
  if(fullness > 5){
    over = fullness - 5;
  }
  return `${base}${over>0 ? "(+" + over + ")" : ""}`;
}

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

// 카운트다운 포맷 (초를 분:초로)
function formatCountdown(sec=0){
  const mm = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

// timestamp 포맷팅은 utils/dateUtils에서 import
const formatTimestamp = formatTimestampUtil;

const StatsPanel = ({ stats, sleepStatus = "AWAKE" }) => {
  return (
    <div className="border p-2 bg-white shadow-md text-sm w-48">
      <h2 className="text-center font-bold mb-2 text-base">StatsPanel</h2>
      <p>Age: {stats.age || 0}</p>
      <p>Weight: {stats.weight || 0}</p>
      <p>Strength: {stats.strength || 0}</p>
      <p>Energy (DP): {stats.energy || 0}</p>

      {/* WinRate = 0% */}
      <p>WinRate: {stats.winRate || 0}%</p>

      <p>Effort: {stats.effort || 0}</p>
      <p>CareMistakes: {stats.careMistakes || 0}</p>
      <p>Sleep: {sleepStatus}</p>

      {/* 하트로 표시된 상태 */}
      <div className="mt-2 pt-2 border-t border-gray-300">
        <StatusHearts
          fullness={stats.fullness || 0}
          strength={stats.strength || 0}
          maxOverfeed={stats.maxOverfeed || 0}
          proteinOverdose={stats.proteinOverdose || 0}
          showLabels={true}
          size="sm"
          position="inline"
        />
      </div>
      
      {/* 기존 텍스트 표시 (참고용) */}
      <p className="text-xs text-gray-500 mt-1">Fullness: {fullnessDisplay(stats.fullness, stats.maxOverfeed)}</p>
      
      {/* 개발자용 추가 정보 */}
      <div className="mt-2 pt-2 border-t border-gray-300">
        <p className="text-xs text-gray-600">Dev Info:</p>
        <p className="text-xs">Protein Overdose: {stats.proteinOverdose || 0}</p>
        <p className="text-xs">Overfeeds: {stats.overfeeds || 0}</p>
        <p className="text-xs">Battles: {stats.battles || 0}</p>
        <p className="text-xs">Wins: {stats.battlesWon || 0} / Losses: {stats.battlesLost || 0}</p>
      </div>

      {/* 5. 내부/고급 카운터 (StatsPopup New 탭과 동일) */}
      <div className="mt-2 pt-2 border-t border-gray-300">
        <h3 className="text-xs font-bold mb-1 text-gray-700">5. 내부/고급 카운터</h3>
        <div className="text-xs space-y-0.5">
          <p>HungerTimer: {stats.hungerTimer || 0} min (남은 시간: {formatCountdown(stats.hungerCountdown || 0)})</p>
          <p>StrengthTimer: {stats.strengthTimer || 0} min (남은 시간: {formatCountdown(stats.strengthCountdown || 0)})</p>
          <p>PoopTimer: {stats.poopTimer || 0} min (남은 시간: {formatCountdown(stats.poopCountdown || 0)})</p>
          <p>PoopCount: {stats.poopCount || 0}/8</p>
          <p>LastMaxPoopTime: {formatTimestamp(stats.lastMaxPoopTime)}</p>
          <p>Lifespan: {formatTime(stats.lifespanSeconds || 0)}</p>
          <p>Time to Evolve: {formatTimeToEvolve(stats.timeToEvolveSeconds || 0)}</p>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;