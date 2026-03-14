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

const ABLY_CHANNEL_PREFIX = 'realtime-battle:';
const ROUND_TIMEOUT_MS = 90000; // 90초 내에 round 미수신 시 상대 이탈 처리

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

  const channelRef = useRef(null);
  const battleLoopRef = useRef(false);
  const battleStartedForRoomIdRef = useRef(null); // 같은 방에서 배틀 루프 한 번만 실행
  const roundTimeoutRef = useRef(null);

  const isHost = room && room.hostUid === userId;

  // 방이 바뀌면 배틀/준비 상태 초기화 (방 만들기만 했을 때 이전 배틀 화면이 뜨지 않도록)
  useEffect(() => {
    if (!roomId) return;
    setBattleStarted(false);
    setBattleLog([]);
    setUserHits(0);
    setEnemyHits(0);
    setBattleWinner(null);
    setReadySent(false);
    setHostReady(false);
    setGuestReady(false);
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

      if (type === 'round') {
        battleLoopRef.current = false;
        if (roundTimeoutRef.current) {
          clearTimeout(roundTimeoutRef.current);
          roundTimeoutRef.current = null;
        }
        setBattleStarted(true);
        const { roundIndex, userHit, enemyHit, userHits: uh, enemyHits: eh, logEntries = [] } = data;
        setUserHits(uh);
        setEnemyHits(eh);
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

    let uh = 0;
    let eh = 0;
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
  }, [room?.id, isHost, hostReady, guestReady]);

  const createRoom = useCallback(
    async (hostSlotSnapshot, hostTamerName) => {
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

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    sendReady,
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
  };
}
