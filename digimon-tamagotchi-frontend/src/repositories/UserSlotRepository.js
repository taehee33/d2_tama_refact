// src/repositories/UserSlotRepository.js
/**
 * 유저별 슬롯 관리 Repository
 * Firestore 구조: users/{userId}/slots/{slotId}
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { deleteSlotWithSubcollections } from '../utils/firestoreHelpers';
import { resolveSlotNotificationEligible } from '../utils/notificationEligibility';

const CARE_MISTAKE_PROJECTION_FIELDS = Object.freeze([
  'careMistakes',
  'unresolvedCareMistakeCount',
  'latestUnresolvedCareMistakeIncidentId',
  'latestCareMistakeAt',
  'careMistakeSchemaVersion',
  'careMistakeReconciliationVersion',
  'careMistakeReconciliationStatus',
  'evolutionStageInstanceId',
  'careMistakeReconciliationChecksum',
  'lastGameTransitionId',
]);

function hasOwn(value, key) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

function stripCareMistakeProjection(stats = {}) {
  const safeStats = { ...(stats || {}) };
  CARE_MISTAKE_PROJECTION_FIELDS.forEach((field) => delete safeStats[field]);
  delete safeStats.careMistakeLedger;
  return safeStats;
}

function resolveAuthoritativeCareProjection(slotData = {}) {
  const nestedStats = slotData.digimonStats;
  const projection = {};
  CARE_MISTAKE_PROJECTION_FIELDS.forEach((field) => {
    if (hasOwn(slotData, field)) {
      projection[field] = slotData[field];
    } else if (hasOwn(nestedStats, field)) {
      projection[field] = nestedStats[field];
    }
  });
  return projection;
}

function protectLegacySlotPayload(slotData = {}, currentSlotData = null) {
  const safeSlotData = { ...(slotData || {}) };
  CARE_MISTAKE_PROJECTION_FIELDS.forEach((field) => delete safeSlotData[field]);

  const currentStats = currentSlotData?.digimonStats;
  if (hasOwn(safeSlotData, 'digimonStats')) {
    const requestedStats = safeSlotData.digimonStats;
    safeSlotData.digimonStats = {
      ...(currentStats && typeof currentStats === 'object' ? currentStats : {}),
      ...stripCareMistakeProjection(requestedStats),
    };
    const authoritativeNestedProjection =
      currentStats && typeof currentStats === 'object'
        ? resolveAuthoritativeCareProjection({ digimonStats: currentStats })
        : {};
    CARE_MISTAKE_PROJECTION_FIELDS
      .filter((field) => field !== 'careMistakeReconciliationChecksum' && field !== 'lastGameTransitionId')
      .forEach((field) => {
        if (hasOwn(authoritativeNestedProjection, field)) {
          safeSlotData.digimonStats[field] = authoritativeNestedProjection[field];
        } else {
          delete safeSlotData.digimonStats[field];
        }
      });
    delete safeSlotData.digimonStats.careMistakeLedger;
  }

  if (currentSlotData) {
    Object.assign(safeSlotData, resolveAuthoritativeCareProjection(currentSlotData));
  }
  return safeSlotData;
}

class UserSlotRepository {
  /**
   * 유저의 슬롯 데이터 가져오기
   * @param {string} userId - 유저 ID
   * @param {number} slotId - 슬롯 ID
   * @returns {Promise<Object|null>} 슬롯 데이터 또는 null
   */
  async getUserSlot(userId, slotId) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const slotRef = doc(db, 'users', userId, 'slots', `slot${slotId}`);
    const slotSnap = await getDoc(slotRef);

    if (!slotSnap.exists()) {
      return null;
    }

    return {
      id: slotId,
      ...slotSnap.data(),
    };
  }

  /**
   * 유저의 모든 슬롯 목록 가져오기
   * @param {string} userId - 유저 ID
   * @param {number} maxSlots - 최대 슬롯 수 (기본값: 10)
   * @returns {Promise<Array>} 슬롯 배열
   */
  async getUserSlots(userId, maxSlots = 10) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const slotsRef = collection(db, 'users', userId, 'slots');
    const q = query(slotsRef, orderBy('createdAt', 'desc'), limit(maxSlots));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      // 문서 ID에서 slotId 추출 (예: "slot1" -> 1)
      const slotId = parseInt(doc.id.replace('slot', ''));
      return {
        id: slotId,
        ...data,
      };
    });
  }

  /**
   * 유저의 슬롯 데이터 저장하기
   * @param {string} userId - 유저 ID
   * @param {number} slotId - 슬롯 ID
   * @param {Object} slotData - 저장할 슬롯 데이터
   * @returns {Promise<void>}
   */
  async saveUserSlot(userId, slotId, slotData) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const slotRef = doc(db, 'users', userId, 'slots', `slot${slotId}`);
    const currentSlotSnap = await getDoc(slotRef);
    const currentSlotData = currentSlotSnap.exists() ? currentSlotSnap.data() : null;
    const safeSlotData = protectLegacySlotPayload(slotData, currentSlotData);
    await setDoc(
      slotRef,
      {
        ...safeSlotData,
        notificationEligible: resolveSlotNotificationEligible({
          selectedDigimon: safeSlotData?.selectedDigimon,
          stats: safeSlotData?.digimonStats,
          slotData: safeSlotData,
        }),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  /**
   * 유저의 디지몬 스탯만 저장하기
   * @param {string} userId - 유저 ID
   * @param {number} slotId - 슬롯 ID
   * @param {Object} digimonStats - 디지몬 스탯 객체
   * @returns {Promise<void>}
   */
  async saveUserDigimonStats(userId, slotId, digimonStats) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const slotRef = doc(db, 'users', userId, 'slots', `slot${slotId}`);
    const currentSlotSnap = await getDoc(slotRef);
    const currentSlotData = currentSlotSnap.exists() ? currentSlotSnap.data() : null;
    const currentStats = currentSlotData?.digimonStats || {};
    const statsWithoutProteinCount = {
      ...currentStats,
      ...(digimonStats || {}),
    };
    delete statsWithoutProteinCount.proteinCount;
    const safeSlotData = protectLegacySlotPayload(
      { digimonStats: statsWithoutProteinCount },
      currentSlotData
    );

    await updateDoc(slotRef, {
      digimonStats: safeSlotData.digimonStats,
      notificationEligible: resolveSlotNotificationEligible({
        selectedDigimon: digimonStats?.selectedDigimon,
        stats: safeSlotData.digimonStats,
      }),
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 유저의 선택된 디지몬만 저장하기
   * @param {string} userId - 유저 ID
   * @param {number} slotId - 슬롯 ID
   * @param {string} digimonName - 디지몬 이름
   * @returns {Promise<void>}
   */
  async saveUserSelectedDigimon(userId, slotId, digimonName) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const slotRef = doc(db, 'users', userId, 'slots', `slot${slotId}`);
    await updateDoc(slotRef, {
      selectedDigimon: digimonName,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * 유저의 슬롯 삭제하기
   * @param {string} userId - 유저 ID
   * @param {number} slotId - 슬롯 ID
   * @returns {Promise<void>}
   */
  async deleteUserSlot(userId, slotId) {
    if (!userId) {
      throw new Error('userId is required');
    }

    await deleteSlotWithSubcollections(db, userId, slotId);
  }

  /**
   * 유저의 빈 슬롯 찾기
   * @param {string} userId - 유저 ID
   * @param {number} maxSlots - 최대 슬롯 수 (기본값: 10)
   * @returns {Promise<number|null>} 빈 슬롯 ID 또는 null
   */
  async findEmptyUserSlot(userId, maxSlots = 10) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const slots = await this.getUserSlots(userId, maxSlots);
    const usedSlots = new Set(slots.map((slot) => slot.id));

    for (let i = 1; i <= maxSlots; i++) {
      if (!usedSlots.has(i)) {
        return i;
      }
    }

    return null;
  }

  /**
   * 유저 정보 생성/업데이트
   * @param {string} userId - 유저 ID
   * @param {Object} userData - 유저 데이터 (email, displayName 등)
   * @returns {Promise<void>}
   */
  async saveUser(userId, userData) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const userRef = doc(db, 'users', userId);
    await setDoc(
      userRef,
      {
        ...userData,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  /**
   * 유저 정보 가져오기
   * @param {string} userId - 유저 ID
   * @returns {Promise<Object|null>} 유저 데이터 또는 null
   */
  async getUser(userId) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    return {
      id: userId,
      ...userSnap.data(),
    };
  }
}

// 싱글톤 인스턴스
export const userSlotRepository = new UserSlotRepository();
export default userSlotRepository;
