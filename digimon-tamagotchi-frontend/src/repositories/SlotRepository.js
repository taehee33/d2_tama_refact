// src/repositories/SlotRepository.js
/**
 * Repository 패턴을 사용한 데이터 저장소 추상화
 * 
 * 현재는 localStorage를 사용하지만, 나중에 Firestore로 쉽게 교체 가능
 * 
 * 사용법:
 *   import { slotRepository } from './repositories/SlotRepository';
 *   
 *   // 슬롯 데이터 가져오기
 *   const slot = await slotRepository.getSlot(slotId);
 *   
 *   // 슬롯 데이터 저장하기
 *   await slotRepository.saveSlot(slotId, slotData);
 */

// ============================================
// LocalStorage 구현 (현재 사용)
// ============================================
class LocalStorageSlotRepository {
  /**
   * 슬롯 데이터 가져오기
   * @param {number} slotId - 슬롯 ID (1-10)
   * @returns {Promise<Object|null>} 슬롯 데이터 또는 null
   */
  async getSlot(slotId) {
    const selectedDigimon = localStorage.getItem(`slot${slotId}_selectedDigimon`);
    
    if (!selectedDigimon) {
      return null;
    }

    const digimonStatsStr = localStorage.getItem(`slot${slotId}_digimonStats`);
    const digimonStats = digimonStatsStr ? JSON.parse(digimonStatsStr) : {};

    return {
      id: slotId,
      selectedDigimon: selectedDigimon || 'Digitama',
      digimonStats,
      slotName: localStorage.getItem(`slot${slotId}_slotName`) || `슬롯${slotId}`,
      createdAt: localStorage.getItem(`slot${slotId}_createdAt`) || '',
      device: localStorage.getItem(`slot${slotId}_device`) || '',
      version: localStorage.getItem(`slot${slotId}_version`) || 'Ver.1',
    };
  }

  /**
   * 모든 슬롯 목록 가져오기
   * @param {number} maxSlots - 최대 슬롯 수 (기본값: 10)
   * @returns {Promise<Array>} 슬롯 배열
   */
  async getAllSlots(maxSlots = 10) {
    const slots = [];
    
    for (let i = 1; i <= maxSlots; i++) {
      const slot = await this.getSlot(i);
      if (slot && slot.selectedDigimon) {
        slots.push(slot);
      }
    }
    
    return slots;
  }

  /**
   * 슬롯 데이터 저장하기
   * @param {number} slotId - 슬롯 ID
   * @param {Object} slotData - 저장할 슬롯 데이터
   * @returns {Promise<void>}
   */
  async saveSlot(slotId, slotData) {
    const {
      selectedDigimon,
      digimonStats,
      slotName,
      createdAt,
      device,
      version,
    } = slotData;

    if (selectedDigimon !== undefined) {
      localStorage.setItem(`slot${slotId}_selectedDigimon`, selectedDigimon);
    }
    
    if (digimonStats !== undefined) {
      localStorage.setItem(`slot${slotId}_digimonStats`, JSON.stringify(digimonStats));
    }
    
    if (slotName !== undefined) {
      localStorage.setItem(`slot${slotId}_slotName`, slotName);
    }
    
    if (createdAt !== undefined) {
      localStorage.setItem(`slot${slotId}_createdAt`, createdAt);
    }
    
    if (device !== undefined) {
      localStorage.setItem(`slot${slotId}_device`, device);
    }
    
    if (version !== undefined) {
      localStorage.setItem(`slot${slotId}_version`, version);
    }
  }

  /**
   * 디지몬 스탯만 저장하기 (자주 호출되는 경우를 위한 편의 메서드)
   * @param {number} slotId - 슬롯 ID
   * @param {Object} digimonStats - 디지몬 스탯 객체
   * @returns {Promise<void>}
   */
  async saveDigimonStats(slotId, digimonStats) {
    localStorage.setItem(`slot${slotId}_digimonStats`, JSON.stringify(digimonStats));
  }

  /**
   * 선택된 디지몬 이름만 저장하기
   * @param {number} slotId - 슬롯 ID
   * @param {string} digimonName - 디지몬 이름
   * @returns {Promise<void>}
   */
  async saveSelectedDigimon(slotId, digimonName) {
    localStorage.setItem(`slot${slotId}_selectedDigimon`, digimonName);
  }

  /**
   * 슬롯 삭제하기
   * @param {number} slotId - 슬롯 ID
   * @returns {Promise<void>}
   */
  async deleteSlot(slotId) {
    localStorage.removeItem(`slot${slotId}_selectedDigimon`);
    localStorage.removeItem(`slot${slotId}_digimonStats`);
    localStorage.removeItem(`slot${slotId}_slotName`);
    localStorage.removeItem(`slot${slotId}_createdAt`);
    localStorage.removeItem(`slot${slotId}_device`);
    localStorage.removeItem(`slot${slotId}_version`);
  }

  /**
   * 빈 슬롯 찾기
   * @param {number} maxSlots - 최대 슬롯 수 (기본값: 10)
   * @returns {Promise<number|null>} 빈 슬롯 ID 또는 null
   */
  async findEmptySlot(maxSlots = 10) {
    for (let i = 1; i <= maxSlots; i++) {
      const existing = localStorage.getItem(`slot${i}_selectedDigimon`);
      if (!existing) {
        return i;
      }
    }
    return null;
  }
}

// ============================================
// Firestore 구현 (향후 사용)
// ============================================
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';

class FirestoreSlotRepository {
  constructor(db) {
    this.db = db;
  }

  async getSlot(slotId) {
    const docRef = doc(this.db, 'slots', `slot${slotId}`);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return {
      id: slotId,
      ...docSnap.data(),
    };
  }

  async getAllSlots(maxSlots = 10) {
    const slotsRef = collection(this.db, 'slots');
    const q = query(slotsRef, limit(maxSlots));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: parseInt(doc.id.replace('slot', '')),
      ...doc.data(),
    }));
  }

  async saveSlot(slotId, slotData) {
    const docRef = doc(this.db, 'slots', `slot${slotId}`);
    await setDoc(docRef, {
      ...slotData,
      updatedAt: new Date(),
    }, { merge: true });
  }

  async saveDigimonStats(slotId, digimonStats) {
    const docRef = doc(this.db, 'slots', `slot${slotId}`);
    await updateDoc(docRef, {
      digimonStats,
      updatedAt: new Date(),
    });
  }

  async saveSelectedDigimon(slotId, digimonName) {
    const docRef = doc(this.db, 'slots', `slot${slotId}`);
    await updateDoc(docRef, {
      selectedDigimon: digimonName,
      updatedAt: new Date(),
    });
  }

  async deleteSlot(slotId) {
    const docRef = doc(this.db, 'slots', `slot${slotId}`);
    await deleteDoc(docRef);
  }

  async findEmptySlot(maxSlots = 10) {
    const slotsRef = collection(this.db, 'slots');
    const querySnapshot = await getDocs(slotsRef);
    const usedSlots = new Set(
      querySnapshot.docs.map(doc => parseInt(doc.id.replace('slot', '')))
    );
    
    for (let i = 1; i <= maxSlots; i++) {
      if (!usedSlots.has(i)) {
        return i;
      }
    }
    
    return null;
  }
}

// ============================================
// Repository 인스턴스 생성 및 export
// ============================================

// 환경변수로 저장소 타입 선택 (기본값: 'localStorage')
const STORAGE_TYPE = process.env.REACT_APP_STORAGE_TYPE || 'localStorage';

/**
 * Repository 인스턴스 생성
 */
let slotRepository;

if (STORAGE_TYPE === 'firestore') {
  // Firestore 사용 시
  try {
    slotRepository = new FirestoreSlotRepository(firestoreDb);
  } catch (error) {
    console.error('Firestore 초기화 실패, localStorage로 fallback:', error);
    slotRepository = new LocalStorageSlotRepository();
  }
} else {
  // LocalStorage 사용 (기본값)
  slotRepository = new LocalStorageSlotRepository();
}

export { slotRepository };
export default slotRepository;

