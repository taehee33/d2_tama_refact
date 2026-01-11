// src/components/CollectionModal.jsx
// 컬렉션 모달 (메인 메뉴)

import React from "react";
import "../styles/Battle.css";

export default function CollectionModal({ 
  onClose,
  onBack,
  onOpenBackgroundSettings,
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="battle-modal bg-white p-6 rounded-lg shadow-xl" style={{ maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 className="text-2xl font-bold mb-4 text-center">컬렉션</h2>
        
        <div className="flex flex-col space-y-4">
          {/* 배경화면 버튼 */}
          <button
            onClick={() => {
              if (onOpenBackgroundSettings) {
                onOpenBackgroundSettings();
              }
              onClose();
            }}
            className="w-full px-6 py-4 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
          >
            배경화면
          </button>
          
          {/* 준비중 버튼 */}
          <button
            onClick={() => {
              alert("준비중입니다.");
            }}
            className="w-full px-6 py-4 bg-gray-400 text-white rounded-lg font-bold cursor-not-allowed opacity-60 hover:bg-gray-400"
            disabled
          >
            준비중
          </button>
          
          {/* 구분선 (시각적 구분을 위한 빈 공간) */}
          <div className="border-t border-gray-300 my-2"></div>
          
          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => {
              if (onBack) {
                onBack();
              } else {
                onClose();
              }
            }}
            className="w-full px-6 py-4 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors"
          >
            뒤로가기
          </button>
        </div>
      </div>
    </div>
  );
}
