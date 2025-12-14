// src/logic/stats/index.js
// 스탯 관리 로직 통합 export

export {
  initializeStats,
  updateLifespan,
  updateAge,
  applyLazyUpdate,
} from './stats';

export {
  feedMeat,
  checkOverfeed,
  decreaseHunger,
} from './hunger';

