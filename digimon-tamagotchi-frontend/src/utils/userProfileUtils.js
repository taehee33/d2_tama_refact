// src/utils/userProfileUtils.js
// 사용자 프로필: 도감 마스터 칭호(achievements), 최대 슬롯(maxSlots)
// profile/main 우선 + users/{uid} fallback + dual-write 호환 단계

import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export const USER_PROFILE_COLLECTION = "profile";
export const USER_PROFILE_DOC_ID = "main";

/** 기본 최대 슬롯 수 (도감 마스터 없을 때, 기존 앱과 동일 10개) */
export const BASE_MAX_SLOTS = 10;

/** 도감 마스터 1개당 추가 슬롯 */
export const SLOTS_PER_MASTER = 5;

/** 칭호 키: Ver.1 도감 완성 */
export const ACHIEVEMENT_VER1_MASTER = "ver1_master";

/** 칭호 키: Ver.2 도감 완성 */
export const ACHIEVEMENT_VER2_MASTER = "ver2_master";

export function getUserProfileRef(uid) {
  return doc(db, "users", uid, USER_PROFILE_COLLECTION, USER_PROFILE_DOC_ID);
}

function getUserRootRef(uid) {
  return doc(db, "users", uid);
}

function hasOwnField(data, fieldName) {
  return !!data && Object.prototype.hasOwnProperty.call(data, fieldName);
}

function resolveAchievements(profileData, rootData) {
  if (Array.isArray(profileData?.achievements)) {
    return [...profileData.achievements];
  }

  if (Array.isArray(rootData?.achievements)) {
    return [...rootData.achievements];
  }

  return [];
}

function resolveMaxSlots(profileData, rootData, achievements) {
  if (hasOwnField(profileData, "maxSlots")) {
    return typeof profileData.maxSlots === "number" && profileData.maxSlots >= BASE_MAX_SLOTS
      ? profileData.maxSlots
      : computeMaxSlotsFromAchievements(achievements);
  }

  if (hasOwnField(profileData, "achievements")) {
    return computeMaxSlotsFromAchievements(achievements);
  }

  if (hasOwnField(rootData, "maxSlots")) {
    return typeof rootData.maxSlots === "number" && rootData.maxSlots >= BASE_MAX_SLOTS
      ? rootData.maxSlots
      : computeMaxSlotsFromAchievements(achievements);
  }

  return computeMaxSlotsFromAchievements(achievements);
}

/**
 * achievements 배열로 maxSlots 계산 (마스터당 +5)
 * @param {string[]} achievements
 * @returns {number}
 */
export function computeMaxSlotsFromAchievements(achievements) {
  const count = Array.isArray(achievements)
    ? achievements.filter((a) => a === ACHIEVEMENT_VER1_MASTER || a === ACHIEVEMENT_VER2_MASTER).length
    : 0;
  return BASE_MAX_SLOTS + count * SLOTS_PER_MASTER;
}

/**
 * 사용자 칭호·최대 슬롯 가져오기
 * @param {string} uid - 사용자 ID
 * @returns {Promise<{ achievements: string[], maxSlots: number }>}
 */
export async function getAchievementsAndMaxSlots(uid) {
  if (!uid) {
    return { achievements: [], maxSlots: BASE_MAX_SLOTS };
  }
  try {
    if (!db) return { achievements: [], maxSlots: BASE_MAX_SLOTS };
    const userRef = doc(db, "users", uid);
    const profileRef = getUserProfileRef(uid);
    const [profileSnap, userSnap] = await Promise.all([getDoc(profileRef), getDoc(userRef)]);
    const profileData = profileSnap.exists() ? profileSnap.data() : null;
    const rootData = userSnap.exists() ? userSnap.data() : null;
    const achievements = resolveAchievements(profileData, rootData);
    const maxSlots = resolveMaxSlots(profileData, rootData, achievements);
    return { achievements, maxSlots };
  } catch (error) {
    console.error("칭호/최대 슬롯 로드 오류:", error);
    return { achievements: [], maxSlots: BASE_MAX_SLOTS };
  }
}

/**
 * 사용자 최대 슬롯 수만 가져오기
 * @param {string} uid - 사용자 ID
 * @returns {Promise<number>}
 */
export async function getMaxSlots(uid) {
  const { maxSlots } = await getAchievementsAndMaxSlots(uid);
  return maxSlots;
}

/**
 * 칭호 배열 저장 및 maxSlots 자동 계산 반영
 * @param {string} uid - 사용자 ID
 * @param {string[]} achievements - 새 칭호 배열 (ver1_master, ver2_master 등)
 * @returns {Promise<void>}
 */
export async function updateAchievementsAndMaxSlots(uid, achievements) {
  if (!uid) throw new Error("사용자 ID가 필요합니다.");
  const maxSlots = computeMaxSlotsFromAchievements(achievements);
  return ensureUserProfileMirror(uid, {
    achievements: Array.isArray(achievements) ? achievements : [],
    maxSlots,
  });
}

/**
 * 현재 계산된 프로필 값을 루트 users 문서와 profile/main에 함께 보정한다.
 * 완전 이관 전 호환 단계에서 profile/main 생성과 root mirror 유지를 동시에 담당한다.
 * @param {string} uid - 사용자 ID
 * @param {{ achievements?: string[], maxSlots?: number }=} overrides - 강제 반영할 값
 * @returns {Promise<{ achievements: string[], maxSlots: number }>}
 */
export async function ensureUserProfileMirror(uid, overrides = {}) {
  if (!uid) throw new Error("사용자 ID가 필요합니다.");
  try {
    const userRef = getUserRootRef(uid);
    const profileRef = getUserProfileRef(uid);
    const userSnap = await getDoc(userRef);
    const profileSnap = await getDoc(profileRef);
    const rootData = userSnap.exists() ? userSnap.data() : null;
    const profileData = profileSnap.exists() ? profileSnap.data() : null;
    const achievements = Array.isArray(overrides?.achievements)
      ? [...overrides.achievements]
      : resolveAchievements(profileData, rootData);
    const maxSlots =
      typeof overrides?.maxSlots === "number" && overrides.maxSlots >= BASE_MAX_SLOTS
        ? overrides.maxSlots
        : resolveMaxSlots(profileData, rootData, achievements);
    const updates = {
      achievements,
      maxSlots: typeof maxSlots === "number" ? maxSlots : BASE_MAX_SLOTS,
      updatedAt: new Date(),
    };
    if (userSnap.exists()) {
      await updateDoc(userRef, updates);
    } else {
      await setDoc(userRef, updates);
    }

    await setDoc(profileRef, updates, { merge: true });
    return {
      achievements: updates.achievements,
      maxSlots: updates.maxSlots,
    };
  } catch (error) {
    console.error("칭호/최대 슬롯 저장 오류:", error);
    throw error;
  }
}
