// src/components/OverfeedConfirmModal.jsx
import React from "react";

/**
 * 과식 확인 모달 컴포넌트 (Pixel 스타일)
 */
export default function OverfeedConfirmModal({
  onConfirm,
  onCancel,
}) {
  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-gray-800 border-4 border-yellow-500 rounded-lg p-6 max-w-md w-full mx-4 pixel-art-modal">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-yellow-400 pixel-art-text">
            ⚠️ 과식 경고
          </h2>
          <button
            onClick={onCancel}
            className="text-white hover:text-red-400 text-2xl font-bold pixel-art-button"
          >
            ✕
          </button>
        </div>

        {/* Message */}
        <div className="bg-gray-700 border-2 border-gray-600 rounded p-4 mb-4 pixel-art-card">
          <p className="text-white text-center text-lg font-bold pixel-art-text mb-2">
            과식이지만 고기를 먹이시겠습니까?
          </p>
          <p className="text-yellow-300 text-center text-sm">
            예: Overfeed +1, 고기 먹기
          </p>
          <p className="text-yellow-300 text-center text-sm">
            아니오: Overfeed 증가 없음, 거절 애니메이션
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded pixel-art-button"
          >
            [ 예 ]
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded pixel-art-button"
          >
            [ 아니오 ]
          </button>
        </div>
      </div>
    </div>
  );
}

