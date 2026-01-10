// src/logic/stats/strength.js
// Digital Monster Color 매뉴얼 기반 힘/훈련 관리 로직

/**
 * 시간 경과에 따른 힘 감소 처리
 * 매뉴얼: "As time proceeds, these hearts will empty at a set rate"
 * 
 * @param {Object} currentStats - 현재 스탯
 * @param {Object} digimonData - 디지몬 데이터 (strengthCycle 정보 포함)
 * @param {number} deltaSec - 경과 시간 (초)
 * @param {boolean} isSleeping - 수면 중 여부 (수면 중에는 타이머 감소하지 않음)
 * @returns {Object} 업데이트된 스탯
 */
export function handleStrengthTick(currentStats, digimonData, deltaSec = 1, isSleeping = false) {
  if (currentStats.isDead) return currentStats;
  // 수면 중에는 타이머 감소하지 않음
  if (isSleeping) return currentStats;

  const s = { ...currentStats };
  
  // strengthTimer는 어댑터를 통해 strengthCycle로 변환됨
  const strengthCycle = s.strengthTimer || 0;
  
  if (strengthCycle > 0) {
    s.strengthCountdown = s.strengthCountdown || (strengthCycle * 60);
    s.strengthCountdown -= deltaSec;
    
    if (s.strengthCountdown <= 0) {
      // strength -1 (최소 0)
      s.strength = Math.max(0, (s.strength || 0) - 1);
      s.strengthCountdown = strengthCycle * 60;
      
      // 힘이 0이 되면 시간 기록
      if (s.strength === 0 && !s.lastStrengthZeroAt) {
        s.lastStrengthZeroAt = Date.now();
      }
    }
  }
  
  return s;
}

// 프로틴 관련 함수는 logic/food/protein.js로 이동되었습니다.
// 이 파일에서는 handleStrengthTick만 제공합니다.

