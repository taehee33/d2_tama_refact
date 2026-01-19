// src/components/DeathPopup.jsx
import React from "react";

export default function DeathPopup({ isOpen, onConfirm, onClose, reason, selectedDigimon, onNewStart, digimonStats = {} }) {
  if (!isOpen) return null;

  // 오하카다몬 여부 확인
  const isOhakadamon = selectedDigimon === "Ohakadamon1" || selectedDigimon === "Ohakadamon2";
  
  // digimonStats.deathReason을 우선 사용, 없으면 reason prop 사용
  const finalReason = digimonStats.deathReason || reason;

  // 좀 더 같이 있기 / 좀 더 슬퍼하기: 팝업만 닫고 현재 죽어있는 디지몬을 계속 보여줌
  const handleStay = () => {
    if (onClose) {
      onClose();
    }
  };

  // 사망 확인(안녕..): 오하카다몬으로 환생 처리 (일반 디지몬일 때)
  // 새로운 시작: 디지타마부터 다시 새롭게 시작 (오하카다몬일 때)
  const handleConfirm = () => {
    if (isOhakadamon && onNewStart) {
      // 오하카다몬일 때: 디지타마로 초기화
      onNewStart();
    } else if (onConfirm) {
      // 일반 디지몬일 때: 오하카다몬으로 환생
      onConfirm();
    }
    if (onClose) {
      onClose();
    }
  };

  // 사망 원인에 따른 설명 매핑
  const getDeathReasonInfo = (reason) => {
    if (!reason) return null;

    const reasonMap = {
      'STARVATION (굶주림)': {
        title: '굶주림',
        description: '배고픔이 0인 상태로 12시간 이상 방치되어 사망했습니다.',
        icon: '🍽️',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
      },
      'EXHAUSTION (힘 소진)': {
        title: '힘 소진',
        description: '힘이 0인 상태로 12시간 이상 방치되어 사망했습니다.',
        icon: '💪',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
      },
      'INJURY OVERLOAD (부상 과다: 15회)': {
        title: '부상 과다',
        description: '누적 부상이 15회에 도달하여 사망했습니다.',
        icon: '🩹',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
      },
      'INJURY NEGLECT (부상 방치: 6시간)': {
        title: '부상 방치',
        description: '부상 상태에서 6시간 이상 치료하지 않아 사망했습니다.',
        icon: '🏥',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
      },
      'OLD AGE (수명 다함)': {
        title: '수명 종료',
        description: '디지몬의 수명이 다하여 자연스럽게 사망했습니다.',
        icon: '⏰',
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
      },
    };

    return reasonMap[reason] || {
      title: reason,
      description: '알 수 없는 원인으로 사망했습니다.',
      icon: '❓',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    };
  };

  const reasonInfo = getDeathReasonInfo(finalReason);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md mx-4">
        <h2 className="text-3xl font-bold text-red-600 mb-4">
          YOUR DIGIMON HAS DIED
        </h2>
        
        {reasonInfo && (
          <div className={`${reasonInfo.bgColor} border-2 border-gray-300 rounded-lg p-4 mb-6`}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">{reasonInfo.icon}</span>
              <h3 className={`text-lg font-bold ${reasonInfo.color}`}>
                사망 원인: {reasonInfo.title}
              </h3>
            </div>
            <p className="text-sm text-gray-700 mt-2">
              {reasonInfo.description}
            </p>
            <div className="mt-3 pt-3 border-t border-gray-300">
              <p className="text-xs text-gray-500">
                원인 코드: {finalReason || '없음'}
              </p>
            </div>
          </div>
        )}

        {!reasonInfo && (
          <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 font-semibold">
              사망 원인 확인 불가
            </p>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <button
            onClick={handleStay}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
          >
            {isOhakadamon ? "좀 더 슬퍼하기" : "좀 더 같이 있기"}
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-3 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-800 transition-colors"
          >
            {isOhakadamon ? "🥚 새로운 시작" : "사망 확인 (안녕..)"}
          </button>
        </div>
      </div>
    </div>
  );
}

