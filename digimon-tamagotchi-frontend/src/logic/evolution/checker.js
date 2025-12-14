// src/logic/evolution/checker.js
// Digital Monster Color 매뉴얼 기반 진화 판정 로직

/**
 * 진화 판정 함수
 * 매뉴얼 규칙에 따라 현재 스탯과 디지몬 데이터를 기반으로 진화 가능 여부를 판정하고 상세 결과를 반환합니다.
 * 
 * @param {Object} currentStats - 현재 디지몬 스탯
 * @param {Object} currentDigimonData - 현재 디지몬 데이터 (digimons.js의 항목)
 * @param {Object} evolutionConditions - 진화 조건 맵 (evolutionConditionsVer1)
 * @param {string} currentDigimonName - 현재 디지몬 이름
 * @param {Object} digimonDataMap - 전체 디지몬 데이터 맵 (targetName 찾기용, optional)
 * @returns {Object} 진화 결과 객체
 *   - success: true/false
 *   - reason: "NOT_READY" | "CONDITIONS_UNMET" | "SUCCESS"
 *   - targetId: 진화 대상 ID (성공 시)
 *   - remainingTime: 남은 시간 초 (NOT_READY 시)
 *   - details: 조건 불만족 상세 정보 배열 (CONDITIONS_UNMET 시)
 */
export function checkEvolution(currentStats, currentDigimonData, evolutionConditions, currentDigimonName, digimonDataMap = {}) {
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

  // 2단계: 조건 매칭 및 진화 후보 분석
  if (!evolutionConditions || !evolutionConditions[currentDigimonName]) {
    return {
      success: false,
      reason: "CONDITIONS_UNMET",
      details: [{ target: "N/A", missing: "진화 조건 데이터가 없습니다." }],
    };
  }

  const evo = evolutionConditions[currentDigimonName];
  if (!evo || !evo.evolution || evo.evolution.length === 0) {
    return {
      success: false,
      reason: "CONDITIONS_UNMET",
      details: [{ target: "N/A", missing: "진화 가능한 형태가 없습니다." }],
    };
  }

  // 각 진화 후보별로 조건 체크 및 실패 사유 분석
  const details = [];
  let successTarget = null;

  for (const evolutionOption of evo.evolution) {
    // targetName 가져오기 (예외 처리)
    let targetName = evolutionOption.next;
    if (!targetName) {
      // evolutionOption에 next가 없으면 targetId나 targetName 사용
      targetName = evolutionOption.targetId || evolutionOption.targetName || "Unknown Digimon";
    }
    
    // 데이터 파일에서 이름 확인 (Fallback 처리)
    // 먼저 digimonDataMap에서 찾기
    if (digimonDataMap[targetName]) {
      targetName = digimonDataMap[targetName].name || digimonDataMap[targetName].id || targetName;
    } else {
      // 찾을 수 없으면 ID 기반으로 표시
      targetName = `Unknown Digimon (ID: ${targetName})`;
    }
    
    const missingConditions = [];

    // 각 조건별로 체크
    if (criteria.mistakes) {
      if (criteria.mistakes.min !== undefined && currentStats.careMistakes < criteria.mistakes.min) {
        missingConditions.push(`실수 (현재: ${currentStats.careMistakes}, 필요: 최소 ${criteria.mistakes.min})`);
      }
      if (criteria.mistakes.max !== undefined && currentStats.careMistakes > criteria.mistakes.max) {
        missingConditions.push(`실수 (현재: ${currentStats.careMistakes}, 필요: 최대 ${criteria.mistakes.max})`);
      }
    }

    if (criteria.overfeeds !== undefined) {
      if (typeof criteria.overfeeds === 'number') {
        if (currentStats.overfeeds > criteria.overfeeds) {
          missingConditions.push(`오버피드 (현재: ${currentStats.overfeeds}, 필요: 최대 ${criteria.overfeeds})`);
        }
      } else if (Array.isArray(criteria.overfeeds)) {
        const [min, max] = criteria.overfeeds;
        if (min !== undefined && currentStats.overfeeds < min) {
          missingConditions.push(`오버피드 (현재: ${currentStats.overfeeds}, 필요: 최소 ${min})`);
        }
        if (max !== undefined && currentStats.overfeeds > max) {
          missingConditions.push(`오버피드 (현재: ${currentStats.overfeeds}, 필요: 최대 ${max})`);
        }
      }
    }

    if (criteria.battles !== undefined) {
      const totalBattles = (currentStats.battlesWon || 0) + (currentStats.battlesLost || 0);
      if (totalBattles < criteria.battles) {
        missingConditions.push(`배틀 (현재: ${totalBattles}, 필요: ${criteria.battles})`);
      }
    }

    if (criteria.winRatio !== undefined) {
      const totalBattles = (currentStats.battlesWon || 0) + (currentStats.battlesLost || 0);
      if (totalBattles === 0) {
        missingConditions.push(`승률 (배틀을 하지 않았습니다)`);
      } else {
        const winRatio = ((currentStats.battlesWon || 0) / totalBattles) * 100;
        if (winRatio < criteria.winRatio) {
          missingConditions.push(`승률 (현재: ${winRatio.toFixed(1)}%, 필요: ${criteria.winRatio}%)`);
        }
      }
    }

    if (criteria.trainings !== undefined) {
      if ((currentStats.trainings || 0) < criteria.trainings) {
        missingConditions.push(`훈련 (현재: ${currentStats.trainings || 0}, 필요: ${criteria.trainings})`);
      }
    }

    if (criteria.minWeight !== undefined) {
      if ((currentStats.weight || 0) < criteria.minWeight) {
        missingConditions.push(`체중 (현재: ${currentStats.weight || 0}, 필요: ${criteria.minWeight})`);
      }
    }

    if (criteria.minStrength !== undefined) {
      if ((currentStats.strength || 0) < criteria.minStrength) {
        missingConditions.push(`힘 (현재: ${currentStats.strength || 0}, 필요: ${criteria.minStrength})`);
      }
    }

    if (criteria.minEffort !== undefined) {
      if ((currentStats.effort || 0) < criteria.minEffort) {
        missingConditions.push(`노력치 (현재: ${currentStats.effort || 0}, 필요: ${criteria.minEffort})`);
      }
    }

    if (criteria.requiredType && currentStats.type !== criteria.requiredType) {
      missingConditions.push(`속성 (현재: ${currentStats.type || "없음"}, 필요: ${criteria.requiredType})`);
    }

    // evolutionConditionsVer1의 condition.check도 확인
    if (evolutionOption.condition && evolutionOption.condition.check) {
      const testStats = { ...currentStats };
      if (evolutionOption.condition.check(testStats)) {
        // 조건을 만족하는 첫 번째 진화 대상
        if (!successTarget) {
          successTarget = targetName;
        }
      } else {
        // condition.check가 실패했지만, 구체적인 사유는 알 수 없음
        if (missingConditions.length === 0) {
          missingConditions.push("진화 조건을 만족하지 못했습니다.");
        }
      }
    }

    // 실패한 조건이 있으면 details에 추가
    if (missingConditions.length > 0) {
      details.push({
        target: targetName,
        missing: missingConditions.join(", "),
      });
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
 * 진화 대상 찾기
 * evolutionConditionsVer1을 기반으로 진화 대상을 찾습니다.
 * 
 * @param {string} currentDigimonName - 현재 디지몬 이름
 * @param {Object} currentStats - 현재 스탯
 * @param {Object} evolutionConditions - 진화 조건 맵 (evolutionConditionsVer1)
 * @returns {string|null} 진화 대상 디지몬 이름 또는 null
 */
export function findEvolutionTarget(currentDigimonName, currentStats, evolutionConditions) {
  if (!evolutionConditions || !evolutionConditions[currentDigimonName]) {
    return null;
  }

  const evo = evolutionConditions[currentDigimonName];
  if (!evo || !evo.evolution || evo.evolution.length === 0) {
    return null;
  }

  // 조건을 만족하는 첫 번째 진화 대상을 반환
  for (const evolutionOption of evo.evolution) {
    if (evolutionOption.condition && evolutionOption.condition.check) {
      const testStats = { ...currentStats };
      if (evolutionOption.condition.check(testStats)) {
        return evolutionOption.next;
      }
    }
  }

  return null;
}
