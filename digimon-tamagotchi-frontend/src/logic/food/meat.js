// src/logic/food/meat.js
// Digital Monster Color 매뉴얼 기반 고기 먹이기 로직

/**
 * 고기 먹이기 처리
 * 매뉴얼: "Giving this to a Digimon will add one heart to the hunger meter, and add one gigabyte to their weight."
 * 
 * @param {Object} stats - 현재 스탯
 * @returns {Object} 업데이트된 스탯 및 결과
 */
export function feedMeat(stats) {
  const s = { ...stats };
  
  // 배고픔 하트 +1 (최대 5)
  const oldHunger = s.hunger;
  s.hunger = Math.min(5, s.hunger + 1);
  
  // 체중 +1 Gigabyte
  s.weight = s.weight + 1;
  
  // 오버피드 체크: 배고픔이 가득 찬 상태에서 10개 더 먹으면 오버피드
  // TODO: 연속으로 먹은 고기 개수 추적 필요
  
  return {
    updatedStats: s,
    hungerIncreased: s.hunger > oldHunger,
    canEatMore: s.hunger < 5 + (s.maxOverfeed || 0), // 오버피드 허용치까지
  };
}

/**
 * 오버피드 체크
 * 매뉴얼: "You can overfeed by feeding 10 more meat after having full hearts."
 * "Overfeeding will give you one extra Hunger Loss cycle before one of your hearts drop."
 * 
 * @param {Object} stats - 현재 스탯
 * @param {number} consecutiveMeatFed - 연속으로 먹은 고기 개수
 * @returns {boolean} 오버피드 여부
 */
export function checkOverfeed(stats, consecutiveMeatFed) {
  // 배고픔이 가득 찬 상태(5)에서 10개 더 먹으면 오버피드
  if (stats.hunger >= 5 && consecutiveMeatFed >= 10) {
    return true;
  }
  return false;
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
  return stats.hunger >= maxHunger;
}

