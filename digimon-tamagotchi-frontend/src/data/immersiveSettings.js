export const IMMERSIVE_LAYOUT_MODES = Object.freeze({
  PORTRAIT: "portrait",
  LANDSCAPE: "landscape",
});

export const IMMERSIVE_LANDSCAPE_SIDES = Object.freeze({
  AUTO: "auto",
  LEFT: "left",
  RIGHT: "right",
});

export const PIXEL_PORTRAIT_SKIN_IDS = Object.freeze([
  "pixel-split-brick",
  "pixel-red-device",
  "pixel-dark-battle",
]);

export const PIXEL_SKIN_DEFAULT_APPEARANCE = Object.freeze({
  "pixel-split-brick": Object.freeze({
    backgroundLeft: "#238DF1",
    backgroundRight: "#F4F4F1",
    device: "#173DD0",
  }),
  "pixel-red-device": Object.freeze({
    backgroundLeft: "#075B55",
    backgroundRight: "#073E3B",
    device: "#C8483E",
  }),
  "pixel-dark-battle": Object.freeze({
    backgroundLeft: "#111317",
    backgroundRight: "#250D0B",
    device: "#C63827",
  }),
});

export const PIXEL_APPEARANCE_PRESETS = Object.freeze([
  {
    id: "digital-blue",
    name: "디지털 블루",
    appearance: PIXEL_SKIN_DEFAULT_APPEARANCE["pixel-split-brick"],
  },
  {
    id: "brick-red",
    name: "벽돌 레드",
    appearance: PIXEL_SKIN_DEFAULT_APPEARANCE["pixel-red-device"],
  },
  {
    id: "battle-dark",
    name: "배틀 다크",
    appearance: PIXEL_SKIN_DEFAULT_APPEARANCE["pixel-dark-battle"],
  },
]);

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
      leftPct: 13.5,
      topPct: 29,
      widthPct: 32.5,
      heightPct: 44.8,
    },
    landscapeOnly: true,
  },
  {
    id: "pixel-split-brick",
    name: "블루 · 화이트 벽돌",
    description: "좌우 벽돌과 10버튼 원작풍 셸",
    portraitPixel: true,
    portraitFrameSrc: "/images/immersive/portrait-pixel/split-brick-10.png",
  },
  {
    id: "pixel-red-device",
    name: "레드 디바이스",
    description: "청록 그리드와 붉은 벽돌 디바이스",
    portraitPixel: true,
    portraitFrameSrc: "/images/immersive/portrait-pixel/red-device-10.png",
  },
  {
    id: "pixel-dark-battle",
    name: "다크 배틀",
    description: "검은 그리드와 붉은 균열 디바이스",
    portraitPixel: true,
    portraitFrameSrc: "/images/immersive/portrait-pixel/dark-battle-10.png",
  },
]);

export const DEFAULT_IMMERSIVE_SETTINGS = Object.freeze({
  layoutMode: IMMERSIVE_LAYOUT_MODES.PORTRAIT,
  skinId: "tama-default-none",
  landscapeSide: IMMERSIVE_LANDSCAPE_SIDES.AUTO,
  appearanceBySkin: PIXEL_SKIN_DEFAULT_APPEARANCE,
});
