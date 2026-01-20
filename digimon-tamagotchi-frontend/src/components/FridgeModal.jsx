// src/components/FridgeModal.jsx
// 냉장고 모달 컴포넌트

import React from "react";
import "../styles/Battle.css";

export default function FridgeModal({
  isFrozen,
  onPutIn,
  onTakeOut,
  onClose,
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="battle-modal bg-white p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold mb-4 text-center">냉장고</h2>
        
        <div className="space-y-4">
          {!isFrozen ? (
            <>
              <p className="text-center text-gray-700 mb-4">
                디지몬을 냉장고에 보관하면 시간이 멈춥니다.
                <br />
                모든 수치가 고정되고 사망하지 않습니다.
                <br />
                <span className="text-sm text-gray-500">
                  (먹이 주기, 훈련하기는 비활성화됩니다)
                </span>
              </p>
              <button
                onClick={() => {
                  onPutIn();
                  onClose();
                }}
                className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
              >
                냉장고에 넣기
              </button>
            </>
          ) : (
            <>
              <p className="text-center text-gray-700 mb-4">
                디지몬이 냉장고에 보관되어 있습니다.
                <br />
                꺼내면 시간이 다시 흐르기 시작합니다.
              </p>
              <button
                onClick={() => {
                  onTakeOut();
                  onClose();
                }}
                className="w-full px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors"
              >
                냉장고에서 꺼내기
              </button>
            </>
          )}
          
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
