// src/components/CommunicationModal.jsx
// Communication 하위 메뉴 모달

import React from "react";
import "../styles/Battle.css";

export default function CommunicationModal({ onClose, onSparringStart, onArenaStart }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50" style={{ padding: '20px' }}>
      <div className="battle-modal bg-white p-6 rounded-lg shadow-xl" style={{ 
        width: '90%', 
        maxWidth: '400px',
        margin: 'auto'
      }}>
        <h2 className="text-2xl font-bold mb-4 text-center">온라인 배틀</h2>
        
        <div className="flex flex-col space-y-4">
          <button
            onClick={() => {
              onSparringStart();
              onClose();
            }}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
          >
            스파링 [Self PvP]
          </button>
          
          <button
            onClick={() => {
              onArenaStart();
              onClose();
            }}
            className="px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
          >
            아레나 [PvP(Ghost)]
          </button>
          
          <button
            className="px-6 py-3 bg-gray-400 text-white rounded-lg font-bold cursor-not-allowed opacity-60"
            disabled
            title="Coming Soon"
          >
            실시간 배틀
            <span className="text-xs block mt-1">Coming Soon</span>
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

