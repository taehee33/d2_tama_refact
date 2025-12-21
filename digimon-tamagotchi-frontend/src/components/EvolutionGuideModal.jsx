// src/components/EvolutionGuideModal.jsx
import React from "react";
import { checkEvolutionAvailability } from "../hooks/useGameLogic";

/**
 * 진화 가이드 모달 컴포넌트 (Data-Driven)
 * digimons.js의 구조화된 진화 조건 데이터를 표시합니다.
 */
export default function EvolutionGuideModal({
  currentDigimonName,
  currentDigimonData,
  currentStats,
  digimonDataMap,
  onClose,
}) {
  if (!currentDigimonData || !currentDigimonData.evolutions || currentDigimonData.evolutions.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50" onClick={onClose}>
        <div className="bg-gray-800 border-4 border-yellow-500 rounded-lg p-6 max-w-2xl w-full mx-4 pixel-art-modal" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-yellow-400 pixel-art-text">진화 가이드</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-red-400 text-2xl font-bold pixel-art-button"
            >
              ✕
            </button>
          </div>
          <p className="text-white">현재 디지몬은 더 이상 진화할 수 없습니다.</p>
        </div>
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
      // 각 조건 그룹을 별도 항목으로 표시
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
    // 예: Botamon -> Koromon (10분 후 자동 진화)
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
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border-4 border-yellow-500 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto pixel-art-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-yellow-400 pixel-art-text">
            진화 가이드 - {currentDigimonData.name || currentDigimonName}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-red-400 text-2xl font-bold pixel-art-button"
          >
            ✕
          </button>
        </div>

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

              {/* 조건 상세 정보 (개발자용) */}
              {process.env.NODE_ENV === 'development' && evo.conditions && (
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <p className="text-xs text-gray-400">
                    조건 타입: {evo.conditionType === 'single' ? '단일 조건' : evo.conditionType === 'group' ? `조건 그룹 ${evo.groupIndex}/${evo.totalGroups}` : '조그레스'}
                  </p>
                </div>
              )}
            </div>
          ))}
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
