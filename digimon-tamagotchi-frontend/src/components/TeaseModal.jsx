// src/components/TeaseModal.jsx
// 괜히 괴롭히기 팝업 모달

import React, { useState, useEffect } from "react";
import "../styles/Battle.css";

const teaseActions = [
  "배방구!",
  "앞발잡기!",
  "물 가져오라고 시키기!",
  "콕콕찌르기!",
  "귀찮게하기!"     
];

export default function TeaseModal({ onClose, onComplete, currentCareMistakes = 0 }) {
  const [selectedAction, setSelectedAction] = useState("");
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [result, setResult] = useState(null); // "success" or "failure"
  const [newCareMistakes, setNewCareMistakes] = useState(null); // 성공 시 새로운 케어미스

  // 컴포넌트 마운트 시 랜덤 액션 선택
  useEffect(() => {
    const randomAction = teaseActions[Math.floor(Math.random() * teaseActions.length)];
    setSelectedAction(randomAction);
  }, []);

  // 프로그레스 바 진행 (랜덤 값으로 표시)
  useEffect(() => {
    if (!selectedAction) return;

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
      const isSuccess = Math.random() < 0.65;
      if (isSuccess) {
        setResult("success");
        // 성공 시 케어미스 +1
        const calculatedNewCareMistakes = (currentCareMistakes || 0) + 1;
        setNewCareMistakes(calculatedNewCareMistakes);
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
  }, [selectedAction, currentCareMistakes]);

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
        <h2 className="text-2xl font-bold mb-4 text-center">괜히 괴롭히기</h2>
        
        {!isComplete ? (
          <>
            <div className="text-center mb-4">
              <p className="text-xl font-semibold text-red-600 mb-4">
                {selectedAction}
              </p>
              
              {/* 프로그레스 바 */}
              <div className="w-full bg-gray-200 rounded-full h-6 mb-4">
                <div
                  className="bg-red-500 h-6 rounded-full transition-all duration-100 ease-linear flex items-center justify-center text-white text-xs font-bold"
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
                <div className="text-4xl mb-4">😈</div>
                <p className="text-2xl font-bold text-red-600 mb-4">성공!</p>
                <p className="text-lg text-gray-700 mb-2">
                  {selectedAction} 완료!
                </p>
                {newCareMistakes !== null && (
                  <p className="text-base text-gray-600 mb-4">
                    괜히 괴롭히기 성공! 케어미스: {currentCareMistakes} → {newCareMistakes}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="text-4xl mb-4">😅</div>
                <p className="text-2xl font-bold text-gray-600 mb-4">실패...</p>
                <p className="text-lg text-gray-700 mb-4">
                  {selectedAction} 실패했습니다.
                </p>
              </>
            )}
            
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors"
            >
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
