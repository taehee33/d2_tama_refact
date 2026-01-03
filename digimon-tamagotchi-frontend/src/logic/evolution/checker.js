// src/logic/evolution/checker.js
// Digital Monster Color 매뉴얼 기반 진화 판정 로직 (Data-Driven Interpreter)

/**
 * 진화 판정 함수 (Data-Driven Interpreter)
 * digimons.js의 구조화된 진화 조건 데이터를 해석하여 진화 가능 여부를 판정합니다.
 * 
 * @param {Object} currentStats - 현재 디지몬 스탯
 * @param {Object} currentDigimonData - 현재 디지몬 데이터 (digimons.js의 항목)
 * @param {string} currentDigimonName - 현재 디지몬 이름
 * @param {Object} digimonDataMap - 전체 디지몬 데이터 맵 (targetName 찾기용, optional)
 * @returns {Object} 진화 결과 객체
 *   - success: true/false
 *   - reason: "NOT_READY" | "CONDITIONS_UNMET" | "SUCCESS"
 *   - targetId: 진화 대상 ID (성공 시)
 *   - remainingTime: 남은 시간 초 (NOT_READY 시)
 *   - details: 조건 불만족 상세 정보 배열 (CONDITIONS_UNMET 시)
 */
export function checkEvolution(currentStats, currentDigimonData, currentDigimonName, digimonDataMap = {}) {
  // 디버깅: 데이터 확인
  if (process.env.NODE_ENV === 'development') {
    console.log('[checkEvolution] currentDigimonName:', currentDigimonName);
    console.log('[checkEvolution] currentDigimonData:', currentDigimonData);
    console.log('[checkEvolution] evolutionCriteria:', currentDigimonData?.evolutionCriteria);
  }
  
  if (!currentDigimonData) {
    return {
      success: false,
      reason: "CONDITIONS_UNMET",
      details: [{ target: "N/A", missing: `디지몬 데이터를 찾을 수 없습니다. (${currentDigimonName})` }],
    };
  }
  
  if (!currentDigimonData.evolutionCriteria) {
    return {
      success: false,
      reason: "CONDITIONS_UNMET",
      details: [{ target: "N/A", missing: `진화 조건이 정의되지 않았습니다. (${currentDigimonName})` }],
    };
  }

  const criteria = currentDigimonData.evolutionCriteria;

  // 1단계: 시간 체크
  if (criteria.timeToEvolveSeconds !== undefined) {
    if (currentStats.timeToEvolveSeconds > 0) {
      const remainingSeconds = currentStats.timeToEvolveSeconds;
      return {
        success: false,
        reason: "NOT_READY",
        remainingTime: remainingSeconds,
      };
    }
  }

  // 2단계: 진화 후보 분석 (digimons.js의 evolutions 배열 사용)
  if (!currentDigimonData.evolutions || currentDigimonData.evolutions.length === 0) {
    return {
      success: false,
      reason: "CONDITIONS_UNMET",
      details: [{ target: "N/A", missing: "진화 가능한 형태가 없습니다." }],
    };
  }

  // 각 진화 후보별로 조건 체크 및 실패 사유 분석
  const details = [];
  let successTarget = null;

  for (const evolutionOption of currentDigimonData.evolutions) {
    const targetId = evolutionOption.targetId || evolutionOption.targetName;
    const targetData = digimonDataMap[targetId];
    const targetName = targetData?.name || targetData?.id || targetId || "Unknown Digimon";
    
    const missingConditions = [];
    let isMatch = false;

    // Case 1: 단일 조건 그룹 (conditions) - AND Logic
    if (evolutionOption.conditions) {
      isMatch = checkConditions(evolutionOption.conditions, currentStats, missingConditions);
      
      // 디버그 로그 (개발 환경에서만)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[checkEvolution] ${targetName} 체크:`, {
          conditions: evolutionOption.conditions,
          currentStats: {
            careMistakes: currentStats.careMistakes,
            trainings: currentStats.trainings,
            overfeeds: currentStats.overfeeds,
          },
          isMatch,
          missingConditions,
        });
      }
    }
    // Case 2: 다중 조건 그룹 (conditionGroups) - OR Logic
    else if (evolutionOption.conditionGroups && Array.isArray(evolutionOption.conditionGroups)) {
      // 배열 내 조건 중 하나라도 만족하면 통과
      for (let i = 0; i < evolutionOption.conditionGroups.length; i++) {
        const groupMissing = [];
        if (checkConditions(evolutionOption.conditionGroups[i], currentStats, groupMissing)) {
          isMatch = true;
          break; // 하나라도 만족하면 통과
        } else {
          // 모든 그룹의 조건을 수집 (첫 번째 그룹만 상세 표시)
          if (i === 0) {
            missingConditions.push(...groupMissing);
          }
        }
      }
    }
    // Case 3: 조그레스 (jogress)
    else if (evolutionOption.jogress) {
      // 조그레스는 별도 로직 필요 (현재는 스킵)
      continue;
    }
    // Case 4: 조건이 없는 경우 (시간 조건만 있거나 자동 진화)
    // 예: Digitama -> Botamon (8초 후 자동 진화)
    else {
      // conditions, conditionGroups, jogress가 모두 없으면
      // 시간 조건만 만족하면 자동으로 진화 가능
      isMatch = true;
    }

    if (isMatch) {
      // 조건을 만족하는 첫 번째 진화 대상
      if (!successTarget) {
        successTarget = targetId;
      }
    } else {
      // 실패한 조건이 있으면 details에 추가
      if (missingConditions.length > 0) {
        details.push({
          target: targetName,
          missing: missingConditions.join(", "),
        });
      }
    }
  }

  // 3단계: 결과 반환
  if (successTarget) {
    return {
      success: true,
      reason: "SUCCESS",
      targetId: successTarget,
    };
  } else {
    return {
      success: false,
      reason: "CONDITIONS_UNMET",
      details: details.length > 0 ? details : [{ target: "N/A", missing: "진화 조건을 만족하지 못했습니다." }],
    };
  }
}

/**
 * 조건 체크 헬퍼 함수
 * @param {Object} conditions - 조건 객체 { careMistakes: { min: 4 }, trainings: { min: 5, max: 15 }, ... }
 * @param {Object} stats - 현재 스탯
 * @param {Array} missingConditions - 누락된 조건을 추가할 배열
 * @returns {boolean} 조건 만족 여부
 */
function checkConditions(conditions, stats, missingConditions) {
  let allMet = true;

  // careMistakes 체크
  if (conditions.careMistakes) {
    const val = stats.careMistakes || 0;
    if (conditions.careMistakes.min !== undefined && val < conditions.careMistakes.min) {
      missingConditions.push(`케어 미스 (현재: ${val}, 필요: >= ${conditions.careMistakes.min})`);
      allMet = false;
    }
    if (conditions.careMistakes.max !== undefined && val > conditions.careMistakes.max) {
      missingConditions.push(`케어 미스 (현재: ${val}, 필요: <= ${conditions.careMistakes.max})`);
      allMet = false;
    }
  }

  // trainings 체크
  if (conditions.trainings !== undefined) {
    const val = stats.trainings || 0;
    if (conditions.trainings.min !== undefined && val < conditions.trainings.min) {
      missingConditions.push(`훈련 (현재: ${val}, 필요: >= ${conditions.trainings.min})`);
      allMet = false;
    }
    if (conditions.trainings.max !== undefined && val > conditions.trainings.max) {
      missingConditions.push(`훈련 (현재: ${val}, 필요: <= ${conditions.trainings.max})`);
      allMet = false;
    }
  }

  // overfeeds 체크
  if (conditions.overfeeds !== undefined) {
    const val = stats.overfeeds || 0;
    if (conditions.overfeeds.min !== undefined && val < conditions.overfeeds.min) {
      missingConditions.push(`오버피드 (현재: ${val}, 필요: >= ${conditions.overfeeds.min})`);
      allMet = false;
    }
    if (conditions.overfeeds.max !== undefined && val > conditions.overfeeds.max) {
      missingConditions.push(`오버피드 (현재: ${val}, 필요: <= ${conditions.overfeeds.max})`);
      allMet = false;
    }
  }

  // sleepDisturbances 체크
  if (conditions.sleepDisturbances !== undefined) {
    const val = stats.sleepDisturbances || 0;
    if (conditions.sleepDisturbances.min !== undefined && val < conditions.sleepDisturbances.min) {
      missingConditions.push(`수면 방해 (현재: ${val}, 필요: >= ${conditions.sleepDisturbances.min})`);
      allMet = false;
    }
    if (conditions.sleepDisturbances.max !== undefined && val > conditions.sleepDisturbances.max) {
      missingConditions.push(`수면 방해 (현재: ${val}, 필요: <= ${conditions.sleepDisturbances.max})`);
      allMet = false;
    }
  }

  // battles 체크 (현재 디지몬 값만 사용)
  if (conditions.battles !== undefined) {
    const currentBattles = (stats.battlesWon || 0) + (stats.battlesLost || 0);
    if (conditions.battles.min !== undefined && currentBattles < conditions.battles.min) {
      missingConditions.push(`배틀 (현재: ${currentBattles}, 필요: >= ${conditions.battles.min})`);
      allMet = false;
    }
    if (conditions.battles.max !== undefined && currentBattles > conditions.battles.max) {
      missingConditions.push(`배틀 (현재: ${currentBattles}, 필요: <= ${conditions.battles.max})`);
      allMet = false;
    }
  }

  // winRatio 체크 (현재 디지몬 값만 사용)
  if (conditions.winRatio !== undefined) {
    const currentBattles = (stats.battlesWon || 0) + (stats.battlesLost || 0);
    if (currentBattles === 0) {
      missingConditions.push(`승률 (배틀을 하지 않았습니다)`);
      allMet = false;
    } else {
      const winRatio = ((stats.battlesWon || 0) / currentBattles) * 100;
      if (conditions.winRatio.min !== undefined && winRatio < conditions.winRatio.min) {
        missingConditions.push(`승률 (현재: ${winRatio.toFixed(1)}%, 필요: >= ${conditions.winRatio.min}%)`);
        allMet = false;
      }
      if (conditions.winRatio.max !== undefined && winRatio > conditions.winRatio.max) {
        missingConditions.push(`승률 (현재: ${winRatio.toFixed(1)}%, 필요: <= ${conditions.winRatio.max}%)`);
        allMet = false;
      }
    }
  }

  // weight 체크
  if (conditions.weight !== undefined) {
    const val = stats.weight || 0;
    if (conditions.weight.min !== undefined && val < conditions.weight.min) {
      missingConditions.push(`체중 (현재: ${val}, 필요: >= ${conditions.weight.min})`);
      allMet = false;
    }
    if (conditions.weight.max !== undefined && val > conditions.weight.max) {
      missingConditions.push(`체중 (현재: ${val}, 필요: <= ${conditions.weight.max})`);
      allMet = false;
    }
  }

  // strength 체크
  if (conditions.strength !== undefined) {
    const val = stats.strength || 0;
    if (conditions.strength.min !== undefined && val < conditions.strength.min) {
      missingConditions.push(`힘 (현재: ${val}, 필요: >= ${conditions.strength.min})`);
      allMet = false;
    }
    if (conditions.strength.max !== undefined && val > conditions.strength.max) {
      missingConditions.push(`힘 (현재: ${val}, 필요: <= ${conditions.strength.max})`);
      allMet = false;
    }
  }

  // power 체크
  if (conditions.power !== undefined) {
    const val = stats.power || stats.basePower || 0;
    if (conditions.power.min !== undefined && val < conditions.power.min) {
      missingConditions.push(`파워 (현재: ${val}, 필요: >= ${conditions.power.min})`);
      allMet = false;
    }
    if (conditions.power.max !== undefined && val > conditions.power.max) {
      missingConditions.push(`파워 (현재: ${val}, 필요: <= ${conditions.power.max})`);
      allMet = false;
    }
  }

  return allMet;
}

/**
 * 진화 대상 찾기 (레거시 호환성 유지)
 * @deprecated 이 함수는 레거시 코드와의 호환성을 위해 유지됩니다.
 * 새로운 코드는 checkEvolution을 직접 사용하세요.
 * 
 * @param {string} currentDigimonName - 현재 디지몬 이름
 * @param {Object} currentStats - 현재 스탯
 * @param {Object} digimonDataMap - 전체 디지몬 데이터 맵
 * @returns {string|null} 진화 대상 디지몬 이름 또는 null
 */
export function findEvolutionTarget(currentDigimonName, currentStats, digimonDataMap = {}) {
  const currentDigimonData = digimonDataMap[currentDigimonName];
  if (!currentDigimonData) {
    return null;
  }

  const result = checkEvolution(currentStats, currentDigimonData, currentDigimonName, digimonDataMap);
  return result.success ? result.targetId : null;
}
