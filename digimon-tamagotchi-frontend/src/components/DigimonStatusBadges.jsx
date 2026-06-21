// src/components/DigimonStatusBadges.jsx
import React, { useEffect, useState } from "react";
import {
  buildDigimonStatusMessages,
  getSummaryDigimonStatusMessages,
} from "./digimonStatusMessages";

/**
 * DigimonStatusBadges 컴포넌트
 * 디지몬의 현재 상태를 상단 요약 배지로 보여주고 클릭 시 전체 상태를 전달합니다.
 */
const DigimonStatusBadges = ({
  digimonStats = {},
  sleepStatus = "AWAKE",
  isDead = false,
  currentAnimation = "idle",
  feedType = null,
  onOpenStatusDetail = null,
  canEvolve = false,
  sleepSchedule = null,
  wakeUntil = null,
  sleepLightOnStart = null,
  deathReason = null,
  syncStatus = null,
}) => {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const allMessages = buildDigimonStatusMessages({
    digimonStats,
    sleepStatus,
    isDead,
    currentAnimation,
    feedType,
    canEvolve,
    sleepSchedule,
    wakeUntil,
    sleepLightOnStart,
    deathReason,
    currentTime,
  });

  const displayMessages = getSummaryDigimonStatusMessages(allMessages, 3);

  const handleClick = () => {
    if (onOpenStatusDetail) {
      onOpenStatusDetail(allMessages);
    }
  };

  const syncStatusMeta = {
    saving: { text: "저장 중", color: "text-blue-700", bgColor: "bg-blue-50" },
    local: { text: "기기에 안전하게 저장됨", color: "text-amber-700", bgColor: "bg-amber-50" },
    synced: { text: "서버 동기화 완료", color: "text-emerald-700", bgColor: "bg-emerald-50" },
    conflict: { text: "다른 기기의 변경사항 확인 필요", color: "text-red-700", bgColor: "bg-red-50" },
    unavailable: { text: "저장소 사용 불가", color: "text-red-700", bgColor: "bg-red-50" },
  }[syncStatus];

  if (displayMessages.length === 0 && !syncStatusMeta) {
    return null;
  }

  return (
    <button
      type="button"
      className={`mt-2 flex items-center justify-center gap-2 flex-wrap bg-transparent border-0 p-0 text-left disabled:opacity-100 ${
        onOpenStatusDetail ? "cursor-pointer" : "cursor-default"
      }`}
      onClick={handleClick}
      title={onOpenStatusDetail ? "클릭하여 모든 상태 보기" : undefined}
      aria-label={onOpenStatusDetail ? "모든 상태 보기" : undefined}
      disabled={!onOpenStatusDetail}
    >
      {syncStatusMeta ? (
        <span
          data-testid="game-sync-status"
          className={`text-xs font-semibold ${syncStatusMeta.color} px-2.5 py-1 rounded-full ${syncStatusMeta.bgColor} border border-slate-300 shadow-sm`}
        >
          {syncStatusMeta.text}
        </span>
      ) : null}
      {displayMessages.map((message) => (
        <span
          key={message.id}
          className={`text-xs font-semibold ${message.color} px-2.5 py-1 rounded-full ${message.bgColor} border border-slate-300 shadow-sm`}
        >
          {message.text}
        </span>
      ))}
      {allMessages.length > displayMessages.length && (
        <span className="text-xs font-semibold text-slate-500 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-300">
          +{allMessages.length - displayMessages.length}개 더
        </span>
      )}
    </button>
  );
};

export default DigimonStatusBadges;
