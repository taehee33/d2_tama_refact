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
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';

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
    await setDoc(
      slotRef,
      {
        ...slotData,
        updatedAt: new Date(),
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
    await updateDoc(slotRef, {
      digimonStats,
      updatedAt: new Date(),
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
      updatedAt: new Date(),
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

    const slotRef = doc(db, 'users', userId, 'slots', `slot${slotId}`);
    await deleteDoc(slotRef);
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
        updatedAt: new Date(),
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






