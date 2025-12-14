// src/logic/battle/index.js
// 배틀 관련 로직 통합 export

// 기존 히트레이트 계산 (호환성 유지)
export {
  calculateHitrate,
  getAttributeAdvantage,
  calculatePower,
  calculateInjuryChance,
} from './hitrate';

// 새로운 배틀 계산기
export {
  calculateHitRate,
  simulateBattle,
} from './calculator';

// 속성 상성 시스템
export {
  getAttributeBonus,
} from './types';

// 퀘스트 엔진
export {
  playQuestRound,
  playQuestArea,
} from './questEngine';

