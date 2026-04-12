// src/hooks/useGameHandlers.js
// Game.jsx의 이벤트 핸들러와 인증 로직을 분리한 Custom Hook

import { resetCallStatus, addActivityLog } from "./useGameLogic";
import {
  isTimeWithinSleepSchedule,
  normalizeSleepSchedule,
  shiftSleepScheduleByHours,
} from "../utils/sleepUtils";
import { getGameMenuById, getMenuDisabledState } from "../constants/gameMenus";

/**
 * 수면 스케줄 가져오기 (야행성 모드 반영)
 * @param {string} name - 디지몬 이름
 * @param {Object} digimonDataMap - 현재 슬롯의 디지몬 데이터 맵
 * @param {Object|null} digimonStats - 디지몬 스탯 (야행성 모드 확인용, 선택적)
 * @returns {Object} 수면 스케줄 객체 { start, end }
 */
export const getSleepSchedule = (name, digimonDataMap, digimonStats = null) => {
  const data = digimonDataMap?.[name] || {};
  const baseSchedule = normalizeSleepSchedule(data.sleepSchedule || { start: 22, end: 6 });
  
  // 야행성 모드 확인
  const isNocturnal = digimonStats?.isNocturnal || false;
  
  if (!isNocturnal) return baseSchedule;
  
  // 야행성 모드: 시작 시간과 종료 시간을 3시간 뒤로 미룸 (24시간제 계산)
  return shiftSleepScheduleByHours(baseSchedule, 3);
};

/**
 * 현재 시간이 수면 스케줄 내에 있는지 확인
 * @param {Object} schedule - 수면 스케줄 { start, end }
 * @param {Date} nowDate - 현재 시간
 * @returns {boolean}
 */
export const isWithinSleepSchedule = (schedule, nowDate = new Date()) => {
  return isTimeWithinSleepSchedule(schedule, nowDate);
};

/**
 * 조명 토글 후 저장할 스탯 계산
 * @param {Object} params
 * @param {Object} params.digimonStats
 * @param {boolean} params.next
 * @param {string} params.selectedDigimon
 * @param {Object} params.digimonDataVer1 - 현재 슬롯의 런타임 데이터 맵
 * @param {number} [params.nowMs]
 * @param {Date} [params.nowDate]
 * @returns {Object}
 */
export function buildToggledLightsStats({
  digimonStats,
  next,
  selectedDigimon,
  digimonDataVer1: digimonDataMap,
  nowMs = Date.now(),
  nowDate = new Date(),
}) {
  let updatedStats = {
    ...digimonStats,
    isLightsOn: next,
  };

  if (!next) {
    updatedStats = resetCallStatus(updatedStats, "sleep");
    updatedStats.fastSleepStart = nowMs;

    const schedule = getSleepSchedule(selectedDigimon, digimonDataMap, digimonStats);
    const isSleepTime = isWithinSleepSchedule(schedule, nowDate);

    if (!isSleepTime) {
      updatedStats.napUntil = nowMs + (15 * 1000) + (3 * 60 * 60 * 1000);
    } else {
      updatedStats.napUntil = null;
    }
  } else {
    updatedStats.fastSleepStart = null;
    updatedStats.napUntil = null;
  }

  return updatedStats;
}

/**
 * 조명 토글 저장 시 activity log와 저장 대상 stats를 함께 조립한다.
 * @param {Object} params
 * @param {Object} params.updatedStats
 * @param {boolean} params.next
 * @returns {{updatedLogs:Array, statsWithLogs:Object, logText:string}}
 */
export function buildToggledLightsCommitState({
  updatedStats,
  next,
}) {
  const currentLogs = updatedStats.activityLogs || [];
  const logText = next ? "Lights: ON" : "Lights: OFF";
  const updatedLogs = addActivityLog(currentLogs, "ACTION", logText);

  return {
    updatedLogs,
    statsWithLogs: {
      ...updatedStats,
      activityLogs: updatedLogs,
    },
    logText,
  };
}

/**
 * 퀘스트 선택 시 적용할 상태를 조립한다.
 * @param {Object} params
 * @param {string} params.areaId
 * @param {string} [params.version]
 * @returns {{currentQuestArea:string,currentQuestRound:number,currentQuestVersion:string,battleType:string,sparringEnemySlot:null}}
 */
export function buildQuestSelectionState({
  areaId,
  version = "Ver.1",
}) {
  return {
    currentQuestArea: areaId,
    currentQuestRound: 0,
    currentQuestVersion: version,
    battleType: "quest",
    sparringEnemySlot: null,
  };
}

/**
 * 스파링 상대 선택 시 적용할 상태를 조립한다.
 * @param {Object} params
 * @param {Object} params.enemySlot
 * @returns {{sparringEnemySlot:Object,battleType:string,currentQuestArea:null,currentQuestRound:number}}
 */
export function buildSparringSelectionState({
  enemySlot,
}) {
  return {
    sparringEnemySlot: enemySlot,
    battleType: "sparring",
    currentQuestArea: null,
    currentQuestRound: 0,
  };
}

/**
 * 퀘스트 완료 시 다음 영역 해금이 필요한지 판단한다.
 * @param {Object} params
 * @param {Array} params.quests
 * @param {string|null} params.currentQuestArea
 * @param {number} params.clearedQuestIndex
 * @returns {boolean}
 */
export function shouldAdvanceClearedQuest({
  quests,
  currentQuestArea,
  clearedQuestIndex,
}) {
  const currentAreaIndex = quests.findIndex((q) => q.areaId === currentQuestArea);
  return currentAreaIndex === clearedQuestIndex;
}

/**
 * primary 메뉴 클릭 시 실제 실행할 액션을 결정한다.
 * @param {Object} params
 * @param {string} params.menu
 * @param {Object} params.digimonStats
 * @param {boolean} params.isLightsOn
 * @returns {{activeMenuId:string,actionKey:string}|null}
 */
export function resolvePrimaryMenuAction({
  menu,
  digimonStats,
  isLightsOn,
}) {
  const menuMeta = getGameMenuById(menu);
  const disabledState = getMenuDisabledState(menu, {
    isFrozen: Boolean(digimonStats?.isFrozen),
    isLightsOn,
  });

  if (!menuMeta || menuMeta.surface !== "primary" || disabledState.disabled) {
    return null;
  }

  const actionKeyMap = {
    electric: "openLightsModal",
    eat: "openFeedModal",
    status: "openStatsModal",
    bathroom: "cleanPoop",
    train: "openTrainModal",
    battle: "openBattleSelectionModal",
    heal: "openHealModal",
    callSign: "openCallModal",
    communication: "openInteractionModal",
    extra: "openExtraModal",
  };

  return {
    activeMenuId: menuMeta.id,
    actionKey: actionKeyMap[menuMeta.id] || null,
  };
}

/**
 * Heal 액션에서 모달을 열기 전에 반영할 상태를 조립한다.
 * @param {Object} params
 * @param {Object} params.updatedStats
 * @returns {{stats:Object, modalName:string}|null}
 */
export function buildHealModalPlan({
  updatedStats,
}) {
  if (updatedStats?.isDead) {
    return null;
  }

  return {
    stats: updatedStats,
    modalName: "heal",
  };
}

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
  setCurrentQuestVersion,
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
  const slotRuntimeDataMap = digimonDataVer1;

  /**
   * 메뉴 클릭 핸들러
   * @param {string} menu - 메뉴 타입
   */
  const handleMenuClick = (menu) => {
    const menuAction = resolvePrimaryMenuAction({
      menu,
      digimonStats,
      isLightsOn,
    });

    if (!menuAction) {
      return;
    }

    const menuActionMap = {
      openLightsModal: () => toggleModal("lights", true),
      openFeedModal: () => toggleModal("feed", true),
      openStatsModal: () => toggleModal("stats", true),
      cleanPoop: () => handleCleanPoopFromHook(),
      openTrainModal: () => toggleModal("train", true),
      openBattleSelectionModal: () => toggleModal("battleSelection", true),
      openHealModal: () => handleHeal(),
      openCallModal: () => toggleModal("call", true),
      openInteractionModal: () => toggleModal("interaction", true),
      openExtraModal: () => toggleModal("extra", true),
    };

    setActiveMenu(menuAction.activeMenuId);
    menuActionMap[menuAction.actionKey]?.();
  };

  /**
   * 치료(Heal) 액션 핸들러
   * 수면방해는 handleMenuClick에서 처리됨
   */
  const handleHeal = async () => {
    const updatedStats = await applyLazyUpdateBeforeAction();
    const healModalPlan = buildHealModalPlan({
      updatedStats,
    });

    if (!healModalPlan) {
      return;
    }

    setDigimonStats(healModalPlan.stats);
    setHealModalStats(healModalPlan.stats);
    if (!updatedStats.isInjured) {
      toggleModal(healModalPlan.modalName, true);
      return;
    }
    toggleModal(healModalPlan.modalName, true);
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
   * @param {string} [version] - 퀘스트 버전 ("Ver.1" | "Ver.2")
   */
  const handleSelectArea = (areaId, version = "Ver.1") => {
    const questSelectionState = buildQuestSelectionState({
      areaId,
      version,
    });
    setCurrentQuestArea(questSelectionState.currentQuestArea);
    setCurrentQuestRound(questSelectionState.currentQuestRound);
    setCurrentQuestVersion(questSelectionState.currentQuestVersion);
    toggleModal('questSelection', false);
    setBattleType(questSelectionState.battleType);
    setSparringEnemySlot(questSelectionState.sparringEnemySlot);
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
    const sparringSelectionState = buildSparringSelectionState({
      enemySlot,
    });
    setSparringEnemySlot(sparringSelectionState.sparringEnemySlot);
    setBattleType(sparringSelectionState.battleType);
    setCurrentQuestArea(sparringSelectionState.currentQuestArea);
    setCurrentQuestRound(sparringSelectionState.currentQuestRound);
    toggleModal('battleScreen', true);
  };

  /**
   * 퀘스트 완료 핸들러
   */
  const handleQuestComplete = () => {
    if (shouldAdvanceClearedQuest({
      quests,
      currentQuestArea,
      clearedQuestIndex,
    })) {
      setClearedQuestIndex(prev => prev + 1);
    }
  };

  /**
   * 조명 토글 핸들러
   */
  const handleToggleLights = async () => {
    const next = !isLightsOn;
    setIsLightsOn(next);
    const updatedStats = buildToggledLightsStats({
      digimonStats,
      next,
      selectedDigimon,
      digimonDataVer1: slotRuntimeDataMap,
    });
    const toggledLightsCommitState = buildToggledLightsCommitState({
      updatedStats,
      next,
    });

    if (appendLogToSubcollection) {
      await appendLogToSubcollection(
        toggledLightsCommitState.updatedLogs[toggledLightsCommitState.updatedLogs.length - 1]
      ).catch(() => {});
    }
    await setDigimonStatsAndSave(
      toggledLightsCommitState.statsWithLogs,
      toggledLightsCommitState.updatedLogs
    );
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
