// src/logic/food/protein.js
// Digital Monster Color 매뉴얼 기반 프로틴 먹이기 로직

/**
 * 프로틴 먹이기 처리
 * 매뉴얼: "Giving this to a Digimon will add one heart to the strength meter and two gigabytes to their weight."
 * "Every four Protein will increase your Energy and Protein Overdose by 1 each."
 * 
 * @param {Object} stats - 현재 스탯
 * @returns {Object} 업데이트된 스탯 및 결과
 */
export function feedProtein(stats) {
  const s = { ...stats };
  
  // 힘 하트 +1 (최대 5)
  const oldStrength = s.strength;
  s.strength = Math.min(5, s.strength + 1);
  
  // 체중 +2 Gigabyte
  s.weight = s.weight + 2;
  
  // 프로틴 카운트 증가 (4개당 Energy +1, Protein Overdose +1)
  const proteinCount = (s.proteinCount || 0) + 1;
  s.proteinCount = proteinCount;
  
  // 4개마다 Energy +1, Protein Overdose +1
  if (proteinCount % 4 === 0) {
    s.energy = Math.min(s.maxEnergy || 100, s.energy + 1);
    s.proteinOverdose = Math.min(7, (s.proteinOverdose || 0) + 1); // 최대 7
  }
  
  return {
    updatedStats: s,
    strengthIncreased: s.strength > oldStrength,
    energyRestored: proteinCount % 4 === 0,
    proteinOverdoseIncreased: proteinCount % 4 === 0,
  };
}

/**
 * 프로틴 거부 체크
 * 
 * @param {Object} stats - 현재 스탯
 * @returns {boolean} 프로틴 거부 여부
 */
export function willRefuseProtein(stats) {
  // 힘이 가득 찬 상태에서 건강도 가득 찬 경우 거부
  return stats.strength >= 5 && stats.health >= 5;
}

