// src/hooks/useEncyclopedia.js
// 도감(Encyclopedia) 데이터 저장/로드 로직

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getRequiredDigimonIds, isVersionComplete } from "../logic/encyclopediaMaster";
import { digimonDataVer1 } from "../data/v1/digimons";
import { digimonDataVer2 } from "../data/v2modkor";
import {
  getAchievementsAndMaxSlots,
  updateAchievementsAndMaxSlots,
  ACHIEVEMENT_VER1_MASTER,
  ACHIEVEMENT_VER2_MASTER,
} from "../utils/userProfileUtils";

const ENCYCLOPEDIA_VERSIONS = ["Ver.1", "Ver.2"];

function createEmptyEncyclopedia() {
  return Object.fromEntries(ENCYCLOPEDIA_VERSIONS.map((version) => [version, {}]));
}

function getUserRootRef(uid) {
  return doc(db, "users", uid);
}

function getUserEncyclopediaRef(uid, version) {
  return doc(db, "users", uid, "encyclopedia", version);
}

function normalizeVersionEntries(versionEntries) {
  if (!versionEntries || typeof versionEntries !== "object") {
    return {};
  }

  return { ...versionEntries };
}

function normalizeEncyclopedia(encyclopedia) {
  const normalized = createEmptyEncyclopedia();

  ENCYCLOPEDIA_VERSIONS.forEach((version) => {
    normalized[version] = normalizeVersionEntries(encyclopedia?.[version]);
  });

  return normalized;
}

function hasVersionEntries(versionEntries) {
  return Object.keys(versionEntries || {}).length > 0;
}

/**
 * 도감 데이터 로드 (계정별 통합)
 * @param {Object|null} currentUser - 현재 사용자 (Firebase Auth)
 * @returns {Promise<Object>} 도감 데이터
 */
export async function loadEncyclopedia(currentUser) {
  // Firebase 로그인 필수
  if (!currentUser || !db) {
    console.warn("Firebase 로그인이 필요합니다.");
    return createEmptyEncyclopedia();
  }

  try {
    const versionSnapshots = await Promise.all(
      ENCYCLOPEDIA_VERSIONS.map((version) =>
        getDoc(getUserEncyclopediaRef(currentUser.uid, version))
      )
    );
    const hasAnyVersionDoc = versionSnapshots.some((snapshot) => snapshot.exists());

    if (hasAnyVersionDoc) {
      const encyclopedia = createEmptyEncyclopedia();
      versionSnapshots.forEach((snapshot, index) => {
        if (snapshot.exists()) {
          encyclopedia[ENCYCLOPEDIA_VERSIONS[index]] = normalizeVersionEntries(snapshot.data());
        }
      });

      return encyclopedia;
    }

    // Firebase: 마이그레이션 기간 동안만 루트 users/{uid}.encyclopedia fallback 허용
    const userRef = getUserRootRef(currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      return normalizeEncyclopedia(data.encyclopedia);
    }
  } catch (error) {
    console.error("도감 로드 오류 (Firebase):", error);
  }

  return createEmptyEncyclopedia();
}

/**
 * 도감 완성 시 마스터 칭호·maxSlots 부여 (저장 후 호출)
 * @param {Object|null} currentUser - Firebase Auth 사용자
 * @param {Object} mergedEncyclopedia - 병합된 도감 { "Ver.1": {...}, "Ver.2": {...} }
 */
export async function checkAndGrantEncyclopediaMasters(currentUser, mergedEncyclopedia) {
  if (!currentUser?.uid || !db || !mergedEncyclopedia) return;
  try {
    const idsVer1 = getRequiredDigimonIds(digimonDataVer1, digimonDataVer2, "Ver.1");
    const idsVer2 = getRequiredDigimonIds(digimonDataVer1, digimonDataVer2, "Ver.2");
    const ver1Complete = isVersionComplete(mergedEncyclopedia["Ver.1"] || {}, idsVer1);
    const ver2Complete = isVersionComplete(mergedEncyclopedia["Ver.2"] || {}, idsVer2);
    const { achievements } = await getAchievementsAndMaxSlots(currentUser.uid);
    const next = [...achievements];
    if (ver1Complete && !next.includes(ACHIEVEMENT_VER1_MASTER)) next.push(ACHIEVEMENT_VER1_MASTER);
    if (ver2Complete && !next.includes(ACHIEVEMENT_VER2_MASTER)) next.push(ACHIEVEMENT_VER2_MASTER);
    if (next.length > achievements.length) {
      await updateAchievementsAndMaxSlots(currentUser.uid, next);
    }
  } catch (err) {
    console.error("도감 마스터 칭호 부여 오류:", err);
  }
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
    const normalizedEncyclopedia = normalizeEncyclopedia(encyclopedia);
    const saveTasks = [];

    for (const version of ENCYCLOPEDIA_VERSIONS) {
      if (!hasVersionEntries(normalizedEncyclopedia[version])) {
        continue;
      }

      saveTasks.push(
        setDoc(
          getUserEncyclopediaRef(currentUser.uid, version),
          normalizedEncyclopedia[version]
        )
      );
    }

    if (saveTasks.length > 0) {
      await Promise.all(saveTasks);
    }

    await checkAndGrantEncyclopediaMasters(currentUser, normalizedEncyclopedia);
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
 * @param {string} version - 버전 ("Ver.1" | "Ver.2" 등, 기본값: "Ver.1")
 */
export async function updateEncyclopedia(
  digimonName,
  finalStats,
  eventType, // 'evolution' | 'death' | 'discovery'
  currentUser,
  version = "Ver.1" // 버전 파라미터 추가 (Ver.2 별도 관리)
) {
  if (!digimonName) return;
  
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
