// src/components/fridgeRenderPolicy.js

import { toEpochMs } from "../utils/time";

export const FRIDGE_RENDER_TIMINGS = Object.freeze({
  freezeCoverStartMs: 1000,
  freezeHideDigimonAfterMs: 2500,
  takeOutStageTwoStartMs: 800,
  takeOutStageThreeStartMs: 2000,
  takeOutShowDigimonAfterMs: 2500,
});

function toAnimationTimestamp(value) {
  return toEpochMs(value);
}

/**
 * 냉장고 관련 연출 단계와 디지몬 표시 정책을 계산한다.
 * 렌더링 전용 helper라서 저장 구조나 게임 로직은 건드리지 않는다.
 */
export function getFridgeRenderPolicy({
  isFrozen = false,
  frozenAt = null,
  takeOutAt = null,
  now = Date.now(),
} = {}) {
  const safeNow = Number.isFinite(now) ? now : Date.now();

  if (isFrozen) {
    const frozenTimestamp = toAnimationTimestamp(frozenAt);
    const fridgeElapsedMs = frozenTimestamp === null ? 0 : Math.max(0, safeNow - frozenTimestamp);

    let fridgeStage = 0;
    if (fridgeElapsedMs >= FRIDGE_RENDER_TIMINGS.freezeHideDigimonAfterMs) {
      fridgeStage = 2;
    } else if (fridgeElapsedMs >= FRIDGE_RENDER_TIMINGS.freezeCoverStartMs) {
      fridgeStage = 1;
    }

    return {
      fridgeStage,
      takeOutStage: null,
      fridgeElapsedMs,
      takeOutElapsedMs: null,
      shouldShowDigimon: fridgeStage !== 2,
      shouldFreezeDigimonMotion: true,
      shouldUseIdleMotionTimeline: false,
      shouldCycleDigimonFrames: false,
    };
  }

  if (takeOutAt) {
    const takeOutTimestamp = toAnimationTimestamp(takeOutAt);
    const takeOutElapsedMs = takeOutTimestamp === null ? 0 : Math.max(0, safeNow - takeOutTimestamp);

    let takeOutStage = 1;
    if (takeOutElapsedMs >= FRIDGE_RENDER_TIMINGS.takeOutShowDigimonAfterMs) {
      takeOutStage = 4;
    } else if (takeOutElapsedMs >= FRIDGE_RENDER_TIMINGS.takeOutStageThreeStartMs) {
      takeOutStage = 3;
    } else if (takeOutElapsedMs >= FRIDGE_RENDER_TIMINGS.takeOutStageTwoStartMs) {
      takeOutStage = 2;
    }

    return {
      fridgeStage: null,
      takeOutStage,
      fridgeElapsedMs: null,
      takeOutElapsedMs,
      shouldShowDigimon: takeOutStage === 4,
      shouldFreezeDigimonMotion: true,
      shouldUseIdleMotionTimeline: false,
      shouldCycleDigimonFrames: false,
    };
  }

  return {
    fridgeStage: null,
    takeOutStage: null,
    fridgeElapsedMs: null,
    takeOutElapsedMs: null,
    shouldShowDigimon: true,
    shouldFreezeDigimonMotion: false,
    shouldUseIdleMotionTimeline: true,
    shouldCycleDigimonFrames: true,
  };
}
