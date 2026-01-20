// src/repositories/SlotRepository.js
/**
 * Repository 패턴을 사용한 데이터 저장소 추상화
 * 
 * localStorage 모드 제거: 이제 Firebase만 사용합니다.
 * 
 * 참고: 실제 코드에서는 이 Repository를 직접 사용하지 않고
 * useGameData.js에서 직접 Firebase를 사용합니다.
 * 
 * 이 파일은 향후 필요 시 사용할 수 있도록 보존되어 있습니다.
 */

// ============================================
// Firestore 구현
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
    const querySnapshot = await getDocs(query(slotsRef, limit(maxSlots)));
    
    const usedIds = new Set(
      querySnapshot.docs.map(doc => parseInt(doc.id.replace('slot', '')))
    );
    
    for (let i = 1; i <= maxSlots; i++) {
      if (!usedIds.has(i)) {
        return i;
      }
    }
    return null;
  }
}

// ============================================
// Repository 인스턴스 생성 및 export
// ============================================

/**
 * Repository 인스턴스 생성
 * localStorage 모드 제거: Firebase만 사용
 */
let slotRepository;

if (firestoreDb) {
  try {
    slotRepository = new FirestoreSlotRepository(firestoreDb);
  } catch (error) {
    console.error('Firestore 초기화 실패:', error);
    slotRepository = null;
  }
} else {
  console.warn('Firestore가 초기화되지 않았습니다.');
  slotRepository = null;
}

export { slotRepository };
export default slotRepository;
