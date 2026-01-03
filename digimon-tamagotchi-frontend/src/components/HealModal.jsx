// src/components/HealModal.jsx
import React from "react";

/**
 * 치료(Heal) 모달 컴포넌트 (Pixel 스타일)
 */
export default function HealModal({
  isInjured,
  currentDoses = 0,
  requiredDoses = 1,
  onHeal,
  onClose,
}) {
  // 상태 메시지 결정
  const getStatusMessage = () => {
    if (!isInjured) {
      return "Not injured!";
    }
    if (currentDoses >= requiredDoses) {
      return "Fully Recovered!";
    }
    return `Doses: ${currentDoses} / ${requiredDoses}`;
  };

  // 상태 아이콘 결정
  const getStatusIcon = () => {
    if (!isInjured) {
      return "✅";
    }
    if (currentDoses >= requiredDoses) {
      return "💚";
    }
    return "💀";
  };

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-gray-800 border-4 border-yellow-500 rounded-lg p-6 max-w-md w-full mx-4 pixel-art-modal">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-yellow-400 pixel-art-text">
            MEDICAL CARE
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
          {isInjured && currentDoses < requiredDoses && (
            <p className="text-yellow-300 text-center text-sm mt-2">
              Needs medicine.
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {isInjured && currentDoses < requiredDoses && (
            <button
              onClick={onHeal}
              className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded pixel-art-button"
            >
              [ HEAL ]
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded pixel-art-button"
          >
            [ CLOSE ]
          </button>
        </div>
      </div>
    </div>
  );
}




