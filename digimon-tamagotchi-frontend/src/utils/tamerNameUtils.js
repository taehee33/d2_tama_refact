// src/utils/tamerNameUtils.js
// 테이머명(닉네임) 관리 유틸리티 함수

import { doc, getDoc, runTransaction, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getUserProfileRef } from "./userProfileUtils";

const NICKNAME_INDEX_COLLECTION = "nickname_index";
const NORMALIZED_SPACE_NOTICE = "연속된 공백은 1칸으로 자동 변경됩니다.";

function hasOwnField(data, fieldName) {
  return !!data && Object.prototype.hasOwnProperty.call(data, fieldName);
}

function normalizePreferredName(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveStoredTamerName(profileData, rootData) {
  if (hasOwnField(profileData, "tamerName")) {
    return typeof profileData.tamerName === "string" ? profileData.tamerName : null;
  }

  if (typeof rootData?.tamerName === "string") {
    return rootData.tamerName;
  }

  return null;
}

function resolveDisplayFallback(rootData, authDisplayName, uid) {
  return rootData?.displayName || authDisplayName || `Trainer_${uid.slice(0, 6)}`;
}

export function getAccountDisplayFallback(
  currentUser,
  {
    fallback = "익명의 테이머",
    includeTrainerId = true,
  } = {}
) {
  const authDisplayName = normalizePreferredName(currentUser?.displayName);
  if (authDisplayName) {
    return authDisplayName;
  }

  const emailPrefix = normalizePreferredName(currentUser?.email?.split("@")[0]);
  if (emailPrefix) {
    return emailPrefix;
  }

  if (includeTrainerId && currentUser?.uid) {
    return `Trainer_${String(currentUser.uid).slice(0, 6)}`;
  }

  return fallback;
}

export function resolveTamerNamePriority({
  tamerName,
  currentUser = null,
  extraFallbacks = [],
  fallback = "익명의 테이머",
  includeTrainerId = true,
} = {}) {
  const preferredTamerName = normalizePreferredName(tamerName);
  if (preferredTamerName) {
    return preferredTamerName;
  }

  const authIdentityName = getAccountDisplayFallback(currentUser, {
    fallback: null,
    includeTrainerId: false,
  });
  if (authIdentityName) {
    return authIdentityName;
  }

  for (const candidate of extraFallbacks) {
    const normalizedCandidate = normalizePreferredName(candidate);
    if (normalizedCandidate) {
      return normalizedCandidate;
    }
  }

  if (includeTrainerId && currentUser?.uid) {
    return `Trainer_${String(currentUser.uid).slice(0, 6)}`;
  }

  return fallback;
}

export function resolveTamerNameInitial({
  tamerName,
  currentUser = null,
  extraFallbacks = [],
  fallback = "U",
  includeTrainerId = true,
} = {}) {
  const resolvedName = resolveTamerNamePriority({
    tamerName,
    currentUser,
    extraFallbacks,
    fallback,
    includeTrainerId,
  });

  return normalizePreferredName(resolvedName)?.[0] || fallback;
}

/**
 * 닉네임 입력값 정규화
 * @param {string} raw - 원본 입력값
 * @returns {string} 앞뒤 공백 제거 + 연속 공백 1칸 축약 결과
 */
export function normalizeNicknameInput(raw) {
  if (typeof raw !== "string") {
    return "";
  }

  return raw.trim().replace(/\s+/g, " ");
}

/**
 * 닉네임 인덱스 키 생성
 * @param {string} raw - 원본 입력값
 * @returns {string} 정규화 후 영문 소문자 키
 */
export function toNicknameKey(raw) {
  return normalizeNicknameInput(raw).toLowerCase();
}

/**
 * 공백 자동 정규화 여부
 * @param {string} raw - 원본 입력값
 * @returns {boolean}
 */
export function hasCollapsedSpaces(raw) {
  if (typeof raw !== "string") {
    return false;
  }

  return normalizeNicknameInput(raw) !== raw.trim();
}

/**
 * 공백 자동 정규화 안내를 메시지에 덧붙이기
 * @param {string} message - 기본 메시지
 * @param {boolean} didNormalizeSpaces - 공백 축약 여부
 * @returns {string}
 */
export function withNormalizationNotice(message, didNormalizeSpaces) {
  if (!didNormalizeSpaces) {
    return message;
  }

  return `${NORMALIZED_SPACE_NOTICE} ${message}`;
}

function buildAvailabilityResult({
  status,
  isAvailable,
  message,
  normalizedNickname,
  didNormalizeSpaces,
}) {
  return {
    status,
    isAvailable,
    message: withNormalizationNotice(message, didNormalizeSpaces),
    normalizedNickname,
    normalizedKey: toNicknameKey(normalizedNickname),
    didNormalizeSpaces,
  };
}

/**
 * 닉네임 중복 검사
 * @param {string} nickname - 검사할 닉네임
 * @param {string|null} currentUid - 현재 로그인한 사용자 UID
 * @returns {Promise<{status: string, isAvailable: boolean, message: string, normalizedNickname: string, normalizedKey: string, didNormalizeSpaces: boolean}>}
 */
export async function checkNicknameAvailability(nickname, currentUid = null) {
  if (!nickname || nickname.trim() === "") {
    return buildAvailabilityResult({
      status: "invalid",
      isAvailable: false,
      message: "테이머명을 입력해주세요.",
      normalizedNickname: "",
      didNormalizeSpaces: false,
    });
  }

  const normalizedNickname = normalizeNicknameInput(nickname);
  const didNormalizeSpaces = hasCollapsedSpaces(nickname);

  if (normalizedNickname.length < 2) {
    return buildAvailabilityResult({
      status: "invalid",
      isAvailable: false,
      message: "테이머명은 2자 이상이어야 합니다.",
      normalizedNickname,
      didNormalizeSpaces,
    });
  }

  if (normalizedNickname.length > 20) {
    return buildAvailabilityResult({
      status: "invalid",
      isAvailable: false,
      message: "테이머명은 20자 이하여야 합니다.",
      normalizedNickname,
      didNormalizeSpaces,
    });
  }

  const validPattern = /^[가-힣a-zA-Z0-9 ]+$/;
  if (!validPattern.test(normalizedNickname)) {
    return buildAvailabilityResult({
      status: "invalid",
      isAvailable: false,
      message: "테이머명은 한글, 영문, 숫자, 공백만 사용할 수 있습니다.",
      normalizedNickname,
      didNormalizeSpaces,
    });
  }

  const nicknameKey = toNicknameKey(normalizedNickname);
  const nicknameRef = doc(db, NICKNAME_INDEX_COLLECTION, nicknameKey);
  const nicknameSnap = await getDoc(nicknameRef);

  if (nicknameSnap.exists()) {
    const nicknameData = nicknameSnap.data();
    if (nicknameData.uid === currentUid) {
      return buildAvailabilityResult({
        status: "current-user",
        isAvailable: true,
        message: "현재 사용 중인 테이머명입니다.",
        normalizedNickname,
        didNormalizeSpaces,
      });
    }

    if (nicknameData.uid !== currentUid) {
      return buildAvailabilityResult({
        status: "taken",
        isAvailable: false,
        message: "이미 사용 중인 테이머명입니다.",
        normalizedNickname,
        didNormalizeSpaces,
      });
    }
  }

  return buildAvailabilityResult({
    status: "available",
    isAvailable: true,
    message: "사용 가능한 테이머명입니다.",
    normalizedNickname,
    didNormalizeSpaces,
  });
}

/**
 * 테이머명 업데이트 (중복 검사 포함)
 * @param {string} uid - 사용자 ID
 * @param {string} newNickname - 새로운 닉네임
 * @param {string|null} oldNickname - 기존 닉네임
 * @returns {Promise<{normalizedNickname: string, normalizedKey: string, didNormalizeSpaces: boolean}>}
 */
export async function updateTamerName(uid, newNickname, oldNickname = null) {
  if (!uid) {
    throw new Error("사용자 ID가 필요합니다.");
  }

  const availability = await checkNicknameAvailability(newNickname, uid);
  if (!availability.isAvailable) {
    throw new Error(availability.message);
  }

  const normalizedNickname = availability.normalizedNickname;
  const normalizedKey = availability.normalizedKey;

  const userRef = doc(db, "users", uid);
  const profileRef = getUserProfileRef(uid);
  const nicknameRef = doc(db, NICKNAME_INDEX_COLLECTION, normalizedKey);

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error("사용자 정보를 찾을 수 없습니다.");
    }

    const profileSnap = await transaction.get(profileRef);
    const nicknameSnap = await transaction.get(nicknameRef);
    if (nicknameSnap.exists() && nicknameSnap.data().uid !== uid) {
      throw new Error("이미 사용 중인 테이머명입니다.");
    }

    const storedNickname = resolveStoredTamerName(
      profileSnap.exists() ? profileSnap.data() : null,
      userSnap.data()
    );
    const previousNickname =
      typeof storedNickname === "string" && storedNickname.trim() !== ""
        ? storedNickname
        : oldNickname;
    const previousKey = previousNickname ? toNicknameKey(previousNickname) : null;
    const previousNicknameRef =
      previousKey && previousKey !== normalizedKey
        ? doc(db, NICKNAME_INDEX_COLLECTION, previousKey)
        : null;
    const previousNicknameSnap = previousNicknameRef
      ? await transaction.get(previousNicknameRef)
      : null;

    const now = new Date();
    transaction.set(
      profileRef,
      {
        tamerName: normalizedNickname,
        updatedAt: now,
      },
      { merge: true }
    );

    transaction.set(
      nicknameRef,
      {
        uid,
        nickname: normalizedNickname,
        normalizedKey,
        createdAt: nicknameSnap.exists() ? nicknameSnap.data().createdAt ?? now : now,
        updatedAt: now,
      },
      { merge: true }
    );

    if (
      previousNicknameRef &&
      previousNicknameSnap?.exists() &&
      previousNicknameSnap.data().uid === uid
    ) {
      transaction.delete(previousNicknameRef);
    }
  });

  return {
    normalizedNickname,
    normalizedKey,
    didNormalizeSpaces: availability.didNormalizeSpaces,
  };
}

/**
 * 기본값으로 되돌리기 (Firebase Auth의 displayName 사용)
 * @param {string} uid - 사용자 ID
 * @param {string} authDisplayName - Firebase Auth의 displayName
 * @param {string|null} currentNickname - 현재 커스텀 닉네임
 * @returns {Promise<void>}
 */
export async function resetToDefaultTamerName(uid, authDisplayName, currentNickname = null) {
  if (!uid) {
    throw new Error("사용자 ID가 필요합니다.");
  }

  void authDisplayName;

  const userRef = doc(db, "users", uid);
  const profileRef = getUserProfileRef(uid);

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error("사용자 정보를 찾을 수 없습니다.");
    }

    const profileSnap = await transaction.get(profileRef);
    const storedNickname = resolveStoredTamerName(
      profileSnap.exists() ? profileSnap.data() : null,
      userSnap.data()
    );
    const nicknameToReset =
      typeof storedNickname === "string" && storedNickname.trim() !== ""
        ? storedNickname
        : currentNickname;
    const currentKey = nicknameToReset ? toNicknameKey(nicknameToReset) : null;
    const currentNicknameRef = currentKey
      ? doc(db, NICKNAME_INDEX_COLLECTION, currentKey)
      : null;
    const currentNicknameSnap = currentNicknameRef
      ? await transaction.get(currentNicknameRef)
      : null;

    transaction.set(
      profileRef,
      {
        tamerName: null,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    if (currentNicknameRef && currentNicknameSnap?.exists() && currentNicknameSnap.data().uid === uid) {
      transaction.delete(currentNicknameRef);
    }
  });
}

/**
 * 유저의 테이머명 가져오기 (기본값 포함)
 * @param {string} uid - 사용자 ID
 * @param {string} authDisplayName - Firebase Auth의 displayName
 * @returns {Promise<string>} 테이머명
 */
export async function getTamerName(uid, authDisplayName) {
  if (!uid) {
    return authDisplayName || "익명의 테이머";
  }

  try {
    const userRef = doc(db, "users", uid);
    const profileRef = getUserProfileRef(uid);
    const [profileSnap, userSnap] = await Promise.all([getDoc(profileRef), getDoc(userRef)]);
    const profileData = profileSnap.exists() ? profileSnap.data() : null;
    const userData = userSnap.exists() ? userSnap.data() : null;
    const storedTamerName = resolveStoredTamerName(profileData, userData);

    if (storedTamerName && storedTamerName.trim()) {
      return storedTamerName;
    }

    if (userData || profileData) {
      return resolveDisplayFallback(userData, authDisplayName, uid);
    }

    return resolveDisplayFallback(null, authDisplayName, uid);
  } catch (error) {
    console.error("테이머명 가져오기 오류:", error);
    return authDisplayName || "익명의 테이머";
  }
}

/**
 * 로그인 시 테이머명 초기화 (없으면 displayName 사용)
 * @param {string} uid - 사용자 ID
 * @param {string} displayName - Firebase Auth의 displayName
 * @returns {Promise<string>} 설정된 테이머명
 */
export async function initializeTamerName(uid, displayName) {
  if (!uid) {
    return displayName || "익명의 테이머";
  }

  try {
    const userRef = doc(db, "users", uid);
    const profileRef = getUserProfileRef(uid);
    const [profileSnap, userSnap] = await Promise.all([getDoc(profileRef), getDoc(userRef)]);

    const profileData = profileSnap.exists() ? profileSnap.data() : null;

    if (userSnap.exists()) {
      const userData = userSnap.data();
      const storedTamerName = resolveStoredTamerName(profileData, userData);

      if (!profileSnap.exists() || !hasOwnField(profileData, "tamerName")) {
        await setDoc(
          profileRef,
          {
            tamerName: storedTamerName ?? null,
            updatedAt: new Date(),
          },
          { merge: true }
        );
      }

      if (storedTamerName) {
        return storedTamerName;
      }

      return resolveDisplayFallback(userData, displayName, uid);
    }

    const now = new Date();
    await Promise.all([
      setDoc(
        userRef,
        {
          email: null,
          displayName,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        profileRef,
        {
          tamerName: null,
          updatedAt: now,
        },
        { merge: true }
      ),
    ]);

    return displayName || `Trainer_${uid.slice(0, 6)}`;
  } catch (error) {
    console.error("테이머명 초기화 오류:", error);
    return displayName || "익명의 테이머";
  }
}
