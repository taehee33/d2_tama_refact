// src/logic/stats/index.js
// 스탯 관리 로직 통합 export

export {
  initializeStats,
  updateLifespan,
  updateAge,
  applyLazyUpdate,
} from './stats';

export {
  handleHungerTick,
  feedMeat,
  willRefuseMeat,
} from './hunger';

export {
  handleStrengthTick,
  feedProtein,
  willRefuseProtein,
} from './strength';

