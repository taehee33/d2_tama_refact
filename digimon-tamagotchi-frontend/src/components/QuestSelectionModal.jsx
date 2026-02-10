// src/components/QuestSelectionModal.jsx
import React, { useState, useEffect } from "react";
import { digimonDataVer1 } from "../data/v1/digimons";
import "./QuestSelectionModal.css";

export default function QuestSelectionModal({
  quests,
  questsVer2 = [],
  defaultVersion = "Ver.1",
  clearedQuestIndex,
  onSelectArea,
  onClose,
  digimonDataVer2 = {},
}) {
  const [activeTab, setActiveTab] = useState(defaultVersion);
  const displayQuests = activeTab === "Ver.2" ? questsVer2 : quests;
  const digimonData = activeTab === "Ver.2" ? digimonDataVer2 : digimonDataVer1;
  const spriteBase = activeTab === "Ver.2" ? "/Ver2_Mod_Kor" : "/images";

  useEffect(() => {
    setActiveTab(defaultVersion);
  }, [defaultVersion]);

  const getAreaStatus = (index) => {
    if (index < clearedQuestIndex) {
      return "cleared"; // 클리어됨
    } else if (index === clearedQuestIndex) {
      return "open"; // 도전 가능
    } else {
      return "locked"; // 잠김
    }
  };

  const handleAreaClick = (area, index) => {
    const status = getAreaStatus(index);
    if (status === "open" || status === "cleared") {
      onSelectArea(area.areaId, activeTab);
    }
  };

  const getSpriteSrc = (enemy) => {
    const d = digimonData[enemy.enemyId] || digimonData[enemy.name];
    const base = d?.spriteBasePath || spriteBase;
    const sprite = d?.sprite ?? 0;
    return `${base}/${sprite}.png`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">퀘스트 모드</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            닫기
          </button>
        </div>

        {/* Ver.1 / Ver.2 탭 */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab("Ver.1")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === "Ver.1" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
          >
            Ver.1
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("Ver.2")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === "Ver.2" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
          >
            Ver.2
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(displayQuests || []).map((area, index) => {
            const status = getAreaStatus(index);
            const isLocked = status === "locked";
            const isCleared = index < clearedQuestIndex; // 클리어 여부
            const isOpen = status === "open";

            return (
              <div
                key={area.areaId}
                onClick={() => handleAreaClick(area, index)}
                className={`
                  p-4 rounded-lg border-2 cursor-pointer transition-all
                  ${isLocked 
                    ? "bg-gray-200 border-gray-400 cursor-not-allowed opacity-60" 
                    : isCleared
                    ? "bg-green-50 border-green-400 hover:bg-green-100"
                    : "bg-blue-50 border-blue-400 hover:bg-blue-100"
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold">{area.areaName}</h3>
                  {isLocked && (
                    <span className="text-2xl">🔒</span>
                  )}
                  {isCleared && (
                    <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">
                      CLEARED
                    </span>
                  )}
                  {isOpen && (
                    <span className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded">
                      Challenge!
                    </span>
                  )}
                </div>

                {/* Unlock 정보 표시 (상태 배지 아래) */}
                {area.unlockCondition && (
                  <div className="text-right mt-1">
                    <p className={`text-xs ${isCleared ? 'text-gray-600' : 'text-gray-400 opacity-50'}`}>
                      Unlock: {isCleared ? area.unlockCondition : '???'}
                    </p>
                  </div>
                )}

                <div className="text-sm text-gray-700">
                  <p>Round : {area.enemies.length} </p>
                  {area.enemies.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {isCleared ? (
                        <>Boss : {area.enemies[area.enemies.length - 1].name}</>
                      ) : (
                        <>Boss : ???</>
                      )}
                    </p>
                  )}
                </div>

                {/* 적 디지몬 스프라이트 또는 물음표 아이콘 */}
                <div className="mt-3 flex justify-center items-center">
                  {isCleared ? (
                    (() => {
                      const bossEnemy = area.enemies.find(e => e.isBoss);
                      const enemy = bossEnemy || area.enemies[area.enemies.length - 1];
                      if (!enemy) return null;
                      return (
                        <img
                          src={getSpriteSrc(enemy)}
                          alt={enemy.name}
                          className="w-16 h-16"
                          style={{ imageRendering: "pixelated" }}
                        />
                      );
                    })()
                  ) : (
                    <div className="unknown-quest-icon text-6xl text-gray-400 opacity-50">
                      ❓
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

