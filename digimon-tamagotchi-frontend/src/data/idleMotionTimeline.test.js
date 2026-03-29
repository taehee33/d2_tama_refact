import {
  IDLE_MOTION_SLOT_OFFSET,
  IDLE_MOTION_TIMELINE,
  resolveIdleMotionTimeline,
} from "./idleMotionTimeline";

describe("idleMotionTimeline", () => {
  test("slot 이름을 현재 baseSprite offset 구조로 매핑한다", () => {
    expect(IDLE_MOTION_SLOT_OFFSET).toEqual({
      idle_1: 0,
      idle_2: 1,
      attack_2: 7,
    });
  });

  test("F:1~32 타임라인을 baseSprite 기준 spriteNumber로 해석한다", () => {
    const resolved = resolveIdleMotionTimeline(210);

    expect(resolved).toHaveLength(IDLE_MOTION_TIMELINE.length);
    expect(resolved[0]).toMatchObject({
      f: 1,
      slot: "idle_1",
      spriteOffset: 0,
      spriteNumber: 210,
      x: 24,
      y: 24,
      flip: false,
    });
    expect(resolved[10]).toMatchObject({
      f: 11,
      slot: "attack_2",
      spriteOffset: 7,
      spriteNumber: 217,
      x: 0,
      y: 24,
      flip: false,
    });
    expect(resolved[31]).toMatchObject({
      f: 32,
      slot: "idle_1",
      spriteOffset: 0,
      spriteNumber: 210,
      x: 30,
      y: 24,
      flip: false,
    });
  });
});
