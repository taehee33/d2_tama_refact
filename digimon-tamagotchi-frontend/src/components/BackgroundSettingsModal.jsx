// src/components/BackgroundSettingsModal.jsx
// 배경화면 설정 모달

import React, { useState, useEffect } from "react";
import "../styles/Battle.css";
import { BACKGROUND_TYPES } from "../data/backgroundData";
import { getTimeBasedSpriteIndex } from "../utils/backgroundUtils";

export default function BackgroundSettingsModal({ 
  onClose,
  onBack,
  backgroundSettings,
  setBackgroundSettings,
  currentTime = new Date(),
}) {
  const [expandedBg, setExpandedBg] = useState(null); // 펼쳐진 배경화면 ID
  const [tempSettings, setTempSettings] = useState(backgroundSettings); // 임시 설정
  const [initialSettings, setInitialSettings] = useState(backgroundSettings); // 초기 설정

  // 초기 설정 저장
  useEffect(() => {
    setInitialSettings(backgroundSettings);
    setTempSettings(backgroundSettings);
  }, []);

  // 변경사항 확인
  const hasChanges = JSON.stringify(tempSettings) !== JSON.stringify(initialSettings);

  const handleBackgroundSelect = (bgId, mode) => {
    setTempSettings({ selectedId: bgId, mode });
  };

  const handleSave = () => {
    setBackgroundSettings(tempSettings);
    setInitialSettings(tempSettings);
    alert("배경화면 설정이 저장되었습니다.");
  };

  const handleBack = () => {
    if (hasChanges) {
      const confirmDiscard = window.confirm("변경사항이 있습니다. 저장하지 않고 나가시겠습니까?");
      if (!confirmDiscard) {
        return; // 취소하면 모달 유지
      }
    }
    // 변경사항이 없거나 확인했으면 뒤로가기
    if (onBack) {
      onBack();
    } else {
      onClose();
    }
  };

  const toggleExpand = (bgId) => {
    setExpandedBg(expandedBg === bgId ? null : bgId);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="battle-modal bg-white rounded-lg shadow-xl" style={{ maxWidth: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* 헤더 (고정) */}
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold mb-2 text-center">배경화면 설정</h2>
          {hasChanges && (
            <div className="text-sm text-orange-600 text-center">
              ⚠️ 변경사항이 있습니다. 저장 버튼을 눌러주세요.
            </div>
          )}
        </div>
        
        {/* 스크롤 가능한 컨텐츠 영역 */}
        <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">배경화면</h3>
            
            {/* 배경화면 목록 */}
            <div className="space-y-3">
              {BACKGROUND_TYPES.map((bg) => {
                const isSelected = tempSettings?.selectedId === bg.id;
                const currentMode = isSelected ? tempSettings.mode : null;
                const isExpanded = expandedBg === bg.id;
                // 현재 실제로 설정된 배경화면인지 확인 (backgroundSettings와 비교)
                const isCurrentlySet = backgroundSettings?.selectedId === bg.id;
              
              return (
                <div 
                  key={bg.id}
                  className={`p-3 border-2 rounded-lg transition-colors ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* 배경화면 헤더 (클릭 시 펼치기/접기) */}
                  <button
                    onClick={() => toggleExpand(bg.id)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-left">{bg.name}</div>
                      {isCurrentlySet && (
                        <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded font-bold">
                          현재설정 중
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {isExpanded ? '▲ 접기' : '▼ 펼치기'}
                    </div>
                  </button>
                  
                  {/* 펼쳐진 상태에서만 표시 */}
                  {isExpanded && (
                    <div className="mt-3 space-y-2">
                      {/* 스프라이트 프리뷰 (3개) */}
                      <div className="flex gap-2 mb-3">
                        {bg.sprites.map((spriteNum, idx) => {
                          const timeIndex = getTimeBasedSpriteIndex(currentTime);
                          const isTimeMatch = currentMode === 'auto' && idx === timeIndex;
                          const isFixed = currentMode === idx.toString();
                          const isActive = isSelected && (isTimeMatch || isFixed);
                          
                          return (
                            <div key={idx} className="flex-1">
                              <div className={`text-xs text-center mb-1 ${
                                isActive ? 'text-blue-600 font-bold' : 'text-gray-600'
                              }`}>
                                {idx === 0 ? '낮' : idx === 1 ? '황혼' : '밤'}
                                {isActive && ' ✓'}
                              </div>
                              <img 
                                src={`/images/${spriteNum}.png`}
                                alt={`${bg.name} ${idx === 0 ? 'Day' : idx === 1 ? 'Dusk' : 'Night'}`}
                                className={`w-full h-20 object-cover rounded border-2 ${
                                  isActive 
                                    ? 'border-blue-500 ring-2 ring-blue-300' 
                                    : 'border-gray-300'
                                }`}
                                onError={(e) => {
                                  // 스프라이트가 없을 경우 대체 이미지
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* 설정 버튼 */}
                      <div className="space-y-2 mt-4">
                        <div className="text-xs font-semibold text-gray-700 mb-1">선택:</div>
                        <div className="space-y-2">
                          <button
                            onClick={() => handleBackgroundSelect(bg.id, 'auto')}
                            className={`w-full text-sm py-2 rounded transition-colors ${
                              isSelected && currentMode === 'auto'
                                ? 'bg-blue-500 text-white font-bold'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                          >
                            ⏰ 시간순 변경 (자동)
                          </button>
                          <div className="flex gap-1">
                            {[0, 1, 2].map(idx => (
                              <button
                                key={idx}
                                onClick={() => handleBackgroundSelect(bg.id, idx.toString())}
                                className={`flex-1 text-xs py-2 rounded transition-colors ${
                                  isSelected && currentMode === idx.toString()
                                    ? 'bg-blue-500 text-white font-bold'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                              >
                                {idx === 0 ? '☀️ 낮' : idx === 1 ? '🌅 황혼' : '🌙 밤'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          </div>
        </div>
        
        {/* 하단 버튼 영역 (고정) */}
        <div className="p-6 border-t bg-gray-50 space-y-2">
          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`w-full px-6 py-3 rounded-lg font-bold transition-colors ${
              hasChanges
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            💾 저장
          </button>
          
          {/* 뒤로가기 버튼 */}
          <button
            onClick={handleBack}
            className="w-full px-6 py-3 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors"
          >
            뒤로가기
          </button>
        </div>
      </div>
    </div>
  );
}
