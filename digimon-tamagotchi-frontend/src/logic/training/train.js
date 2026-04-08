// src/logic/training/train.js
// Digital Monster Color 기반 훈련 로직

export const VER1_DEFENSE_PATTERNS = [
  ["U", "D", "U", "D", "D"],
  ["D", "D", "U", "U", "D"],
  ["D", "U", "U", "D", "D"],
  ["U", "D", "D", "U", "U"],
  ["D", "U", "D", "U", "D"],
  ["U", "D", "U", "D", "U"],
];

/**
 * Ver.1 반복 방어 패턴을 반환합니다.
 * @param {number} trainingCount - 현재 누적 훈련 횟수
 * @returns {string[]} 5라운드 방어 패턴
 */
export function getVer1DefensePattern(trainingCount = 0) {
  const count = Number.isFinite(Number(trainingCount)) ? Number(trainingCount) : 0;
  const patternIndex = Math.abs(count) % VER1_DEFENSE_PATTERNS.length;
  return [...VER1_DEFENSE_PATTERNS[patternIndex]];
}

/**
 * Ver.1 훈련 결과 계산
 * 원작 Ver.1의 입력 구조를 따르되, 스탯 증감은 현재 앱 규칙을 유지합니다.
 *
 * @param {Object} digimonStats - 현재 디지몬 스탯
 * @param {Array} partialResults - 5라운드 결과 [{round, attack, defend, isHit}, ...]
 * @returns {Object} 훈련 결과
 */
export function doVer1Training(digimonStats, partialResults) {
  const hits = partialResults.filter((r) => r.isHit).length;
  const fails = partialResults.length - hits;
  const isSuccess = hits >= 3;
  const message = isSuccess ? "< 좋은 훈련이었다! >" : "< X!꽝!X >";

  const updatedStats = { ...digimonStats };
  updatedStats.weight = Math.max(0, (updatedStats.weight || 0) - 2);
  updatedStats.energy = Math.max(0, (updatedStats.energy || 0) - 1);

  if (isSuccess) {
    updatedStats.strength = Math.min(5, (updatedStats.strength || 0) + 1);
  }

  updatedStats.trainings = (updatedStats.trainings || 0) + 1;

  if (updatedStats.trainings % 4 === 0) {
    updatedStats.effort = Math.min(5, (updatedStats.effort || 0) + 1);
  }

  return {
    updatedStats,
    hits,
    fails,
    isSuccess,
    message,
    roundResults: partialResults,
    trainingSuccessful: isSuccess,
  };
}

/**
 * Ver.2 훈련 로직 (구현 예정)
 * 매뉴얼: "Press A or B to stop the meter. If you stop it when it is full, the punching bag is destroyed and training is successful."
 */
export function doVer2Training(digimonStats, meterValue) {
  // TODO: 구현 필요
  return {
    updatedStats: digimonStats,
    trainingSuccessful: false,
  };
}

/**
 * Ver.3 훈련 로직 (구현 예정)
 * 매뉴얼: "Repeatedly press A or B to increase the meter. If you fill it to maximum before the time runs out, training is successful."
 */
export function doVer3Training(digimonStats, meterValue, timeRemaining) {
  // TODO: 구현 필요
  return {
    updatedStats: digimonStats,
    trainingSuccessful: false,
  };
}

/**
 * Ver.4 훈련 로직 (구현 예정)
 * 매뉴얼: "Press A or B to stop the number. If you stop it at 100, the rock is destroyed and training is successful."
 */
export function doVer4Training(digimonStats, stoppedNumber) {
  // TODO: 구현 필요
  return {
    updatedStats: digimonStats,
    trainingSuccessful: stoppedNumber === 100,
  };
}

/**
 * Ver.5 훈련 로직 (구현 예정)
 * 매뉴얼: "Press A or B to stop the meter. If you stop it when it is full, the tree is destroyed and training is successful."
 */
export function doVer5Training(digimonStats, meterValue) {
  // TODO: 구현 필요
  return {
    updatedStats: digimonStats,
    trainingSuccessful: false,
  };
}
