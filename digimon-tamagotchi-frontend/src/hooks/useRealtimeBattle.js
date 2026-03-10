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
import {
  createDeckState,
  draw,
  playCardFromHand,
  pickRandomFromHand,
  resolveDeckRound,
} from '../logic/battle/deckBattleEngine';
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
  /** 덱 배틀: 내 덱(미드로우된 카드), 손패, 사용더미 */
  const [deckBattleDeck, setDeckBattleDeck] = useState([]);
  const [deckBattleHand, setDeckBattleHand] = useState([]);
  const [deckBattleUsedPile, setDeckBattleUsedPile] = useState([]);
  // 덱 배틀: 직전 라운드에서 양쪽이 고른 카드 (배틀 화면에 표시용)
  const [lastRoundIndex, setLastRoundIndex] = useState(null);
  const [lastRoundHostCardId, setLastRoundHostCardId] = useState(null);
  const [lastRoundGuestCardId, setLastRoundGuestCardId] = useState(null);
  /** 덱 배틀: 이번 라운드 로그만 (1회 액션 재생용) */
  const [lastRoundLogEntries, setLastRoundLogEntries] = useState([]);
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
  /** 덱 배틀: 같은 라운드에서 resolve가 두 번 호출되지 않도록 (이중 액션 방지) */
  const roundResolvedRef = useRef(false);
  /** 덱 배틀: 이미 처리한 round 메시지 스킵 (roomId + roundIndex) */
  const lastProcessedRoundRef = useRef({ roomId: null, roundIndex: null });
  const choiceTimeoutTimerRef = useRef(null);
  const guestSentChoiceForRoundRef = useRef(false);
  /** 덱 배틀: 내 덱 상태(deck/hand/usedPile) — draw/playCardFromHand 반영용 */
  const deckStateRef = useRef(null);
  /** 덱 배틀: 게임 시작 시 3+1 드로우 완료 여부 */
  const deckBattleInitializedRef = useRef(false);

  const isHost = room && room.hostUid === userId;
  const battleMode = room?.battleMode || 'normal';

  // 방이 바뀌면 배틀/준비 상태 초기화 (방 만들기만 했을 때 이전 배틀 화면이 뜨지 않도록)
  useEffect(() => {
    if (!roomId) return;
    battleStartedForRoomIdRef.current = null;
    lastProcessedRoundRef.current = { roomId: null, roundIndex: null };
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
    setDeckBattleDeck([]);
    setDeckBattleHand([]);
    setDeckBattleUsedPile([]);
    setLastRoundIndex(null);
    setLastRoundHostCardId(null);
    setLastRoundGuestCardId(null);
    setLastRoundLogEntries([]);
    setOpponentChoiceReceived(false);
    deckStateRef.current = null;
    deckBattleInitializedRef.current = false;
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
        const timeoutMs = (data.timeoutMs != null && data.timeoutMs >= 5000) ? data.timeoutMs : DECK_CHOICE_TIMEOUT_MS;
        setOpponentChoiceReceived(false);
        setPendingChoiceRoundIndex(roundIdx);
        setChoiceTimeoutAt(Date.now() + timeoutMs);
        guestSentChoiceForRoundRef.current = false;
        const mySnap = room?.hostUid === userId ? room?.hostDigimonSnapshot : room?.guestDigimonSnapshot;
        const myDeck = mySnap?.battleDeck && mySnap.battleDeck.length ? mySnap.battleDeck : DEFAULT_BATTLE_DECK;

        // 덱 배틀: 손패 기반 — 라운드 1이면 3+1 드로우 초기화, 이후엔 라운드 시작 시 1장 드로우
        if (roundIdx === 1 && !deckBattleInitializedRef.current) {
          let state = createDeckState(myDeck);
          state = draw(state, 3);
          state = draw(state, 1);
          deckStateRef.current = state;
          deckBattleInitializedRef.current = true;
          setDeckBattleDeck(state.deck);
          setDeckBattleHand(state.hand);
          setDeckBattleUsedPile(state.usedPile);
        } else if (deckBattleInitializedRef.current && deckStateRef.current) {
          const state = draw(deckStateRef.current, 1);
          deckStateRef.current = state;
          setDeckBattleDeck(state.deck);
          setDeckBattleHand(state.hand);
          setDeckBattleUsedPile(state.usedPile);
        }

        if (room?.hostUid !== userId) {
          if (choiceTimeoutTimerRef.current) clearTimeout(choiceTimeoutTimerRef.current);
          choiceTimeoutTimerRef.current = setTimeout(() => {
            const hand = deckStateRef.current?.hand;
            if (hand && hand.length > 0 && !guestSentChoiceForRoundRef.current && channelRef.current) {
              const pick = pickRandomFromHand(hand);
              guestSentChoiceForRoundRef.current = true;
              channelRef.current.publish('realtime-battle', { type: 'choice', roundIndex: roundIdx, role: 'guest', cardId: pick });
            }
            setPendingChoiceRoundIndex(null);
            setChoiceTimeoutAt(null);
          }, timeoutMs);
        }
        return;
      }

      if (type === 'choice') {
        const isMyRole = (data.role === 'host' && room?.hostUid === userId) || (data.role === 'guest' && room?.hostUid !== userId);
        if (!isMyRole) setOpponentChoiceReceived(true);
        if (data.role === 'guest' && room?.hostUid === userId) {
          guestChoiceForRoundRef.current = data.cardId;
          // 호스트 자신의 선택도 들어온 경우에만 resolve (양쪽 선택 후에만 라운드 진행), 이중 resolve 방지
          if (hostChoiceForRoundRef.current != null && deckChoiceResolveRef.current && !roundResolvedRef.current) {
            roundResolvedRef.current = true;
            deckChoiceResolveRef.current();
            deckChoiceResolveRef.current = null;
          }
        }
        return;
      }

      if (type === 'round') {
        const { roundIndex, userHit, enemyHit, userHits: uh, enemyHits: eh, logEntries = [], hostCardId, guestCardId } = data;
        const rid = room?.id;
        if (rid != null && roundIndex != null && lastProcessedRoundRef.current.roomId === rid && lastProcessedRoundRef.current.roundIndex === roundIndex) {
          return;
        }
        if (rid != null && roundIndex != null) lastProcessedRoundRef.current = { roomId: rid, roundIndex };

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
        setUserHits(uh);
        setEnemyHits(eh);
        if (roundIndex != null && hostCardId != null && guestCardId != null) {
          setLastRoundIndex(roundIndex);
          setLastRoundHostCardId(hostCardId);
          setLastRoundGuestCardId(guestCardId);
          const myCardThisRound = room?.hostUid === userId ? hostCardId : guestCardId;
          if (deckStateRef.current) {
            const nextState = playCardFromHand(deckStateRef.current, myCardThisRound);
            deckStateRef.current = nextState;
            setDeckBattleDeck(nextState.deck);
            setDeckBattleHand(nextState.hand);
            setDeckBattleUsedPile(nextState.usedPile);
          }
        }
        const isHostSide = room?.hostUid === userId;
        const transformedRoundLogs = (logEntries || []).map((entry) => {
          if (isHostSide) return entry;
          return {
            ...entry,
            attacker: entry.attacker === 'user' ? 'enemy' : 'user',
            defender: entry.defender === 'user' ? 'enemy' : 'user',
          };
        });
        setLastRoundLogEntries(transformedRoundLogs);
        setBattleLog((prev) => [...prev, ...transformedRoundLogs]);
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
      updateRoom(room.id, { status: 'fighting' }).catch(console.error);

      // 덱 배틀: 손패 기반 — 라운드별 드로우 → 선택 → 공개 → 판정 → 사용카드 더미
      (async () => {
        const channel = channelRef.current;
        for (let r = 1; ; r++) {
          roundResolvedRef.current = false;

          // 호스트 덱 상태: 라운드 1이면 3+1 드로우, 이후엔 1장 드로우
          if (r === 1) {
            let hostState = createDeckState(hostDeck);
            hostState = draw(hostState, 3);
            hostState = draw(hostState, 1);
            deckStateRef.current = hostState;
            deckBattleInitializedRef.current = true;
            setDeckBattleDeck(hostState.deck);
            setDeckBattleHand(hostState.hand);
            setDeckBattleUsedPile(hostState.usedPile);
          } else if (deckStateRef.current) {
            const hostState = draw(deckStateRef.current, 1);
            deckStateRef.current = hostState;
            setDeckBattleDeck(hostState.deck);
            setDeckBattleHand(hostState.hand);
            setDeckBattleUsedPile(hostState.usedPile);
          }

          channel?.publish('realtime-battle', { type: 'request_choice', roundIndex: r, timeoutMs: DECK_CHOICE_TIMEOUT_MS });
          setPendingChoiceRoundIndex(r);
          setChoiceTimeoutAt(Date.now() + DECK_CHOICE_TIMEOUT_MS);
          hostChoiceForRoundRef.current = null;
          guestChoiceForRoundRef.current = null;
          await new Promise((resume) => setTimeout(resume, 500));
          await new Promise((resolve) => {
            deckChoiceResolveRef.current = resolve;
            setTimeout(() => {
              if (roundResolvedRef.current) return;
              roundResolvedRef.current = true;
              if (deckChoiceResolveRef.current) {
                deckChoiceResolveRef.current();
                deckChoiceResolveRef.current = null;
              }
            }, DECK_CHOICE_TIMEOUT_MS);
          });

          const hCard = hostChoiceForRoundRef.current ?? (deckStateRef.current?.hand?.length ? pickRandomFromHand(deckStateRef.current.hand) : 'attack');
          const gCard = guestChoiceForRoundRef.current ?? 'attack';

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

          if (deckStateRef.current) {
            const nextState = playCardFromHand(deckStateRef.current, hCard);
            deckStateRef.current = nextState;
            setDeckBattleDeck(nextState.deck);
            setDeckBattleHand(nextState.hand);
            setDeckBattleUsedPile(nextState.usedPile);
          }

          setUserHits(uh);
          setEnemyHits(eh);
          setBattleLog((prev) => [...prev, ...(res.logEntries || [])]);
          setBattleStarted(true);
          setPendingChoiceRoundIndex(null);
          setChoiceTimeoutAt(null);
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
      if (guestChoiceForRoundRef.current != null && deckChoiceResolveRef.current && !roundResolvedRef.current) {
        roundResolvedRef.current = true;
        deckChoiceResolveRef.current();
        deckChoiceResolveRef.current = null;
      }
    } else {
      guestSentChoiceForRoundRef.current = true;
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
      hand: deckBattleHand,
      deck: deckBattleDeck,
      usedPile: deckBattleUsedPile,
      deckLength: deckBattleDeck.length,
      sendChoice: sendDeckChoice,
      lastRoundIndex,
      lastRoundHostCardId,
      lastRoundGuestCardId,
      lastRoundLogEntries,
      usedCardIds: deckBattleUsedPile,
      opponentChoiceReceived,
    } : null,
  };
}
