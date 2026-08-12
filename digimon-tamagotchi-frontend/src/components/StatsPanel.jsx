// src/components/StatsPanel.jsx
import React, { useState, useEffect } from "react";
import { formatTimestamp as formatTimestampUtil } from "../utils/dateUtils";
import { getInternalCounterTimerDisplay } from "../utils/internalCounterTimerDisplay";
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
  return `${d}일 ${h}시간 ${m}분 ${s}초`;
}

// 진화까지 남은 시간 포맷 (일/시간/분/초)
function formatTimeToEvolve(sec=0){
  const d = Math.floor(sec / 86400);
  const r = sec % 86400;
  const h = Math.floor(r / 3600);
  const m = Math.floor((r % 3600) / 60);
  const s = r % 60;
  return `${d}일 ${h}시간 ${m}분 ${s}초`;
}

// timestamp 계산은 공용 유틸을 사용하고, 값이 없을 때의 표시 문구만 한글화합니다.
const formatTimestamp = (timestamp) => {
  const formatted = formatTimestampUtil(timestamp);
  return formatted === "N/A" ? "기록 없음" : formatted;
};

// 공용 타이머 유틸의 계산 결과는 그대로 사용하고 표시 단위만 한글화합니다.
const formatTimerLabel = (label = "") => label.replace(/(\d+(?:\.\d+)?)\s*min\b/g, "$1분");
const formatCountdownLabel = (label = "") => label
  .replace(/(\d+)m\b/g, "$1분")
  .replace(/(\d+)s\b/g, "$1초");

function formatSleepStatus(sleepStatus = "AWAKE") {
  switch (sleepStatus) {
    case "FALLING_ASLEEP":
      return "잠들기 준비 중";
    case "NAPPING":
      return "낮잠 중";
    case "SLEEPING":
      return "수면 중";
    case "SLEEPING_LIGHT_ON":
    case "TIRED":
    case "SLEEPY":
      return "수면 중(불 켜짐 경고!)";
    case "AWAKE_INTERRUPTED":
      return "강제 기상 중";
    case "AWAKE":
      return "깨어있음";
    default:
      return "상태 확인 필요";
  }
}

const StatsPanel = ({ stats, sleepStatus = "AWAKE", isMobile = false }) => {
  const hungerTimerDisplay = getInternalCounterTimerDisplay({
    evolutionStage: stats.evolutionStage,
    timerKind: "hunger",
    timerMinutes: stats.hungerTimer,
    countdownSeconds: stats.hungerCountdown,
  });
  const strengthTimerDisplay = getInternalCounterTimerDisplay({
    evolutionStage: stats.evolutionStage,
    timerKind: "strength",
    timerMinutes: stats.strengthTimer,
    countdownSeconds: stats.strengthCountdown,
  });
  const poopTimerDisplay = getInternalCounterTimerDisplay({
    evolutionStage: stats.evolutionStage,
    timerKind: "poop",
    timerMinutes: stats.poopTimer,
    countdownSeconds: stats.poopCountdown,
  });

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
  const AccordionButton = ({ isOpen, onClick, title, controlsId }) => {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-expanded={isOpen}
        aria-controls={controlsId}
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
        type="button"
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        aria-expanded={isPanelOpen}
        aria-controls="stats-panel-content"
        className="w-full text-center font-bold mb-2 text-base flex items-center justify-between hover:bg-gray-50 rounded px-2 py-1 transition-colors"
      >
        <span>스탯 패널</span>
        <span className="text-gray-500 text-sm flex items-center gap-1">
          <span className="text-xs">{isPanelOpen ? '접기' : '펼치기'}</span>
          <span>{isPanelOpen ? '▼' : '▶'}</span>
        </span>
      </button>
      
      {/* StatsPanel 내용 (접기/펼치기) */}
      {isPanelOpen && (
        <div id="stats-panel-content">
          {/* 1. 기본 스탯 (아코디언) */}
          <div className="mt-2 pt-2 border-t border-gray-300">
        <AccordionButton
          isOpen={showBasicStats}
          onClick={() => setShowBasicStats(!showBasicStats)}
          title="1. 기본 스탯"
          controlsId="stats-panel-basic"
        />
        {showBasicStats && (
          <div id="stats-panel-basic" className="space-y-1">
            <p>나이: {stats.age || 0}</p>
            <p>몸무게: {stats.weight || 0}</p>
            <p>힘: {strengthDisplay(stats.strength || 0)}</p>
            <p>에너지 (DP): {stats.energy || 0}</p>
            <p>승률: {stats.winRate || 0}%</p>
            <p>노력치: {stats.effort || 0}</p>
            <p>케어 미스: {stats.careMistakes || 0}</p>
            <p>수면 상태: {formatSleepStatus(sleepStatus)}</p>
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
          controlsId="stats-panel-hearts"
        />
        {showHearts && (
          <div id="stats-panel-hearts">
            <StatusHearts
              fullness={stats.fullness || 0}
              strength={stats.strength || 0}
              maxOverfeed={stats.maxOverfeed || 0}
              proteinOverdose={stats.proteinOverdose || 0}
              showLabels={true}
              size="sm"
              position="inline"
              isFrozen={stats.isFrozen || false}
            />
            
          </div>
        )}
      </div>
      
      {/* 3. 개발자용 추가 정보 (아코디언) */}
      <div className="mt-2 pt-2 border-t border-gray-300">
        <AccordionButton
          isOpen={showDevInfo}
          onClick={() => setShowDevInfo(!showDevInfo)}
          title="3. 개발 정보"
          controlsId="stats-panel-dev-info"
        />
        {showDevInfo && (
          <div id="stats-panel-dev-info" className="text-xs space-y-0.5 mt-1">
            <p>프로틴 과다: {stats.proteinOverdose || 0}</p>
            <p>과식 횟수: {stats.overfeeds || 0}</p>
            <p>배틀 횟수: {stats.battles || 0}</p>
            <p>승리: {stats.battlesWon || 0} / 패배: {stats.battlesLost || 0}</p>
          </div>
        )}
      </div>

      {/* 4. 내부/고급 카운터 (아코디언) */}
      <div className="mt-2 pt-2 border-t border-gray-300">
        <AccordionButton
          isOpen={showAdvanced}
          onClick={() => setShowAdvanced(!showAdvanced)}
          title="4. 내부/고급 카운터"
          controlsId="stats-panel-advanced"
        />
        {showAdvanced && (
          <div id="stats-panel-advanced" className="text-xs space-y-0.5">
            <p>
              배고픔 감소 주기: {formatTimerLabel(hungerTimerDisplay.label)}
              {hungerTimerDisplay.showCountdown
                ? ` (남은 시간: ${formatCountdownLabel(hungerTimerDisplay.countdownLabel)})`
                : ""}
            </p>
            <p>
              힘 감소 주기: {formatTimerLabel(strengthTimerDisplay.label)}
              {strengthTimerDisplay.showCountdown
                ? ` (남은 시간: ${formatCountdownLabel(strengthTimerDisplay.countdownLabel)})`
                : ""}
            </p>
            <p>
              배변 주기: {formatTimerLabel(poopTimerDisplay.label)}
              {poopTimerDisplay.showCountdown
                ? ` (남은 시간: ${formatCountdownLabel(poopTimerDisplay.countdownLabel)})`
                : ""}
            </p>
            <p>배변 횟수: {stats.poopCount || 0}/8</p>
            <p>배변 최대 도달 시각: {formatTimestamp(stats.poopReachedMaxAt)}</p>
            <p>최근 배변 페널티 시각: {formatTimestamp(stats.lastPoopPenaltyAt)}</p>
            <p>부상 발생 시각: {formatTimestamp(stats.injuredAt)}</p>
            <p>부상 횟수: {stats.injuries || 0}</p>
            <p>사망 원인: {stats.deathReason || "없음"}</p>
            <p>수명: {formatTime(stats.lifespanSeconds || 0)}</p>
            <p>진화까지 남은 시간: {formatTimeToEvolve(stats.timeToEvolveSeconds || 0)}</p>
          </div>
        )}
      </div>
        </div>
      )}
    </div>
  );
};

export default StatsPanel;
