// src/logic/battle/types.js
// Digital Monster Color 매뉴얼 기반 속성 상성 시스템

/**
 * 속성 상성 관계
 * Vaccine > Virus > Data > Vaccine (삼각 상성)
 * Free는 상성 없음
 */
const ATTRIBUTE_ADVANTAGE = {
  Vaccine: {
    strong: "Virus",    // Vaccine > Virus
    weak: "Data",       // Vaccine < Data
  },
  Virus: {
    strong: "Data",     // Virus > Data
    weak: "Vaccine",   // Virus < Vaccine
  },
  Data: {
    strong: "Vaccine",  // Data > Vaccine
    weak: "Virus",      // Data < Virus
  },
};

/**
 * 속성 보너스 계산
 * 매뉴얼: 유리하면 +5%, 불리하면 -5%, 무관하면 0%
 * 
 * @param {string|null} attackerAttr - 공격자 속성 (Vaccine, Data, Virus, Free, null)
 * @param {string|null} defenderAttr - 방어자 속성 (Vaccine, Data, Virus, Free, null)
 * @returns {number} 속성 보너스 (-5, 0, 또는 +5)
 */
export function getAttributeBonus(attackerAttr, defenderAttr) {
  // Free나 null인 경우 상성 없음
  if (!attackerAttr || !defenderAttr || attackerAttr === "Free" || defenderAttr === "Free") {
    return 0;
  }

  // 같은 속성인 경우 상성 없음
  if (attackerAttr === defenderAttr) {
    return 0;
  }

  // 공격자가 유리한 경우
  const advantage = ATTRIBUTE_ADVANTAGE[attackerAttr];
  if (advantage && advantage.strong === defenderAttr) {
    return 5; // +5% 보너스
  }

  // 공격자가 불리한 경우
  if (advantage && advantage.weak === defenderAttr) {
    return -5; // -5% 페널티
  }

  // 그 외의 경우 (이론적으로 발생하지 않아야 함)
  return 0;
}

