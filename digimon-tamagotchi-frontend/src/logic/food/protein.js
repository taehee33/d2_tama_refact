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
  
  // 프로틴 카운트 증가
  const proteinCount = (s.proteinCount || 0) + 1;
  s.proteinCount = proteinCount;
  
  // proteinCount ≤ 5: 4가 되면 energy만 +1 증가, proteinOverdose는 증가하지 않음
  // proteinCount > 5: 9, 13, 17, 21, 25, 29, 33이 되면 energy +1, proteinOverdose +1 증가
  const maxEnergy = s.maxEnergy || s.maxStamina || 100;
  
  if (proteinCount <= 5) {
    // proteinCount가 4일 때만 energy +1
    if (proteinCount === 4) {
      s.energy = Math.min(maxEnergy, (s.energy || 0) + 1);
    }
  } else {
    // proteinCount > 5: 9, 13, 17, 21, 25, 29, 33일 때 energy +1, proteinOverdose +1
    const overdoseTriggerPoints = [9, 13, 17, 21, 25, 29, 33];
    if (overdoseTriggerPoints.includes(proteinCount)) {
      s.energy = Math.min(maxEnergy, (s.energy || 0) + 1);
      s.proteinOverdose = Math.min(7, (s.proteinOverdose || 0) + 1); // 최대 7
    }
  }
  
  // energy 증가 여부 확인
  const energyRestored = (proteinCount <= 5 && proteinCount === 4) || 
                         (proteinCount > 5 && [9, 13, 17, 21, 25, 29, 33].includes(proteinCount));
  
  return {
    updatedStats: s,
    strengthIncreased: s.strength > oldStrength,
    energyRestored: energyRestored,
    proteinOverdoseIncreased: proteinCount > 5 && [9, 13, 17, 21, 25, 29, 33].includes(proteinCount),
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

