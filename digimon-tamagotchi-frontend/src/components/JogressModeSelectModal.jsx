// src/components/JogressModeSelectModal.jsx
// 조그레스 진화 방식 선택: 로컬(내 다른 슬롯) / 온라인(다른 유저)

import React from "react";

/**
 * 조그레스 진화 모드 선택 모달
 * @param {Function} onClose - 모달 닫기
 * @param {Function} onSelectLocal - 로컬(내 다른 슬롯과 합체) 선택 시
 * @param {Function} onSelectOnline - 온라인(다른 유저와 합체) 선택 시
 */
export default function JogressModeSelectModal({
  onClose,
  onSelectLocal,
  onSelectOnline,
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
          <h2 className="text-xl font-bold text-yellow-400 pixel-art-text">
            조그레스 진화
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-red-400 text-2xl font-bold pixel-art-button"
          >
            ✕
          </button>
        </div>

        <p className="text-gray-300 text-sm mb-4">
          합체할 방식을 선택하세요.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              onSelectLocal?.();
              onClose?.();
            }}
            className="px-6 py-3 bg-amber-600 text-white font-bold rounded pixel-art-button hover:bg-amber-700"
          >
            로컬 — 내 다른 슬롯과 합체
          </button>
          <button
            onClick={() => {
              onSelectOnline?.();
              onClose?.();
            }}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded pixel-art-button hover:bg-blue-700"
          >
            온라인 — 다른 유저와 합체
          </button>
        </div>
      </div>
    </div>
  );
}
