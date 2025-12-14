// src/logic/stats/strength.js
// Digital Monster Color 매뉴얼 기반 힘/훈련 관리 로직

/**
 * 시간 경과에 따른 힘 감소 처리
 * 매뉴얼: "As time proceeds, these hearts will empty at a set rate"
 * 
 * @param {Object} currentStats - 현재 스탯
 * @param {Object} digimonData - 디지몬 데이터 (strengthCycle 정보 포함)
 * @param {number} deltaSec - 경과 시간 (초)
 * @returns {Object} 업데이트된 스탯
 */
export function handleStrengthTick(currentStats, digimonData, deltaSec = 1) {
  if (currentStats.isDead) return currentStats;

  const s = { ...currentStats };
  
  // strengthTimer는 어댑터를 통해 strengthCycle로 변환됨
  const strengthCycle = s.strengthTimer || 0;
  
  if (strengthCycle > 0) {
    s.strengthCountdown = s.strengthCountdown || (strengthCycle * 60);
    s.strengthCountdown -= deltaSec;
    
    if (s.strengthCountdown <= 0) {
      // 힘 감소
      s.health = Math.max(0, s.health - 1);
      s.strengthCountdown = strengthCycle * 60;
      
      // 힘이 0이 되면 시간 기록
      if (s.health === 0 && !s.lastStrengthZeroAt) {
        s.lastStrengthZeroAt = Date.now();
      }
    }
  }
  
  return s;
}

/**
 * 프로틴 먹기 처리
 * 매뉴얼: "Giving this to a Digimon will add one heart to the strength meter and two gigabytes to their weight."
 * "Every four Protein will increase your Energy and Protein Overdose by 1 each."
 * 
 * @param {Object} currentStats - 현재 스탯
 * @returns {Object} 업데이트된 스탯 및 결과 정보
 */
export function feedProtein(currentStats) {
  const s = { ...currentStats };
  
  // 힘 하트 +1 (최대 5)
  const oldHealth = s.health;
  if (s.health < 5) {
    s.health++;
  }
  
  // 체중 +2 Gigabyte
  s.weight += 2;
  
  // 프로틴 카운트 증가 (4개당 Energy +1, Protein Overdose +1)
  s.proteinCount = (s.proteinCount || 0) + 1;
  
  // 4개마다 Energy +1, Protein Overdose +1
  if (s.proteinCount % 4 === 0) {
    s.energy = Math.min(s.maxStamina || 100, (s.energy || 0) + 1);
    s.proteinOverdose = Math.min(7, (s.proteinOverdose || 0) + 1); // 최대 7
  }
  
  return {
    updatedStats: s,
    strengthIncreased: s.health > oldHealth,
    energyRestored: s.proteinCount % 4 === 0,
    proteinOverdoseIncreased: s.proteinCount % 4 === 0,
  };
}

/**
 * 프로틴 거부 체크
 * 
 * @param {Object} stats - 현재 스탯
 * @returns {boolean} 프로틴 거부 여부
 */
export function willRefuseProtein(stats) {
  // 힘이 가득 찬 상태에서 배고픔도 가득 찬 경우 거부
  return stats.health >= 5 && stats.fullness >= 5;
}

