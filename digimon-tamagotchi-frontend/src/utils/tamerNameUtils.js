// src/utils/tamerNameUtils.js
// 테이머명(닉네임) 관리 유틸리티 함수

import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../firebase";

/**
 * 사용 중인 닉네임 목록 가져오기
 * @returns {Promise<Array<string>>} 사용 중인 닉네임 배열
 */
export async function getUsedNicknames() {
  try {
    const nickRef = doc(db, "metadata", "nicknames");
    const nickSnap = await getDoc(nickRef);
    
    if (nickSnap.exists()) {
      return nickSnap.data().list || [];
    }
    
    // 문서가 없으면 초기화
    await setDoc(nickRef, { list: [] });
    return [];
  } catch (error) {
    console.error("닉네임 목록 가져오기 오류:", error);
    return [];
  }
}

/**
 * 닉네임 중복 검사
 * @param {string} nickname - 검사할 닉네임
 * @param {string} currentNickname - 현재 사용 중인 닉네임 (자신의 닉네임은 제외)
 * @returns {Promise<{isAvailable: boolean, message: string}>}
 */
export async function checkNicknameAvailability(nickname, currentNickname = null) {
  if (!nickname || nickname.trim() === "") {
    return { isAvailable: false, message: "테이머명을 입력해주세요." };
  }

  const trimmedNickname = nickname.trim();
  
  // 길이 검사
  if (trimmedNickname.length < 2) {
    return { isAvailable: false, message: "테이머명은 2자 이상이어야 합니다." };
  }
  
  if (trimmedNickname.length > 20) {
    return { isAvailable: false, message: "테이머명은 20자 이하여야 합니다." };
  }

  // 특수문자 검사 (한글, 영문, 숫자, 공백만 허용)
  const validPattern = /^[가-힣a-zA-Z0-9\s]+$/;
  if (!validPattern.test(trimmedNickname)) {
    return { isAvailable: false, message: "테이머명은 한글, 영문, 숫자, 공백만 사용할 수 있습니다." };
  }

  // 중복 검사
  const usedNames = await getUsedNicknames();
  
  // 자신의 현재 닉네임은 제외
  const filteredNames = currentNickname 
    ? usedNames.filter(name => name !== currentNickname)
    : usedNames;
  
  if (filteredNames.includes(trimmedNickname)) {
    return { isAvailable: false, message: "이미 사용 중인 테이머명입니다." };
  }

  return { isAvailable: true, message: "사용 가능한 테이머명입니다." };
}

/**
 * 테이머명 업데이트 (중복 검사 포함)
 * @param {string} uid - 사용자 ID
 * @param {string} newNickname - 새로운 닉네임
 * @param {string} oldNickname - 기존 닉네임 (있으면 목록에서 제거)
 * @returns {Promise<void>}
 */
export async function updateTamerName(uid, newNickname, oldNickname = null) {
  if (!uid) {
    throw new Error("사용자 ID가 필요합니다.");
  }

  const trimmedNickname = newNickname.trim();
  
  // 중복 검사
  const availability = await checkNicknameAvailability(trimmedNickname, oldNickname);
  if (!availability.isAvailable) {
    throw new Error(availability.message);
  }

  // 1. 유저 정보 업데이트
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    tamerName: trimmedNickname,
    updatedAt: new Date(),
  });

  // 2. 닉네임 목록 업데이트
  const nickRef = doc(db, "metadata", "nicknames");
  
  // 기존 닉네임이 있으면 목록에서 제거
  if (oldNickname && oldNickname !== trimmedNickname) {
    await updateDoc(nickRef, {
      list: arrayRemove(oldNickname),
    });
  }
  
  // 새 닉네임을 목록에 추가
  await updateDoc(nickRef, {
    list: arrayUnion(trimmedNickname),
  });
}

/**
 * 기본값으로 되돌리기 (Firebase Auth의 displayName 사용)
 * @param {string} uid - 사용자 ID
 * @param {string} authDisplayName - Firebase Auth의 displayName
 * @param {string} currentNickname - 현재 커스텀 닉네임 (목록에서 제거)
 * @returns {Promise<void>}
 */
export async function resetToDefaultTamerName(uid, authDisplayName, currentNickname = null) {
  if (!uid) {
    throw new Error("사용자 ID가 필요합니다.");
  }

  const defaultName = authDisplayName || `Trainer_${uid.slice(0, 6)}`;

  // 1. 유저 정보에서 tamerName 제거 (기본값 사용)
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    tamerName: null, // null로 설정하면 displayName 사용
    updatedAt: new Date(),
  });

  // 2. 기존 커스텀 닉네임이 있으면 목록에서 제거
  if (currentNickname) {
    const nickRef = doc(db, "metadata", "nicknames");
    await updateDoc(nickRef, {
      list: arrayRemove(currentNickname),
    });
  }
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
      // tamerName이 있으면 사용, 없으면 displayName 사용
      return userData.tamerName || userData.displayName || authDisplayName || `Trainer_${uid.slice(0, 6)}`;
    }
    
    // 문서가 없으면 기본값 반환
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
      
      // 이미 tamerName이 설정되어 있으면 그대로 사용
      if (userData.tamerName) {
        return userData.tamerName;
      }
      
      // tamerName이 없으면 displayName을 기본값으로 설정 (하지만 목록에는 추가하지 않음)
      // 기본값은 목록에 추가하지 않음 (커스텀 닉네임만 목록에 추가)
      return userData.displayName || displayName || `Trainer_${uid.slice(0, 6)}`;
    }
    
    // 문서가 없으면 생성 (tamerName은 null로 두고 displayName만 저장)
    await setDoc(userRef, {
      email: null, // Login.jsx에서 이미 저장하므로 여기서는 생략
      displayName: displayName,
      tamerName: null, // null이면 displayName 사용
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    return displayName || `Trainer_${uid.slice(0, 6)}`;
  } catch (error) {
    console.error("테이머명 초기화 오류:", error);
    return displayName || "익명의 테이머";
  }
}
