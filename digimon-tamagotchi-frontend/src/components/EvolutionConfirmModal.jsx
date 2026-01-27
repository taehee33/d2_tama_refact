// src/components/EvolutionConfirmModal.jsx
import React, { useState, useEffect } from "react";

/**
 * 남은 시간을 포맷팅하는 함수
 * @param {number} seconds - 남은 시간 (초)
 * @returns {string} "x일 x시간 x분 x초" 형식의 문자열
 */
function formatRemainingTime(seconds) {
  if (!seconds || seconds <= 0) return "";
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}일`);
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}초`);
  
  return parts.join(" ");
}

/**
 * 진화 확인 모달 컴포넌트
 * 진화 버튼 클릭 시 나타나는 확인 팝업
 */
export default function EvolutionConfirmModal({
  onConfirm,
  onOpenGuide,
  onClose,
  canEvolve = true,
  remainingTime = null,
}) {
  const [currentRemainingTime, setCurrentRemainingTime] = useState(remainingTime);
  
  // 실시간으로 남은 시간 업데이트
  useEffect(() => {
    if (!remainingTime || remainingTime <= 0) {
      setCurrentRemainingTime(null);
      return;
    }
    
    setCurrentRemainingTime(remainingTime);
    
    const interval = setInterval(() => {
      setCurrentRemainingTime((prev) => {
        if (!prev || prev <= 0) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [remainingTime]);
  
  const isDisabled = !canEvolve;
  const timeText = currentRemainingTime ? formatRemainingTime(currentRemainingTime) : "";
  const buttonText = isDisabled && timeText 
    ? `진화(${timeText})`
    : "진화";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border-4 border-yellow-500 rounded-lg p-6 max-w-md w-full mx-4 pixel-art-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-yellow-400 pixel-art-text">
            진화하시겠습니까?
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-red-400 text-2xl font-bold pixel-art-button"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 mt-6">
          <button
            onClick={() => {
              if (!isDisabled) {
                onConfirm();
                onClose();
              }
            }}
            disabled={isDisabled}
            className={`px-6 py-3 text-white font-bold rounded pixel-art-button ${
              isDisabled 
                ? "bg-gray-500 cursor-not-allowed" 
                : "bg-green-500 hover:bg-green-600"
            }`}
          >
            {buttonText}
          </button>
          <button
            onClick={() => {
              onOpenGuide();
              onClose();
            }}
            className="px-6 py-3 bg-blue-500 text-white font-bold rounded pixel-art-button hover:bg-blue-600"
          >
            진화가이드
          </button>
        </div>
      </div>
    </div>
  );
}
