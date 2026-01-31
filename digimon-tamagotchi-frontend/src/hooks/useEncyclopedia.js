// src/hooks/useEncyclopedia.js
// 도감(Encyclopedia) 데이터 저장/로드 로직

import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * 도감 데이터 로드 (계정별 통합)
 * @param {Object|null} currentUser - 현재 사용자 (Firebase Auth)
 * @returns {Promise<Object>} 도감 데이터
 */
export async function loadEncyclopedia(currentUser) {
  // Firebase 로그인 필수
  if (!currentUser || !db) {
    console.warn("Firebase 로그인이 필요합니다.");
    return { "Ver.1": {} };
  }

  try {
    // Firebase: 사용자별 도감 저장 (/users/{uid}/encyclopedia)
    const userRef = doc(db, 'users', currentUser.uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const data = userSnap.data();
      return data.encyclopedia || { "Ver.1": {} };
    }
  } catch (error) {
    console.error("도감 로드 오류 (Firebase):", error);
  }

  return { "Ver.1": {} };
}

/**
 * 도감 데이터 저장 (계정별 통합)
 * @param {Object} encyclopedia - 도감 데이터
 * @param {Object|null} currentUser - 현재 사용자 (Firebase Auth)
 */
export async function saveEncyclopedia(encyclopedia, currentUser) {
  // Firebase 로그인 필수
  if (!currentUser || !db) {
    console.warn("Firebase 로그인이 필요합니다.");
    return;
  }

  try {
    // Firebase: 사용자별 도감 저장 (/users/{uid}/encyclopedia)
    const userRef = doc(db, 'users', currentUser.uid);
    // 문서 존재 여부 확인
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, {
        encyclopedia: encyclopedia,
        updatedAt: new Date(),
      });
    } else {
      // 문서가 없으면 생성
      await setDoc(userRef, {
        encyclopedia: encyclopedia,
        updatedAt: new Date(),
      });
    }
  } catch (error) {
    console.error("도감 저장 오류 (Firebase):", error);
  }
}

/**
 * 도감 업데이트 (진화/사망/발견 시 호출) - 계정별 통합
 * @param {string} digimonName - 디지몬 이름
 * @param {Object} finalStats - 최종 스탯
 * @param {string} eventType - 이벤트 타입 ('evolution' | 'death' | 'discovery')
 * @param {Object|null} currentUser - 현재 사용자
 */
export async function updateEncyclopedia(
  digimonName,
  finalStats,
  eventType, // 'evolution' | 'death' | 'discovery'
  currentUser
) {
  if (!digimonName) return;
  
  // 버전 확인 (현재는 Ver.1만 존재)
  const version = "Ver.1";
  
  // 도감 데이터 로드 (계정별)
  const encyclopedia = await loadEncyclopedia(currentUser);
  
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
  
  // 저장 (계정별)
  encyclopedia[version][digimonName] = digimonData;
  await saveEncyclopedia(encyclopedia, currentUser);
}

/**
 * 도감 개발 이전에 진화한 디지몬을 도감에 안전하게 추가 (누락 보정)
 * - 기존 도감 데이터는 건드리지 않고, 누락된 ID만 최소 구조로 추가합니다.
 * @param {Object|null} currentUser - 현재 사용자 (Firebase Auth)
 * @param {string[]} digimonIds - 추가할 디지몬 ID (예: ["BlitzGreymon", "ShinMonzaemon"])
 * @returns {Promise<{ added: string[], skipped: string[] }>} 추가된 ID 목록, 이미 있어서 스킵된 ID 목록
 */
export async function addMissingEncyclopediaEntries(currentUser, digimonIds = []) {
  const added = [];
  const skipped = [];

  if (!currentUser || !db || !Array.isArray(digimonIds) || digimonIds.length === 0) {
    return { added, skipped };
  }

  const version = "Ver.1";
  const encyclopedia = await loadEncyclopedia(currentUser);

  if (!encyclopedia[version]) {
    encyclopedia[version] = {};
  }

  const now = Date.now();
  const minimalEntry = {
    isDiscovered: true,
    firstDiscoveredAt: now,
    raisedCount: 1,
    lastRaisedAt: now,
    bestStats: {},
    history: [{ date: now, result: "도감 보정으로 등록 (진화 이력 반영)", finalStats: {} }]
  };

  for (const id of digimonIds) {
    if (!id || typeof id !== "string") continue;
    const existing = encyclopedia[version][id];
    if (existing?.isDiscovered) {
      skipped.push(id);
      continue;
    }
    encyclopedia[version][id] = { ...minimalEntry };
    added.push(id);
  }

  if (added.length > 0) {
    await saveEncyclopedia(encyclopedia, currentUser);
  }

  return { added, skipped };
}
