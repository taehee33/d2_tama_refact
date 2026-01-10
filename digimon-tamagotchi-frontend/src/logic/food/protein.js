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
  
  // 힘 하트 +1 (제한 없음)
  const oldStrength = s.strength || 0;
  s.strength = (s.strength || 0) + 1;
  
  // 체중 +2 Gigabyte
  s.weight = (s.weight || 0) + 2;
  
  // strength 값으로 Energy/Overdose 계산
  // strength ≤ 5: 4가 되면 energy만 +1 증가, proteinOverdose는 증가하지 않음
  // strength > 5: 9, 13, 17, 21, 25, 29, 33이 되면 energy +1, proteinOverdose +1 증가
  // maxEnergy가 0일 수도 있으므로 ?? (nullish coalescing) 사용
  const maxEnergy = s.maxEnergy ?? s.maxStamina ?? 0;
  const currentStrength = s.strength;
  
  if (currentStrength <= 5) {
    // strength가 4일 때만 energy +1
    if (currentStrength === 4) {
      s.energy = Math.min(maxEnergy, (s.energy || 0) + 1);
    }
  } else {
    // strength > 5: 9, 13, 17, 21, 25, 29, 33일 때 energy +1, proteinOverdose +1
    const overdoseTriggerPoints = [9, 13, 17, 21, 25, 29, 33];
    if (overdoseTriggerPoints.includes(currentStrength)) {
      s.energy = Math.min(maxEnergy, (s.energy || 0) + 1);
      s.proteinOverdose = Math.min(7, (s.proteinOverdose || 0) + 1); // 최대 7
    }
  }
  
  // energy 증가 여부 확인
  const energyRestored = (currentStrength <= 5 && currentStrength === 4) || 
                         (currentStrength > 5 && [9, 13, 17, 21, 25, 29, 33].includes(currentStrength));
  
  return {
    updatedStats: s,
    strengthIncreased: s.strength > oldStrength,
    energyRestored: energyRestored,
    proteinOverdoseIncreased: currentStrength > 5 && [9, 13, 17, 21, 25, 29, 33].includes(currentStrength),
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

