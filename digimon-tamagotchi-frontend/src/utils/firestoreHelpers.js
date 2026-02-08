// src/utils/firestoreHelpers.js
/**
 * Firestore 슬롯 삭제 시 서브컬렉션 정리 유틸
 * Firestore는 문서 삭제 시 서브컬렉션을 자동 삭제하지 않으므로, 슬롯 재사용 시 옛 로그가 남는 문제를 막기 위해 사용합니다.
 */

import { doc, collection, getDocs, deleteDoc } from 'firebase/firestore';

/**
 * 슬롯 문서의 서브컬렉션(logs, battleLogs) 내 모든 문서를 삭제한 뒤 슬롯 문서를 삭제합니다.
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} userId - 유저 UID
 * @param {number} slotId - 슬롯 번호 (1, 2, ...)
 * @returns {Promise<void>}
 */
export async function deleteSlotWithSubcollections(db, userId, slotId) {
  if (!db || !userId || slotId == null) return;
  const slotRef = doc(db, 'users', userId, 'slots', `slot${slotId}`);

  const subcollections = ['logs', 'battleLogs'];
  for (const name of subcollections) {
    const colRef = collection(slotRef, name);
    const snap = await getDocs(colRef);
    const deletes = snap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletes);
  }
  await deleteDoc(slotRef);
}
