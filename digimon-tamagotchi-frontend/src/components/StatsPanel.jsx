// src/components/StatsPanel.jsx
import React from "react";

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

const StatsPanel = ({ stats, sleepStatus = "AWAKE" }) => {
  return (
    <div className="border p-2 bg-white shadow-md text-sm w-48">
      <p>Age: {stats.age || 0}</p>
      <p>Weight: {stats.weight || 0}</p>
      <p>Strength: {stats.strength || 0}</p>
      <p>Energy (DP): {stats.energy !== undefined ? stats.energy : (stats.stamina || 0)}</p>

      {/* WinRate = 0% */}
      <p>WinRate: {stats.winRate || 0}%</p>

      <p>Effort: {stats.effort || 0}</p>
      <p>CareMistakes: {stats.careMistakes || 0}</p>
      <p>Sleep: {sleepStatus}</p>

      <p>Fullness: {fullnessDisplay(stats.fullness, stats.maxOverfeed)}</p>
      <p>Health: {stats.health || 0}</p>
      
      {/* 개발자용 추가 정보 */}
      <div className="mt-2 pt-2 border-t border-gray-300">
        <p className="text-xs text-gray-600">Dev Info:</p>
        <p className="text-xs">Protein Overdose: {stats.proteinOverdose || 0}</p>
        <p className="text-xs">Overfeeds: {stats.overfeeds || 0}</p>
        <p className="text-xs">Battles: {stats.battles || 0}</p>
        <p className="text-xs">Wins: {stats.battlesWon || 0} / Losses: {stats.battlesLost || 0}</p>
      </div>
    </div>
  );
};

export default StatsPanel;