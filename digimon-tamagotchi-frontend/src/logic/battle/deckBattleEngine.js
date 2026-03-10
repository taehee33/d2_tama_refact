// src/logic/battle/deckBattleEngine.js
// 덱 배틀 규칙·판정 전용 (Ably/React 무관). useRealtimeBattle는 선택 수집·발행만 담당.

import { resolveCardRound } from './calculator';

const CARD_IDS = ['attack', 'defend', 'heavy_attack'];

/**
 * 덱과 사용횟수로 이번 라운드에서 고를 수 있는 카드 ID 배열 반환
 * @param {string[]} deck - 카드 ID 배열 (덱)
 * @param {Record<string, number>} usedCount - 카드 ID별 사용 횟수
 * @returns {string[]}
 */
export function getRemainingCards(deck, usedCount) {
  if (!deck || !Array.isArray(deck)) return [];
  const count = {};
  deck.forEach((id) => { count[id] = (count[id] || 0) + 1; });
  CARD_IDS.forEach((id) => {
    const used = usedCount[id] || 0;
    count[id] = Math.max(0, (count[id] || 0) - used);
  });
  const arr = [];
  Object.keys(count).forEach((id) => {
    for (let i = 0; i < count[id]; i++) arr.push(id);
  });
  return arr;
}

/**
 * 남은 카드 중 랜덤 1장 반환 (타임아웃 시 자동 선택용)
 * @param {string[]} deck
 * @param {Record<string, number>} usedCount
 * @returns {string}
 */
export function pickRandomFrom(deck, usedCount) {
  const remaining = getRemainingCards(deck, usedCount);
  if (!remaining || remaining.length === 0) return 'attack';
  return remaining[Math.floor(Math.random() * remaining.length)];
}

/**
 * 덱/손패/사용더미 상태 타입 (한 플레이어 기준)
 * @typedef {{ deck: string[], hand: string[], usedPile: string[] }} DeckState
 */

/**
 * 덱 배열로 초기 상태 생성 (deck 복사, hand/usedPile 빈 배열)
 * @param {string[]} deckArray - 카드 ID 배열 (최대 10장)
 * @returns {DeckState}
 */
export function createDeckState(deckArray) {
  if (!deckArray || !Array.isArray(deckArray)) {
    return { deck: [], hand: [], usedPile: [] };
  }
  return {
    deck: [...deckArray],
    hand: [],
    usedPile: [],
  };
}

/**
 * 덱에서 앞에서부터 최대 n장을 손패로 드로우한 새 상태 반환
 * @param {DeckState} state
 * @param {number} n - 드로우할 장수
 * @returns {DeckState}
 */
export function draw(state, n) {
  if (!state || n <= 0) return state;
  const deck = [...(state.deck || [])];
  const hand = [...(state.hand || [])];
  const usedPile = [...(state.usedPile || [])];
  const toDraw = Math.min(n, deck.length);
  for (let i = 0; i < toDraw; i++) {
    hand.push(deck.shift());
  }
  return { deck, hand, usedPile };
}

/**
 * 손패에서 해당 cardId 1장 제거 후 사용더미에 추가한 새 상태 반환
 * @param {DeckState} state
 * @param {string} cardId
 * @returns {DeckState}
 */
export function playCardFromHand(state, cardId) {
  if (!state || !cardId) return state;
  const hand = [...(state.hand || [])];
  const idx = hand.indexOf(cardId);
  if (idx < 0) return state;
  hand.splice(idx, 1);
  return {
    deck: [...(state.deck || [])],
    hand,
    usedPile: [...(state.usedPile || []), cardId],
  };
}

/**
 * 손패 배열에서 랜덤 1장 반환 (타임아웃 시 자동 선택용)
 * @param {string[]} hand - 손패 카드 ID 배열
 * @returns {string}
 */
export function pickRandomFromHand(hand) {
  if (!hand || !hand.length) return 'attack';
  return hand[Math.floor(Math.random() * hand.length)];
}

/**
 * 덱 배틀 1라운드 판정 (calculator.resolveCardRound 래퍼)
 * @param {string} hostCardId
 * @param {string} guestCardId
 * @param {number} hostPower
 * @param {number} guestPower
 * @param {number} hostAttr
 * @param {number} guestAttr
 * @param {number} roomSeed
 * @param {number} roundIndex
 * @param {string} hostName
 * @param {string} guestName
 * @returns {{ userHitsDelta: number, enemyHitsDelta: number, logEntries: Array }}
 */
export function resolveDeckRound(
  hostCardId,
  guestCardId,
  hostPower,
  guestPower,
  hostAttr,
  guestAttr,
  roomSeed,
  roundIndex,
  hostName = '호스트',
  guestName = '게스트'
) {
  return resolveCardRound(
    hostCardId,
    guestCardId,
    hostPower,
    guestPower,
    hostAttr,
    guestAttr,
    roomSeed,
    roundIndex,
    hostName,
    guestName
  );
}

/**
 * 1라운드 종료 후 승자 결정 (동점 시 시드 기반 타이브레이커)
 * @param {number} userHits - 호스트가 게스트에게 준 히트
 * @param {number} enemyHits - 게스트가 호스트에게 준 히트
 * @param {number} roomSeed
 * @returns {'host'|'guest'}
 */
export function resolveDeckBattleWinner(userHits, enemyHits, roomSeed) {
  if (userHits > enemyHits) return 'host';
  if (enemyHits > userHits) return 'guest';
  return (roomSeed + 1) % 2 === 0 ? 'host' : 'guest';
}
