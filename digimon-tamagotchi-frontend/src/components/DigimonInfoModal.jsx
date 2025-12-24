// src/components/DigimonInfoModal.jsx
import React, { useState } from "react";
import { checkEvolutionAvailability } from "../hooks/useGameLogic";
import { formatTimestamp } from "../utils/dateUtils";

/**
 * 디지몬 정보 모달 컴포넌트 (메뉴 선택형 구조)
 * MENU, INFO, EVOLUTION, LOGS 뷰를 포함합니다.
 */
export default function DigimonInfoModal({
  currentDigimonName,
  currentDigimonData,
  currentStats,
  digimonDataMap,
  activityLogs = [],
  onClose,
}) {
  const [currentView, setCurrentView] = useState('MENU');

  // 헤더 UI
  const renderHeader = () => {
    const titles = {
      'MENU': 'Digimon Menu',
      'INFO': 'Digimon Info',
      'EVOLUTION': 'Evolution Guide',
      'LOGS': 'Activity Logs',
    };

    return (
      <div className="flex justify-between items-center mb-4">
        {currentView === 'MENU' ? (
          <h2 className="text-2xl font-bold text-yellow-400 pixel-art-text">
            {titles[currentView]}
          </h2>
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentView('MENU')}
              className="text-white hover:text-yellow-400 text-lg font-bold pixel-art-button"
            >
              ← Back
            </button>
            <h2 className="text-2xl font-bold text-yellow-400 pixel-art-text">
              {titles[currentView]}
            </h2>
          </div>
        )}
        <button
          onClick={onClose}
          className="text-white hover:text-red-400 text-2xl font-bold pixel-art-button"
        >
          ✕
        </button>
      </div>
    );
  };

  // 화면 1: 메인 메뉴 (MENU View)
  const renderMenuView = () => {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setCurrentView('INFO')}
          className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg pixel-art-button text-left flex items-center gap-3"
        >
          <span className="text-2xl">📊</span>
          <span>Digimon Info</span>
        </button>
        <button
          onClick={() => setCurrentView('EVOLUTION')}
          className="w-full px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg pixel-art-button text-left flex items-center gap-3"
        >
          <span className="text-2xl">🧬</span>
          <span>Evolution Guide</span>
        </button>
        <button
          onClick={() => setCurrentView('LOGS')}
          className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg pixel-art-button text-left flex items-center gap-3"
        >
          <span className="text-2xl">📝</span>
          <span>Activity Logs</span>
        </button>
      </div>
    );
  };

  // 화면 2: 상세 정보 (INFO View)
  const renderInfoView = () => {
    if (!currentDigimonData) {
      return <p className="text-white">디지몬 데이터를 불러올 수 없습니다.</p>;
    }

    const stats = currentDigimonData.stats || {};
    const digimonStats = currentStats || {};

    // Cycles를 분 단위로 변환 (초 단위인 경우)
    const formatCycle = (cycleSeconds) => {
      if (!cycleSeconds) return 'N/A';
      const minutes = Math.floor(cycleSeconds / 60);
      return `${minutes}m`;
    };

    // hungerCycle, strengthCycle, poopCycle은 초 단위로 저장되어 있을 수 있음
    const hungerCycle = stats.hungerCycle || stats.hungerTimer || 0;
    const strengthCycle = stats.strengthCycle || stats.strengthTimer || 0;
    const poopCycle = stats.poopCycle || stats.poopTimer || 0;

    return (
      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-gray-700 border-2 border-gray-600 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-yellow-300 mb-3 pixel-art-text">Profile</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-400 text-sm">Name</p>
              <p className="text-white font-bold">{currentDigimonData.name || currentDigimonName}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Stage</p>
              <p className="text-white font-bold">{currentDigimonData.stage || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Type</p>
              <p className="text-white font-bold">{stats.type || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Sprite</p>
              <p className="text-white font-bold">#{currentDigimonData.sprite || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Specs */}
        <div className="bg-gray-700 border-2 border-gray-600 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-yellow-300 mb-3 pixel-art-text">Specs</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-400 text-sm">Base Power</p>
              <p className="text-white font-bold">{stats.basePower || 0}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Max DP</p>
              <p className="text-white font-bold">{stats.maxEnergy || stats.maxStamina || 0}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Lifespan</p>
              <p className="text-white font-bold">{stats.lifespan ? `${stats.lifespan}h` : 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Min Weight</p>
              <p className="text-white font-bold">{stats.minWeight || 0}g</p>
            </div>
          </div>
        </div>

        {/* Cycles */}
        <div className="bg-gray-700 border-2 border-gray-600 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-yellow-300 mb-3 pixel-art-text">Cycles</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-400 text-sm">Hunger</p>
              <p className="text-white font-bold">{formatCycle(hungerCycle)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Strength</p>
              <p className="text-white font-bold">{formatCycle(strengthCycle)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Poop</p>
              <p className="text-white font-bold">{formatCycle(poopCycle)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Sleep Schedule</p>
              <p className="text-white font-bold">
                {stats.sleepSchedule 
                  ? `${stats.sleepSchedule.start}:00 - ${stats.sleepSchedule.end}:00`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-gray-700 border-2 border-gray-600 rounded p-4 pixel-art-card">
          <h3 className="text-xl font-bold text-yellow-300 mb-3 pixel-art-text">Status</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-400 text-sm">Age</p>
              <p className="text-white font-bold">{digimonStats.age || 0} days</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Weight</p>
              <p className="text-white font-bold">{digimonStats.weight || 0}g</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Win Rate</p>
              <p className="text-white font-bold">{digimonStats.winRate || 0}%</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Fullness</p>
              <p className="text-white font-bold">{digimonStats.fullness || 0}/5</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Strength</p>
              <p className="text-white font-bold">{digimonStats.strength || 0}/5</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Energy (DP)</p>
              <p className="text-white font-bold">{digimonStats.energy || 0}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 화면 3: 진화 가이드 (EVOLUTION View)
  const renderEvolutionView = () => {
    if (!currentDigimonData || !currentDigimonData.evolutions || currentDigimonData.evolutions.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-white">현재 디지몬은 더 이상 진화할 수 없습니다.</p>
        </div>
      );
    }

    // evolutions 배열을 처리하여 진화 목록 생성
    const evolutionList = [];
    
    currentDigimonData.evolutions.forEach((evo, index) => {
      const targetId = evo.targetId || evo.targetName;
      
      const targetData = digimonDataMap[targetId];
      const targetName = targetData?.name || targetData?.id || targetId || "Unknown";

      // Case 1: 단일 조건 그룹 (conditions)
      if (evo.conditions) {
        const requirements = {
          timeToEvolveSeconds: currentDigimonData.evolutionCriteria?.timeToEvolveSeconds,
          ...convertConditionsToRequirements(evo.conditions),
        };
        
        const availability = checkEvolutionAvailability(currentStats, requirements);
        
        evolutionList.push({
          targetId,
          targetName,
          targetData,
          requirements,
          availability,
          conditions: evo.conditions,
          conditionType: 'single',
        });
      }
      // Case 2: 다중 조건 그룹 (conditionGroups) - OR Logic
      else if (evo.conditionGroups && Array.isArray(evo.conditionGroups)) {
        evo.conditionGroups.forEach((group, groupIndex) => {
          const requirements = {
            timeToEvolveSeconds: currentDigimonData.evolutionCriteria?.timeToEvolveSeconds,
            ...convertConditionsToRequirements(group),
          };
          
          const availability = checkEvolutionAvailability(currentStats, requirements);
          
          const displayName = evo.conditionGroups.length > 1 
            ? `${targetName} (진화 방법 ${groupIndex + 1})`
            : targetName;
          
          evolutionList.push({
            targetId,
            targetName: displayName,
            targetData,
            requirements,
            availability,
            conditions: group,
            conditionType: 'group',
            groupIndex: groupIndex + 1,
            totalGroups: evo.conditionGroups.length,
          });
        });
      }
      // Case 3: 조그레스 (jogress)
      else if (evo.jogress) {
        evolutionList.push({
          targetId,
          targetName,
          targetData,
          requirements: {},
          availability: { isAvailable: false, missingConditions: ["조그레스 진화는 아직 지원되지 않습니다."] },
          conditionType: 'jogress',
          jogress: evo.jogress,
        });
      }
      // Case 4: 조건이 없는 경우 (시간 조건만 있거나 자동 진화)
      else {
        const requirements = {
          timeToEvolveSeconds: currentDigimonData.evolutionCriteria?.timeToEvolveSeconds,
        };
        
        const availability = checkEvolutionAvailability(currentStats, requirements);
        
        evolutionList.push({
          targetId,
          targetName,
          targetData,
          requirements,
          availability: {
            isAvailable: availability.isAvailable,
            missingConditions: availability.missingConditions.length > 0 
              ? availability.missingConditions 
              : ["진화 조건 없음 (시간 조건만 만족하면 진화)"],
          },
          conditions: null,
          conditionType: 'time_only',
        });
      }
    });

    return (
      <div className="space-y-4">
        {evolutionList.map((evo, index) => (
          <div
            key={index}
            className="bg-gray-700 border-2 border-gray-600 rounded p-4 pixel-art-card hover:border-yellow-400 transition-colors"
          >
            <h3 className="text-xl font-bold text-yellow-300 mb-2 pixel-art-text">
              → {evo.targetName}
            </h3>

            <div className="space-y-2">
              {evo.availability.missingConditions.length > 0 ? (
                evo.availability.missingConditions.map((condition, idx) => {
                  const isMet = condition.includes("달성 ✅");
                  const isMissing = condition.includes("부족 ❌") || condition.includes("초과 ❌");
                  const isNoCondition = condition.includes("진화 조건 없음");
                  
                  return (
                    <div key={idx} className="flex items-center space-x-2">
                      <span className={`text-sm ${
                        isMet ? "text-green-400" : 
                        isMissing ? "text-red-400" : 
                        isNoCondition ? "text-yellow-400" :
                        "text-gray-300"
                      }`}>
                        {condition}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-green-400 font-bold">✅ 모든 조건을 만족했습니다!</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 화면 4: 활동 로그 (LOGS View)
  const renderLogsView = () => {
    if (!activityLogs || activityLogs.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-white">No activities yet.</p>
        </div>
      );
    }

    // 최신순으로 정렬
    const sortedLogs = [...activityLogs].sort((a, b) => {
      const timeA = a.timestamp || 0;
      const timeB = b.timestamp || 0;
      return timeB - timeA;
    });

    // formatTimestamp는 utils/dateUtils에서 import

    return (
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {sortedLogs.map((log, index) => (
          <div
            key={index}
            className="bg-gray-700 border-2 border-gray-600 rounded p-3 pixel-art-card"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-white text-sm">{log.text || log.type || 'Unknown'}</p>
              </div>
              <div className="text-gray-400 text-xs ml-4">
                {formatTimestamp(log.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 메인 렌더링
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border-4 border-yellow-500 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto pixel-art-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {renderHeader()}

        <div className="mt-4">
          {currentView === 'MENU' && renderMenuView()}
          {currentView === 'INFO' && renderInfoView()}
          {currentView === 'EVOLUTION' && renderEvolutionView()}
          {currentView === 'LOGS' && renderLogsView()}
        </div>

        {currentView === 'MENU' && (
          <div className="mt-6 text-center">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-yellow-500 text-black font-bold rounded pixel-art-button hover:bg-yellow-400"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * conditions 객체를 requirements 형식으로 변환
 * @param {Object} conditions - { careMistakes: { min: 4 }, trainings: { min: 5, max: 15 }, ... }
 * @returns {Object} requirements 객체
 */
function convertConditionsToRequirements(conditions) {
  const requirements = {};
  
  if (conditions.careMistakes) {
    if (conditions.careMistakes.min !== undefined) {
      requirements.minMistakes = conditions.careMistakes.min;
    }
    if (conditions.careMistakes.max !== undefined) {
      requirements.maxMistakes = conditions.careMistakes.max;
    }
  }
  
  if (conditions.trainings) {
    if (conditions.trainings.min !== undefined) {
      requirements.minTrainings = conditions.trainings.min;
    }
    if (conditions.trainings.max !== undefined) {
      requirements.maxTrainings = conditions.trainings.max;
    }
  }
  
  if (conditions.overfeeds) {
    if (conditions.overfeeds.min !== undefined) {
      requirements.minOverfeeds = conditions.overfeeds.min;
    }
    if (conditions.overfeeds.max !== undefined) {
      requirements.maxOverfeeds = conditions.overfeeds.max;
    }
  }
  
  if (conditions.sleepDisturbances) {
    if (conditions.sleepDisturbances.min !== undefined) {
      requirements.minSleepDisturbances = conditions.sleepDisturbances.min;
    }
    if (conditions.sleepDisturbances.max !== undefined) {
      requirements.maxSleepDisturbances = conditions.sleepDisturbances.max;
    }
  }
  
  if (conditions.battles) {
    if (conditions.battles.min !== undefined) {
      requirements.minBattles = conditions.battles.min;
    }
    if (conditions.battles.max !== undefined) {
      requirements.maxBattles = conditions.battles.max;
    }
  }
  
  if (conditions.winRatio) {
    if (conditions.winRatio.min !== undefined) {
      requirements.minWinRatio = conditions.winRatio.min;
    }
    if (conditions.winRatio.max !== undefined) {
      requirements.maxWinRatio = conditions.winRatio.max;
    }
  }
  
  if (conditions.weight) {
    if (conditions.weight.min !== undefined) {
      requirements.minWeight = conditions.weight.min;
    }
    if (conditions.weight.max !== undefined) {
      requirements.maxWeight = conditions.weight.max;
    }
  }
  
  if (conditions.strength) {
    if (conditions.strength.min !== undefined) {
      requirements.minStrength = conditions.strength.min;
    }
    if (conditions.strength.max !== undefined) {
      requirements.maxStrength = conditions.strength.max;
    }
  }
  
  if (conditions.power) {
    if (conditions.power.min !== undefined) {
      requirements.minPower = conditions.power.min;
    }
    if (conditions.power.max !== undefined) {
      requirements.maxPower = conditions.power.max;
    }
  }
  
  return requirements;
}

