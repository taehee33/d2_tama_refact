// src/data/v2modkor/digimons.js
// Digital Monster Color Ver.2 라인 디지몬 데이터 (버전 관리용)
// 스키마는 v1/digimons.js와 동일. 스프라이트는 public/Ver2_Mod_Kor 경로 사용.

/** v2 스프라이트 기준 경로 (public/Ver2_Mod_Kor → 서빙 경로 /Ver2_Mod_Kor) */
export const V2_SPRITE_BASE = '/Ver2_Mod_Kor';

/**
 * Ver.2 디지몬 데이터 스키마 (v1 + spriteBasePath)
 * @typedef {Object} DigimonData
 * @property {string} id - 디지몬 고유 ID
 * @property {string} name - 디지몬 이름
 * @property {string} stage - 진화 단계
 * @property {number} sprite - 스프라이트 번호
 * @property {string} [spriteBasePath] - 스프라이트 이미지 기준 경로 (v2는 /Ver2_Mod_Kor)
 * @property {Object} stats - 스탯 정보
 * @property {Object} evolutionCriteria - 진화 조건
 * @property {Array} evolutions - 진화 경로 배열
 */

/** Ver.2 전용 디지몬 맵 (Punimon, Tsunomon 등) */
export const digimonDataVer2 = {
  // Ver.2 Baby I — 푸니몬 (테스트 추가)
  Punimon: {
    id: "Punimon",
    name: "푸니몬",
    stage: "Baby I",
    sprite: 226,
    spriteBasePath: V2_SPRITE_BASE,
    stats: {
      hungerCycle: 3,
      strengthCycle: 3,
      poopCycle: 3,
      maxOverfeed: 3,
      basePower: 0,
      maxEnergy: 5,
      minWeight: 5,
      healDoses: 0,
      type: "Free",
      sleepTime: null,
      attackSprite: null,
    },
    evolutionCriteria: {
      timeToEvolveSeconds: 600,
    },
    evolutions: [
      { targetId: "Tsunomon", targetName: "쯔노몬" },
    ],
  },
};
