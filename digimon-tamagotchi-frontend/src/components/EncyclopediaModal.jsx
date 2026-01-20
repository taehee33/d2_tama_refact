// src/components/EncyclopediaModal.jsx
// 도감 모달 컴포넌트

import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { digimonDataVer1 } from "../data/v1/digimons";
import { loadEncyclopedia } from "../hooks/useEncyclopedia";
import { translateStage } from "../utils/stageTranslator";
import EncyclopediaDetailModal from "./EncyclopediaDetailModal";
import "../styles/Battle.css";

export default function EncyclopediaModal({ 
  onClose,
  mode,
}) {
  const { currentUser, isFirebaseAvailable } = useAuth();
  const [encyclopedia, setEncyclopedia] = useState({ "Ver.1": {} });
  const [selectedVersion, setSelectedVersion] = useState("Ver.1");
  const [selectedDigimon, setSelectedDigimon] = useState(null);
  const [loading, setLoading] = useState(true);

  // 도감 데이터 로드 (계정별 통합)
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await loadEncyclopedia(currentUser, mode);
        setEncyclopedia(data);
      } catch (error) {
        console.error("도감 로드 오류:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [currentUser, mode]);

  // Ver.1 디지몬 목록 가져오기 (Ohakadamon 제외)
  const digimonList = Object.keys(digimonDataVer1)
    .filter(key => {
      const digimon = digimonDataVer1[key];
      return digimon && digimon.stage !== "Ohakadamon" && digimon.id !== "Ohakadamon1" && digimon.id !== "Ohakadamon2";
    })
    .map(key => ({
      id: key,
      ...digimonDataVer1[key]
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

        {/* 버전 탭 (현재는 Ver.1만) */}
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
                  {/* 스프라이트 이미지 */}
                  <div className="flex justify-center mb-2">
                    <img
                      src={`/images/${digimon.sprite || 0}.png`}
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
        </div>
      </div>

      {/* 상세 정보 모달 */}
      {selectedDigimon && (
        <EncyclopediaDetailModal
          digimonName={selectedDigimon}
          digimonData={digimonDataVer1[selectedDigimon]}
          encyclopediaData={versionData[selectedDigimon]}
          onClose={() => setSelectedDigimon(null)}
        />
      )}
    </div>
  );
}
