// src/utils/backgroundUtils.js
// 배경화면 관련 유틸리티 함수

import { BACKGROUND_TYPES, DEFAULT_BACKGROUND_SETTINGS } from '../data/backgroundData';

/**
 * 현재 시간에 따른 배경화면 스프라이트 인덱스 반환
 * @param {Date} now - 현재 시간 (기본값: new Date())
 * @returns {number} 스프라이트 인덱스 (0: Day, 1: Dusk, 2: Night)
 */
export const getTimeBasedSpriteIndex = (now = new Date()) => {
  const hour = now.getHours();

  // 오전 7시 ~ 오후 18시 : 1번째 (Day)
  if (hour >= 7 && hour < 18) return 0;

  // 오전 5시 ~ 7시 / 오후 18시 ~ 20시 : 2번째 (Dusk)
  if ((hour >= 5 && hour < 7) || (hour >= 18 && hour < 20)) return 1;

  // 오후 20시 ~ 오전 5시 : 3번째 (Night)
  return 2;
};

/**
 * 배경화면 설정에 따라 실제 스프라이트 번호 반환
 * @param {Object} backgroundSettings - 배경화면 설정 { selectedId, mode }
 * @param {Date} currentTime - 현재 시간
 * @returns {number} 스프라이트 번호
 */
export const getBackgroundSprite = (backgroundSettings, currentTime = new Date()) => {
  // 기본값 처리
  const settings = backgroundSettings || DEFAULT_BACKGROUND_SETTINGS;
  const { selectedId = 'default', mode = '0' } = settings;
  
  // BACKGROUND_TYPES에서 선택된 배경 찾기
  const selectedBg = BACKGROUND_TYPES.find(bg => bg.id === selectedId) || BACKGROUND_TYPES[0];
  
  let spriteIndex;
  if (mode === 'auto') {
    // 자동 모드: 시간에 따라 변경
    spriteIndex = getTimeBasedSpriteIndex(currentTime);
  } else {
    // 고정 모드: 지정된 인덱스 사용
    spriteIndex = parseInt(mode, 10);
    // 유효하지 않은 인덱스면 0으로 기본값
    if (isNaN(spriteIndex) || spriteIndex < 0 || spriteIndex > 2) {
      spriteIndex = 0;
    }
  }
  
  return selectedBg.sprites[spriteIndex];
};
