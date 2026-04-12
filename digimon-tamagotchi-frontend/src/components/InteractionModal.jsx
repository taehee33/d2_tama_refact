// src/components/InteractionModal.jsx
// 교감 메뉴 팝업 모달

import React from "react";
import "../styles/Battle.css";

export default function InteractionModal({ 
  onClose, 
  onDiet,
  onDetox,
  onRest,
  onPlayOrSnack,
  onTease
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 p-3"
      onClick={onClose}
    >
      <div
        className="battle-modal battle-modal--interactive bg-white rounded-2xl shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="interaction-modal-title"
      >
        <div className="battle-modal__header">
          <h2 id="interaction-modal-title" className="text-xl font-bold text-slate-900">
            교감
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="battle-modal__close"
            aria-label="교감 닫기"
          >
            ✕
          </button>
        </div>

        <div className="battle-modal__body flex flex-col space-y-4">
          <button
            onClick={() => {
              if (onDiet) {
                onDiet();
              } else {
                onClose();
              }
            }}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors flex items-center justify-between"
          >
            <span>🍖다이어트</span>
            <span className="text-sm font-normal opacity-90">(포만감 -1)</span>
          </button>
          
          <button
            onClick={() => {
              if (onRest) {
                onRest();
              } else {
                onClose();
              }
            }}
            className="px-6 py-3 bg-yellow-500 text-white rounded-lg font-bold hover:bg-yellow-600 transition-colors flex items-center justify-between"
          >
            <span>💪누워있기</span>
            <span className="text-sm font-normal opacity-90">(힘 -1)</span>
          </button>
          
          <button
            onClick={() => {
              if (onDetox) {
                onDetox();
              } else {
                onClose();
              }
            }}
            className="px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors flex items-center justify-between"
          >
            <span>💉디톡스</span>
            <span className="text-sm font-normal opacity-90">(단백질 과다 -1)</span>
          </button>
          
          <button
            onClick={() => {
              if (onPlayOrSnack) onPlayOrSnack();
              onClose();
            }}
            className="px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors flex items-center justify-between"
          >
            <span>❤️놀아주기/간식주기</span>
            <span className="text-sm font-normal opacity-90">(케어미스 -1)</span>
          </button>
          
          <button
            onClick={() => {
              if (onTease) {
                onTease();
              }
              onClose();
            }}
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center justify-between"
          >
            <span>💔괜히 괴롭히기</span>
            <span className="text-sm font-normal opacity-90">(케어미스 +1)</span>
          </button>
          
          {/* 구분선 */}
          <div className="border-t border-gray-300 my-2"></div>
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            뒤로
          </button>
        </div>
      </div>
    </div>
  );
}
