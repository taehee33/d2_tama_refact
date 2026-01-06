// src/utils/stageTranslator.js
// Stage 한글 번역 유틸리티

/**
 * Stage 영어 값을 한글로 번역
 * @param {string} stage - 영어 Stage 값
 * @returns {string} 한글 Stage 값
 */
export const stageTranslations = {
  "Digitama": "디지타마",
  "Baby I": "유아기",
  "Baby II": "유아기",
  "Child": "성장기",
  "Adult": "성숙기",
  "Perfect": "완전체",
  "Ultimate": "궁극체",
  "Super Ultimate": "초궁극체",
  "Ohakadamon": "오하카다몬"
};

export function translateStage(stage) {
  if (!stage) return "Unknown";
  return stageTranslations[stage] || stage;
}

