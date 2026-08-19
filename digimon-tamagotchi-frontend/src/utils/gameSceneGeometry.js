export const GAME_SCENE_ASPECT_RATIO = "3 / 2";

export const GAME_SCENE_GEOMETRY = Object.freeze({
  digimonWidthRatio: 0.4,
  digimonHeightRatio: 0.4,
});

/**
 * 일반 게임 화면의 기본 디지몬 배치값을 계산합니다.
 * @param {number} width 장면 너비
 * @param {number} height 장면 높이
 * @param {string} currentAnimation 현재 애니메이션
 * @returns {{digiW: number, digiH: number, digiX: number, digiY: number, flip: boolean}}
 */
export function getDefaultDigimonDrawState(width, height, currentAnimation = "idle") {
  const digiW = width * GAME_SCENE_GEOMETRY.digimonWidthRatio;
  const digiH = height * GAME_SCENE_GEOMETRY.digimonHeightRatio;
  let digiX = (width - digiW) / 2;

  if (currentAnimation === "eat") {
    digiX = width * 0.6 - digiW / 2;
  }

  return {
    digiW,
    digiH,
    digiX,
    digiY: (height - digiH) / 2,
    flip: false,
  };
}

/**
 * 기본 디지몬 배치를 반응형 DOM 장면에 적용할 백분율 스타일로 변환합니다.
 * @returns {{left: string, top: string, width: string, height: string}}
 */
export function getDefaultDigimonSceneStyle() {
  const drawState = getDefaultDigimonDrawState(100, 100);

  return {
    left: `${drawState.digiX}%`,
    top: `${drawState.digiY}%`,
    width: `${drawState.digiW}%`,
    height: `${drawState.digiH}%`,
  };
}
