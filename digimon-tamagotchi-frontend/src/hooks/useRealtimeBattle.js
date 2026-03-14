// src/hooks/useRealtimeBattle.js
// 실시간 배틀 방 생성/참가, Ably 라운드 동기화, 시드 기반 판정

import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  getWaitingRooms,
  getRoom,
  createRoom as createRoomRepo,
  joinRoom as joinRoomRepo,
  updateRoom,
  cancelRoom as cancelRoomRepo,
} from '../repositories/RealtimeBattleRoomRepository';
import { simulateOneRound } from '../logic/battle/calculator';
import { getAttributeBonus } from '../logic/battle/types';
import { getRemainingCards, pickRandomFrom, resolveDeckRound } from '../logic/battle/deckBattleEngine';
import { DEFAULT_BATTLE_DECK } from '../data/battleCards';

const ABLY_CHANNEL_PREFIX = 'realtime-battle:';
const ROUND_TIMEOUT_MS = 90000; // 90초 내에 round 미수신 시 상대 이탈 처리
const DECK_CHOICE_TIMEOUT_MS = 25000; // 카드 선택 제한 25초

/**
 * @param {Object} params
 * @param {string|null} params.roomId - 현재 방 ID (참가/생성 후 설정)
 * @param {string} params.userId - 현재 유저 UID
 * @param {Object|null} params.ablyClient - Ably Realtime 클라이언트 (useAblyContext)
 */
export function useRealtimeBattle({ roomId, userId, ablyClient }) {
  const [room, setRoom] = useState(null);
  const [battleLog, setBattleLog] = useState([]);
  const [userHits, setUserHits] = useState(0);
  const [enemyHits, setEnemyHits] = useState(0);
  const [battleWinner, setBattleWinner] = useState(null); // 'host' | 'guest' | null
  const [battleStarted, setBattleStarted] = useState(false);
  const [readySent, setReadySent] = useState(false);
  const [hostReady, setHostReady] = useState(false);
  const [guestReady, setGuestReady] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  // 덱 배틀: 카드 선택 대기 상태 (제한시간 표시용)
  const [pendingChoiceRoundIndex, setPendingChoiceRoundIndex] = useState(null);
  const [choiceTimeoutAt, setChoiceTimeoutAt] = useState(null);
  const [deckBattleRemainingCards, setDeckBattleRemainingCards] = useState([]);
  // 덱 배틀: 직전 라운드에서 양쪽이 고른 카드 (배틀 화면에 표시용)
  const [lastRoundIndex, setLastRoundIndex] = useState(null);
  const [lastRoundHostCardId, setLastRoundHostCardId] = useState(null);
  const [lastRoundGuestCardId, setLastRoundGuestCardId] = useState(null);
  /** 덱 배틀: 내가 이번 배틀에서 이미 사용한 카드 ID 목록 (라운드 순) */
  const [myUsedCardIdsInOrder, setMyUsedCardIdsInOrder] = useState([]);
  /** 덱 배틀: 현재 라운드에서 상대가 choice 메시지를 보냈는지 (상대방 선택 완료 표시용) */
  const [opponentChoiceReceived, setOpponentChoiceReceived] = useState(false);

  const channelRef = useRef(null);
  const battleLoopRef = useRef(false);
  const battleStartedForRoomIdRef = useRef(null);
  const roundTimeoutRef = useRef(null);
  // 덱 배틀: 호스트가 양쪽 선택 수집 후 resolve 호출
  const hostChoiceForRoundRef = useRef(null);
  const guestChoiceForRoundRef = useRef(null);
  const deckChoiceResolveRef = useRef(null);
  const myUsedCardsRef = useRef({}); // 게스트/호스트 본인 카드 사용 횟수
  const choiceTimeoutTimerRef = useRef(null);
  const guestSentChoiceForRoundRef = useRef(false);

  const isHost = room && room.hostUid === userId;
  const battleMode = room?.battleMode || 'normal';

  // 방이 바뀌면 배틀/준비 상태 초기화 (방 만들기만 했을 때 이전 배틀 화면이 뜨지 않도록)
  useEffect(() => {
    if (!roomId) return;
    battleStartedForRoomIdRef.current = null;
    setBattleStarted(false);
    setBattleLog([]);
    setUserHits(0);
    setEnemyHits(0);
    setBattleWinner(null);
    setReadySent(false);
    setHostReady(false);
    setGuestReady(false);
    setPendingChoiceRoundIndex(null);
    setChoiceTimeoutAt(null);
    setDeckBattleRemainingCards([]);
    setLastRoundIndex(null);
    setLastRoundHostCardId(null);
    setLastRoundGuestCardId(null);
    setMyUsedCardIdsInOrder([]);
    setOpponentChoiceReceived(false);
    myUsedCardsRef.current = {};
  }, [roomId]);

  // Firestore 방 구독
  useEffect(() => {
    if (!db || !roomId) {
      setRoom(null);
      return;
    }
    const ref = doc(db, 'realtime_battle_rooms', roomId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) setRoom({ id: snap.id, ...snap.data() });
        else setRoom(null);
      },
      (err) => {
        console.warn('[useRealtimeBattle] room snapshot error', err);
        setRoom(null);
      }
    );
    return () => unsub();
  }, [roomId]);

  // Ably 채널 구독 및 ready/round/result 처리
  useEffect(() => {
    if (!ablyClient || !roomId) {
      channelRef.current = null;
      return;
    }
    const channelName = `${ABLY_CHANNEL_PREFIX}${roomId}`;
    const ch = ablyClient.channels.get(channelName);
    channelRef.current = ch;

    const onMessage = (msg) => {
      const data = msg?.data ?? {};
      const type = data.type;

      if (type === 'ready') {
        if (data.role === 'host') setHostReady(true);
        if (data.role === 'guest') setGuestReady(true);
        return;
      }

      if (type === 'request_choice') {
        const roundIdx = data.roundIndex;
        setOpponentChoiceReceived(false);
        setPendingChoiceRoundIndex(roundIdx);
        setChoiceTimeoutAt(Date.now() + (data.timeoutMs ?? DECK_CHOICE_TIMEOUT_MS));
        guestSentChoiceForRoundRef.current = false;
        const mySnap = room?.hostUid === userId ? room?.hostDigimonSnapshot : room?.guestDigimonSnapshot;
        const myDeck = mySnap?.battleDeck && mySnap.battleDeck.length ? mySnap.battleDeck : DEFAULT_BATTLE_DECK;
        setDeckBattleRemainingCards(getRemainingCards(myDeck, myUsedCardsRef.current));
        if (room?.hostUid !== userId) {
          if (choiceTimeoutTimerRef.current) clearTimeout(choiceTimeoutTimerRef.current);
          choiceTimeoutTimerRef.current = setTimeout(() => {
            const remaining = getRemainingCards(myDeck, myUsedCardsRef.current);
            if (remaining.length > 0 && !guestSentChoiceForRoundRef.current && channelRef.current) {
              const pick = pickRandomFrom(myDeck, myUsedCardsRef.current);
              myUsedCardsRef.current[pick] = (myUsedCardsRef.current[pick] || 0) + 1;
              guestSentChoiceForRoundRef.current = true;
              channelRef.current.publish('realtime-battle', { type: 'choice', roundIndex: roundIdx, role: 'guest', cardId: pick });
            }
            setPendingChoiceRoundIndex(null);
            setChoiceTimeoutAt(null);
          }, data.timeoutMs ?? DECK_CHOICE_TIMEOUT_MS);
        }
        return;
      }

      if (type === 'choice') {
        const isMyRole = (data.role === 'host' && room?.hostUid === userId) || (data.role === 'guest' && room?.hostUid !== userId);
        if (!isMyRole) setOpponentChoiceReceived(true);
        if (data.role === 'guest' && room?.hostUid === userId) {
          guestChoiceForRoundRef.current = data.cardId;
          // 호스트 자신의 선택도 들어온 경우에만 resolve (양쪽 선택 후에만 라운드 진행)
          if (hostChoiceForRoundRef.current != null && deckChoiceResolveRef.current) {
            deckChoiceResolveRef.current();
            deckChoiceResolveRef.current = null;
          }
        }
        return;
      }

      if (type === 'round') {
        battleLoopRef.current = false;
        if (roundTimeoutRef.current) {
          clearTimeout(roundTimeoutRef.current);
          roundTimeoutRef.current = null;
        }
        if (choiceTimeoutTimerRef.current) {
          clearTimeout(choiceTimeoutTimerRef.current);
          choiceTimeoutTimerRef.current = null;
        }
        setPendingChoiceRoundIndex(null);
        setChoiceTimeoutAt(null);
        setBattleStarted(true);
        const { roundIndex, userHit, enemyHit, userHits: uh, enemyHits: eh, logEntries = [], hostCardId, guestCardId } = data;
        setUserHits(uh);
        setEnemyHits(eh);
        if (roundIndex != null && hostCardId != null && guestCardId != null) {
          setLastRoundIndex(roundIndex);
          setLastRoundHostCardId(hostCardId);
          setLastRoundGuestCardId(guestCardId);
          const myCardThisRound = room?.hostUid === userId ? hostCardId : guestCardId;
          setMyUsedCardIdsInOrder((prev) => [...prev, myCardThisRound]);
          // 사용된 카드 카운트 갱신 → 다음 라운드 request_choice 시 remainingCards가 올바르게 계산됨
          myUsedCardsRef.current[myCardThisRound] = (myUsedCardsRef.current[myCardThisRound] || 0) + 1;
        }
        setBattleLog((prev) => {
          const next = [...prev];
          const isHostSide = room?.hostUid === userId;
          logEntries.forEach((entry) => {
            if (isHostSide) {
              next.push(entry);
            } else {
              next.push({
                ...entry,
                attacker: entry.attacker === 'user' ? 'enemy' : 'user',
                defender: entry.defender === 'user' ? 'enemy' : 'user',
              });
            }
          });
          return next;
        });
        return;
      }

      if (type === 'result') {
        if (roundTimeoutRef.current) {
          clearTimeout(roundTimeoutRef.current);
          roundTimeoutRef.current = null;
        }
        if (data.userHits != null) setUserHits(data.userHits);
        if (data.enemyHits != null) setEnemyHits(data.enemyHits);
        setBattleWinner(data.winner ?? null);
        setBattleStarted(true);
      }
    };

    ch.subscribe('realtime-battle', onMessage);

    return () => {
      ch.unsubscribe('realtime-battle', onMessage);
      channelRef.current = null;
    };
  }, [ablyClient, roomId, userId, room?.hostUid]);

  // 호스트: 양쪽 ready 시 배틀 루프 실행 (같은 방에서 한 번만)
  useEffect(() => {
    if (!room || !isHost || !hostReady || !guestReady || !room.guestDigimonSnapshot || !room.hostDigimonSnapshot) return;
    if (battleLoopRef.current || battleStartedForRoomIdRef.current === room.id) return;
    if (room.battleMode === undefined) return;

    battleLoopRef.current = true;
    battleStartedForRoomIdRef.current = room.id;
    const hostSnap = room.hostDigimonSnapshot;
    const guestSnap = room.guestDigimonSnapshot;
    const roomSeed = room.roomSeed ?? 0;
    const hostPower = hostSnap.stats?.power ?? 0;
    const guestPower = guestSnap.stats?.power ?? 0;
    const hostAttr = getAttributeBonus(hostSnap.stats?.type, guestSnap.stats?.type);
    const guestAttr = getAttributeBonus(guestSnap.stats?.type, hostSnap.stats?.type);
    const hostName = room.hostTamerName || '호스트';
    const guestName = room.guestTamerName || '게스트';
    const hostDeck = (hostSnap.battleDeck && hostSnap.battleDeck.length) ? hostSnap.battleDeck : DEFAULT_BATTLE_DECK;
    const guestDeck = (guestSnap.battleDeck && guestSnap.battleDeck.length) ? guestSnap.battleDeck : DEFAULT_BATTLE_DECK;

    let uh = 0;
    let eh = 0;

    if (room.battleMode === 'deck') {
      const hostUsed = {};
      const guestUsed = {};
      updateRoom(room.id, { status: 'fighting' }).catch(console.error);

      // 덱 배틀: 다중 라운드 (3히트 선승), 라운드별 공격/방어 결과 표시 후 다음 라운드
      (async () => {
        const channel = channelRef.current;
        for (let r = 1; ; r++) {
          channel?.publish('realtime-battle', { type: 'request_choice', roundIndex: r, timeoutMs: DECK_CHOICE_TIMEOUT_MS });
          setPendingChoiceRoundIndex(r);
          setChoiceTimeoutAt(Date.now() + DECK_CHOICE_TIMEOUT_MS);
          setDeckBattleRemainingCards(getRemainingCards(hostDeck, hostUsed));
          hostChoiceForRoundRef.current = null;
          guestChoiceForRoundRef.current = null;
          await new Promise((resume) => setTimeout(resume, 500));
          await new Promise((resolve) => {
            deckChoiceResolveRef.current = resolve;
            setTimeout(() => { if (deckChoiceResolveRef.current) deckChoiceResolveRef.current(); }, DECK_CHOICE_TIMEOUT_MS);
          });
          const hCard = hostChoiceForRoundRef.current ?? pickRandomFrom(hostDeck, hostUsed);
          const gCard = guestChoiceForRoundRef.current ?? pickRandomFrom(guestDeck, guestUsed);
          hostUsed[hCard] = (hostUsed[hCard] || 0) + 1;
          guestUsed[gCard] = (guestUsed[gCard] || 0) + 1;
          const res = resolveDeckRound(hCard, gCard, hostPower, guestPower, hostAttr, guestAttr, roomSeed, r, hostName, guestName);
          uh += res.userHitsDelta;
          eh += res.enemyHitsDelta;
          if (channel) {
            channel.publish('realtime-battle', {
              type: 'round',
              roundIndex: r,
              userHits: uh,
              enemyHits: eh,
              logEntries: res.logEntries || [],
              hostCardId: hCard,
              guestCardId: gCard,
            });
          }
          setUserHits(uh);
          setEnemyHits(eh);
          setBattleLog((prev) => [...prev, ...(res.logEntries || [])]);
          setBattleStarted(true);
          setPendingChoiceRoundIndex(null);
          setChoiceTimeoutAt(null);
          // 라운드 결과를 볼 수 있도록 2.5초 대기
          await new Promise((delayResolve) => setTimeout(delayResolve, 2500));
          if (uh >= 3 || eh >= 3) {
            const winner = uh >= 3 ? 'host' : 'guest';
            if (channel) channel.publish('realtime-battle', { type: 'result', winner, userHits: uh, enemyHits: eh });
            setBattleWinner(winner);
            updateRoom(room.id, { status: 'finished', winner }).catch(console.error);
            break;
          }
        }
        battleLoopRef.current = false;
      })();
      return () => { battleLoopRef.current = false; };
    }

    if (room.battleMode === 'normal') {
      let roundIndex = 1;
      const runRound = () => {
        const result = simulateOneRound(
          roundIndex,
          hostPower,
          guestPower,
          hostAttr,
          guestAttr,
          roomSeed,
          hostName,
          guestName
        );
        uh += result.userHit ? 1 : 0;
        eh += result.enemyHit ? 1 : 0;

        const channel = channelRef.current;
        if (channel) {
          channel.publish('realtime-battle', {
            type: 'round',
            roundIndex,
            userHit: result.userHit,
            enemyHit: result.enemyHit,
            userHits: uh,
            enemyHits: eh,
            logEntries: result.logEntries,
          });
        }

        setUserHits(uh);
        setEnemyHits(eh);
        setBattleLog((prev) => [...prev, ...(result.logEntries || [])]);
        setBattleStarted(true);

        if (uh >= 3 || eh >= 3) {
          const winner = uh >= 3 ? 'host' : 'guest';
          if (channel) {
            channel.publish('realtime-battle', { type: 'result', winner, userHits: uh, enemyHits: eh });
          }
          setUserHits(uh);
          setEnemyHits(eh);
          setBattleWinner(winner);
          updateRoom(room.id, { status: 'finished', winner }).catch(console.error);
          return;
        }

        roundIndex += 1;
        if (roundIndex <= 100) setTimeout(runRound, 800);
      };

      updateRoom(room.id, { status: 'fighting' }).then(() => {
        runRound();
      }).catch((err) => {
        console.error('update room fighting', err);
        runRound();
      });

      return () => {
        battleLoopRef.current = false;
      };
    }
  }, [room?.id, room?.battleMode, isHost, hostReady, guestReady]);

  const createRoom = useCallback(
    async (hostSlotSnapshot, hostTamerName, battleMode = 'normal') => {
      setError(null);
      setLoading(true);
      try {
        const roomSeed = Math.floor(Math.random() * 1e9);
        const { id } = await createRoomRepo({
          hostUid: userId,
          hostSlotId: hostSlotSnapshot?.slotId ?? 0,
          hostDigimonSnapshot: hostSlotSnapshot,
          hostTamerName,
          roomSeed,
          battleMode: battleMode === 'deck' ? 'deck' : 'normal',
        });
        return id;
      } catch (e) {
        setError(e.message || '방 생성 실패');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const joinRoom = useCallback(
    async (rid, guestSlotSnapshot, guestTamerName) => {
      setError(null);
      setLoading(true);
      try {
        await joinRoomRepo(rid, {
          guestUid: userId,
          guestSlotId: guestSlotSnapshot?.slotId ?? 0,
          guestDigimonSnapshot: guestSlotSnapshot,
          guestTamerName,
        });
      } catch (e) {
        setError(e.message || '참가 실패');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const leaveRoom = useCallback(async () => {
    if (roundTimeoutRef.current) {
      clearTimeout(roundTimeoutRef.current);
      roundTimeoutRef.current = null;
    }
    battleStartedForRoomIdRef.current = null;
    if (roomId && room && room.hostUid === userId && room.status === 'waiting') {
      try {
        await cancelRoomRepo(roomId);
      } catch (e) {
        console.warn('cancel room', e);
      }
    }
    setRoom(null);
    setBattleLog([]);
    setUserHits(0);
    setEnemyHits(0);
    setBattleWinner(null);
    setBattleStarted(false);
    setReadySent(false);
    setHostReady(false);
    setGuestReady(false);
    setError(null);
  }, [roomId, room, userId]);

  const sendReady = useCallback(() => {
    if (!ablyClient) {
      setError('실시간 배틀을 사용하려면 REACT_APP_ABLY_KEY를 설정해주세요.');
      return;
    }
    const ch = channelRef.current;
    if (!ch) return;
    const role = room?.hostUid === userId ? 'host' : 'guest';
    ch.publish('realtime-battle', { type: 'ready', role });
    setReadySent(true);
  }, [ablyClient, room, userId]);

  /** 덱 배틀: 카드 선택 제출. 호스트는 루프에서 수집, 게스트는 Ably로 전송 */
  const sendDeckChoice = useCallback((cardId) => {
    const ch = channelRef.current;
    if (!ch) return;
    const role = room?.hostUid === userId ? 'host' : 'guest';
    if (role === 'host') {
      hostChoiceForRoundRef.current = cardId;
      ch.publish('realtime-battle', { type: 'choice', roundIndex: pendingChoiceRoundIndex, role: 'host', cardId });
      if (guestChoiceForRoundRef.current != null && deckChoiceResolveRef.current) {
        deckChoiceResolveRef.current();
        deckChoiceResolveRef.current = null;
      }
    } else {
      guestSentChoiceForRoundRef.current = true;
      myUsedCardsRef.current[cardId] = (myUsedCardsRef.current[cardId] || 0) + 1;
      if (choiceTimeoutTimerRef.current) {
        clearTimeout(choiceTimeoutTimerRef.current);
        choiceTimeoutTimerRef.current = null;
      }
      setPendingChoiceRoundIndex(null);
      setChoiceTimeoutAt(null);
      ch.publish('realtime-battle', { type: 'choice', roundIndex: pendingChoiceRoundIndex, role: 'guest', cardId });
    }
  }, [room, userId, pendingChoiceRoundIndex]);

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    sendReady,
    sendDeckChoice,
    getWaitingRooms,
    room,
    roomId,
    isHost,
    battleLog,
    userHits,
    enemyHits,
    battleWinner,
    battleStarted,
    readySent,
    opponentReady: isHost ? guestReady : hostReady,
    error,
    loading,
    isAblyAvailable: !!ablyClient,
    battleMode,
    deckBattle: battleMode === 'deck' ? {
      pendingChoiceRoundIndex,
      choiceTimeoutAt,
      remainingCards: deckBattleRemainingCards,
      sendChoice: sendDeckChoice,
      lastRoundIndex,
      lastRoundHostCardId,
      lastRoundGuestCardId,
      usedCardIds: myUsedCardIdsInOrder,
      opponentChoiceReceived,
    } : null,
  };
}
