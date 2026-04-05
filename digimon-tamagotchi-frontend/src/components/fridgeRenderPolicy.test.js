import {
  FRIDGE_RENDER_TIMINGS,
  getFridgeRenderPolicy,
} from "./fridgeRenderPolicy";

describe("getFridgeRenderPolicy", () => {
  const baseNow = 1_700_000_000_000;

  test("냉장고에 넣은 직후에는 디지몬을 고정 표시하고 이동과 프레임 순환을 멈춘다", () => {
    const result = getFridgeRenderPolicy({
      isFrozen: true,
      frozenAt: baseNow,
      now: baseNow + 100,
    });

    expect(result).toMatchObject({
      fridgeStage: 0,
      takeOutStage: null,
      shouldShowDigimon: true,
      shouldFreezeDigimonMotion: true,
      shouldUseIdleMotionTimeline: false,
      shouldCycleDigimonFrames: false,
    });
  });

  test("냉장고 보관 2.5초 이후에는 디지몬을 숨기고 냉장고 내부 단계로 전환한다", () => {
    const result = getFridgeRenderPolicy({
      isFrozen: true,
      frozenAt: baseNow,
      now: baseNow + FRIDGE_RENDER_TIMINGS.freezeHideDigimonAfterMs + 100,
    });

    expect(result).toMatchObject({
      fridgeStage: 2,
      takeOutStage: null,
      shouldShowDigimon: false,
      shouldFreezeDigimonMotion: true,
    });
  });

  test("냉장고에서 꺼낸 직후에는 해동 연출만 보여준다", () => {
    const result = getFridgeRenderPolicy({
      isFrozen: false,
      takeOutAt: baseNow,
      now: baseNow + 100,
    });

    expect(result).toMatchObject({
      fridgeStage: null,
      takeOutStage: 1,
      shouldShowDigimon: false,
      shouldFreezeDigimonMotion: true,
      shouldUseIdleMotionTimeline: false,
      shouldCycleDigimonFrames: false,
    });
  });

  test("냉장고에서 꺼낸 후반에는 디지몬을 다시 표시하지만 정지 상태를 유지한다", () => {
    const result = getFridgeRenderPolicy({
      isFrozen: false,
      takeOutAt: baseNow,
      now: baseNow + FRIDGE_RENDER_TIMINGS.takeOutShowDigimonAfterMs + 100,
    });

    expect(result).toMatchObject({
      fridgeStage: null,
      takeOutStage: 4,
      shouldShowDigimon: true,
      shouldFreezeDigimonMotion: true,
      shouldUseIdleMotionTimeline: false,
      shouldCycleDigimonFrames: false,
    });
  });

  test("takeOutAt이 정리되면 기본 idle 이동 정책으로 돌아간다", () => {
    const result = getFridgeRenderPolicy({
      isFrozen: false,
      frozenAt: null,
      takeOutAt: null,
      now: baseNow,
    });

    expect(result).toMatchObject({
      fridgeStage: null,
      takeOutStage: null,
      shouldShowDigimon: true,
      shouldFreezeDigimonMotion: false,
      shouldUseIdleMotionTimeline: true,
      shouldCycleDigimonFrames: true,
    });
  });
});
