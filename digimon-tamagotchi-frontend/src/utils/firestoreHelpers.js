// src/utils/firestoreHelpers.js
/**
 * Firestore 슬롯 삭제 시 서브컬렉션 정리 유틸
 * Firestore는 문서 삭제 시 서브컬렉션을 자동 삭제하지 않으므로, 슬롯 재사용 시 옛 로그가 남는 문제를 막기 위해 사용합니다.
 */

import { doc, collection, getDocs, deleteDoc } from 'firebase/firestore';

function isPermissionDeniedError(error) {
  return (
    error?.code === 'permission-denied' ||
    error?.message?.includes('Missing or insufficient permissions')
  );
}

/**
 * 슬롯 문서의 서브컬렉션(logs, battleLogs)을 best-effort로 정리한 뒤 슬롯 문서를 삭제합니다.
 * 서브컬렉션 규칙이 부모 문서보다 엄격한 프로젝트에서는 정리만 실패할 수 있으므로,
 * 이 경우에도 슬롯 문서 삭제는 계속 진행합니다.
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
    try {
      const colRef = collection(slotRef, name);
      const snap = await getDocs(colRef);
      const deletes = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletes);
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        console.warn(
          `[deleteSlotWithSubcollections] ${name} 정리 권한이 없어 슬롯 문서만 삭제합니다.`,
          error
        );
      } else {
        console.warn(
          `[deleteSlotWithSubcollections] ${name} 정리 중 오류가 발생했지만 슬롯 문서 삭제는 계속합니다.`,
          error
        );
      }
    }
  }
  await deleteDoc(slotRef);
}
