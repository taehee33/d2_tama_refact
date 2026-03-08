// src/data/battleCards.js
// 배틀 덱 빌딩용 카드 정의 (1단계: attack, defend, heavy_attack)

/**
 * 카드 메타 정보
 * @typedef {{ id: string, nameKo: string, description: string, maxInDeck: number }} CardMeta
 */

/** @type {CardMeta[]} 카드 풀 (배틀 덱에 넣을 수 있는 카드 목록) */
export const BATTLE_CARD_POOL = [
  {
    id: 'attack',
    nameKo: '기본 공격',
    description: '기존 명중률로 1히트.',
    maxInDeck: 5,
  },
  {
    id: 'defend',
    nameKo: '방어',
    description: '이 턴 받는 공격 1회 무효.',
    maxInDeck: 2,
  },
  {
    id: 'heavy_attack',
    nameKo: '강타',
    description: '명중률 -15%, 성공 시 2히트.',
    maxInDeck: 1,
  },
];

/** 카드 ID → 메타 맵 */
export const BATTLE_CARD_BY_ID = BATTLE_CARD_POOL.reduce((acc, card) => {
  acc[card.id] = card;
  return acc;
}, /** @type {Record<string, CardMeta>} */ ({}));

/** 기본 덱 (저장된 덱이 없을 때 사용): attack×5, defend×2, heavy_attack×1 */
export const DEFAULT_BATTLE_DECK = [
  'attack', 'attack', 'attack', 'attack', 'attack',
  'defend', 'defend',
  'heavy_attack',
];

/** 덱 최소 장수 */
export const DECK_MIN_SIZE = 5;

/** 덱 최대 장수 */
export const DECK_MAX_SIZE = 10;
