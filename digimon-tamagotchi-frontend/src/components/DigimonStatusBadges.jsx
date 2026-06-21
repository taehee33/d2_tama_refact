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

  if (displayMessages.length === 0) {
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
