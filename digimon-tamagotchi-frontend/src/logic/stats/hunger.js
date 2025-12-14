// src/logic/stats/hunger.js
// Digital Monster Color 매뉴얼 기반 배고픔 관리 로직

/**
 * 고기 먹기 처리
 * 매뉴얼: "Giving this to a Digimon will add one heart to the hunger meter, and add one gigabyte to their weight."
 * 
 * @param {Object} stats - 현재 스탯
 * @returns {Object} 업데이트된 스탯
 */
export function feedMeat(stats) {
  const s = { ...stats };
  
  // 배고픔 하트 +1 (최대 5)
  s.hunger = Math.min(5, s.hunger + 1);
  
  // 체중 +1 Gigabyte
  s.weight = s.weight + 1;
  
  // 오버피드 체크: 배고픔이 가득 찬 상태에서 10개 더 먹으면 오버피드
  // TODO: 오버피드 로직 구현 필요
  
  return s;
}

/**
 * 오버피드 체크
 * 매뉴얼: "You can overfeed by feeding 10 more meat after having full hearts."
 * 
 * @param {Object} stats - 현재 스탯
 * @param {number} meatFed - 먹은 고기 개수
 * @returns {boolean} 오버피드 여부
 */
export function checkOverfeed(stats, meatFed) {
  // 배고픔이 가득 찬 상태(5)에서 10개 더 먹으면 오버피드
  if (stats.hunger >= 5 && meatFed >= 10) {
    return true;
  }
  return false;
}

/**
 * 배고픔 감소 처리
 * 매뉴얼: "As time proceeds, these hearts will empty at a set rate"
 * 
 * @param {Object} stats - 현재 스탯
 * @param {number} deltaSec - 경과 시간 (초)
 * @returns {Object} 업데이트된 스탯
 */
export function decreaseHunger(stats, deltaSec) {
  const s = { ...stats };
  
  if (s.hungerTimer > 0) {
    s.hungerCountdown -= deltaSec;
    if (s.hungerCountdown <= 0) {
      s.hunger = Math.max(0, s.hunger - 1);
      s.hungerCountdown = s.hungerTimer * 60;
      
      // 배고픔이 0이 되면 시간 기록
      if (s.hunger === 0 && !s.lastHungerZeroAt) {
        s.lastHungerZeroAt = Date.now();
      }
    }
  }
  
  return s;
}

