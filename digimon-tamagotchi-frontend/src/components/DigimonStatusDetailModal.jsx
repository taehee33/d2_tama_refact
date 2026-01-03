// src/components/DigimonStatusDetailModal.jsx
import React from "react";

/**
 * DigimonStatusDetailModal 컴포넌트
 * 디지몬의 모든 상태를 카테고리별로 표시하는 모달
 */
const DigimonStatusDetailModal = ({
  statusMessages = [],
  onClose,
}) => {
  // 카테고리별로 그룹화
  const categorizedMessages = {
    critical: statusMessages.filter(msg => msg.category === "critical"),
    warning: statusMessages.filter(msg => msg.category === "warning"),
    action: statusMessages.filter(msg => msg.category === "action"),
    info: statusMessages.filter(msg => msg.category === "info"),
    good: statusMessages.filter(msg => msg.category === "good"),
  };

  const categoryLabels = {
    critical: "🚨 긴급",
    warning: "⚠️ 경고",
    action: "🎬 행동",
    info: "ℹ️ 정보",
    good: "✅ 좋음",
  };

  const categoryColors = {
    critical: "text-red-600 bg-red-50 border-red-200",
    warning: "text-orange-600 bg-orange-50 border-orange-200",
    action: "text-blue-600 bg-blue-50 border-blue-200",
    info: "text-gray-600 bg-gray-50 border-gray-200",
    good: "text-green-600 bg-green-50 border-green-200",
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 modal-overlay-mobile"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto pixel-art-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">디지몬 상태 상세</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {Object.entries(categorizedMessages).map(([category, messages]) => {
              if (messages.length === 0) return null;
              
              return (
                <div key={category} className={`border-2 rounded-lg p-4 ${categoryColors[category]}`}>
                  <h3 className="font-bold text-lg mb-2">{categoryLabels[category]}</h3>
                  <div className="space-y-2">
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 px-3 py-2 rounded ${msg.bgColor} border`}
                      >
                        <span className={`font-semibold ${msg.color}`}>{msg.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigimonStatusDetailModal;


