// src/components/ExtraMenuModal.jsx
// 추가 기능 메뉴 모달

import React from "react";
import "../styles/Battle.css";

export default function ExtraMenuModal({ 
  onClose,
  onOpenSettings,
  onOpenDigimonInfo,
  onOpenCollection,
  onOpenActivityLog,
  onOpenEncyclopedia,
  onOpenFridge,
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="battle-modal bg-white p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold mb-4 text-center">추가 기능</h2>
        
        <div className="flex flex-col space-y-4">
          <button
            onClick={() => {
              if (onOpenDigimonInfo) {
                onOpenDigimonInfo();
              }
              onClose();
            }}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
          >
            📖 디지몬 가이드
          </button>
          
          <button
            onClick={() => {
              if (onOpenActivityLog) {
                onOpenActivityLog();
              }
              onClose();
            }}
            className="px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors"
          >
            📋 활동 로그
          </button>
          
          <button
            onClick={() => {
              if (onOpenEncyclopedia) {
                onOpenEncyclopedia();
              }
              onClose();
            }}
            className="px-6 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
          >
            📚 도감
          </button>
          
          <button
            onClick={() => {
              if (onOpenFridge) {
                onOpenFridge();
              }
              onClose();
            }}
            className="px-6 py-3 bg-cyan-500 text-white rounded-lg font-bold hover:bg-cyan-600 transition-colors"
          >
            🧊 냉장고
          </button>
          
          <button
            onClick={() => {
              if (onOpenCollection) {
                onOpenCollection();
              }
              onClose();
            }}
            className="px-6 py-3 bg-amber-200 text-gray-800 rounded-lg font-bold hover:bg-amber-300 transition-colors"
          >
            ⭐ 컬렉션
          </button>
          
          <hr className="border-gray-300 my-2" />
          
          <button
            onClick={() => {
              if (onOpenSettings) {
                onOpenSettings();
              }
              onClose();
            }}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors"
          >
            ⚙️ 설정
          </button>
          
          <hr className="border-gray-300 my-2" />
          
          <button
            onClick={onClose}
            className="px-6 py-3 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
