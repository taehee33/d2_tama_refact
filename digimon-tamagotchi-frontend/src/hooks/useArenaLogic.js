// src/hooks/useArenaLogic.js
// Game.jsx의 아레나(Arena) 관련 로직을 분리한 Custom Hook

import { useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * useArenaLogic Hook
 * 아레나 관련 로직을 관리하는 Custom Hook
 * 
 * @param {Object} params - Hook 파라미터
 * @param {string} params.slotId - 슬롯 ID
 * @param {number} params.currentSeasonId - 현재 시즌 ID
 * @param {Function} params.setCurrentSeasonId - 시즌 ID 설정 함수
 * @param {string} params.seasonName - 시즌 이름
 * @param {Function} params.setSeasonName - 시즌 이름 설정 함수
 * @param {number} params.seasonDuration - 시즌 지속 시간
 * @param {Function} params.setSeasonDuration - 시즌 지속 시간 설정 함수
 * @param {Object} params.arenaChallenger - 아레나 도전자 정보
 * @param {Function} params.setArenaChallenger - 아레나 도전자 설정 함수
 * @param {string} params.arenaEnemyId - 아레나 적 ID
 * @param {Function} params.setArenaEnemyId - 아레나 적 ID 설정 함수
 * @param {string} params.myArenaEntryId - 내 아레나 엔트리 ID
 * @param {Function} params.setMyArenaEntryId - 내 아레나 엔트리 ID 설정 함수
 * @param {Function} params.toggleModal - 모달 토글 함수
 * @param {Function} params.setBattleType - 배틀 타입 설정 함수
 * @param {Function} params.setCurrentQuestArea - 현재 퀘스트 영역 설정 함수
 * @param {Function} params.setCurrentQuestRound - 현재 퀘스트 라운드 설정 함수
 * @returns {Object} 아레나 관련 함수들
 */
export function useArenaLogic({
  slotId,
  currentSeasonId,
  setCurrentSeasonId,
  seasonName,
  setSeasonName,
  seasonDuration,
  setSeasonDuration,
  arenaChallenger,
  setArenaChallenger,
  arenaEnemyId,
  setArenaEnemyId,
  myArenaEntryId,
  setMyArenaEntryId,
  toggleModal,
  setBattleType,
  setCurrentQuestArea,
  setCurrentQuestRound,
}) {
  /**
   * 아레나 설정 로드
   * Firestore에서 아레나 설정을 불러와서 state에 반영
   */
  useEffect(() => {
    if (!slotId) {
      return;
    }

    const loadArenaConfig = async () => {
      if (!db) return;
      try {
        const configRef = doc(db, 'game_settings', 'arena_config');
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.currentSeasonId) setCurrentSeasonId(data.currentSeasonId);
          if (data.seasonName) setSeasonName(data.seasonName);
          if (data.seasonDuration) setSeasonDuration(data.seasonDuration);
        }
      } catch (error) {
        console.error("Arena 설정 로드 오류:", error);
      }
    };
    loadArenaConfig();
  }, [slotId, setCurrentSeasonId, setSeasonName, setSeasonDuration]);

  /**
   * 아레나 시작 핸들러
   * 아레나 화면 모달을 엽니다.
   */
  const handleArenaStart = () => {
    toggleModal('arenaScreen', true);
  };

  /**
   * 아레나 배틀 시작 핸들러
   * 선택한 도전자와 배틀을 시작합니다.
   * 
   * @param {Object} challenger - 도전자 정보
   * @param {string|null} myEntryId - 내 아레나 엔트리 ID
   */
  const handleArenaBattleStart = (challenger, myEntryId = null) => {
    if (!challenger.id) {
      console.error("Arena Challenger에 Document ID가 없습니다:", challenger);
      alert("배틀을 시작할 수 없습니다. Challenger 데이터에 문제가 있습니다.");
      return;
    }
    setArenaChallenger(challenger);
    setArenaEnemyId(challenger.id); // 상대방의 Document ID 저장
    setMyArenaEntryId(myEntryId); // 내 디지몬의 Document ID 저장
    setBattleType('arena');
    setCurrentQuestArea(null);
    setCurrentQuestRound(0);
    toggleModal('battleScreen', true);
    toggleModal('arenaScreen', false); // ArenaScreen 닫기
  };

  /**
   * Admin 설정 반영 콜백
   * Admin 모달에서 설정한 아레나 설정을 반영합니다.
   * 
   * @param {Object} config - 설정 객체
   */
  const handleAdminConfigUpdated = (config) => {
    if (config.currentSeasonId) setCurrentSeasonId(config.currentSeasonId);
    if (config.seasonName) setSeasonName(config.seasonName);
    if (config.seasonDuration) setSeasonDuration(config.seasonDuration);
  };

  return {
    handleArenaStart,
    handleArenaBattleStart,
    handleAdminConfigUpdated,
    // 아레나 설정 데이터도 반환 (필요한 경우)
    arenaConfig: {
      currentSeasonId,
      seasonName,
      seasonDuration,
    },
  };
}


