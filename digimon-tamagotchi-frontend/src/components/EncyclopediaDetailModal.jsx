// src/components/EncyclopediaDetailModal.jsx
// 도감 상세 정보 모달

import React from "react";
import { formatTimestamp } from "../utils/dateUtils";
import { translateStage } from "../utils/stageTranslator";
import "../styles/Battle.css";

/**
 * 시간 포맷팅 (초를 일/시간/분/초로 변환)
 */
function formatTime(seconds) {
  if (!seconds || seconds <= 0) return "0초";
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}일`);
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}초`);
  
  return parts.join(" ");
}

export default function DigimonDetailModal({
  digimonName,
  digimonData,
  encyclopediaData,
  onClose,
}) {
  if (!digimonData) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50" style={{ padding: '20px' }}>
      <div className="battle-modal bg-white rounded-lg shadow-xl" style={{ 
        width: '90%', 
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-300 flex justify-between items-center">
          <h2 className="text-2xl font-bold">{digimonData.name || digimonName}</h2>
          <button
            onClick={onClose}
            className="text-2xl font-bold text-gray-600 hover:text-red-600"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 기본 정보 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold mb-2 text-lg">기본 정보</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">도감 번호:</span>
                <span className="font-bold ml-2">{digimonData.id || digimonName}</span>
              </div>
              <div>
                <span className="text-gray-600">세대:</span>
                <span className="font-bold ml-2">{translateStage(digimonData.stage)}</span>
              </div>
              <div>
                <span className="text-gray-600">속성:</span>
                <span className="font-bold ml-2">{digimonData.stats?.type || "Unknown"}</span>
              </div>
              <div>
                <span className="text-gray-600">기본 파워:</span>
                <span className="font-bold ml-2">{digimonData.stats?.basePower || 0}</span>
              </div>
            </div>
          </div>

          {/* 육성 이력 */}
          {encyclopediaData && encyclopediaData.isDiscovered && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-bold mb-2 text-lg">육성 이력</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">처음 발견:</span>
                  <span className="font-bold ml-2">
                    {encyclopediaData.firstDiscoveredAt 
                      ? formatTimestamp(encyclopediaData.firstDiscoveredAt)
                      : "알 수 없음"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">총 육성 횟수:</span>
                  <span className="font-bold ml-2">{encyclopediaData.raisedCount || 0}회</span>
                </div>
                {encyclopediaData.lastRaisedAt && (
                  <div>
                    <span className="text-gray-600">마지막 육성:</span>
                    <span className="font-bold ml-2">
                      {formatTimestamp(encyclopediaData.lastRaisedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 명예의 전당 (최고 기록) */}
          {encyclopediaData && encyclopediaData.bestStats && Object.keys(encyclopediaData.bestStats).length > 0 && (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="font-bold mb-2 text-lg">🏆 명예의 전당</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {encyclopediaData.bestStats.maxAge !== undefined && (
                  <div>
                    <span className="text-gray-600">최대 나이:</span>
                    <span className="font-bold ml-2">{encyclopediaData.bestStats.maxAge}일</span>
                  </div>
                )}
                {encyclopediaData.bestStats.maxWinRate !== undefined && (
                  <div>
                    <span className="text-gray-600">최고 승률:</span>
                    <span className="font-bold ml-2">{encyclopediaData.bestStats.maxWinRate}%</span>
                  </div>
                )}
                {encyclopediaData.bestStats.maxWeight !== undefined && (
                  <div>
                    <span className="text-gray-600">최대 체중:</span>
                    <span className="font-bold ml-2">{encyclopediaData.bestStats.maxWeight}g</span>
                  </div>
                )}
                {encyclopediaData.bestStats.maxLifespan !== undefined && (
                  <div>
                    <span className="text-gray-600">최장 생존:</span>
                    <span className="font-bold ml-2">
                      {formatTime(encyclopediaData.bestStats.maxLifespan)}
                    </span>
                  </div>
                )}
                {encyclopediaData.bestStats.totalBattles !== undefined && (
                  <div>
                    <span className="text-gray-600">총 배틀:</span>
                    <span className="font-bold ml-2">{encyclopediaData.bestStats.totalBattles}회</span>
                  </div>
                )}
                {encyclopediaData.bestStats.totalBattlesWon !== undefined && (
                  <div>
                    <span className="text-gray-600">총 승리:</span>
                    <span className="font-bold ml-2">{encyclopediaData.bestStats.totalBattlesWon}회</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 최근 육성 기록 */}
          {encyclopediaData && encyclopediaData.history && encyclopediaData.history.length > 0 && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-bold mb-2 text-lg">최근 육성 기록</h3>
              <div className="space-y-2">
                {encyclopediaData.history.map((entry, index) => (
                  <div key={index} className="bg-white p-3 rounded border border-gray-200 text-sm">
                    <div className="font-semibold mb-1">
                      {formatTimestamp(entry.date)}
                    </div>
                    <div className="text-gray-700 mb-1">{entry.result}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>나이: {entry.finalStats?.age || 0}일</div>
                      <div>승률: {entry.finalStats?.winRate || 0}%</div>
                      <div>체중: {entry.finalStats?.weight || 0}g</div>
                      <div>생존: {formatTime(entry.finalStats?.lifespanSeconds || 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 진화 트리 (선택 사항) */}
          {digimonData.evolutions && digimonData.evolutions.length > 0 && (
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-bold mb-2 text-lg">진화 경로</h3>
              <div className="text-sm">
                {digimonData.evolutions.map((evo, index) => (
                  <div key={index} className="mb-1">
                    → {evo.targetName || evo.targetId}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 닫기 버튼 */}
        <div className="p-4 border-t border-gray-200">
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
