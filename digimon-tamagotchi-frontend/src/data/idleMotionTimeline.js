// src/data/idleMotionTimeline.js

export const IDLE_MOTION_SLOT_OFFSET = {
  idle_1: 0,
  idle_2: 1,
  attack_2: 7,
};

export const IDLE_MOTION_TIMELINE = [
  { f: 1, slot: "idle_1", x: 24, y: 24, flip: false },
  { f: 2, slot: "idle_1", x: 18, y: 24, flip: false },
  { f: 3, slot: "idle_2", x: 12, y: 24, flip: false },
  { f: 4, slot: "idle_2", x: 12, y: 24, flip: true },
  { f: 5, slot: "idle_1", x: 18, y: 24, flip: true },
  { f: 6, slot: "idle_1", x: 18, y: 24, flip: false },
  { f: 7, slot: "idle_2", x: 12, y: 24, flip: false },
  { f: 8, slot: "idle_2", x: 6, y: 24, flip: false },
  { f: 9, slot: "idle_2", x: 6, y: 24, flip: true },
  { f: 10, slot: "idle_2", x: 6, y: 24, flip: false },
  { f: 11, slot: "attack_2", x: 0, y: 24, flip: false },
  { f: 12, slot: "idle_2", x: 6, y: 24, flip: false },
  { f: 13, slot: "attack_2", x: 0, y: 24, flip: false },
  { f: 14, slot: "idle_2", x: 6, y: 24, flip: false },
  { f: 15, slot: "idle_2", x: 6, y: 24, flip: true },
  { f: 16, slot: "idle_2", x: 12, y: 24, flip: true },
  { f: 17, slot: "idle_1", x: 18, y: 24, flip: true },
  { f: 18, slot: "idle_1", x: 24, y: 24, flip: true },
  { f: 19, slot: "idle_1", x: 30, y: 24, flip: true },
  { f: 20, slot: "idle_2", x: 36, y: 24, flip: true },
  { f: 21, slot: "idle_2", x: 36, y: 24, flip: false },
  { f: 22, slot: "idle_1", x: 30, y: 24, flip: false },
  { f: 23, slot: "idle_1", x: 30, y: 24, flip: true },
  { f: 24, slot: "idle_1", x: 36, y: 24, flip: true },
  { f: 25, slot: "idle_2", x: 36, y: 24, flip: false },
  { f: 26, slot: "idle_2", x: 42, y: 24, flip: true },
  { f: 27, slot: "attack_2", x: 48, y: 24, flip: true },
  { f: 28, slot: "idle_2", x: 42, y: 24, flip: true },
  { f: 29, slot: "attack_2", x: 48, y: 24, flip: true },
  { f: 30, slot: "idle_2", x: 42, y: 24, flip: true },
  { f: 31, slot: "idle_2", x: 36, y: 24, flip: false },
  { f: 32, slot: "idle_1", x: 30, y: 24, flip: false },
];

/**
 * idle 타임라인을 현재 프로젝트의 baseSprite + offset 구조로 해석
 * @param {number} baseSprite
 * @returns {Array<{f:number, slot:string, spriteOffset:number, spriteNumber:number, x:number, y:number, flip:boolean}>}
 */
export function resolveIdleMotionTimeline(baseSprite) {
  const safeBaseSprite = Number.isFinite(Number(baseSprite))
    ? Number(baseSprite)
    : 0;

  return IDLE_MOTION_TIMELINE.map((step) => {
    const spriteOffset = IDLE_MOTION_SLOT_OFFSET[step.slot] ?? 0;

    return {
      ...step,
      spriteOffset,
      spriteNumber: safeBaseSprite + spriteOffset,
    };
  });
}
