// src/components/EvolutionConfirmModal.jsx
import React from "react";

/**
 * 진화 확인 모달 컴포넌트
 * 진화 버튼 클릭 시 나타나는 확인 팝업
 */
export default function EvolutionConfirmModal({
  onConfirm,
  onOpenGuide,
  onClose,
}) {
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
              onConfirm();
              onClose();
            }}
            className="px-6 py-3 bg-green-500 text-white font-bold rounded pixel-art-button hover:bg-green-600"
          >
            진화
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
