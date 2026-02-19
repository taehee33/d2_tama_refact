// src/components/JogressOnlineSelectModal.jsx
// 온라인 조그레스: 방 만들기 / 방 참가 선택

import React from "react";

/**
 * 온라인 조그레스 선택 모달
 * @param {Function} onClose - 모달 닫기
 * @param {Function} onCreateRoom - 방 만들기 선택 시 (방 생성 후 roomId 반환)
 * @param {Function} onJoinRoom - 방 참가 선택 시 (방 목록 모달 열기)
 */
export default function JogressOnlineSelectModal({
  onClose,
  onCreateRoom,
  onJoinRoom,
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border-4 border-blue-500 rounded-lg p-6 max-w-md w-full mx-4 pixel-art-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-blue-400 pixel-art-text">
            온라인 조그레스
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-red-400 text-2xl font-bold pixel-art-button"
          >
            ✕
          </button>
        </div>

        <p className="text-gray-300 text-sm mb-4">
          다른 테이머와 조그레스하려면 방을 만들거나 참가하세요.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              onCreateRoom?.();
              onClose?.();
            }}
            className="px-6 py-3 bg-amber-600 text-white font-bold rounded pixel-art-button hover:bg-amber-700"
          >
            방 만들기 — 파트너 대기
          </button>
          <button
            onClick={() => {
              onJoinRoom?.();
              onClose?.();
            }}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded pixel-art-button hover:bg-blue-700"
          >
            방 참가 — 대기 중인 방 목록
          </button>
        </div>
      </div>
    </div>
  );
}
