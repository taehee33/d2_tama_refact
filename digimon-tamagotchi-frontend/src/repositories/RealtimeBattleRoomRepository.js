// src/repositories/RealtimeBattleRoomRepository.js
// 실시간 배틀 방 Firestore CRUD

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'realtime_battle_rooms';
const WAITING_ROOMS_LIMIT = 30;

/**
 * 대기 중인 방 목록 조회 (status === 'waiting')
 * @returns {Promise<Array<{ id: string, ... }>>}
 */
export async function getWaitingRooms() {
  if (!db) throw new Error('Firestore is not available');
  const ref = collection(db, COLLECTION);
  const q = query(
    ref,
    where('status', '==', 'waiting'),
    orderBy('createdAt', 'desc'),
    limit(WAITING_ROOMS_LIMIT)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * 방 하나 조회
 * @param {string} roomId
 * @returns {Promise<Object|null>}
 */
export async function getRoom(roomId) {
  if (!db || !roomId) return null;
  const ref = doc(db, COLLECTION, roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * 방 생성 (호스트)
 * @param {Object} params
 * @param {string} params.hostUid
 * @param {number} params.hostSlotId
 * @param {Object} params.hostDigimonSnapshot - createDigimonSnapshot() 결과
 * @param {string} params.hostTamerName
 * @param {number} params.roomSeed - Math.floor(Math.random() * 1e9) 등
 * @param {string} [params.battleMode='normal'] - 'normal' | 'deck'
 * @returns {Promise<{ id: string }>}
 */
export async function createRoom({
  hostUid,
  hostSlotId,
  hostDigimonSnapshot,
  hostTamerName,
  roomSeed,
  battleMode = 'normal',
}) {
  if (!db) throw new Error('Firestore is not available');
  const ref = collection(db, COLLECTION);
  const docRef = await addDoc(ref, {
    hostUid,
    hostSlotId,
    hostDigimonSnapshot,
    hostTamerName,
    roomSeed: roomSeed ?? Math.floor(Math.random() * 1e9),
    battleMode: battleMode === 'deck' ? 'deck' : 'normal',
    status: 'waiting',
    createdAt: serverTimestamp(),
  });
  return { id: docRef.id };
}

/**
 * 게스트 참가
 * @param {string} roomId
 * @param {Object} params
 * @param {string} params.guestUid
 * @param {number} params.guestSlotId
 * @param {Object} params.guestDigimonSnapshot
 * @param {string} params.guestTamerName
 */
export async function joinRoom(roomId, { guestUid, guestSlotId, guestDigimonSnapshot, guestTamerName }) {
  if (!db || !roomId) throw new Error('roomId required');
  const ref = doc(db, COLLECTION, roomId);
  await updateDoc(ref, {
    guestUid,
    guestSlotId,
    guestDigimonSnapshot,
    guestTamerName,
    status: 'ready',
    updatedAt: serverTimestamp(),
  });
}

/**
 * 방 상태 변경 (ready → fighting, fighting → finished)
 * @param {string} roomId
 * @param {Object} updates - { status, winner?, finishedAt?, disconnectReason? }
 */
export async function updateRoom(roomId, updates) {
  if (!db || !roomId) throw new Error('roomId required');
  const ref = doc(db, COLLECTION, roomId);
  const payload = { ...updates, updatedAt: serverTimestamp() };
  if (updates.status === 'finished' && !payload.finishedAt) {
    payload.finishedAt = serverTimestamp();
  }
  await updateDoc(ref, payload);
}

/**
 * 방 취소 (호스트가 대기 중 나가기)
 * @param {string} roomId
 */
export async function cancelRoom(roomId) {
  return updateRoom(roomId, { status: 'cancelled' });
}
