// src/hooks/useDeckVsCpu.js
// 덱 배틀 vs CPU 로컬 게임 루프 (Ably 없음)

import { useState, useCallback, useRef } from 'react';
import {
  createDeckState,
  draw,
  playCardFromHand,
  pickRandomFromHand,
  resolveDeckRound,
} from '../logic/battle/deckBattleEngine';
import { getAttributeBonus } from '../logic/battle/types';
import { DEFAULT_BATTLE_DECK } from '../data/battleCards';
import { digimonDataVer1 } from '../data/v1/digimons';

const DEFAULT_CPU_DIGIMON_KEY = 'Koromon';

/**
 * @param {Object} params
 * @param {string[]} params.myDeck - 내 덱 (최대 10장)
 * @param {Object} params.myDigimon - 내 디지몬 데이터 (id, name, stats, sprite, spriteBasePath)
 * @param {Object} params.myStats - 내 스탯 (power 등)
 * @param {string[]} [params.cpuDeck] - CPU 덱 (미제공 시 DEFAULT_BATTLE_DECK)
 * @param {Object} [params.cpuDigimon] - CPU 디지몬 (미제공 시 v1 Koromon)
 * @param {Object} [params.cpuStats] - CPU 스탯 (미제공 시 basePower 사용)
 */
export function useDeckVsCpu({
  myDeck,
  myDigimon,
  myStats,
  cpuDeck,
  cpuDigimon,
  cpuStats,
}) {
  const roomSeedRef = useRef(Math.floor(Math.random() * 1e9));
  const hitsRef = useRef({ userHits: 0, enemyHits: 0 });

  const defaultCpu = digimonDataVer1[DEFAULT_CPU_DIGIMON_KEY] || { id: 'Koromon', name: '코로몬', stats: { basePower: 50, type: 'Free' }, sprite: 0 };
  const effectiveCpuDigimon = cpuDigimon || defaultCpu;
  const effectiveCpuStats = cpuStats || { power: effectiveCpuDigimon.stats?.basePower ?? 50, type: effectiveCpuDigimon.stats?.type ?? null };
  const effectiveCpuDeck = Array.isArray(cpuDeck) && cpuDeck.length > 0 ? cpuDeck : DEFAULT_BATTLE_DECK;
  const effectiveMyDeck = Array.isArray(myDeck) && myDeck.length > 0 ? myDeck : DEFAULT_BATTLE_DECK;

  const [myState, setMyState] = useState(() => {
    let s = createDeckState(effectiveMyDeck);
    s = draw(s, 3);
    return s;
  });
  const [cpuState, setCpuState] = useState(() => {
    let s = createDeckState(effectiveCpuDeck);
    s = draw(s, 3);
    return s;
  });
  const [phase, setPhase] = useState('start'); // 'start' | 'choice' | 'reveal' | 'battle_anim' | 'round_done'
  const [round, setRound] = useState(1);
  const [userHits, setUserHits] = useState(0);
  const [enemyHits, setEnemyHits] = useState(0);
  const [lastMyCardId, setLastMyCardId] = useState(null);
  const [lastCpuCardId, setLastCpuCardId] = useState(null);
  const [roundLogEntries, setRoundLogEntries] = useState([]);
  const [battleWinner, setBattleWinner] = useState(null); // 'user' | 'cpu' | null
  const [battleFinished, setBattleFinished] = useState(false);

  const myPower = myStats?.power ?? myDigimon?.stats?.basePower ?? 50;
  const cpuPower = effectiveCpuStats.power ?? effectiveCpuDigimon.stats?.basePower ?? 50;
  const myAttr = myDigimon?.stats?.type ?? myStats?.type ?? null;
  const cpuAttr = effectiveCpuDigimon.stats?.type ?? effectiveCpuStats.type ?? null;
  const myAttrBonus = getAttributeBonus(myAttr, cpuAttr);
  const cpuAttrBonus = getAttributeBonus(cpuAttr, myAttr);

  const startBattle = useCallback(() => {
    setMyState((s) => draw(s, 1));
    setCpuState((s) => draw(s, 1));
    setPhase('choice');
  }, []);

  const sendChoice = useCallback((cardId) => {
    setPhase('reveal');
    setMyState((s) => playCardFromHand(s, cardId));
    setLastMyCardId(cardId);

    const cpuCard = pickRandomFromHand(cpuState.hand);
    setCpuState((s) => playCardFromHand(s, cpuCard));
    setLastCpuCardId(cpuCard);

    const res = resolveDeckRound(
      cardId,
      cpuCard,
      myPower,
      cpuPower,
      myAttrBonus,
      cpuAttrBonus,
      roomSeedRef.current,
      round,
      '나',
      'CPU'
    );

    const newUserHits = userHits + res.userHitsDelta;
    const newEnemyHits = enemyHits + res.enemyHitsDelta;
    hitsRef.current = { userHits: newUserHits, enemyHits: newEnemyHits };
    setUserHits(newUserHits);
    setEnemyHits(newEnemyHits);
    setRoundLogEntries(res.logEntries || []);
    setPhase('battle_anim');
  }, [cpuState.hand, myPower, cpuPower, myAttrBonus, cpuAttrBonus, round, userHits, enemyHits]);

  const onRoundAnimDone = useCallback(() => {
    const { userHits: uh, enemyHits: eh } = hitsRef.current;
    if (uh >= 3 || eh >= 3) {
      setBattleWinner(uh >= 3 ? 'user' : 'cpu');
      setBattleFinished(true);
      return;
    }
    setPhase('round_done');
    setTimeout(() => {
      setMyState((s) => draw(s, 1));
      setCpuState((s) => draw(s, 1));
      setRound((r) => r + 1);
      setPhase('choice');
    }, 2000);
  }, []);

  const enemyData = {
    name: effectiveCpuDigimon.id || effectiveCpuDigimon.name || 'Koromon',
    digimonId: effectiveCpuDigimon.id,
    power: cpuPower,
    type: cpuAttr,
    attribute: cpuAttr,
    sprite: effectiveCpuDigimon.sprite ?? 0,
    spriteBasePath: effectiveCpuDigimon.spriteBasePath || null,
    stats: { power: cpuPower, type: cpuAttr, basePower: effectiveCpuDigimon.stats?.basePower, attackSprite: effectiveCpuDigimon.stats?.attackSprite ?? effectiveCpuDigimon.sprite },
  };

  return {
    phase,
    round,
    userHits,
    enemyHits,
    hand: myState.hand,
    deck: myState.deck,
    usedPile: myState.usedPile,
    deckLength: myState.deck.length,
    lastMyCardId,
    lastCpuCardId,
    roundLogEntries,
    battleWinner,
    battleFinished,
    sendChoice,
    startBattle,
    onRoundAnimDone,
    enemyData,
  };
}
