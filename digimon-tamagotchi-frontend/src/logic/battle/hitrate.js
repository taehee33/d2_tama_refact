// src/logic/battle/hitrate.js
// Digital Monster Color 매뉴얼 기반 배틀 히트레이트 계산 로직

/**
 * 히트레이트 계산
 * 매뉴얼: hitrate = ((playerPower * 100)/(playerPower + opponentPower)) + attributeAdvantage
 * 
 * @param {Object} playerStats - 플레이어 디지몬 스탯
 * @param {Object} opponentStats - 상대 디지몬 스탯
 * @returns {number} 히트레이트 (0-100)
 */
export function calculateHitrate(playerStats, opponentStats) {
  const playerPower = playerStats.power || 0;
  const opponentPower = opponentStats.power || 0;
  
  // 기본 히트레이트 계산
  const baseHitrate = (playerPower * 100) / (playerPower + opponentPower);
  
  // 속성 상성 보너스
  const attributeAdvantage = getAttributeAdvantage(
    playerStats.type,
    opponentStats.type
  );
  
  const hitrate = baseHitrate + attributeAdvantage;
  
  // 0-100 범위로 제한
  return Math.max(0, Math.min(100, hitrate));
}

/**
 * 속성 상성 계산
 * 매뉴얼:
 * - Vaccine is strong against Virus (+5%)
 * - Virus is strong against Data (+5%)
 * - Data is strong against Vaccine (+5%)
 * - Free has no strength or weakness (0%)
 * 
 * @param {string|null} playerType - 플레이어 속성
 * @param {string|null} opponentType - 상대 속성
 * @returns {number} 속성 보너스 (-5, 0, 또는 +5)
 */
export function getAttributeAdvantage(playerType, opponentType) {
  if (!playerType || !opponentType || playerType === "Free" || opponentType === "Free") {
    return 0;
  }
  
  // Vaccine > Virus
  if (playerType === "Vaccine" && opponentType === "Virus") {
    return 5;
  }
  
  // Virus > Data
  if (playerType === "Virus" && opponentType === "Data") {
    return 5;
  }
  
  // Data > Vaccine
  if (playerType === "Data" && opponentType === "Vaccine") {
    return 5;
  }
  
  // 역방향은 불리함
  if (
    (playerType === "Virus" && opponentType === "Vaccine") ||
    (playerType === "Data" && opponentType === "Virus") ||
    (playerType === "Vaccine" && opponentType === "Data")
  ) {
    return -5;
  }
  
  return 0;
}

/**
 * 파워 계산 (Base Power + 보너스)
 * 매뉴얼: Base Power + Strength Hearts 보너스 + Traited Egg 보너스 + Effort 보너스
 * 
 * @param {Object} stats - 디지몬 스탯
 * @param {Object} digimonData - 디지몬 데이터
 * @param {boolean} returnDetails - 상세 정보 반환 여부
 * @returns {number|Object} 최종 파워 또는 { power, details }
 */
export function calculatePower(stats, digimonData, returnDetails = false) {
  const basePower = digimonData?.stats?.basePower ?? 0;
  let power = basePower;
  
  const details = {
    basePower,
    strengthBonus: 0,
    traitedEggBonus: 0,
    effortBonus: 0,
  };
  
  if (!digimonData?.stats) {
    return returnDetails ? { power: 0, details } : 0;
  }
  
  // Strength Hearts 보너스 (가득 찬 경우)
  // strength >= 6이면 5로 계산
  const effectiveStrength = Math.min(5, stats.strength || 0);
  if (effectiveStrength >= 5) {
    const stage = digimonData?.stage;
    let strengthBonus = 0;
    if (stage === "Child") strengthBonus = 5;
    else if (stage === "Adult") strengthBonus = 8;
    else if (stage === "Perfect") strengthBonus = 15;
    else if (stage === "Ultimate" || stage === "Super Ultimate") strengthBonus = 25;
    
    power += strengthBonus;
    details.strengthBonus = strengthBonus;
  }
  
  // Traited Egg 보너스
  if (stats.traitedEgg) {
    const stage = digimonData?.stage;
    let traitedEggBonus = 0;
    if (stage === "Child") traitedEggBonus = 5;
    else if (stage === "Adult") traitedEggBonus = 8;
    else if (stage === "Perfect") traitedEggBonus = 15;
    else if (stage === "Ultimate" || stage === "Super Ultimate") traitedEggBonus = 25;
    
    power += traitedEggBonus;
    details.traitedEggBonus = traitedEggBonus;
  }
  
  // Effort 보너스 (effort 값 * 5)
  const effectiveEffort = Math.min(5, stats.effort || 0);
  if (effectiveEffort > 0) {
    const effortBonus = effectiveEffort * 5;
    power += effortBonus;
    details.effortBonus = effortBonus;
  }
  
  if (returnDetails) {
    return { power, details };
  }
  
  return power;
}

/**
 * 부상 확률 계산
 * 매뉴얼: "you have a 20% chance of getting injured when you win, and a 10% chance when you lose."
 * "That 10% chance is increased by 10% for every Protein Overdose you have, for a maximum of 80%."
 * 
 * @param {boolean} won - 승리 여부
 * @param {number} proteinOverdose - 프로틴 과다 수치
 * @returns {number} 부상 확률 (0-100)
 */
export function calculateInjuryChance(won, proteinOverdose) {
  if (won) {
    return 20; // 승리 시 20%
  } else {
    // 패배 시 10% + (프로틴 과다 * 10%)
    return Math.min(80, 10 + proteinOverdose * 10);
  }
}

