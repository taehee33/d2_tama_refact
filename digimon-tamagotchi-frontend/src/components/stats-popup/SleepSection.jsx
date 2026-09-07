import React, { useState } from "react";
import { isSleepDisturbanceLog } from "../../hooks/useGameLogic";
import { formatTimestamp } from "../../utils/dateUtils";
import { formatSleepSchedule, getTimeUntilSleep, getTimeUntilWake } from "../../utils/sleepUtils";
import { toEpochMs } from "../../utils/time";

/** 현재 진화 구간의 수면 방해 이력을 표시합니다. */
function SleepDisturbanceHistory({ activityLogs, currentStageStartedAt }) {
  const [isOpen, setIsOpen] = useState(false);
  const logs = (activityLogs || [])
    .filter(isSleepDisturbanceLog)
    .filter((log) => {
      const logMs = toEpochMs(log.timestamp);
      if (logMs == null) return false;
      if (currentStageStartedAt == null) return true;
      return logMs >= currentStageStartedAt;
    })
    .sort((a, b) => (toEpochMs(b.timestamp) || 0) - (toEpochMs(a.timestamp) || 0));

  return (
    <div className="mt-2 border-t pt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left flex items-center justify-between py-1 px-2 hover:bg-gray-100 rounded transition-colors"
      >
        <span className="text-sm font-semibold text-gray-700">수면 방해 이력 ({logs.length}건)</span>
        <span className="text-gray-500 text-xs">{isOpen ? "▲ 접기" : "▼ 펼치기"}</span>
      </button>

      {isOpen && (
        <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-xs p-2 bg-gray-50 border border-gray-200 rounded text-gray-600">
              수면 방해 이력이 없습니다. (로그가 아직 기록되지 않았을 수 있습니다)
            </div>
          ) : logs.map((log, index) => {
            const timestamp = toEpochMs(log.timestamp);
            return (
              <div key={index} className="text-xs p-2 bg-red-50 border border-red-200 rounded">
                <div className="font-semibold text-red-700">{log.text || "수면 방해 발생"}</div>
                <div className="text-red-600 mt-1">{timestamp ? formatTimestamp(timestamp) : "시간 정보 없음"}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatRemainingTime(remainingMs) {
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
}

/** StatsPopup의 수면 표시와 야행성 변경 의도를 담당하는 프레젠터입니다. */
export default function SleepSection({
  stats,
  currentTime,
  currentSleepSchedule,
  visibleSleepStatus,
  sleepStatusLabel,
  isLightsOn,
  wakeUntil,
  sleepLightOnStart,
  activityLogs,
  currentStageStartedAt,
  onToggleNocturnal,
}) {
  const {
    fastSleepStart = null,
    napUntil = null,
    isNocturnal = false,
    isFrozen = false,
    sleepDisturbances = 0,
  } = stats || {};

  const sleepStatusText = (() => {
    const isNapTime = napUntil && currentTime < napUntil;
    if (visibleSleepStatus === "AWAKE") return "깨어있음";
    if (visibleSleepStatus === "SLEEPING" || visibleSleepStatus === "NAPPING") {
      if (isNapTime) {
        return <span>낮잠 중 😴 <span className="text-blue-600">({formatRemainingTime(napUntil - currentTime)} 남음)</span></span>;
      }
      return "수면 중 😴";
    }
    if (visibleSleepStatus === "SLEEPING_LIGHT_ON") return "수면 중(불 켜짐 경고!)";
    if (visibleSleepStatus === "FALLING_ASLEEP") return "잠들기 준비 중";
    if (visibleSleepStatus === "AWAKE_INTERRUPTED") return "강제 기상 중";
    return sleepStatusLabel;
  })();

  const fallingAsleepText = (() => {
    if (visibleSleepStatus === "FALLING_ASLEEP" && fastSleepStart && !isLightsOn) {
      const seconds = Math.max(0, 15 - Math.floor((currentTime - fastSleepStart) / 1000));
      if (seconds > 0 && seconds <= 15) return <span className="text-blue-500 font-semibold">{seconds}초 후 잠들어요</span>;
      if (seconds <= 0) return <span className="text-green-500 font-semibold">즉시 잠들 수 있음</span>;
    }
    return <span className="text-gray-500">{sleepStatusLabel}</span>;
  })();

  const statusCheck = (() => {
    if (visibleSleepStatus === "SLEEPING_LIGHT_ON" && isLightsOn && sleepLightOnStart) {
      const remainingMs = 30 * 60 * 1000 - (currentTime - sleepLightOnStart);
      if (remainingMs > 0) {
        const minutes = Math.floor(remainingMs / 60000);
        const seconds = Math.floor((remainingMs % 60000) / 1000);
        return <li className="text-yellow-600 font-semibold">수면상태확인: 수면 중(불 켜짐 경고!) → {minutes}분 {seconds}초 남음 (30분 초과 시 케어 미스)</li>;
      }
      return <li className="text-red-600 font-semibold">수면상태확인: 케어 미스 발생! (불을 30분 이상 켜둠)</li>;
    }
    if (visibleSleepStatus === "SLEEPING" && !isLightsOn) {
      return <li className="text-green-600 font-semibold">수면상태확인: 수면 중, 조명(꺼짐!) → 잠자는 중 ✓</li>;
    }
    if (visibleSleepStatus === "AWAKE" || visibleSleepStatus === "AWAKE_INTERRUPTED") {
      if (wakeUntil && currentTime < wakeUntil) {
        const isWaitingFastSleep = !isLightsOn && fastSleepStart;
        if (isWaitingFastSleep) {
          const seconds = Math.max(0, 15 - Math.floor((currentTime - fastSleepStart) / 1000));
          if (seconds > 0 && seconds <= 15) return <li className="text-blue-500">수면상태확인: 잠들기 준비 중 ({seconds}초 남음)</li>;
        }
        const remainingMs = wakeUntil - currentTime;
        const minutes = Math.floor(remainingMs / 60000);
        const seconds = Math.floor((remainingMs % 60000) / 1000);
        return <li className="text-orange-500">수면상태확인: {isLightsOn ? `강제 기상 중 (${minutes}분 ${seconds}초 남음)` : `강제 기상 회복 중 (${minutes}분 ${seconds}초 남음)`}</li>;
      }
      if (!isLightsOn && fastSleepStart) {
        const seconds = Math.max(0, 15 - Math.floor((currentTime - fastSleepStart) / 1000));
        if (seconds > 0 && seconds <= 15) return <li className="text-blue-500">수면상태확인: 잠들기 준비 중 ({seconds}초 남음)</li>;
      }
      return <li className="text-gray-500">수면상태확인: 수면 시간이 아님</li>;
    }
    if (visibleSleepStatus === "SLEEPING_LIGHT_ON" && isLightsOn && !sleepLightOnStart) {
      return <li className="text-yellow-500">수면상태확인: 수면 중(불 켜짐 경고!) → 카운트 시작 대기 중</li>;
    }
    return <li className="text-gray-500">수면상태확인: 현재 상태 - {sleepStatusLabel}</li>;
  })();

  return (
    <div className="border-b pb-2">
      <h3 className="font-bold text-base mb-2">4. {isFrozen ? "냉장고 상태" : "수면 정보"}</h3>
      {isFrozen ? (
        <ul className="space-y-1">
          <li className="text-blue-600 font-semibold">🧊 냉장고에 넣어서 얼어있음 (수면 개념 없음)</li>
        </ul>
      ) : (
        <ul className="space-y-1">
          <li>수면 시간: {currentSleepSchedule && currentSleepSchedule.start !== undefined ? (
            <span>{formatSleepSchedule(currentSleepSchedule)}{isNocturnal && <span className="text-blue-500 ml-1">🦉 야행성 🌙</span>}</span>
          ) : "정보 없음"}</li>
          <li>수면 상태: {sleepStatusText}</li>
          <li>잠들기: {fallingAsleepText}</li>
          <li>조명 상태: {isLightsOn ? <span className="text-yellow-600 font-semibold">켜짐 🔆</span> : <span className="text-blue-600 font-semibold">꺼짐 🌙</span>}</li>
          {visibleSleepStatus === "AWAKE" && !wakeUntil && currentSleepSchedule && currentSleepSchedule.start !== undefined && (
            <li>수면까지: {getTimeUntilSleep(currentSleepSchedule, new Date())}</li>
          )}
          {visibleSleepStatus === "SLEEPING" && (() => {
            const isNapTime = napUntil && currentTime < napUntil;
            if (isNapTime) return <li className="text-blue-600 font-semibold">낮잠 중: {formatRemainingTime(napUntil - currentTime)} 후 기상</li>;
            if (currentSleepSchedule && currentSleepSchedule.start !== undefined) return <li>기상까지: {getTimeUntilWake(currentSleepSchedule, new Date())}</li>;
            return null;
          })()}
          {wakeUntil && currentTime < wakeUntil && (() => {
            const remainingMs = wakeUntil - currentTime;
            const minutes = Math.floor(remainingMs / 60000);
            const seconds = Math.floor((remainingMs % 60000) / 1000);
            return <li className="text-orange-600 font-semibold">수면 방해 중: {minutes}분 {seconds}초 후 다시 잠들 예정<span className="text-yellow-600 ml-2">(강제로 깨운 횟수로만 수면 방해가 집계됩니다)</span></li>;
          })()}
          {!isLightsOn && fastSleepStart && visibleSleepStatus === "FALLING_ASLEEP" && (() => {
            const seconds = Math.max(0, 15 - Math.floor((currentTime - fastSleepStart) / 1000));
            if (seconds > 0 && seconds <= 15) return <li className="text-green-600 text-sm">💡 빠른 잠들기: {seconds}초 후 자동으로 잠듭니다</li>;
            if (seconds <= 0) return <li className="text-green-600 text-sm">💡 빠른 잠들기: 즉시 잠들 수 있습니다 (wakeUntil 만료 시 자동 잠듦)</li>;
            return null;
          })()}
          {statusCheck}
          <li>
            수면 방해 횟수: {sleepDisturbances || 0}회
            <span className="text-gray-500 text-xs ml-1" title="실제로 잠든 상태에서 강제로 깨운 횟수만 집계됩니다. 현재 진화 단계 시작 이후의 이력 기준입니다."> (진화 구간 기준)</span>
          </li>
        </ul>
      )}

      {!isFrozen && sleepDisturbances > 0 && (
        <SleepDisturbanceHistory activityLogs={activityLogs} currentStageStartedAt={currentStageStartedAt} />
      )}

      <div className="mt-3 pt-3 border-t">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">🦉 야행성 모드 🌙</span>
            {isNocturnal && <span className="text-xs text-blue-500 font-semibold">(활성화됨)</span>}
          </div>
          <button
            onClick={onToggleNocturnal}
            className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${isNocturnal ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
          >
            {isNocturnal ? "ON 🌙" : "OFF ☀️"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {isNocturnal
            ? "수면 시간과 기상 시간이 각각 3시간씩 미뤄집니다. (예: 22시 → 새벽 1시, 6시 → 9시)"
            : "야행성 모드를 활성화하면 수면 시간과 기상 시간이 각각 3시간씩 미뤄집니다."}
        </p>
      </div>
    </div>
  );
}
