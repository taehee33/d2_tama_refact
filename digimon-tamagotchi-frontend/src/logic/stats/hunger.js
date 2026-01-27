// src/logic/stats/hunger.js
// Digital Monster Color 매뉴얼 기반 배고픔 관리 로직

/**
 * 시간 경과에 따른 배고픔 감소 처리
 * 매뉴얼: "As time proceeds, these hearts will empty at a set rate"
 * 
 * @param {Object} currentStats - 현재 스탯
 * @param {Object} digimonData - 디지몬 데이터 (hungerCycle 정보 포함)
 * @param {number} deltaSec - 경과 시간 (초)
 * @param {boolean} isSleeping - 수면 중 여부 (수면 중에는 타이머 감소하지 않음)
 * @returns {Object} 업데이트된 스탯
 */
export function handleHungerTick(currentStats, digimonData, deltaSec = 1, isSleeping = false) {
  if (currentStats.isDead) return currentStats;
  // 냉장고 상태에서는 모든 수치 고정 (시간 정지)
  if (currentStats.isFrozen) return currentStats;
  // 수면 중에는 타이머 감소하지 않음
  if (isSleeping) return currentStats;

  const s = { ...currentStats };
  
  // hungerTimer는 어댑터를 통해 hungerCycle로 변환됨
  const hungerCycle = s.hungerTimer || 0;
  
  if (hungerCycle > 0) {
    s.hungerCountdown = s.hungerCountdown || (hungerCycle * 60);
    s.hungerCountdown -= deltaSec;
    
    if (s.hungerCountdown <= 0) {
      // 정상적으로 배고픔 감소
      s.fullness = Math.max(0, s.fullness - 1);
      s.hungerCountdown = hungerCycle * 60;
      
      // 배고픔이 0이 되면 시간 기록
      if (s.fullness === 0 && !s.lastHungerZeroAt) {
        s.lastHungerZeroAt = Date.now();
      }
    }
  }
  
  return s;
}

/**
 * 고기 먹기 처리
 * 매뉴얼: "Giving this to a Digimon will add one heart to the hunger meter, and add one gigabyte to their weight."
 * "You can overfeed by feeding 10 more meat after having full hearts."
 * 
 * @param {Object} currentStats - 현재 스탯
 * @returns {Object} 업데이트된 스탯 및 결과 정보
 */
export function feedMeat(currentStats) {
  const s = { ...currentStats };
  
  const maxHunger = 5 + (s.maxOverfeed || 0);
  const wasFull = s.fullness >= 5;
  
  // 배고픔이 가득 찬 상태에서 10개 더 먹으면 오버피드
  if (wasFull) {
    // 오버피드 카운트 증가 (연속으로 먹은 고기 개수 추적)
    s.consecutiveMeatFed = (s.consecutiveMeatFed || 0) + 1;
    
    if (s.consecutiveMeatFed >= 10) {
      // 오버피드 발생
      s.overfeeds = (s.overfeeds || 0) + 1;
      s.consecutiveMeatFed = 0; // 리셋
    }
  } else {
    // 배고픔이 가득 차지 않았으면 연속 카운트 리셋
    s.consecutiveMeatFed = 0;
  }
  
  // 배고픔 하트 +1 (최대 maxHunger)
  if (s.fullness < maxHunger) {
    s.fullness++;
    s.weight++;
  }
  
  return {
    updatedStats: s,
    wasOverfed: s.overfeeds > (currentStats.overfeeds || 0),
    canEatMore: s.fullness < maxHunger,
  };
}

/**
 * 고기 거부 체크
 * 매뉴얼: "continuing to feed it until it refuses to will result in an Overfeed"
 * 
 * @param {Object} stats - 현재 스탯
 * @returns {boolean} 고기 거부 여부
 */
export function willRefuseMeat(stats) {
  const maxHunger = 5 + (stats.maxOverfeed || 0);
  return stats.fullness >= maxHunger;
}
