// src/data/backgroundData.js
// 배경화면 데이터 정의

export const BACKGROUND_TYPES = [
  { 
    id: 'default', 
    name: '초원', 
    baseSprite: 162,
    sprites: [162, 163, 164] // Day, Dusk, Night
  },
  { 
    id: 'forest', 
    name: '사막', 
    baseSprite: 165,
    sprites: [165, 166, 167]
  },
  { 
    id: 'city', 
    name: '숲', 
    baseSprite: 168,
    sprites: [168, 169, 170]
  },
  { 
    id: 'desert', 
    name: '산맥', 
    baseSprite: 171,
    sprites: [171, 172, 173]
  },
  { 
    id: 'ocean', 
    name: '바다', 
    baseSprite: 174,
    sprites: [174, 175, 176]
  },
  { 
    id: 'space', 
    name: '파일섬', 
    baseSprite: 177,
    sprites: [177, 178, 179]
  },
];

// 기본 배경화면 설정
export const DEFAULT_BACKGROUND_SETTINGS = {
  selectedId: 'default',
  mode: '0' // '0' = 162 고정 (기본값)
};
