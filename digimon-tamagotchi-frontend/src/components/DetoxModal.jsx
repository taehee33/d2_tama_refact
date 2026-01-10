// src/components/DetoxModal.jsx
// 디톡스 팝업 모달

import React, { useState, useEffect } from "react";
import "../styles/Battle.css";

const juices = [
  "케일주스 마시는중",
  "토마토주스 마시는중",
  "사과당근주스 마시는중"
];

export default function DetoxModal({ onClose, onComplete, currentProteinOverdose = 0 }) {
  const [selectedJuice, setSelectedJuice] = useState("");
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [result, setResult] = useState(null); // "success" or "failure"
  const [newProteinOverdose, setNewProteinOverdose] = useState(null); // 성공 시 새로운 Protein Overdose

  // 컴포넌트 마운트 시 랜덤 주스 선택
  useEffect(() => {
    const randomJuice = juices[Math.floor(Math.random() * juices.length)];
    setSelectedJuice(randomJuice);
  }, []);

  // 프로그레스 바 진행 (랜덤 값으로 표시)
  useEffect(() => {
    if (!selectedJuice) return;

    // timer1: 1초 후 20~40% 사이 랜덤
    const timer1 = setTimeout(() => {
      const randomProgress1 = 20 + Math.random() * 20; // 20~40%
      setProgress(randomProgress1);
    }, 1000);
    
    // timer2: 2초 후 55~80% 사이 랜덤
    const timer2 = setTimeout(() => {
      const randomProgress2 = 55 + Math.random() * 25; // 55~80%
      setProgress(randomProgress2);
    }, 2000);
    
    // timer3: 3초 후 100%로 완료
    const timer3 = setTimeout(() => {
      setProgress(100);
    }, 3000);
    
    // timer4: 3.7초 후 결과 표시 (100% 후 0.7초 대기)
    const timer4 = setTimeout(() => {
      setIsComplete(true);
      // 60% 확률로 성공/실패 결정
      const isSuccess = Math.random() < 0.6;
      if (isSuccess) {
        setResult("success");
        // 성공 시 Protein Overdose -1 (최소 0)
        const calculatedNewProteinOverdose = Math.max(0, currentProteinOverdose - 1);
        setNewProteinOverdose(calculatedNewProteinOverdose);
      } else {
        setResult("failure");
      }
    }, 3700);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [selectedJuice, currentProteinOverdose]);

  // 완료 후 결과 표시
  const handleClose = () => {
    if (onComplete && isComplete) {
      onComplete(result);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="battle-modal bg-white p-6 rounded-lg shadow-xl min-w-[300px]">
        <h2 className="text-2xl font-bold mb-4 text-center">디톡스</h2>
        
        {!isComplete ? (
          <>
            <div className="text-center mb-4">
              <p className="text-xl font-semibold text-green-600 mb-4">
                {selectedJuice}
              </p>
              
              {/* 프로그레스 바 */}
              <div className="w-full bg-gray-200 rounded-full h-6 mb-4">
                <div
                  className="bg-green-500 h-6 rounded-full transition-all duration-100 ease-linear flex items-center justify-center text-white text-xs font-bold"
                  style={{ width: `${progress}%` }}
                >
                  {Math.round(progress)}%
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center">
            {result === "success" ? (
              <>
                <div className="text-4xl mb-4">🎉</div>
                <p className="text-2xl font-bold text-green-600 mb-4">성공!</p>
                <p className="text-lg text-gray-700 mb-2">
                  {selectedJuice} 완료!
                </p>
                {newProteinOverdose !== null && (
                  <p className="text-base text-gray-600 mb-4">
                    디톡스 성공! 약물중독 감소: {currentProteinOverdose} → {newProteinOverdose}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="text-4xl mb-4">😢</div>
                <p className="text-2xl font-bold text-red-600 mb-4">실패...</p>
                <p className="text-lg text-gray-700 mb-4">
                  {selectedJuice} 실패했습니다.
                </p>
              </>
            )}
            
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors"
            >
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
