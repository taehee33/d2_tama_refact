// src/hooks/useEncyclopedia.js
// 도감(Encyclopedia) 데이터 저장/로드 로직

import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * 도감 데이터 로드
 * @param {string|number} slotId - 슬롯 ID
 * @param {Object|null} currentUser - 현재 사용자 (Firebase Auth)
 * @param {string} mode - 모드 ('firebase' | 'local')
 * @returns {Promise<Object>} 도감 데이터
 */
export async function loadEncyclopedia(slotId, currentUser, mode) {
  if (!slotId) {
    return { "Ver.1": {} };
  }

  if (mode === 'firebase' && currentUser && db) {
    try {
      const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
      const slotSnap = await getDoc(slotRef);
      
      if (slotSnap.exists()) {
        const data = slotSnap.data();
        return data.encyclopedia || { "Ver.1": {} };
      }
    } catch (error) {
      console.error("도감 로드 오류 (Firebase):", error);
    }
  } else if (mode === 'local') {
    try {
      const saved = localStorage.getItem(`slot${slotId}_encyclopedia`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error("도감 로드 오류 (localStorage):", error);
    }
  }

  return { "Ver.1": {} };
}

/**
 * 도감 데이터 저장
 * @param {Object} encyclopedia - 도감 데이터
 * @param {string|number} slotId - 슬롯 ID
 * @param {Object|null} currentUser - 현재 사용자 (Firebase Auth)
 * @param {string} mode - 모드 ('firebase' | 'local')
 */
export async function saveEncyclopedia(encyclopedia, slotId, currentUser, mode) {
  if (!slotId) return;

  if (mode === 'firebase' && currentUser && db) {
    try {
      const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
      // 문서 존재 여부 확인
      const slotSnap = await getDoc(slotRef);
      if (slotSnap.exists()) {
        await updateDoc(slotRef, {
          encyclopedia: encyclopedia,
          updatedAt: new Date(),
        });
      } else {
        // 문서가 없으면 생성
        await setDoc(slotRef, {
          encyclopedia: encyclopedia,
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error("도감 저장 오류 (Firebase):", error);
    }
  } else if (mode === 'local') {
    try {
      localStorage.setItem(`slot${slotId}_encyclopedia`, JSON.stringify(encyclopedia));
    } catch (error) {
      console.error("도감 저장 오류 (localStorage):", error);
    }
  }
}

/**
 * 도감 업데이트 (진화/사망/발견 시 호출)
 * @param {string} digimonName - 디지몬 이름
 * @param {Object} finalStats - 최종 스탯
 * @param {string} eventType - 이벤트 타입 ('evolution' | 'death' | 'discovery')
 * @param {string|number} slotId - 슬롯 ID
 * @param {Object|null} currentUser - 현재 사용자
 * @param {string} mode - 모드 ('firebase' | 'local')
 */
export async function updateEncyclopedia(
  digimonName,
  finalStats,
  eventType, // 'evolution' | 'death' | 'discovery'
  slotId,
  currentUser,
  mode
) {
  if (!slotId || !digimonName) return;
  
  // 버전 확인 (현재는 Ver.1만 존재)
  const version = "Ver.1";
  
  // 도감 데이터 로드
  const encyclopedia = await loadEncyclopedia(slotId, currentUser, mode);
  
  // 해당 디지몬 데이터 가져오기 또는 초기화
  if (!encyclopedia[version]) {
    encyclopedia[version] = {};
  }
  
  const digimonData = encyclopedia[version][digimonName] || {
    isDiscovered: false,
    raisedCount: 0,
    bestStats: {},
    history: []
  };
  
  // 발견 처리
  if (!digimonData.isDiscovered) {
    digimonData.isDiscovered = true;
    digimonData.firstDiscoveredAt = Date.now();
  }
  
  // 육성 횟수 증가
  digimonData.raisedCount = (digimonData.raisedCount || 0) + 1;
  digimonData.lastRaisedAt = Date.now();
  
  // 최고 기록 업데이트
  const currentStats = {
    maxAge: finalStats.age || 0,
    maxWinRate: finalStats.winRate || 0,
    maxWeight: finalStats.weight || 0,
    maxLifespan: finalStats.lifespanSeconds || 0,
    totalBattles: finalStats.totalBattles || 0,
    totalBattlesWon: finalStats.totalBattlesWon || 0
  };
  
  // bestStats 업데이트 (더 좋은 기록이면 갱신)
  if (!digimonData.bestStats.maxAge || currentStats.maxAge > (digimonData.bestStats.maxAge || 0)) {
    digimonData.bestStats.maxAge = currentStats.maxAge;
  }
  if (!digimonData.bestStats.maxWinRate || currentStats.maxWinRate > (digimonData.bestStats.maxWinRate || 0)) {
    digimonData.bestStats.maxWinRate = currentStats.maxWinRate;
  }
  if (!digimonData.bestStats.maxWeight || currentStats.maxWeight > (digimonData.bestStats.maxWeight || 0)) {
    digimonData.bestStats.maxWeight = currentStats.maxWeight;
  }
  if (!digimonData.bestStats.maxLifespan || currentStats.maxLifespan > (digimonData.bestStats.maxLifespan || 0)) {
    digimonData.bestStats.maxLifespan = currentStats.maxLifespan;
  }
  if (!digimonData.bestStats.totalBattles || currentStats.totalBattles > (digimonData.bestStats.totalBattles || 0)) {
    digimonData.bestStats.totalBattles = currentStats.totalBattles;
  }
  if (!digimonData.bestStats.totalBattlesWon || currentStats.totalBattlesWon > (digimonData.bestStats.totalBattlesWon || 0)) {
    digimonData.bestStats.totalBattlesWon = currentStats.totalBattlesWon;
  }
  
  // 이력 추가 (최대 5개만 유지)
  const historyEntry = {
    date: Date.now(),
    result: eventType === 'evolution' 
      ? `Evolved to ${finalStats.evolutionStage || digimonName}`
      : eventType === 'death'
      ? `Died: ${finalStats.deathReason || 'Unknown'}`
      : 'Discovered',
    finalStats: {
      age: finalStats.age || 0,
      winRate: finalStats.winRate || 0,
      weight: finalStats.weight || 0,
      lifespanSeconds: finalStats.lifespanSeconds || 0
    }
  };
  
  digimonData.history = [historyEntry, ...(digimonData.history || [])].slice(0, 5);
  
  // 저장
  encyclopedia[version][digimonName] = digimonData;
  await saveEncyclopedia(encyclopedia, slotId, currentUser, mode);
}
