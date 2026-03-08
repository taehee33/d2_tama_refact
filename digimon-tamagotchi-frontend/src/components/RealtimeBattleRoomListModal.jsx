// src/components/RealtimeBattleRoomListModal.jsx
// 실시간 배틀: 방 목록(대기 중), 방 만들기, 참가, 방 대기(준비) UI

import React, { useState, useEffect, useRef } from 'react';
import { createDigimonSnapshotForBattle } from '../utils/battleSnapshotUtils';
import { DEFAULT_BATTLE_DECK } from '../data/battleCards';
import { digimonDataVer1 } from '../data/v1/digimons';
import { digimonDataVer2, V2_SPRITE_BASE } from '../data/v2modkor';
import { getAchievementsAndMaxSlots } from '../utils/userProfileUtils';
import { userSlotRepository } from '../repositories/UserSlotRepository';
import { cancelRoom as cancelRoomRepo } from '../repositories/RealtimeBattleRoomRepository';
import { formatTimestamp } from '../utils/dateUtils';
import '../styles/Battle.css';

function roomCreatedAt(room) {
  const raw = room?.createdAt;
  if (!raw) return null;
  if (raw.toDate && typeof raw.toDate === 'function') return raw.toDate();
  if (typeof raw.seconds === 'number') return new Date(raw.seconds * 1000);
  if (typeof raw === 'number') return new Date(raw);
  return new Date(raw);
}

const SPRITE_BASE = (snap) => snap?.spriteBasePath || (snap?.slotVersion === 'Ver.2' ? V2_SPRITE_BASE : '/images');

/** 배틀 준비 중임을 알리는 표시 (렉이 아님) — 점 애니메이션 */
function PreparingIndicator() {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d + 1) % 4), 500);
    return () => clearInterval(t);
  }, []);
  const dotStr = '.'.repeat(dots);
  return (
    <p className="text-center text-gray-600">
      배틀 준비중{dotStr}
    </p>
  );
}

export default function RealtimeBattleRoomListModal({
  onClose,
  roomId,
  setRoomId,
  createRoom,
  joinRoom,
  getWaitingRooms,
  leaveRoom,
  sendReady,
  room,
  isHost,
  battleLog,
  userHits,
  enemyHits,
  battleWinner,
  battleStarted,
  readySent,
  opponentReady,
  error,
  loading,
  isAblyAvailable = true,
  currentSlot,
  tamerName,
  userId,
  onStartBattle,
}) {
  const [waitingRooms, setWaitingRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [joinSlotModal, setJoinSlotModal] = useState(null); // { roomId, hostTamerName, battleMode }
  const [userSlots, setUserSlots] = useState([]);
  const [creating, setCreating] = useState(false);
  const battleScreenOpenedForRoomRef = useRef(false);

  // 방이 바뀌면 배틀 화면 오픈 플래그 초기화 (같은 방에서 한 번만 onStartBattle 호출하기 위함)
  useEffect(() => {
    battleScreenOpenedForRoomRef.current = false;
  }, [roomId]);

  // 참가 시 슬롯 목록 로드
  useEffect(() => {
    if (!joinSlotModal || !userId) return;
    let cancelled = false;
    getAchievementsAndMaxSlots(userId)
      .then(({ maxSlots = 10 }) => userSlotRepository.getUserSlots(userId, maxSlots))
      .then((slots) => {
        if (!cancelled) setUserSlots(slots || []);
      })
      .catch(() => {
        if (!cancelled) setUserSlots([]);
      });
    return () => { cancelled = true; };
  }, [joinSlotModal, userId]);

  // 대기 중인 방 목록 로드 (내가 호스트인 대기 방은 취소하고 목록에서 제외)
  useEffect(() => {
    if (roomId) return;
    let cancelled = false;
    setRoomsLoading(true);
    getWaitingRooms()
      .then((list) => {
        if (cancelled) return;
        const myRooms = (list || []).filter((r) => r.hostUid === userId);
        myRooms.forEach((r) => cancelRoomRepo(r.id).catch(() => {}));
        const others = (list || []).filter((r) => r.hostUid !== userId);
        setWaitingRooms(others);
      })
      .catch(() => {
        if (!cancelled) setWaitingRooms([]);
      })
      .finally(() => {
        if (!cancelled) setRoomsLoading(false);
      });
    return () => { cancelled = true; };
  }, [roomId, getWaitingRooms, userId]);

  // 배틀 시작 시 부모에게 알림 (BattleScreen 열기) — status fighting 또는 첫 라운드 후 한 번만 호출
  useEffect(() => {
    const shouldOpen = (room?.status === 'fighting' || battleStarted) && room && onStartBattle && !battleScreenOpenedForRoomRef.current;
    if (!shouldOpen) return;
    battleScreenOpenedForRoomRef.current = true;
    const mySnapshot = isHost ? room.hostDigimonSnapshot : room.guestDigimonSnapshot;
    onStartBattle({
      room,
      isHost,
      battleLog: battleLog || [],
      userHits: userHits ?? 0,
      enemyHits: enemyHits ?? 0,
      battleWinner: battleWinner ?? null,
      mySnapshot: mySnapshot || null,
    });
  }, [room?.status, battleStarted, room, isHost, battleLog, userHits, enemyHits, battleWinner, onStartBattle]);

  const handleCreateRoom = async (battleMode = 'normal') => {
    if (!currentSlot || currentSlot.selectedDigimon === 'Digitama' || !userId) {
      alert('배틀에 참가할 수 있는 슬롯을 선택한 뒤 시도해주세요.');
      return;
    }
    setCreating(true);
    try {
      const slotForSnapshot = battleMode === 'deck'
        ? { ...currentSlot, battleDeck: (currentSlot.battleDeck && currentSlot.battleDeck.length) ? currentSlot.battleDeck : DEFAULT_BATTLE_DECK }
        : currentSlot;
      const snapshot = createDigimonSnapshotForBattle(slotForSnapshot, digimonDataVer1, digimonDataVer2);
      const id = await createRoom(snapshot, tamerName || '테이머', battleMode);
      setRoomId(id);
    } catch (e) {
      alert(e.message || '방 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinClick = (r) => {
    setJoinSlotModal({ roomId: r.id, hostTamerName: r.hostTamerName, battleMode: r.battleMode || 'normal' });
  };

  const handleJoinConfirm = async (slot) => {
    if (!joinSlotModal || slot.selectedDigimon === 'Digitama') return;
    try {
      const slotForSnapshot = (joinSlotModal.battleMode === 'deck' && (!slot.battleDeck || !slot.battleDeck.length))
        ? { ...slot, battleDeck: DEFAULT_BATTLE_DECK }
        : slot;
      const snapshot = createDigimonSnapshotForBattle(slotForSnapshot, digimonDataVer1, digimonDataVer2);
      await joinRoom(joinSlotModal.roomId, snapshot, tamerName || '테이머');
      setRoomId(joinSlotModal.roomId);
      setJoinSlotModal(null);
    } catch (e) {
      alert(e.message || '참가에 실패했습니다.');
    }
  };

  const handleLeave = async () => {
    await leaveRoom();
    setRoomId(null);
  };

  const inRoom = !!roomId && room;
  const showList = !inRoom;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div className="battle-modal bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {!isAblyAvailable && (
          <div className="p-3 bg-amber-100 text-amber-900 text-sm rounded-t-lg">
            실시간 동기화를 사용할 수 없습니다. REACT_APP_ABLY_KEY 환경 변수를 설정해주세요.
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-100 text-red-800 text-sm rounded-t-lg">
            {error}
          </div>
        )}

        {showList && (
          <>
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">실시간 배틀</h2>
              <button type="button" onClick={onClose} className="text-gray-500 hover:text-black">
                닫기
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleCreateRoom('normal')}
                  disabled={!isAblyAvailable || loading || creating || !currentSlot || currentSlot.selectedDigimon === 'Digitama'}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50"
                  title={!isAblyAvailable ? 'Ably 키 설정 후 이용 가능' : undefined}
                >
                  {creating ? '방 만드는 중…' : '방 만들기 (일반)'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateRoom('deck')}
                  disabled={!isAblyAvailable || loading || creating || !currentSlot || currentSlot.selectedDigimon === 'Digitama'}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
                  title={!isAblyAvailable ? 'Ably 키 설정 후 이용 가능' : undefined}
                >
                  {creating ? '방 만드는 중…' : '방 만들기 (덱)'}
                </button>
              </div>

              <h3 className="font-semibold text-gray-700">대기 중인 방</h3>
              {roomsLoading ? (
                <p className="text-gray-500 text-sm">목록 불러오는 중…</p>
              ) : waitingRooms.length === 0 ? (
                <p className="text-gray-500 text-sm">대기 중인 방이 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {waitingRooms.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center overflow-hidden">
                          <span className="text-gray-500 text-xs">???</span>
                        </div>
                        <div>
                          <p className="font-medium">{r.hostTamerName || '호스트'}</p>
                          <p className="text-xs text-gray-500">
                            대기 중
                            <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-gray-200">
                              {r.battleMode === 'deck' ? '덱' : '일반'}
                            </span>
                          </p>
                          {r.createdAt && (
                            <p className="text-xs text-gray-400 mt-0.5">만든 시간: {formatTimestamp(roomCreatedAt(r), 'short')}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleJoinClick(r)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                      >
                        참가
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {inRoom && (
          <>
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">배틀 방</h2>
              <button type="button" onClick={handleLeave} className="text-gray-500 hover:text-black text-sm">
                나가기
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">{isHost ? '나' : '상대'}</p>
                  <p className="font-medium">{isHost ? room.hostTamerName : room.guestTamerName}</p>
                  {isHost ? (
                    room.hostDigimonSnapshot && (
                      <>
                        <img
                          src={`${SPRITE_BASE(room.hostDigimonSnapshot)}/${room.hostDigimonSnapshot.sprite ?? 0}.png`}
                          alt={room.hostDigimonSnapshot.digimonName}
                          className="w-16 h-16 mx-auto object-contain"
                        />
                        <p className="text-sm">{room.hostDigimonSnapshot.digimonName}</p>
                        <p className="text-xs text-gray-500">PWR {room.hostDigimonSnapshot.stats?.power ?? '?'}</p>
                      </>
                    )
                  ) : (
                    room.guestDigimonSnapshot && (
                      <>
                        <img
                          src={`${SPRITE_BASE(room.guestDigimonSnapshot)}/${room.guestDigimonSnapshot.sprite ?? 0}.png`}
                          alt={room.guestDigimonSnapshot.digimonName}
                          className="w-16 h-16 mx-auto object-contain"
                        />
                        <p className="text-sm">{room.guestDigimonSnapshot.digimonName}</p>
                        <p className="text-xs text-gray-500">PWR {room.guestDigimonSnapshot.stats?.power ?? '?'}</p>
                      </>
                    )
                  )}
                  {room.status === 'ready' && (
                    <p className={`text-xs font-medium mt-2 ${isHost ? (readySent ? 'text-green-600' : 'text-gray-500') : (opponentReady ? 'text-green-600' : 'text-gray-500')}`}>
                      {isHost ? (readySent ? '준비완료 ✓' : '대기중') : (opponentReady ? '준비완료 ✓' : '대기중')}
                    </p>
                  )}
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">{isHost ? '상대' : '나'}</p>
                  <p className="font-medium">{isHost ? room.guestTamerName || '대기 중…' : room.hostTamerName}</p>
                  {isHost ? (
                    room.guestDigimonSnapshot ? (
                      <>
                        <img
                          src={`${SPRITE_BASE(room.guestDigimonSnapshot)}/${room.guestDigimonSnapshot.sprite ?? 0}.png`}
                          alt={room.guestDigimonSnapshot.digimonName}
                          className="w-16 h-16 mx-auto object-contain"
                        />
                        <p className="text-sm">{room.guestDigimonSnapshot.digimonName}</p>
                        <p className="text-xs text-gray-500">PWR {room.guestDigimonSnapshot.stats?.power ?? '?'}</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">참가 대기 중</p>
                    )
                  ) : (
                    room.hostDigimonSnapshot && (
                      <>
                        <img
                          src={`${SPRITE_BASE(room.hostDigimonSnapshot)}/${room.hostDigimonSnapshot.sprite ?? 0}.png`}
                          alt={room.hostDigimonSnapshot.digimonName}
                          className="w-16 h-16 mx-auto object-contain"
                        />
                        <p className="text-sm">{room.hostDigimonSnapshot.digimonName}</p>
                        <p className="text-xs text-gray-500">PWR {room.hostDigimonSnapshot.stats?.power ?? '?'}</p>
                      </>
                    )
                  )}
                  {room.status === 'ready' && (
                    <p className={`text-xs font-medium mt-2 ${isHost ? (opponentReady ? 'text-green-600' : 'text-gray-500') : (readySent ? 'text-green-600' : 'text-gray-500')}`}>
                      {isHost ? (opponentReady ? '준비완료 ✓' : '대기중') : (readySent ? '준비완료 ✓' : '대기중')}
                    </p>
                  )}
                </div>
              </div>

              {room.status === 'ready' && (
                <>
                  {!readySent ? (
                    <button
                      type="button"
                      onClick={sendReady}
                      disabled={!isAblyAvailable}
                      className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
                      title={!isAblyAvailable ? 'Ably 키 설정 후 이용 가능' : undefined}
                    >
                      준비 완료
                    </button>
                  ) : (
                    <p className="text-center text-gray-600">
                      {opponentReady ? '양쪽 준비 완료. 배틀을 시작합니다…' : '상대가 준비할 때까지 기다려 주세요.'}
                    </p>
                  )}
                </>
              )}
              {room.status === 'fighting' && !battleStarted && (
                <PreparingIndicator />
              )}
            </div>
          </>
        )}

        {joinSlotModal && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 rounded-lg">
            <div className="bg-white rounded-lg p-4 max-w-sm w-full">
              <p className="font-semibold mb-2">참가할 슬롯 선택</p>
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {(userSlots || []).map((slot) => (
                  <li key={slot.id}>
                    <button
                      type="button"
                      onClick={() => handleJoinConfirm(slot)}
                      disabled={slot.selectedDigimon === 'Digitama'}
                      className="w-full text-left p-2 rounded border hover:bg-gray-50 disabled:opacity-50"
                    >
                      {slot.slotName || `슬롯 ${slot.id}`} — {slot.selectedDigimon === 'Digitama' ? '디지타마' : slot.selectedDigimon}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setJoinSlotModal(null)}
                className="mt-2 w-full py-2 bg-gray-200 rounded"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
