// src/data/digimonAnimations.js



const digimonAnimations = {
  1: { name: "idle", frames: [0, 1, 7] },
  2: { name: "eat", frames: [0, 9, 8] },
  3: { name: "foodRejectRefuse", frames: [10, 10] }, // 좌우 번갈아가게
  4: { name: "trainReady", frames: [4] },
  5: { name: "trainFire", frames: [5] },
  6: { name: "trainSuccessPoopWin", frames: [1, 2] },
  7: { name: "trainFailTreatment", frames: [6, 3] },
  8: { name: "sleep", frames: [11, 12] },
  9: { name: "freeze", frames: [0, 14, 2] },
  10: { name: "sick", frames: [13, 14] },
  11: { name: "evolve", frames: [14] },
  12: { name: "battleStart", frames: [1, 7] },
  13: { name: "battleAttack", frames: [6, 7] },
  14: { name: "battleStandby", frames: [6] },
  15: { name: "battleLose", frames: [1, 14] },

  // (A) digitamaIdle (90번)
  90: { name: "digitamaidle", frames: [0, 1] },
  // 필요하면 91번에 evolve 모션(알에서 135)...
  // 91: { name: "digitamaEvolve", frames: [2] },
};

export default digimonAnimations;


/*
const animationDefinitions = {
  1: { name: "idle", frames: [0, 1, 7] },
  2: { name: "eat", frames: [0, 9, 8] },
  3: { name: "foodRejectRefuse", frames: [10] },
  4: { name: "trainReady", frames: [4] },
  5: { name: "trainFire", frames: [5] },
  6: { name: "trainSuccessPoopWin", frames: [1, 2] },
  7: { name: "trainFailTreatment", frames: [6, 3] },
  8: { name: "sleep", frames: [11, 12] },
  9: { name: "freeze", frames: [0, 14, 2] },
  10: { name: "sick", frames: [13, 14] },
  11: { name: "evolve", frames: [14] },
  12: { name: "battleStart", frames: [1, 7] },
  13: { name: "battleAttack", frames: [6, 7] },
  14: { name: "battleStandby", frames: [6] },
  15: { name: "battleLose", frames: [1, 14] },

  // (A) digitamaIdle (90번)
  90: { name: "digitamaidle", frames: [0, 1] },
  // 필요하면 91번에 evolve 모션(알에서 135)...
  // 91: { name: "digitamaEvolve", frames: [2] },
};

export default animationDefinitions;
*/