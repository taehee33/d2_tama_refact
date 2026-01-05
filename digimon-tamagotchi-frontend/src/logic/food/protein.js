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
  const oldStrength = s.strength || 0;
  const currentStrength = s.strength || 0;
  // Strength가 5 미만일 때만 증가 (최대 5)
  if (currentStrength < 5) {
    s.strength = currentStrength + 1;
  }
  
  // 체중 +2 Gigabyte
  s.weight = (s.weight || 0) + 2;
  
  // 프로틴 카운트 증가 (4개당 Energy +1, Protein Overdose +1)
  const proteinCount = (s.proteinCount || 0) + 1;
  s.proteinCount = proteinCount;
  
  // 4개마다 Energy +1, Protein Overdose +1 (메뉴얼: "Every four Protein will increase your Energy and Protein Overdose by 1 each.")
  if (proteinCount % 4 === 0) {
    const maxEnergy = s.maxEnergy || s.maxStamina || 100;
    s.energy = Math.min(maxEnergy, (s.energy || 0) + 1);
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
  // strength가 5여도 단백질을 먹을 수 있음 (energy와 proteinOverdose를 위해)
  // proteinOverdose가 최대치(7)에 도달했을 때만 거부
  const proteinOverdose = stats.proteinOverdose || 0;
  return proteinOverdose >= 7;
}

