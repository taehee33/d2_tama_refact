// src/components/ActivityLogModal.jsx
// 활동 로그 모달 컴포넌트

import React from "react";
import { formatTimestamp } from "../utils/dateUtils";

/**
 * ActivityLogModal 컴포넌트
 * 디지몬의 활동 로그를 표시하는 모달
 */
export default function ActivityLogModal({
  activityLogs = [],
  onClose,
}) {
  // 최신순으로 정렬
  const sortedLogs = [...activityLogs].sort((a, b) => {
    const timeA = a.timestamp || 0;
    const timeB = b.timestamp || 0;
    return timeB - timeA;
  });

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border-4 border-yellow-500 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto pixel-art-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-yellow-400 pixel-art-text">
            활동 로그
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-red-400 text-2xl font-bold pixel-art-button"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          {!activityLogs || activityLogs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white">활동 로그가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {sortedLogs.map((log, index) => (
                <div
                  key={index}
                  className="bg-gray-700 border-2 border-gray-600 rounded p-3 pixel-art-card"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-white text-sm break-words">
                        {log.text || log.type || 'Unknown'}
                      </p>
                    </div>
                    <div className="text-gray-400 text-xs ml-4 whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-yellow-500 text-black font-bold rounded pixel-art-button hover:bg-yellow-400"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
