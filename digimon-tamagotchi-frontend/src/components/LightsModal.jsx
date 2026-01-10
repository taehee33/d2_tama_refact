// src/components/LightsModal.jsx
// 조명 켜기/끄기 팝업 모달

import React from "react";
import "../styles/Battle.css";

export default function LightsModal({ onClose, onTurnOn, onTurnOff, isLightsOn }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="battle-modal bg-white p-6 rounded-lg shadow-xl min-w-[300px]">
        <h2 className="text-2xl font-bold mb-4 text-center">조명 제어</h2>
        
        <div className="space-y-3">
          <button
            onClick={() => {
              onTurnOn();
              onClose();
            }}
            className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-colors ${
              isLightsOn 
                ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            조명켜기 🔆
          </button>
          
          <button
            onClick={() => {
              onTurnOff();
              onClose();
            }}
            className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-colors ${
              !isLightsOn 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            조명끄기 🌙
          </button>
        </div>
        
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 px-4 bg-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-400 transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
