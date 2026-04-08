import digimonAnimations from "../../data/digimonAnimations";
import { resolveIdleMotionTimeline } from "../../data/idleMotionTimeline";
import { normalizeSleepStatusForDisplay } from "../../utils/callStatusUtils";

export const DEATH_FORM_IDS = [
  "Ohakadamon1",
  "Ohakadamon2",
  "Ohakadamon1V2",
  "Ohakadamon2V2",
];

export function buildGameAnimationViewModel({
  selectedDigimon,
  digimonStats,
  digimonDataForSlot,
  currentAnimation,
  sleepStatus,
  evolutionStage = "idle",
}) {
  const digimonData = digimonDataForSlot[selectedDigimon];
  const baseSprite = digimonData?.sprite ?? digimonStats.sprite;
  const digimonImageBase = digimonData?.spriteBasePath || "/images";
  const isDigitama =
    selectedDigimon === "Digitama" || selectedDigimon === "DigitamaV2";
  const isDigitamaHatchFlash = isDigitama && evolutionStage === "flashing";
  const visibleSleepStatus = normalizeSleepStatusForDisplay(sleepStatus);
  const safeBaseSprite = Number(baseSprite);
  const idleMotionTimeline =
    !Number.isFinite(safeBaseSprite) ||
    isDigitama ||
    DEATH_FORM_IDS.includes(selectedDigimon)
      ? []
      : resolveIdleMotionTimeline(safeBaseSprite);

  if (DEATH_FORM_IDS.includes(selectedDigimon)) {
    const fixedFrame = [`${baseSprite}`];
    return {
      digimonImageBase,
      idleMotionTimeline,
      idleFrames: fixedFrame,
      eatFramesArr: fixedFrame,
      rejectFramesArr: fixedFrame,
      desiredAnimation: currentAnimation !== "idle" ? "idle" : null,
    };
  }

  let idleAnimId = 1;
  let eatAnimId = 2;
  let rejectAnimId = 3;

  if (isDigitamaHatchFlash) {
    // 깨진 알은 flashing 단계에서만 정지 컷으로 보여준다.
    idleAnimId = 91;
    eatAnimId = 91;
    rejectAnimId = 91;
  } else if (isDigitama) {
    idleAnimId = 90;
  }

  const idleOff = digimonAnimations[idleAnimId]?.frames || [0];
  const eatOff = digimonAnimations[eatAnimId]?.frames || [0];
  const rejectOff = digimonAnimations[rejectAnimId]?.frames || [14];

  let idleFrames = idleOff.map((n) => `${baseSprite + n}`);
  let eatFramesArr = eatOff.map((n) => `${baseSprite + n}`);
  let rejectFramesArr = rejectOff.map((n) => `${baseSprite + n}`);
  let desiredAnimation = null;
  const sleepingLikeStatuses = new Set([
    "NAPPING",
    "SLEEPING",
    "SLEEPING_LIGHT_ON",
  ]);

  if (digimonStats.isDead) {
    idleFrames = [`${baseSprite + 14}`];
    eatFramesArr = idleFrames;
    rejectFramesArr = idleFrames;
    desiredAnimation = currentAnimation !== "pain2" ? "pain2" : null;
  } else if (digimonStats.isInjured) {
    idleFrames = [`${baseSprite + 13}`, `${baseSprite + 14}`];
    eatFramesArr = idleFrames;
    rejectFramesArr = idleFrames;
    desiredAnimation = currentAnimation !== "sick" ? "sick" : null;
  } else if (
    sleepingLikeStatuses.has(visibleSleepStatus) &&
    !isDigitama
  ) {
    idleFrames = [`${baseSprite + 11}`, `${baseSprite + 12}`];
    eatFramesArr = idleFrames;
    rejectFramesArr = idleFrames;
    desiredAnimation = currentAnimation !== "sleep" ? "sleep" : null;
  } else if (
    currentAnimation === "sick" ||
    currentAnimation === "sleep" ||
    currentAnimation === "pain2"
  ) {
    desiredAnimation = "idle";
  }

  return {
    digimonImageBase,
    idleMotionTimeline,
    idleFrames,
    eatFramesArr,
    rejectFramesArr,
    desiredAnimation,
  };
}
