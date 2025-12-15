// src/components/BattleSelectionModal.jsx
// 배틀 모드 선택 모달

import React from "react";
import "../styles/Battle.css";

export default function BattleSelectionModal({ onClose, onQuestStart, onCommunicationStart }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="battle-modal bg-white p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold mb-4 text-center">Battle Mode Selection</h2>
        
        <div className="flex flex-col space-y-4">
          <button
            onClick={() => {
              onQuestStart();
              onClose();
            }}
            className="battle-mode-button quest-mode-button px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
          >
            [Quest Mode]
          </button>
          
          <button
            onClick={() => {
              onCommunicationStart();
              onClose();
            }}
            className="battle-mode-button communication-mode-button px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors"
          >
            [Communication]
          </button>
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

