// src/hooks/useGameHandlers.js
// Game.jsx의 이벤트 핸들러와 인증 로직을 분리한 Custom Hook

import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { resetCallStatus, addActivityLog } from "./useGameLogic";

/**
 * 수면 스케줄 가져오기 (야행성 모드 반영)
 * @param {string} name - 디지몬 이름
 * @param {Object} digimonDataVer1 - 디지몬 데이터
 * @param {Object|null} digimonStats - 디지몬 스탯 (야행성 모드 확인용, 선택적)
 * @returns {Object} 수면 스케줄 객체 { start, end }
 */
export const getSleepSchedule = (name, digimonDataVer1, digimonStats = null) => {
  const data = digimonDataVer1[name] || {};
  const baseSchedule = data.sleepSchedule || { start: 22, end: 6 };
  
  // 야행성 모드 확인
  const isNocturnal = digimonStats?.isNocturnal || false;
  
  if (!isNocturnal) return baseSchedule;
  
  // 야행성 모드: 시작 시간과 종료 시간을 3시간 뒤로 미룸 (24시간제 계산)
  return {
    start: (baseSchedule.start + 3) % 24,
    end: (baseSchedule.end + 3) % 24
  };
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
 * 수면 중 인터랙션 시 10분 깨우기 + 수면방해 카운트 (현재 사용되지 않음)
 * @param {Object} digimonStats - 디지몬 스탯
 * @param {Function} setWakeUntilCb - wakeUntil 설정 함수
 * @param {Function} setStatsCb - 스탯 업데이트 함수
 * @param {boolean} isSleepTime - 정규 수면 시간 여부
 * @param {Function} onSleepDisturbance - 수면 방해 콜백
 */
// function wakeForInteraction(digimonStats, setWakeUntilCb, setStatsCb, isSleepTime = true, onSleepDisturbance = null) {
//   const until = Date.now() + 10 * 60 * 1000; // 10분
//   setWakeUntilCb(until);
//   
//   const nowMs = Date.now();
//   const napUntil = digimonStats.napUntil || null;
//   const isNapTime = napUntil ? napUntil > nowMs : false;
//   
//   const updated = {
//     ...digimonStats,
//     wakeUntil: until,
//     // 정규 수면 시간에 깨울 때만 수면 방해(sleepDisturbances) 증가 (낮잠 중에는 증가하지 않음)
//     sleepDisturbances: (isSleepTime && !isNapTime) 
//       ? (digimonStats.sleepDisturbances || 0) + 1 
//       : (digimonStats.sleepDisturbances || 0)
//   };
//   setStatsCb(updated);
//   
//   // 수면 방해 콜백 호출 (낮잠 중이 아닐 때만)
//   if (onSleepDisturbance && isSleepTime && !isNapTime) {
//     onSleepDisturbance();
//   }
// }

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
  appendLogToSubcollection,
  toggleModal,
  setDigimonStatsAndSave,
  applyLazyUpdateBeforeAction,
  handleCleanPoopFromHook,
  startHealCycle,
  setHealModalStats, // HealModal에 전달할 최신 스탯 설정
  
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
  
  // Callbacks
  onSleepDisturbance = null, // 수면 방해 콜백
}) {
  /**
   * 메뉴 클릭 핸들러
   * @param {string} menu - 메뉴 타입
   */
  const handleMenuClick = (menu) => {
    // 수면방해는 실제 액션 수행 시점에 처리됨 (메뉴 클릭 시점이 아님)
    // 스탯(status), 호출(callSign), 조명(electric)은 수면방해 제외

    // Lights 모달은 electric 버튼에 매핑 (수면방해 제외)
    if (menu === "electric") {
      toggleModal('lights', true);
      setActiveMenu(menu);
      return;
    }

    // 불이 꺼진 상태에서는 식사·훈련·배틀·교감·화장실·치료 동작 불가
    const needsLights = ['eat', 'train', 'battle', 'communication', 'bathroom', 'heal'];
    if (needsLights.includes(menu) && !isLightsOn) {
      alert('💡 조명을 먼저 켜주세요! 💡');
      return;
    }

    setActiveMenu(menu);
    switch(menu){
      case "eat":
        toggleModal('feed', true);
        break;
      case "status":
        // 스탯은 수면방해 제외
        toggleModal('stats', true);
        break;
      case "bathroom":
        // 화장실은 실제 청소 시 수면방해 발생 (handleCleanPoop에서 처리)
        handleCleanPoopFromHook();
        break;
      case "train":
        toggleModal('train', true);
        break;
      case "battle":
        toggleModal('battleSelection', true);
        break;
      case "heal":
        // 치료는 실제 치료 완료 시 수면방해 발생 (handleHeal에서 처리)
        handleHeal();
        break;
      case "callSign":
        // 호출은 수면방해 제외
        toggleModal('call', true);
        break;
      case "communication":
        // 교감은 실제 액션 선택 시 수면방해 발생 (각 모달에서 처리)
        toggleModal('interaction', true);
        break;
      case "extra":
        // 추가 기능은 수면방해 제외
        toggleModal('extra', true);
        break;
      default:
    }
  };

  /**
   * 치료(Heal) 액션 핸들러
   * 수면방해는 handleMenuClick에서 처리됨
   */
  const handleHeal = async () => {
    const updatedStats = await applyLazyUpdateBeforeAction();
    if (updatedStats.isDead) return;
    setDigimonStats(updatedStats);
    // HealModal에 전달할 최신 스탯 설정 (비동기 상태 업데이트 문제 해결)
    setHealModalStats(updatedStats);
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
    let updatedStats = { ...digimonStats };
    if (!next) {
      updatedStats = resetCallStatus(updatedStats, 'sleep');
      // 불을 껐을 때 빠른 잠들기 시작 시점 기록 (수면 방해 중이든 아니든)
      updatedStats.fastSleepStart = Date.now();
      
      // 디버깅: 콘솔에 출력
      console.log('[handleToggleLights] fastSleepStart 설정:', updatedStats.fastSleepStart);
      
      // 수면 시간이 아니면 낮잠 예약
      const schedule = getSleepSchedule(selectedDigimon, digimonDataVer1, digimonStats);
      const isSleepTime = isWithinSleepSchedule(schedule, new Date());
      
      if (!isSleepTime) {
        // 낮잠 예약: 15초 대기 후 3시간
        // 실제 낮잠 시작은 15초 후이므로, 그 시점부터 3시간
        updatedStats.napUntil = Date.now() + (15 * 1000) + (3 * 60 * 60 * 1000);
      } else {
        updatedStats.napUntil = null; // 정규 수면 시간에는 낮잠 없음
      }
    } else {
      // 불을 켜면 빠른 잠들기 시점 및 낮잠 리셋
      updatedStats.fastSleepStart = null;
      updatedStats.napUntil = null; // 불 켜면 낮잠 종료
    }
    
    const currentLogs = updatedStats.activityLogs || [];
    const logText = next ? "Lights: ON" : "Lights: OFF";
    const updatedLogs = addActivityLog(currentLogs, "ACTION", logText);
    updatedStats.activityLogs = updatedLogs;
    if (appendLogToSubcollection) await appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
    await setDigimonStatsAndSave(updatedStats, updatedLogs);
    
    // 디버깅: 저장 후 확인
    console.log('[handleToggleLights] 저장 후 fastSleepStart:', updatedStats.fastSleepStart);
    
    // isLightsOn 상태를 명시적으로 저장 (Firestore)
    // setIsLightsOn은 비동기이므로, saveStats가 이전 값을 사용할 수 있음
    // 따라서 별도로 isLightsOn을 저장해야 함
    if (slotId && currentUser) {
      try {
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        await updateDoc(slotRef, {
          isLightsOn: next,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("조명 상태 저장 오류 (Firestore):", error);
      }
    }
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

