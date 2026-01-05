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
  
  // 배고픔 하트 +1 (최대 5 + 오버피드 허용치)
  const maxFullness = 5 + (s.maxOverfeed || 0);
  const oldFullness = s.fullness || 0;
  
  // 고기를 먹기 전 거절 여부 체크
  const wasRefusingBefore = oldFullness >= maxFullness;
  
  // 오버피드 체크: 거절 상태에서 고기를 주면 오버피드 발생 (고기는 안 먹음)
  let isOverfeed = false;
  if (wasRefusingBefore) {
    // 이미 거절 상태인데 고기를 주면 오버피드만 발생, 고기는 안 먹음
    s.overfeeds = (s.overfeeds || 0) + 1;
    isOverfeed = true;
    // fullness와 weight는 증가하지 않음
  } else {
    // 거절 상태가 아니면 정상적으로 먹음
    if (s.fullness < maxFullness) {
      s.fullness = (s.fullness || 0) + 1;
    }
    // 체중 +1 Gigabyte
    s.weight = (s.weight || 0) + 1;
  }
  
  return {
    updatedStats: s,
    fullnessIncreased: s.fullness > oldFullness,
    canEatMore: s.fullness < maxFullness,
    isOverfeed: isOverfeed,
  };
}

/**
 * 오버피드 체크 (deprecated - feedMeat에서 직접 처리)
 * 매뉴얼: "continuing to feed it until it refuses to will result in an Overfeed"
 * 
 * @param {Object} stats - 현재 스탯
 * @returns {boolean} 오버피드 여부 (거절 상태면 오버피드 가능)
 */
export function checkOverfeed(stats) {
  // 거절 상태면 오버피드 가능
  return willRefuseMeat(stats);
}

/**
 * 고기 거부 체크
 * 매뉴얼: "continuing to feed it until it refuses to will result in an Overfeed"
 * 
 * @param {Object} stats - 현재 스탯
 * @returns {boolean} 고기 거부 여부
 */
export function willRefuseMeat(stats) {
  const maxFullness = 5 + (stats.maxOverfeed || 0);
  return (stats.fullness || 0) >= maxFullness;
}

