// src/hooks/useGameState.js
// Game.jsx의 모든 State 관리를 통합한 Custom Hook

import { useState, useEffect, useMemo } from "react";
import { initializeStats } from "../data/stats";
import { DEFAULT_BACKGROUND_SETTINGS } from "../data/backgroundData";
import { getBackgroundSprite } from "../utils/backgroundUtils";

/**
 * Sprite 설정을 localStorage에서 로드
 */
const loadSpriteSettings = () => {
  try {
    const saved = localStorage.getItem('digimon_view_settings');
    if (saved) {
      const settings = JSON.parse(saved);
      return {
        width: settings.width || 300,
        height: settings.height || 200,
      };
    }
  } catch (error) {
    console.error('Sprite settings 로드 오류:', error);
  }
  return { width: 300, height: 200 };
};

/**
 * Sprite 설정을 localStorage에 저장
 */
const saveSpriteSettings = (newWidth, newHeight) => {
  try {
    const settings = {
      width: newWidth,
      height: newHeight,
    };
    localStorage.setItem('digimon_view_settings', JSON.stringify(settings));
  } catch (error) {
    console.error('Sprite settings 저장 오류:', error);
  }
};

/**
 * Developer Mode를 localStorage에서 로드
 */
const loadDeveloperMode = () => {
  try {
    const saved = localStorage.getItem('digimon_developer_mode');
    if (saved !== null) {
      return saved === 'true';
    }
  } catch (error) {
    console.error('Developer mode 로드 오류:', error);
  }
  return false;
};

/**
 * Developer Mode를 localStorage에 저장
 */
const saveDeveloperMode = (enabled) => {
  try {
    localStorage.setItem('digimon_developer_mode', enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Developer mode 저장 오류:', error);
  }
};


/**
 * useGameState Hook
 * Game.jsx의 모든 State를 통합 관리하는 Custom Hook
 * 
 * @param {Object} params - 초기화 파라미터
 * @param {string} params.slotId - 슬롯 ID (useParams에서 가져옴)
 * @param {Object} params.digimonDataVer1 - 디지몬 데이터 맵
 * @param {number} params.defaultSeasonId - 기본 시즌 ID
 * @returns {Object} gameState, refs, actions
 */
export function useGameState({ slotId, digimonDataVer1, defaultSeasonId = 1 }) {
  
  // ============================================
  // 1. Game Data (핵심 데이터)
  // ============================================
  const [selectedDigimon, setSelectedDigimon] = useState("Digitama");
  const [digimonStats, setDigimonStats] = useState(
    initializeStats("Digitama", {}, digimonDataVer1)
  );
  const [activityLogs, setActivityLogs] = useState([]);
  
  // 슬롯 정보
  const [slotName, setSlotName] = useState("");
  const [slotCreatedAt, setSlotCreatedAt] = useState("");
  const [slotDevice, setSlotDevice] = useState("");
  const [slotVersion, setSlotVersion] = useState("");
  
  // 퀘스트 관련
  const [currentQuestArea, setCurrentQuestArea] = useState(null);
  const [currentQuestRound, setCurrentQuestRound] = useState(0);
  const [clearedQuestIndex, setClearedQuestIndex] = useState(0);
  
  // 배틀 관련
  const [battleType, setBattleType] = useState(null); // 'quest' | 'sparring' | 'arena'
  const [sparringEnemySlot, setSparringEnemySlot] = useState(null);
  const [arenaChallenger, setArenaChallenger] = useState(null);
  const [arenaEnemyId, setArenaEnemyId] = useState(null);
  const [myArenaEntryId, setMyArenaEntryId] = useState(null);
  
  // 시즌 관련
  const [currentSeasonId, setCurrentSeasonId] = useState(defaultSeasonId);
  const [seasonName, setSeasonName] = useState(`Season ${defaultSeasonId}`);
  const [seasonDuration, setSeasonDuration] = useState("");
  
  // ============================================
  // 2. Modals (모든 모달/팝업 상태를 하나의 객체로 통합)
  // ============================================
  const [modals, setModals] = useState({
    // 기본 모달
    stats: false,
    feed: false,
    settings: false,
    admin: false,
    digimonInfo: false,
    
    // 사망 관련
    deathConfirm: false,
    deathModal: false,
    
    // 훈련/배틀
    train: false,
    battleSelection: false,
    battleScreen: false,
    questSelection: false,
    communication: false,
    sparring: false,
    arenaScreen: false,
    
    // 치료/호출
    heal: false,
    call: false,
    
    // 교감
    interaction: false,
    diet: false,
    rest: false,
    detox: false,
    playOrSnack: false,
    tease: false,
    
    // 애니메이션 표시 (모달은 아니지만 show로 시작)
    food: false,
    poopCleanAnimation: false,
    healAnimation: false,
    callToast: false,
    sleepDisturbanceToast: false,
    
    // 상태 상세 모달
    statusDetail: false,
    
    // 과식 확인 모달
    overfeedConfirm: false,
    
    // 조명 제어 모달
    lights: false,
    
    // 추가 기능 모달
    extra: false,
    collection: false,
    backgroundSettings: false,
  });
  
  // ============================================
  // 3. 임시 상태 (모달용)
  // ============================================
  const [healModalStats, setHealModalStats] = useState(null); // HealModal에 전달할 최신 스탯
  const [healTreatmentMessage, setHealTreatmentMessage] = useState(null); // 치료 성공 메시지
  
  // ============================================
  // 4. Flags (상태 플래그)
  // ============================================
  const [developerMode, setDeveloperMode] = useState(() => loadDeveloperMode());
  const [isEvolving, setIsEvolving] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [isLoadingSlot, setIsLoadingSlot] = useState(true);
  const [isEvoEnabled, setIsEvoEnabled] = useState(false);
  const [hasSeenDeathPopup, setHasSeenDeathPopup] = useState(false);
  const [dailySleepMistake, setDailySleepMistake] = useState(false);
  
  // ============================================
  // 4. UI State (UI 관련 상태)
  // ============================================
  const [activeMenu, setActiveMenu] = useState(null);
  const [currentAnimation, setCurrentAnimation] = useState("idle");
  
  // 배경화면 설정 (슬롯별로 localStorage에서 로드)
  const [backgroundSettings, setBackgroundSettings] = useState(() => {
    if (!slotId) return DEFAULT_BACKGROUND_SETTINGS;
    
    try {
      const saved = localStorage.getItem(`slot${slotId}_backgroundSettings`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Background settings 로드 오류:', error);
    }
    return DEFAULT_BACKGROUND_SETTINGS;
  });
  
  // 슬롯 변경 시 해당 슬롯의 배경화면 설정 로드
  useEffect(() => {
    if (!slotId) return;
    
    try {
      const saved = localStorage.getItem(`slot${slotId}_backgroundSettings`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setBackgroundSettings(parsed);
      } else {
        // 슬롯별 설정이 없으면 기본값 사용
        setBackgroundSettings(DEFAULT_BACKGROUND_SETTINGS);
      }
    } catch (error) {
      console.error('Background settings 로드 오류:', error);
      setBackgroundSettings(DEFAULT_BACKGROUND_SETTINGS);
    }
  }, [slotId]);
  
  // backgroundSettings 변경 시 슬롯별로 localStorage에 저장
  useEffect(() => {
    if (!slotId) return;
    
    try {
      localStorage.setItem(`slot${slotId}_backgroundSettings`, JSON.stringify(backgroundSettings));
    } catch (error) {
      console.error('Background settings 저장 오류:', error);
    }
  }, [backgroundSettings, slotId]);
  
  // Canvas 크기
  const [width, setWidth] = useState(() => loadSpriteSettings().width);
  const [height, setHeight] = useState(() => loadSpriteSettings().height);
  
  // width/height 변경 시 localStorage에 저장
  useEffect(() => {
    saveSpriteSettings(width, height);
  }, [width, height]);

  // developerMode 변경 시 localStorage에 저장
  useEffect(() => {
    saveDeveloperMode(developerMode);
  }, [developerMode]);
  
  // 먹이 관련
  const [feedType, setFeedType] = useState(null);
  const [feedStep, setFeedStep] = useState(0);
  const [foodSizeScale, setFoodSizeScale] = useState(0.31);
  
  // 청소/치료 애니메이션
  const [cleanStep, setCleanStep] = useState(0);
  const [healStep, setHealStep] = useState(0);
  
  // 시간 관련 (backgroundNumber 계산 전에 선언 필요)
  const [customTime, setCustomTime] = useState(new Date());
  const [timeSpeed, setTimeSpeed] = useState(1);
  
  // 실제 배경화면 번호 계산 (호환성 유지) - customTime 이후에 선언
  const backgroundNumber = useMemo(() => {
    return getBackgroundSprite(backgroundSettings, customTime || new Date());
  }, [backgroundSettings, customTime]);
  
  // setBackgroundNumber 호환성 함수 (숫자를 받아서 배경화면 설정으로 변환)
  const setBackgroundNumber = (number) => {
    // 숫자로 배경화면을 찾아서 설정
    // 162-164: default, 165-167: forest, 168-170: city, 171-173: desert, 174-176: ocean, 177-179: space
    const bgId = number >= 162 && number <= 164 ? 'default' :
                 number >= 165 && number <= 167 ? 'forest' :
                 number >= 168 && number <= 170 ? 'city' :
                 number >= 171 && number <= 173 ? 'desert' :
                 number >= 174 && number <= 176 ? 'ocean' :
                 number >= 177 && number <= 179 ? 'space' : 'default';
    
    // 스프라이트 인덱스 계산 (0, 1, 2)
    const baseSprite = number >= 162 && number <= 164 ? 162 :
                      number >= 165 && number <= 167 ? 165 :
                      number >= 168 && number <= 170 ? 168 :
                      number >= 171 && number <= 173 ? 171 :
                      number >= 174 && number <= 176 ? 174 :
                      number >= 177 && number <= 179 ? 177 : 162;
    
    const spriteIndex = number - baseSprite;
    setBackgroundSettings({ selectedId: bgId, mode: spriteIndex.toString() });
  };
  
  // 진화 관련
  const [evolutionStage, setEvolutionStage] = useState('idle'); // 'idle' | 'shaking' | 'flashing' | 'complete'
  const [evolvedDigimonName, setEvolvedDigimonName] = useState(null);
  
  // 사망 관련
  const [deathReason, setDeathReason] = useState(null);
  
  // 수면/조명 관련
  const [isLightsOn, setIsLightsOn] = useState(true);
  const [wakeUntil, setWakeUntil] = useState(null);
  const [sleepStatus, setSleepStatus] = useState("AWAKE"); // 'AWAKE' | 'TIRED' | 'SLEEPING'
  
  // 호출 관련
  const [callToastMessage, setCallToastMessage] = useState("");
  
  // ============================================
  // 5. Refs
  // ============================================
  // tiredStartRef, tiredCountedRef는 더 이상 사용하지 않음 (digimonStats.tiredStartAt으로 대체)
  
  // ============================================
  // Helper Functions (모달 관리)
  // ============================================
  
  /**
   * 특정 모달 열기/닫기
   * @param {string} name - 모달 이름 (modals 객체의 키)
   * @param {boolean} isOpen - 열기/닫기 여부
   */
  const toggleModal = (name, isOpen) => {
    setModals((prevModals) => ({
      ...prevModals,
      [name]: isOpen,
    }));
  };
  
  /**
   * 모든 모달 닫기
   */
  const closeAllModals = () => {
    setModals({
      stats: false,
      feed: false,
      settings: false,
      admin: false,
      digimonInfo: false,
      deathConfirm: false,
      deathModal: false,
      train: false,
      battleSelection: false,
      battleScreen: false,
      questSelection: false,
      communication: false,
      sparring: false,
      arenaScreen: false,
      heal: false,
      call: false,
      interaction: false,
      diet: false,
      detox: false,
      food: false,
      poopCleanAnimation: false,
      healAnimation: false,
      callToast: false,
    });
  };
  
  // ============================================
  // Return 값 정리
  // ============================================
  
  return {
    // Game Data
    gameState: {
      // 디지몬
      selectedDigimon,
      setSelectedDigimon,
      digimonStats,
      setDigimonStats,
      activityLogs,
      setActivityLogs,
      // 임시 상태 (모달용)
      healModalStats,
      setHealModalStats,
      
      // 슬롯 정보
      slotId: slotId ? (typeof slotId === 'number' ? slotId : parseInt(slotId) || null) : null, // slotId를 gameState에 포함
      slotName,
      setSlotName,
      slotCreatedAt,
      setSlotCreatedAt,
      slotDevice,
      setSlotDevice,
      slotVersion,
      setSlotVersion,
      
      // 퀘스트
      currentQuestArea,
      setCurrentQuestArea,
      currentQuestRound,
      setCurrentQuestRound,
      clearedQuestIndex,
      setClearedQuestIndex,
      
      // 배틀
      battleType,
      setBattleType,
      sparringEnemySlot,
      setSparringEnemySlot,
      arenaChallenger,
      setArenaChallenger,
      arenaEnemyId,
      setArenaEnemyId,
      myArenaEntryId,
      setMyArenaEntryId,
      
      // 시즌
      currentSeasonId,
      setCurrentSeasonId,
      seasonName,
      setSeasonName,
      seasonDuration,
      setSeasonDuration,
    },
    
    // Modals (통합된 모달 상태)
    modals,
    setModals,
    toggleModal,
    closeAllModals,
    
    // Flags
    flags: {
      developerMode,
      setDeveloperMode,
      isEvolving,
      setIsEvolving,
      isSleeping,
      setIsSleeping,
      isLoadingSlot,
      setIsLoadingSlot,
      isEvoEnabled,
      setIsEvoEnabled,
      hasSeenDeathPopup,
      setHasSeenDeathPopup,
      dailySleepMistake,
      setDailySleepMistake,
    },
    
    // UI State
    ui: {
      activeMenu,
      setActiveMenu,
      currentAnimation,
      setCurrentAnimation,
      backgroundNumber,
      setBackgroundNumber, // 호환성 유지 (실제로는 backgroundSettings 사용)
      backgroundSettings,
      setBackgroundSettings,
      width,
      setWidth,
      height,
      setHeight,
      feedType,
      setFeedType,
      feedStep,
      setFeedStep,
      foodSizeScale,
      setFoodSizeScale,
      cleanStep,
      setCleanStep,
      healStep,
      setHealStep,
      customTime,
      setCustomTime,
      timeSpeed,
      setTimeSpeed,
      evolutionStage,
      setEvolutionStage,
      evolvedDigimonName,
      setEvolvedDigimonName,
      deathReason,
      setDeathReason,
      isLightsOn,
      setIsLightsOn,
      wakeUntil,
      setWakeUntil,
      sleepStatus,
      setSleepStatus,
      callToastMessage,
      setCallToastMessage,
    },
    
    // Refs (현재 사용하지 않음, 향후 필요 시 추가)
    refs: {},
    
    // Actions (편의 함수들)
    actions: {
      toggleModal,
      closeAllModals,
    },
  };
}


