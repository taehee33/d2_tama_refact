// src/components/HealModal.jsx
import React, { useEffect, useState } from "react";

/**
 * 치료(Heal) 모달 컴포넌트 (Pixel 스타일)
 */
export default function HealModal({
  isInjured,
  currentDoses = 0,
  requiredDoses = 1,
  onHeal,
  onClose,
  treatmentMessage = null, // 치료 성공 메시지
}) {
  // 로컬 상태로 treatmentMessage 관리 (props 변경 감지)
  const [displayMessage, setDisplayMessage] = useState(treatmentMessage);
  
  // treatmentMessage가 변경되면 로컬 상태 업데이트
  useEffect(() => {
    if (treatmentMessage) {
      console.log('[HealModal] treatmentMessage 변경 감지:', treatmentMessage);
      setDisplayMessage(treatmentMessage);
    }
  }, [treatmentMessage]);
  
  // 상태 메시지 결정
  const getStatusMessage = () => {
    // 치료 성공 메시지가 있으면 우선 표시
    if (displayMessage) {
      console.log('[HealModal] 치료 메시지 표시:', displayMessage);
      // 메시지 뒤에 ! 추가 (이미 !가 있으면 그대로, 없으면 추가)
      const messageWithExclamation = displayMessage.endsWith('!') 
        ? displayMessage 
        : `${displayMessage} !`;
      return messageWithExclamation;
    }
    if (!isInjured) {
      return "부상 없음!";
    }
    if (currentDoses >= requiredDoses) {
      return "완전 회복!";
    }
    return `치료제: ${currentDoses} / ${requiredDoses}`;
  };
  
  // 디버깅: props 확인
  useEffect(() => {
    console.log('[HealModal] Props:', {
      treatmentMessage,
      displayMessage,
      isInjured,
      currentDoses,
      requiredDoses,
    });
  }, [treatmentMessage, displayMessage, isInjured, currentDoses, requiredDoses]);

  // 상태 아이콘 결정
  const getStatusIcon = () => {
    if (!isInjured) {
      return "✅";
    }
    if (currentDoses >= requiredDoses) {
      return "💚";
    }
    return "💉";
  };

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-gray-800 border-4 border-yellow-500 rounded-lg p-6 max-w-md w-full mx-4 pixel-art-modal">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-yellow-400 pixel-art-text">
            디지몬 치료
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-red-400 text-2xl font-bold pixel-art-button"
          >
            ✕
          </button>
        </div>

        {/* Status Icon */}
        <div className="text-center mb-4">
          <div className="text-6xl mb-2">{getStatusIcon()}</div>
        </div>

        {/* Message */}
        <div className="bg-gray-700 border-2 border-gray-600 rounded p-4 mb-4 pixel-art-card">
          <p className="text-white text-center text-lg font-bold pixel-art-text">
            {getStatusMessage()}
          </p>
          {/* 치료 성공 후 추가 치료 필요 메시지 */}
          {displayMessage && isInjured && currentDoses < requiredDoses && (
            <p className="text-yellow-300 text-center text-sm mt-2">
              추가 치료가 필요합니다. ({currentDoses}/{requiredDoses})
            </p>
          )}
          {/* 최종 치료 완료 메시지 */}
          {displayMessage && (!isInjured || currentDoses >= requiredDoses) && (
            <p className="text-green-300 text-center text-sm mt-2">
              치료 완료! ({requiredDoses}/{requiredDoses})
            </p>
          )}
          {/* 치료 전 안내 메시지 */}
          {!displayMessage && isInjured && currentDoses < requiredDoses && (
            <p className="text-yellow-300 text-center text-sm mt-2">
              치료가 필요합니다.
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {/* 완전 회복 시 확인 버튼만 표시 */}
          {!isInjured || currentDoses >= requiredDoses ? (
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded pixel-art-button"
            >
              [ 확인 ]
            </button>
          ) : (
            <>
              {/* 추가 치료 필요 시 치료 버튼 표시 */}
              {!displayMessage && (
                <button
                  onClick={onHeal}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded pixel-art-button"
                >
                  [ 치료 ]
                </button>
              )}
              {/* 치료 후 추가 치료 필요 시 치료 버튼과 닫기 버튼 모두 표시 */}
              {displayMessage && (
                <>
                  <button
                    onClick={onHeal}
                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded pixel-art-button"
                  >
                    [ 치료 ]
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded pixel-art-button"
                  >
                    [ 닫기 ]
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}




