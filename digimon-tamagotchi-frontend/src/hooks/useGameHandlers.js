// src/hooks/useGameHandlers.js
// Game.jsx의 이벤트 핸들러와 인증 로직을 분리한 Custom Hook

import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getSleepStatus, resetCallStatus, addActivityLog } from "./useGameLogic";

/**
 * 수면 스케줄 가져오기
 * @param {string} name - 디지몬 이름
 * @param {Object} digimonDataVer1 - 디지몬 데이터
 * @returns {Object} 수면 스케줄 객체 { start, end }
 */
export const getSleepSchedule = (name, digimonDataVer1) => {
  const data = digimonDataVer1[name] || {};
  return data.sleepSchedule || { start: 22, end: 6 };
};

/**
 * 현재 시간이 수면 스케줄 내에 있는지 확인
 * @param {Object} schedule - 수면 스케줄 { start, end }
 * @param {Date} nowDate - 현재 시간
 * @returns {boolean}
 */
export const isWithinSleepSchedule = (schedule, nowDate = new Date()) => {
  const hour = nowDate.getHours();
  const { start, end } = schedule;
  if (start === end) return false;
  if (start < end) {
    return hour >= start && hour < end;
  }
  // 자정 넘김
  return hour >= start || hour < end;
};

/**
 * 수면 중 인터랙션 시 10분 깨우기 + 수면방해 카운트
 * @param {Object} digimonStats - 디지몬 스탯
 * @param {Function} setWakeUntilCb - wakeUntil 설정 함수
 * @param {Function} setStatsCb - 스탯 업데이트 함수
 */
function wakeForInteraction(digimonStats, setWakeUntilCb, setStatsCb) {
  const until = Date.now() + 10 * 60 * 1000; // 10분
  setWakeUntilCb(until);
  const updated = {
    ...digimonStats,
    wakeUntil: until,
    sleepDisturbances: (digimonStats.sleepDisturbances || 0) + 1,
  };
  setStatsCb(updated);
}

/**
 * useGameHandlers Hook
 * Game.jsx의 이벤트 핸들러와 인증 로직을 관리하는 Custom Hook
 * 
 * @param {Object} params - Hook 파라미터
 * @returns {Object} 핸들러 함수들
 */
export function useGameHandlers({
  // State 및 Setters
  selectedDigimon,
  digimonStats,
  setDigimonStats,
  wakeUntil,
  setWakeUntil,
  isLightsOn,
  setIsLightsOn,
  activeMenu,
  setActiveMenu,
  currentQuestArea,
  clearedQuestIndex,
  setCurrentQuestArea,
  setCurrentQuestRound,
  setBattleType,
  setSparringEnemySlot,
  setClearedQuestIndex,
  setActivityLogs,
  
  // Functions
  toggleModal,
  setDigimonStatsAndSave,
  applyLazyUpdateBeforeAction,
  handleCleanPoopFromHook,
  startHealCycle,
  
  // Data
  quests,
  digimonDataVer1,
  slotId,
  currentUser,
  
  // Auth & Navigation
  logout,
  navigate,
  
  // UI State
  setIsSleeping,
}) {
  /**
   * 메뉴 클릭 핸들러
   * @param {string} menu - 메뉴 타입
   */
  const handleMenuClick = (menu) => {
    // 수면 중 인터랙션 시 10분 깨우고 sleepDisturbances 증가
    const schedule = getSleepSchedule(selectedDigimon, digimonDataVer1);
    const nowSleeping = isWithinSleepSchedule(schedule, new Date()) && !(wakeUntil && Date.now() < wakeUntil);
    if (nowSleeping && menu !== "electric") {
      wakeForInteraction(digimonStats, setWakeUntil, setDigimonStatsAndSave);
      setIsSleeping(false);
    }

    // Lights 토글은 electric 버튼에 매핑
    if (menu === "electric") {
      handleToggleLights();
      setActiveMenu(menu);
      return;
    }

    setActiveMenu(menu);
    switch(menu){
      case "eat":
        toggleModal('feed', true);
        break;
      case "status":
        toggleModal('stats', true);
        break;
      case "bathroom":
        handleCleanPoopFromHook();
        break;
      case "train":
        toggleModal('train', true);
        break;
      case "battle":
        toggleModal('battleSelection', true);
        break;
      case "heal":
        handleHeal();
        break;
      case "callSign":
        toggleModal('call', true);
        break;
      default:
    }
  };

  /**
   * 치료(Heal) 액션 핸들러
   */
  const handleHeal = async () => {
    const updatedStats = await applyLazyUpdateBeforeAction();
    if (updatedStats.isDead) return;
    // 수면 중 치료 시도 시 수면 방해 처리
    const schedule = getSleepSchedule(selectedDigimon, digimonDataVer1);
    const nowSleeping = isWithinSleepSchedule(schedule, new Date()) && !(wakeUntil && Date.now() < wakeUntil);
    if (nowSleeping) {
      wakeForInteraction(updatedStats, setWakeUntil, setDigimonStatsAndSave);
      const updatedLogs = addActivityLog(updatedStats.activityLogs || [], 'CARE_MISTAKE', 'Sleep Disturbance: Healed while sleeping');
      setDigimonStatsAndSave({ ...updatedStats, activityLogs: updatedLogs }, updatedLogs);
    }
    setDigimonStats(updatedStats);
    // 부상이 없으면 치료 불가 - 모달로 표시
    if (!updatedStats.isInjured) {
      toggleModal('heal', true);
      return;
    }
    // 치료 모달 열기
    toggleModal('heal', true);
  };

  /**
   * 퀘스트 시작 핸들러
   */
  const handleQuestStart = () => {
    toggleModal('questSelection', true);
  };

  /**
   * 영역 선택 핸들러
   * @param {string} areaId - 영역 ID
   */
  const handleSelectArea = (areaId) => {
    setCurrentQuestArea(areaId);
    setCurrentQuestRound(0);
    toggleModal('questSelection', false);
    setBattleType('quest');
    setSparringEnemySlot(null);
    toggleModal('battleScreen', true);
  };

  /**
   * 통신 시작 핸들러
   */
  const handleCommunicationStart = () => {
    toggleModal('communication', true);
  };

  /**
   * 스파링 시작 핸들러
   */
  const handleSparringStart = () => {
    toggleModal('sparring', true);
  };

  /**
   * 스파링 슬롯 선택 핸들러
   * @param {Object} enemySlot - 적 슬롯 정보
   */
  const handleSparringSlotSelect = (enemySlot) => {
    setSparringEnemySlot(enemySlot);
    setBattleType('sparring');
    setCurrentQuestArea(null);
    setCurrentQuestRound(0);
    toggleModal('battleScreen', true);
  };

  /**
   * 퀘스트 완료 핸들러
   */
  const handleQuestComplete = () => {
    // 현재 깬 Area가 clearedQuestIndex와 같으면 다음 Area 해금
    const currentAreaIndex = quests.findIndex(q => q.areaId === currentQuestArea);
    if (currentAreaIndex === clearedQuestIndex) {
      setClearedQuestIndex(prev => prev + 1);
    }
  };

  /**
   * 조명 토글 핸들러
   */
  const handleToggleLights = async () => {
    const next = !isLightsOn;
    setIsLightsOn(next);
    // 호출 해제: 불이 꺼지면 sleep 호출 리셋
    let updatedStats = digimonStats;
    if (!next) {
      updatedStats = resetCallStatus(digimonStats, 'sleep');
      setDigimonStats(updatedStats);
    }
    // Activity Log 추가 (함수형 업데이트)
    const logText = next ? 'Lights: ON' : 'Lights: OFF';
    setActivityLogs((prevLogs) => {
      const currentLogs = updatedStats.activityLogs || prevLogs || [];
      const updatedLogs = addActivityLog(currentLogs, 'ACTION', logText);
      // Firestore에도 저장 (비동기 처리)
      if(slotId && currentUser){
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        updateDoc(slotRef, {
          isLightsOn: next,
          digimonStats: { ...updatedStats, activityLogs: updatedLogs },
          activityLogs: updatedLogs,
          updatedAt: new Date(),
        }).catch((error) => {
          console.error("조명 상태 저장 오류:", error);
        });
      }
      return updatedLogs;
    });
  };

  /**
   * 로그아웃 핸들러
   */
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error("로그아웃 오류:", err);
    }
  };

  return {
    handleMenuClick,
    handleHeal,
    handleQuestStart,
    handleSelectArea,
    handleCommunicationStart,
    handleSparringStart,
    handleSparringSlotSelect,
    handleQuestComplete,
    handleToggleLights,
    handleLogout,
  };
}

