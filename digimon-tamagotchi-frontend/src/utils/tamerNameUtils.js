// src/utils/tamerNameUtils.js
// 테이머명(닉네임) 관리 유틸리티 함수

import { doc, getDoc, runTransaction, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const NICKNAME_INDEX_COLLECTION = "nickname_index";
const NORMALIZED_SPACE_NOTICE = "연속된 공백은 1칸으로 자동 변경됩니다.";

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
  const nicknameRef = doc(db, NICKNAME_INDEX_COLLECTION, normalizedKey);

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error("사용자 정보를 찾을 수 없습니다.");
    }

    const nicknameSnap = await transaction.get(nicknameRef);
    if (nicknameSnap.exists() && nicknameSnap.data().uid !== uid) {
      throw new Error("이미 사용 중인 테이머명입니다.");
    }

    const storedNickname = userSnap.data()?.tamerName;
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
    transaction.update(userRef, {
      tamerName: normalizedNickname,
      updatedAt: now,
    });

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

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error("사용자 정보를 찾을 수 없습니다.");
    }

    const storedNickname = userSnap.data()?.tamerName;
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

    transaction.update(userRef, {
      tamerName: null,
      updatedAt: new Date(),
    });

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
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      return userData.tamerName || userData.displayName || authDisplayName || `Trainer_${uid.slice(0, 6)}`;
    }

    return authDisplayName || `Trainer_${uid.slice(0, 6)}`;
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
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData.tamerName) {
        return userData.tamerName;
      }

      return userData.displayName || displayName || `Trainer_${uid.slice(0, 6)}`;
    }

    await setDoc(userRef, {
      email: null,
      displayName,
      tamerName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return displayName || `Trainer_${uid.slice(0, 6)}`;
  } catch (error) {
    console.error("테이머명 초기화 오류:", error);
    return displayName || "익명의 테이머";
  }
}
