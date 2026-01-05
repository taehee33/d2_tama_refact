// src/logic/evolution/index.js
// 진화 관련 로직 통합 export

export { checkEvolution, findEvolutionTarget } from './checker';

// TODO: 진화 조건 체크 로직 추가 예정
export function checkEvolutionConditions(stats, digimonData, evolutionCriteria) {
  // 매뉴얼 기반 진화 조건 체크
  // - mistakes (min/max)
  // - trainings (min/max)
  // - overfeeds (min/max)
  // - battles (min)
  // - winRatio (min %)
  // - minWeight
  // - minStrength
  // - minEffort
  // - requiredType
  
  if (!evolutionCriteria) {
    return false;
  }
  
  // 시간 조건
  if (evolutionCriteria.timeToEvolveSeconds !== undefined) {
    if (stats.timeToEvolveSeconds > 0) {
      return false;
    }
  }
  
  // 실수 조건
  if (evolutionCriteria.mistakes) {
    if (evolutionCriteria.mistakes.min !== undefined && stats.careMistakes < evolutionCriteria.mistakes.min) {
      return false;
    }
    if (evolutionCriteria.mistakes.max !== undefined && stats.careMistakes > evolutionCriteria.mistakes.max) {
      return false;
    }
  }
  
  // 훈련 조건
  if (evolutionCriteria.trainings !== undefined && stats.trainings < evolutionCriteria.trainings) {
    return false;
  }
  
  // 오버피드 조건 (min/max 모두 체크)
  if (evolutionCriteria.overfeeds !== undefined) {
    const overfeeds = stats.overfeeds || 0;
    if (evolutionCriteria.overfeeds.min !== undefined && overfeeds < evolutionCriteria.overfeeds.min) {
      return false;
    }
    if (evolutionCriteria.overfeeds.max !== undefined && overfeeds > evolutionCriteria.overfeeds.max) {
      return false;
    }
  }
  
  // 배틀 조건 (현재 디지몬 값만 사용)
  if (evolutionCriteria.battles !== undefined) {
    const currentBattles = (stats.battlesWon || 0) + (stats.battlesLost || 0);
    if (currentBattles < evolutionCriteria.battles) {
      return false;
    }
  }
  
  // 승률 조건 (현재 디지몬 값만 사용)
  if (evolutionCriteria.winRatio !== undefined) {
    const currentBattles = (stats.battlesWon || 0) + (stats.battlesLost || 0);
    if (currentBattles === 0) {
      return false;
    }
    const winRatio = ((stats.battlesWon || 0) / currentBattles) * 100;
    if (winRatio < evolutionCriteria.winRatio) {
      return false;
    }
  }
  
  // 체중 조건
  if (evolutionCriteria.minWeight !== undefined && stats.weight < evolutionCriteria.minWeight) {
    return false;
  }
  
  // 힘 조건
  if (evolutionCriteria.minStrength !== undefined && stats.strength < evolutionCriteria.minStrength) {
    return false;
  }
  
  // 노력치 조건
  if (evolutionCriteria.minEffort !== undefined && stats.effort < evolutionCriteria.minEffort) {
    return false;
  }
  
  // 속성 조건
  if (evolutionCriteria.requiredType && stats.type !== evolutionCriteria.requiredType) {
    return false;
  }
  
  return true;
}

