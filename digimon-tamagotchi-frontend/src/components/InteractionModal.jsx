// src/components/InteractionModal.jsx
// 교감 메뉴 팝업 모달

import React from "react";
import "../styles/Battle.css";

export default function InteractionModal({ 
  onClose, 
  onDiet,
  onDetox,
  onRest,
  onPlayOrSnack
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="battle-modal bg-white p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold mb-4 text-center">교감</h2>
        
        <div className="flex flex-col space-y-4">
          <button
            onClick={() => {
              if (onDiet) {
                onDiet();
              } else {
                onClose();
              }
            }}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
          >
            다이어트
          </button>
          
          <button
            onClick={() => {
              if (onRest) {
                onRest();
              } else {
                onClose();
              }
            }}
            className="px-6 py-3 bg-yellow-500 text-white rounded-lg font-bold hover:bg-yellow-600 transition-colors"
          >
            누워있기
          </button>
          
          <button
            onClick={() => {
              if (onDetox) {
                onDetox();
              } else {
                onClose();
              }
            }}
            className="px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors"
          >
            디톡스
          </button>
          
          <button
            onClick={() => {
              if (onPlayOrSnack) onPlayOrSnack();
              onClose();
            }}
            className="px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
          >
            놀아주기/간식주기
          </button>
          
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
