export const GAME_SCENE_ASPECT_RATIO = "1 / 1";
export const GAME_SCENE_ASPECT_RATIO_VALUE = 1;

export const GAME_SCENE_SIZE = Object.freeze({
  width: 250,
  height: 250,
});

export const GAME_SCENE_SIZE_MIN = 100;
export const GAME_SCENE_SIZE_MAX = 600;

/**
 * 이전 직사각형 화면 설정을 정사각형 화면 설정으로 정규화합니다.
 * 기존 사용자가 보던 가로 폭을 유지하기 위해 width를 우선 사용합니다.
 * @param {{width?: unknown, height?: unknown}|null|undefined} settings 저장된 화면 설정
 * @returns {{width: number, height: number}}
 */
export function normalizeGameSceneSize(settings) {
  const preferredSize = Number(settings?.width ?? settings?.height);
  const finiteSize = Number.isFinite(preferredSize)
    ? Math.round(preferredSize)
    : GAME_SCENE_SIZE.width;
  const size = Math.max(
    GAME_SCENE_SIZE_MIN,
    Math.min(GAME_SCENE_SIZE_MAX, finiteSize)
  );

  return { width: size, height: size };
}

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
 * 외부 모션 편집기의 격자 좌표를 게임 화면 좌표로 변환합니다.
 * @param {number} width 장면 너비
 * @param {number} height 장면 높이
 * @param {{x?: number, y?: number, flip?: boolean}} position 격자 좌표
 * @param {number} gridSize 격자 한 변의 크기
 * @returns {{digiW: number, digiH: number, digiX: number, digiY: number, flip: boolean}}
 */
export function getGridDigimonDrawState(width, height, position, gridSize = 80) {
  const digiW = width * GAME_SCENE_GEOMETRY.digimonWidthRatio;
  const digiH = height * GAME_SCENE_GEOMETRY.digimonHeightRatio;
  const maxX = width - digiW;
  const maxY = height - digiH;
  const x = Number(position?.x) || 0;
  const y = Number(position?.y) || 0;

  return {
    digiW,
    digiH,
    digiX: Math.max(0, Math.min(maxX, (width * x) / gridSize)),
    digiY: Math.max(0, Math.min(maxY, (height * y) / gridSize)),
    flip: Boolean(position?.flip),
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
