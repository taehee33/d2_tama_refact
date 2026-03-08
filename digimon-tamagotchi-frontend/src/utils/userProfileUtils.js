// src/utils/userProfileUtils.js
// 사용자 프로필: 도감 마스터 칭호(achievements), 최대 슬롯(maxSlots) — Firestore users/{uid}

import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

/** 기본 최대 슬롯 수 (도감 마스터 없을 때, 기존 앱과 동일 10개) */
export const BASE_MAX_SLOTS = 10;

/** 도감 마스터 1개당 추가 슬롯 */
export const SLOTS_PER_MASTER = 5;

/** 칭호 키: Ver.1 도감 완성 */
export const ACHIEVEMENT_VER1_MASTER = "ver1_master";

/** 칭호 키: Ver.2 도감 완성 */
export const ACHIEVEMENT_VER2_MASTER = "ver2_master";

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
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      const achievements = Array.isArray(data.achievements) ? [...data.achievements] : [];
      const maxSlots =
        typeof data.maxSlots === "number" && data.maxSlots >= BASE_MAX_SLOTS
          ? data.maxSlots
          : computeMaxSlotsFromAchievements(achievements);
      return { achievements, maxSlots };
    }
    return { achievements: [], maxSlots: BASE_MAX_SLOTS };
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
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    const updates = {
      achievements: Array.isArray(achievements) ? achievements : [],
      maxSlots,
      updatedAt: new Date(),
    };
    if (userSnap.exists()) {
      await updateDoc(userRef, updates);
    } else {
      await setDoc(userRef, updates);
    }
  } catch (error) {
    console.error("칭호/최대 슬롯 저장 오류:", error);
    throw error;
  }
}
