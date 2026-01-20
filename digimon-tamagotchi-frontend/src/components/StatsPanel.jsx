// src/components/StatsPanel.jsx
import React, { useState, useEffect } from "react";
import { formatTimestamp as formatTimestampUtil } from "../utils/dateUtils";
import StatusHearts from "./StatusHearts";


/**
 * strengthDisplay:
 *  - strength => 예) strength가 8이면 "5(+3)" (5 이상일 때)
 */
function strengthDisplay(strength=0){
  const base = Math.min(5, strength);
  const over = strength > 5 ? strength - 5 : 0;
  return `${base}${over>0 ? "(+" + over + ")" : ""}`;
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

// 카운트다운 포맷 (초를 분:초로)
function formatCountdown(sec=0){
  const mm = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

// timestamp 포맷팅은 utils/dateUtils에서 import
const formatTimestamp = formatTimestampUtil;

const StatsPanel = ({ stats, sleepStatus = "AWAKE", isMobile = false }) => {
  // localStorage에서 접기/펼치기 상태 로드
  const loadAccordionState = (key, defaultValue) => {
    try {
      const saved = localStorage.getItem(`statsPanel_${key}`);
      return saved !== null ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.error(`Failed to load accordion state for ${key}:`, error);
      return defaultValue;
    }
  };

  // localStorage에 접기/펼치기 상태 저장
  const saveAccordionState = (key, value) => {
    try {
      localStorage.setItem(`statsPanel_${key}`, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save accordion state for ${key}:`, error);
    }
  };

  // StatsPanel 전체 접기/펼치기 상태 (localStorage에서 초기값 로드, 기본값: false - 접힌 상태)
  const [isPanelOpen, setIsPanelOpen] = useState(() => loadAccordionState('isPanelOpen', false));
  
  // 각 섹션별 접기/펼치기 상태 (localStorage에서 초기값 로드)
  const [showBasicStats, setShowBasicStats] = useState(() => loadAccordionState('showBasicStats', true));
  const [showHearts, setShowHearts] = useState(() => loadAccordionState('showHearts', false));
  const [showDevInfo, setShowDevInfo] = useState(() => loadAccordionState('showDevInfo', false));
  const [showAdvanced, setShowAdvanced] = useState(() => loadAccordionState('showAdvanced', false));

  // 상태 변경 시 localStorage에 저장
  useEffect(() => {
    saveAccordionState('isPanelOpen', isPanelOpen);
  }, [isPanelOpen]);

  useEffect(() => {
    saveAccordionState('showBasicStats', showBasicStats);
  }, [showBasicStats]);

  useEffect(() => {
    saveAccordionState('showHearts', showHearts);
  }, [showHearts]);

  useEffect(() => {
    saveAccordionState('showDevInfo', showDevInfo);
  }, [showDevInfo]);

  useEffect(() => {
    saveAccordionState('showAdvanced', showAdvanced);
  }, [showAdvanced]);

  // 아코디언 버튼 컴포넌트 (재사용) - 웹과 모바일 모두에서 사용
  const AccordionButton = ({ isOpen, onClick, title, defaultOpen = false }) => {
    return (
      <button
        onClick={onClick}
        className="text-xs font-semibold w-full text-left hover:text-gray-800 flex items-center justify-between py-1"
      >
        <span>{title}</span>
        <span className="text-gray-500">{isOpen ? '▼' : '▶'}</span>
      </button>
    );
  };

  return (
    <div className={`border p-2 bg-white shadow-md text-sm ${isMobile ? 'w-full max-h-[40vh] overflow-y-auto' : 'w-48'}`}>
      {/* StatsPanel 전체 아코디언 헤더 */}
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="w-full text-center font-bold mb-2 text-base flex items-center justify-between hover:bg-gray-50 rounded px-2 py-1 transition-colors"
      >
        <span>StatsPanel</span>
        <span className="text-gray-500 text-sm flex items-center gap-1">
          <span className="text-xs">{isPanelOpen ? '접기' : '펼치기'}</span>
          <span>{isPanelOpen ? '▼' : '▶'}</span>
        </span>
      </button>
      
      {/* StatsPanel 내용 (접기/펼치기) */}
      {isPanelOpen && (
        <div>
          {/* 1. 기본 스탯 (아코디언) */}
          <div className="mt-2 pt-2 border-t border-gray-300">
        <AccordionButton
          isOpen={showBasicStats}
          onClick={() => setShowBasicStats(!showBasicStats)}
          title="1. 기본 스탯"
          defaultOpen={true}
        />
        {showBasicStats && (
          <div className="space-y-1">
            <p>Age: {stats.age || 0}</p>
            <p>Weight: {stats.weight || 0}</p>
            <p>Strength: {strengthDisplay(stats.strength || 0)}</p>
            <p>Energy (DP): {stats.energy || 0}</p>
            <p>WinRate: {stats.winRate || 0}%</p>
            <p>Effort: {stats.effort || 0}</p>
            <p>CareMistakes: {stats.careMistakes || 0}</p>
            <p>Sleep: {sleepStatus}</p>
            {stats.isFrozen && (
              <p className="text-blue-600 font-semibold">🧊 냉장고</p>
            )}
          </div>
        )}
      </div>

      {/* 2. 하트 상태 (아코디언) */}
      <div className="mt-2 pt-2 border-t border-gray-300">
        <AccordionButton
          isOpen={showHearts}
          onClick={() => setShowHearts(!showHearts)}
          title="2. 상태 하트"
          defaultOpen={true}
        />
        {showHearts && (
          <div>
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
        )}
      </div>
      
      {/* 3. 개발자용 추가 정보 (아코디언) */}
      <div className="mt-2 pt-2 border-t border-gray-300">
        <AccordionButton
          isOpen={showDevInfo}
          onClick={() => setShowDevInfo(!showDevInfo)}
          title="3. Dev Info"
        />
        {showDevInfo && (
          <div className="text-xs space-y-0.5 mt-1">
            <p>Protein Overdose: {stats.proteinOverdose || 0}</p>
            <p>Overfeeds: {stats.overfeeds || 0}</p>
            <p>Battles: {stats.battles || 0}</p>
            <p>Wins: {stats.battlesWon || 0} / Losses: {stats.battlesLost || 0}</p>
          </div>
        )}
      </div>

      {/* 4. 내부/고급 카운터 (아코디언) */}
      <div className="mt-2 pt-2 border-t border-gray-300">
        <AccordionButton
          isOpen={showAdvanced}
          onClick={() => setShowAdvanced(!showAdvanced)}
          title="4. 내부/고급 카운터"
        />
        {showAdvanced && (
          <div className="text-xs space-y-0.5">
            <p>HungerTimer: {stats.hungerTimer || 0} min (남은 시간: {formatCountdown(stats.hungerCountdown || 0)})</p>
            <p>StrengthTimer: {stats.strengthTimer || 0} min (남은 시간: {formatCountdown(stats.strengthCountdown || 0)})</p>
            <p>PoopTimer: {stats.poopTimer || 0} min (남은 시간: {formatCountdown(stats.poopCountdown || 0)})</p>
            <p>PoopCount: {stats.poopCount || 0}/8</p>
            <p>LastMaxPoopTime: {formatTimestamp(stats.lastMaxPoopTime)}</p>
            <p>Lifespan: {formatTime(stats.lifespanSeconds || 0)}</p>
            <p>Time to Evolve: {formatTimeToEvolve(stats.timeToEvolveSeconds || 0)}</p>
          </div>
        )}
      </div>
        </div>
      )}
    </div>
  );
};

export default StatsPanel;