export const IMMERSIVE_LAYOUT_MODES = Object.freeze({
  PORTRAIT: "portrait",
  LANDSCAPE: "landscape",
});

export const IMMERSIVE_LANDSCAPE_SIDES = Object.freeze({
  AUTO: "auto",
  LEFT: "left",
  RIGHT: "right",
});

export const IMMERSIVE_SKINS = Object.freeze([
  {
    id: "tama-default-none",
    name: "기본(없음)",
    description: "컬러 스킨 없이 기본 셸",
  },
  {
    id: "tama-classic-pink",
    name: "클래식 핑크",
    description: "원작풍 핑크 셸",
  },
  {
    id: "tama-mint",
    name: "민트",
    description: "산뜻한 민트 셸",
  },
  {
    id: "tama-clear-blue",
    name: "클리어 블루",
    description: "투명감 있는 블루 셸",
  },
  {
    id: "brick-ver1",
    name: "벽돌 Ver.1",
    description: "가로 전용 벽돌 디바이스 프레임",
    landscapeFrameSrc: "/images/immersive/brick-ver1.png",
    landscapeViewport: {
      leftPct: 1.8,
      topPct: 22.45,
      widthPct: 56.8,
      heightPct: 57.5,
    },
    landscapeOnly: true,
  },
]);

export const DEFAULT_IMMERSIVE_SETTINGS = Object.freeze({
  layoutMode: IMMERSIVE_LAYOUT_MODES.PORTRAIT,
  skinId: "tama-default-none",
  landscapeSide: IMMERSIVE_LANDSCAPE_SIDES.AUTO,
});
