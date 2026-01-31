// src/components/EncyclopediaModal.jsx
// 도감 모달 컴포넌트

import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { digimonDataVer1 } from "../data/v1/digimons";
import { digimonDataVer2 } from "../data/v2modkor";
import { loadEncyclopedia, addMissingEncyclopediaEntries, saveEncyclopedia } from "../hooks/useEncyclopedia";
import { translateStage } from "../utils/stageTranslator";
import EncyclopediaDetailModal from "./EncyclopediaDetailModal";
import "../styles/Battle.css";

export default function EncyclopediaModal({ 
  currentDigimonId,
  onClose,
}) {
  const { currentUser, isFirebaseAvailable } = useAuth();
  const [encyclopedia, setEncyclopedia] = useState({ "Ver.1": {} });
  const [selectedVersion, setSelectedVersion] = useState("Ver.1");
  const [selectedDigimon, setSelectedDigimon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fixingMessage, setFixingMessage] = useState(null); // 도감 보정 결과 메시지

  // 도감 데이터 로드 (계정별 통합)
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await loadEncyclopedia(currentUser);
        setEncyclopedia(data);
      } catch (error) {
        console.error("도감 로드 오류:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [currentUser]);

  // 선택된 버전에 따라 디지몬 목록 가져오기 (Ohakadamon 제외)
  const getDigimonList = (version) => {
    const dataMap = version === "Ver.2" ? digimonDataVer2 : digimonDataVer1;
    return Object.keys(dataMap)
      .filter(key => {
        const digimon = dataMap[key];
        return digimon && digimon.stage !== "Ohakadamon" && digimon.id !== "Ohakadamon1" && digimon.id !== "Ohakadamon2";
      })
      .map(key => ({
        id: key,
        ...dataMap[key]
      }))
      .sort((a, b) => {
        // Stage 순서로 정렬
        const stageOrder = {
          "Digitama": 0,
          "Baby I": 1,
          "Baby II": 2,
          "Child": 3,
          "Adult": 4,
          "Perfect": 5,
          "Ultimate": 6,
          "Super Ultimate": 7
        };
        const aOrder = stageOrder[a.stage] || 999;
        const bOrder = stageOrder[b.stage] || 999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // 같은 Stage면 이름순
        return (a.name || a.id).localeCompare(b.name || b.id, 'ko');
      });
  };
  
  const digimonList = getDigimonList(selectedVersion);

  const versionData = encyclopedia[selectedVersion] || {};

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white p-6 rounded-lg">
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50" style={{ padding: '20px' }}>
      <div className="battle-modal bg-white rounded-lg shadow-xl" style={{ 
        width: '90%', 
        maxWidth: '1200px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-300 flex justify-between items-center">
          <h2 className="text-2xl font-bold">도감</h2>
          <button
            onClick={onClose}
            className="text-2xl font-bold text-gray-600 hover:text-red-600"
          >
            ✕
          </button>
        </div>

        {/* 버전 탭 (Ver.1, Ver.2 별도 관리) */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedVersion("Ver.1")}
              className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                selectedVersion === "Ver.1"
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Ver.1
            </button>
            <button
              onClick={() => setSelectedVersion("Ver.2")}
              className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                selectedVersion === "Ver.2"
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Ver.2
            </button>
          </div>
        </div>

        {/* 디지몬 그리드 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {digimonList.map((digimon) => {
              const digimonKey = digimon.id || digimon.name;
              const discoveredData = versionData[digimonKey];
              const isDiscovered = discoveredData?.isDiscovered || false;

              return (
                <div
                  key={digimonKey}
                  onClick={() => {
                    if (isDiscovered) {
                      setSelectedDigimon(digimonKey);
                    }
                  }}
                  className={`relative p-3 rounded-lg border-2 transition-all ${
                    isDiscovered
                      ? 'bg-white border-blue-300 hover:border-blue-500 cursor-pointer hover:shadow-lg'
                      : 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                  }`}
                >
                  {/* 스프라이트 이미지 (v2는 Ver2_Mod_Kor 경로) */}
                  <div className="flex justify-center mb-2">
                    <img
                      src={`${digimon.spriteBasePath || '/images'}/${digimon.sprite || 0}.png`}
                      alt={digimon.name || digimonKey}
                      className="w-16 h-16"
                      style={{
                        imageRendering: "pixelated",
                        filter: isDiscovered ? 'none' : 'blur(8px) grayscale(100%)',
                        opacity: isDiscovered ? 1 : 0.5
                      }}
                    />
                  </div>

                  {/* 디지몬 이름 */}
                  <div className="text-center text-sm font-bold">
                    {isDiscovered ? (digimon.name || digimonKey) : '???'}
                  </div>

                  {/* 세대 표시 */}
                  {isDiscovered && (
                    <div className="text-center text-xs text-gray-500 mt-1">
                      {translateStage(digimon.stage)}
                    </div>
                  )}

                  {/* 체크마크 */}
                  {isDiscovered && (
                    <div className="absolute top-1 right-1 text-green-500 text-xl font-bold">
                      ✓
                    </div>
                  )}

                  {/* 잠금 아이콘 */}
                  {!isDiscovered && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl">🔒</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 통계 */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            발견: {Object.values(versionData).filter(d => d.isDiscovered).length} / {digimonList.length}
          </div>
          {/* 도감 강제 업데이트: 현재 슬롯의 디지몬을 도감에 반영 */}
          {currentUser && isFirebaseAvailable && (
            <div className="mt-2">
              <button
                type="button"
                onClick={async () => {
                  if (!currentDigimonId) {
                    setFixingMessage("현재 선택된 디지몬이 없습니다.");
                    setTimeout(() => setFixingMessage(null), 3000);
                    return;
                  }
                  setFixingMessage("처리 중...");
                  try {
                    // 현재 디지몬이 v1인지 v2인지 확인
                    const mergedDigimonData = { ...digimonDataVer1, ...digimonDataVer2 };
                    const digimonData = mergedDigimonData[currentDigimonId];
                    const digimonVersion = digimonData?.spriteBasePath === '/Ver2_Mod_Kor' ? 'Ver.2' : 'Ver.1';
                    
                    // addMissingEncyclopediaEntries는 Ver.1만 지원하므로, 수동으로 Ver.2 처리
                    if (digimonVersion === 'Ver.2') {
                      const data = await loadEncyclopedia(currentUser);
                      if (!data['Ver.2']) data['Ver.2'] = {};
                      if (!data['Ver.2'][currentDigimonId]?.isDiscovered) {
                        data['Ver.2'][currentDigimonId] = {
                          isDiscovered: true,
                          firstDiscoveredAt: Date.now(),
                          raisedCount: 1,
                          lastRaisedAt: Date.now(),
                          bestStats: {},
                          history: []
                        };
                        await saveEncyclopedia(data, currentUser);
                        setEncyclopedia(data);
                        setFixingMessage(`도감(Ver.2)에 ${digimonData?.name || currentDigimonId} 반영되었습니다.`);
                      } else {
                        setFixingMessage("이미 도감(Ver.2)에 등록되어 있습니다.");
                      }
                    } else {
                      const { added, skipped } = await addMissingEncyclopediaEntries(currentUser, [
                        currentDigimonId
                      ]);
                      const data = await loadEncyclopedia(currentUser);
                      setEncyclopedia(data);
                      if (added.length > 0) {
                        setFixingMessage(`도감(Ver.1)에 ${digimonDataVer1[currentDigimonId]?.name || currentDigimonId} 반영되었습니다.`);
                      } else if (skipped.length > 0) {
                        setFixingMessage("이미 도감에 등록되어 있습니다.");
                      } else {
                        setFixingMessage("반영할 항목이 없습니다.");
                      }
                    }
                  } catch (e) {
                    setFixingMessage("보정 실패: " + (e.message || "알 수 없는 오류"));
                  }
                  setTimeout(() => setFixingMessage(null), 4000);
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                도감 강제 업데이트
              </button>
              {fixingMessage && (
                <div className="text-xs text-gray-700 mt-1">{fixingMessage}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 상세 정보 모달 */}
      {selectedDigimon && (
        <EncyclopediaDetailModal
          digimonName={selectedDigimon}
          digimonData={selectedVersion === "Ver.2" 
            ? digimonDataVer2[selectedDigimon] 
            : digimonDataVer1[selectedDigimon]}
          encyclopediaData={versionData[selectedDigimon]}
          onClose={() => setSelectedDigimon(null)}
        />
      )}
    </div>
  );
}
