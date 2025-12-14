// src/logic/training/train.js
// Digital Monster Color 매뉴얼 기반 훈련 로직

/**
 * Ver.1 훈련 결과 계산
 * 매뉴얼: "Press A for a high attack or B for a low attack. If your attack reaches the opposing Digimon 3 out of 5 times, training is successful."
 * "Every four trainings will add one Effort Heart, regardless of whether or not they are successful."
 * "Your Digimon will also lose 1 gigabyte of weight every time they train."
 * "If training is successful, you will also gain a strength heart."
 * 
 * @param {Object} digimonStats - 현재 디지몬 스탯
 * @param {Array} partialResults - 5라운드 결과 [{round, attack, defend, isHit}, ...]
 * @returns {Object} 훈련 결과
 */
export function doVer1Training(digimonStats, partialResults) {
  const hits = partialResults.filter((r) => r.isHit).length;
  const fails = partialResults.length - hits; // 보통 5 - hits

  // message
  let message = "";
  let weightChange = 0;
  let strengthChange = 0;
  if (hits <= 2) {
    message = "< X!꽝!X >";
    weightChange = -2;
  } else if (hits <= 4) {
    message = "< 좋은 훈련이었다! >";
    weightChange = -2;
    strengthChange = 1; // 성공 시 힘 +1
  } else {
    message = "< 미친거아니야?! 대성공!!! >";
    weightChange = -4;
    strengthChange = 3; // 대성공 시 힘 +3
  }

  // stat update
  let s = { ...digimonStats };

  // 체중은 최소 0 이하로 내려가지 않도록 clamp
  const newWeight = Math.max(0, s.weight + weightChange);
  s.weight = newWeight;

  // strength 유지(진화해도) → s.strength은 누적
  s.strength = Math.min(5, (s.strength || 0) + strengthChange);

  // 훈련 횟수++ (성공/실패 모두 카운트)
  s.trainings = (s.trainings || 0) + 1;

  // 4회마다 effort+1 (성공/실패 모두 카운트)
  if (s.trainings % 4 === 0) {
    s.effort = Math.min(5, (s.effort || 0) + 1);
  }

  // 최종 결과 리턴
  return {
    updatedStats: s,
    hits,
    fails,
    message,
    roundResults: partialResults,
    trainingSuccessful: hits >= 3,
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

