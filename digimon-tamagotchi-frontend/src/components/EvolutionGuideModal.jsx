// src/components/EvolutionGuideModal.jsx
import React from "react";
import { checkEvolutionAvailability } from "../hooks/useGameLogic";

/**
 * 진화 가이드 모달 컴포넌트
 * 현재 디지몬에서 진화 가능한 모든 루트를 표시하고 달성 현황을 보여줍니다.
 */
export default function EvolutionGuideModal({
  currentDigimonName,
  currentDigimonData,
  currentStats,
  digimonDataMap,
  evolutionConditions,
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

  // evolutionConditions에서 현재 디지몬의 진화 조건 가져오기
  const evoConditions = evolutionConditions[currentDigimonName] || { evolution: [] };

  // evolutions 배열과 evolutionConditions를 매칭하여 표시
  const evolutionList = currentDigimonData.evolutions.map((evo, index) => {
    const targetId = evo.targetId || evo.targetName;
    const targetData = digimonDataMap[targetId];
    const targetName = targetData?.name || targetData?.id || targetId || "Unknown";

    // evolutionConditions에서 해당 진화 조건 찾기
    const conditionEntry = evoConditions.evolution[index] || evoConditions.evolution.find(
      (e) => e.next === targetId
    );

    // requirements 객체 생성 (evolutions 배열의 condition을 기반으로)
    const requirements = {
      timeToEvolveSeconds: currentDigimonData.evolutionCriteria?.timeToEvolveSeconds,
    };

    // condition 객체를 requirements로 변환
    if (evo.condition) {
      if (evo.condition.type === "mistakes") {
        if (Array.isArray(evo.condition.value)) {
          requirements.maxMistakes = evo.condition.value[1];
        } else {
          requirements.maxMistakes = evo.condition.value;
        }
      }
      if (evo.condition.trainings !== undefined) {
        if (Array.isArray(evo.condition.trainings)) {
          requirements.minTrainings = evo.condition.trainings[0];
          requirements.maxTrainings = evo.condition.trainings[1];
        } else {
          requirements.minTrainings = evo.condition.trainings;
        }
      }
      if (evo.condition.overfeeds !== undefined) {
        if (Array.isArray(evo.condition.overfeeds)) {
          requirements.minOverfeeds = evo.condition.overfeeds[0];
          requirements.maxOverfeeds = evo.condition.overfeeds[1];
        } else {
          requirements.minOverfeeds = evo.condition.overfeeds;
        }
      }
      if (evo.condition.sleepDisturbances !== undefined) {
        if (Array.isArray(evo.condition.sleepDisturbances)) {
          requirements.minSleepDisturbances = evo.condition.sleepDisturbances[0];
          requirements.maxSleepDisturbances = evo.condition.sleepDisturbances[1];
        } else {
          requirements.minSleepDisturbances = evo.condition.sleepDisturbances;
        }
      }
    }

    // checkEvolutionAvailability로 조건 체크
    const availability = checkEvolutionAvailability(currentStats, requirements);

    return {
      targetId,
      targetName,
      targetData,
      requirements,
      availability,
      condition: evo.condition,
    };
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
                    
                    return (
                      <div key={idx} className="flex items-center space-x-2">
                        <span className={`text-sm ${isMet ? "text-green-400" : isMissing ? "text-red-400" : "text-gray-300"}`}>
                          {condition}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-green-400 font-bold">✅ 모든 조건을 만족했습니다!</p>
                )}
              </div>

              {/* 조건 상세 정보 */}
              {evo.condition && (
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <p className="text-xs text-gray-400">
                    조건 타입: {evo.condition.type || "기본"}
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

