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
