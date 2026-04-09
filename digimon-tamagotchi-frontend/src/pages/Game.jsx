import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePresenceContext } from "../contexts/AblyContext";
import { useMasterData } from "../contexts/MasterDataContext";

import GameHeaderMeta from "../components/GameHeaderMeta";
import GameModals from "../components/GameModals";
import GameScreen from "../components/GameScreen";
import StatusHearts from "../components/StatusHearts";
import DigimonStatusBadges from "../components/DigimonStatusBadges";

import { addActivityLog } from "../hooks/useGameLogic";
import { useDeath } from "../hooks/useDeath";
import { useEvolution } from "../hooks/useEvolution";
import { useGameActions } from "../hooks/useGameActions";
import { useGameAnimations } from "../hooks/useGameAnimations";
import { useArenaLogic } from "../hooks/useArenaLogic";
import { useGameHandlers } from "../hooks/useGameHandlers";
import { useGameData } from "../hooks/useGameData";
import { useGameState } from "../hooks/useGameState";
import { useFridge } from "../hooks/useFridge";
import { buildGameModalBindings } from "../hooks/game-runtime/buildGameModalBindings";
import { buildGamePageViewModel } from "../hooks/game-runtime/buildGamePageViewModel";
import { useGamePagePersistenceEffects } from "../hooks/game-runtime/useGamePagePersistenceEffects";
import { useGameRuntimeEffects } from "../hooks/game-runtime/useGameRuntimeEffects";
import { useJogressSubscriptions } from "../hooks/game-runtime/useJogressSubscriptions";
import {
  buildGameAnimationViewModel,
  DEATH_FORM_IDS,
} from "../hooks/game-runtime/gameAnimationViewModel";
import AdBanner from "../components/AdBanner";
import KakaoAd from "../components/KakaoAd";
import AccountSettingsModal from "../components/AccountSettingsModal";
import OnlineUsersCount from "../components/OnlineUsersCount";
import GameDefaultSection from "../components/layout/GameDefaultSection";
import GamePageView from "../components/layout/GamePageView";
import GamePageToolbar from "../components/layout/GamePageToolbar";
import ImmersiveGameView from "../components/layout/ImmersiveGameView";
import ImmersiveLandscapeSection from "../components/layout/ImmersiveLandscapeSection";
import { useTamerProfile } from "../hooks/useTamerProfile";
import { useImmersiveGameLayout } from "../hooks/game-runtime/useImmersiveGameLayout";

import { adaptDataMapToOldFormat } from "../data/v1/adapter";
import { digimonDataVer1 as newDigimonDataVer1 } from "../data/v1/digimons";
import { digimonDataVer2 } from "../data/v2modkor";
import { digimonDataVer3 } from "../data/v3";
import { digimonDataVer4 } from "../data/v4";
import { digimonDataVer5 } from "../data/v5";
import { questsVer2 } from "../data/v2modkor/quests";
import { initializeStats } from "../data/stats";
import { quests } from "../data/v1/quests";

import { checkEvolution } from "../logic/evolution/checker";
import { formatSlotCreatedAt } from "../utils/dateUtils";
import { buildDigimonLogSnapshot } from "../utils/digimonLogSnapshot";
import {
  getDigimonDataMapByVersion,
  getStarterDigimonId,
  normalizeDigimonVersionLabel,
  SUPPORTED_DIGIMON_VERSIONS,
} from "../utils/digimonVersionUtils";
import { recordRuntimeMetric } from "../utils/runtimeMetrics";

const DEFAULT_SEASON_ID = 1;
const MEAT_SPRITES = ["/images/526.png", "/images/527.png", "/images/528.png", "/images/529.png"];
const PROTEIN_SPRITES = ["/images/530.png", "/images/531.png", "/images/532.png"];

const ver1DigimonList = [
  "Digitama",
  "Botamon",
  "Koromon",
  "Agumon",
  "Betamon",
  "Greymon",
  "Ohakadamon1",
  "Ohakadamon2",
];

const perfectStages = ["Perfect","Ultimate","SuperUltimate"];

function Game({ immersive = false }){
  const { slotId } = useParams();
  const { currentUser, logout, isFirebaseAvailable } = useAuth();
  const { isChatOpen, setIsChatOpen, unreadCount, presenceCount } = usePresenceContext();
  const { masterDataRevision } = useMasterData();

  const adaptedV1 = useMemo(() => {
    const revisionKey = masterDataRevision;
    void revisionKey;
    return adaptDataMapToOldFormat(newDigimonDataVer1);
  }, [masterDataRevision]);
  const adaptedDataMapsByVersion = useMemo(() => {
    const revisionKey = masterDataRevision;
    void revisionKey;

    return {
      "Ver.1": adaptedV1,
      "Ver.2": adaptDataMapToOldFormat(digimonDataVer2),
      "Ver.3": adaptDataMapToOldFormat(digimonDataVer3),
      "Ver.4": adaptDataMapToOldFormat(digimonDataVer4),
      "Ver.5": adaptDataMapToOldFormat(digimonDataVer5),
    };
  }, [adaptedV1, masterDataRevision]);

  const navigate= useNavigate();
  const location = useLocation();
  const isImmersive = immersive || location.pathname.endsWith("/full");
  // useGameState 훅 호출
  const {
    gameState,
    modals,
    
    toggleModal,
    
    flags,
    ui,
  } = useGameState({
    slotId,
    digimonDataVer1: adaptedV1,
    defaultSeasonId: DEFAULT_SEASON_ID,
  });
  
  // 프로필 드롭다운 메뉴 상태
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // 계정 설정 모달 상태
  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState(false);
  const { tamerName, setTamerName, hasVer1Master, hasVer2Master, refreshProfile } = useTamerProfile();
  
  // localStorage 모드 제거: Firebase 로그인 필수
  useEffect(() => {
    if (!isFirebaseAvailable || !currentUser) {
      navigate("/auth");
    }
  }, [isFirebaseAvailable, currentUser, navigate]);

  // useGameState에서 가져온 값들을 구조 분해 할당으로 사용
  const {
    selectedDigimon,
    setSelectedDigimon,
    digimonStats,
    setDigimonStats,
    activityLogs,
    setActivityLogs,
    slotName,
    setSlotName,
    slotCreatedAt,
    setSlotCreatedAt,
    slotDevice,
    setSlotDevice,
    slotVersion,
    setSlotVersion,
    digimonNickname,
    setDigimonNickname,
    currentQuestArea,
    setCurrentQuestArea,
    setCurrentQuestRound,
    setCurrentQuestVersion,
    clearedQuestIndex,
    setClearedQuestIndex,
    battleType,
    setBattleType,
    setSparringEnemySlot,
    arenaChallenger,
    setArenaChallenger,
    arenaEnemyId,
    setArenaEnemyId,
    myArenaEntryId,
    setMyArenaEntryId,
    currentSeasonId,
    setCurrentSeasonId,
    seasonName,
    setSeasonName,
    seasonDuration,
    setSeasonDuration,
    setHealModalStats,
    setHealTreatmentMessage,
  } = gameState;

  const normalizedSlotVersion = normalizeDigimonVersionLabel(slotVersion || "Ver.1");
  const digimonDataForSlot =
    adaptedDataMapsByVersion[normalizedSlotVersion] || adaptedV1;
  const evolutionDataForSlot = getDigimonDataMapByVersion(normalizedSlotVersion);

  const {
    developerMode,
    setDeveloperMode,
    encyclopediaShowQuestionMark,
    setEncyclopediaShowQuestionMark,
    ignoreEvolutionTime,
    setIgnoreEvolutionTime,
    isEvolving,
    setIsEvolving,
    setIsSleeping,
    isLoadingSlot,
    setIsLoadingSlot,
    isEvoEnabled,
    setIsEvoEnabled,
    hasSeenDeathPopup,
    setHasSeenDeathPopup,
  } = flags || {};

  const {
    activeMenu,
    setActiveMenu,
    currentAnimation,
    setCurrentAnimation,
    backgroundNumber,
    backgroundSettings,
    setBackgroundSettings,
    immersiveSettings,
    setImmersiveSettings,
    width,
    height,
    feedType,
    setFeedType,
    feedStep,
    setFeedStep,
    foodSizeScale,
    cleanStep,
    setCleanStep,
    setHealStep,
    customTime,
    setCustomTime,
    evolutionStage,
    setEvolutionStage,
    setEvolvedDigimonName,
    setEvolutionCompleteIsJogress,
    setEvolutionCompleteJogressSummary,
    myJogressRoomId,
    setMyJogressRoomId,
    deathReason,
    setDeathReason,
    isLightsOn,
    setIsLightsOn,
    wakeUntil,
    setWakeUntil,
    sleepStatus,
    setSleepStatus,
  } = ui;

  const {
    immersiveExperienceRef,
    showSkinPicker,
    isMobileControlsCollapsed,
    showVirtualLandscapePrompt,
    isVirtualLandscapeActive,
    isMobile,
    layoutMode: immersiveLayoutMode,
    skinId: immersiveSkinId,
    skin: immersiveSkin,
    landscapeSidePreference,
    effectiveLandscapeSide,
    virtualLandscapeDirection,
    isLandscapeImmersive,
    shouldShowRotateHint,
    orientationStatusMessage,
    orientationStatusTone,
    virtualLandscapePromptMessage,
    toggleMobileControls,
    confirmVirtualLandscape,
    dismissVirtualLandscape,
    changeLayoutMode: handleLayoutModeChange,
    cycleLandscapeSide: handleCycleLandscapeSide,
    toggleImmersiveChat: handleToggleImmersiveChat,
    closeImmersiveChat: handleCloseImmersiveChat,
    toggleSkinPicker,
    selectSkin: handleSkinSelect,
  } = useImmersiveGameLayout({
    isImmersive,
    immersiveSettings,
    setImmersiveSettings,
    isChatOpen,
    setIsChatOpen,
  });

  const gameHeaderClassName = [
    "game-page-header",
    isImmersive ? "game-page-header--immersive" : "game-page-header--default",
    !isImmersive && isMobile ? "game-page-header--default-mobile" : "",
    isImmersive && isMobile ? "game-page-header--immersive-mobile" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // legacy tired refs는 더 이상 사용하지 않음

  // 상태 상세 모달용 메시지 저장
  const [statusDetailMessages, setStatusDetailMessages] = useState([]);
  // 온라인 조그레스: 현재 슬롯의 jogressStatus (canEvolve 시 진화 버튼 노출)
  const [slotJogressStatus, setSlotJogressStatus] = useState(null);

  // useGameData 훅 호출 (데이터 저장/로딩 로직)
  const {
    saveStats: setDigimonStatsAndSave,
    applyLazyUpdate: applyLazyUpdateBeforeAction,
    saveBackgroundSettings,
    saveImmersiveSettings,
    saveSelectedDigimon,
    persistDeathSnapshot,
    appendLogToSubcollection,
    appendBattleLogToSubcollection,
  } = useGameData({
    slotId,
    currentUser,
    digimonStats,
    setDigimonStats,
    setSelectedDigimon,
    setActivityLogs,
    setSlotName,
    setSlotCreatedAt,
    setSlotDevice,
    setSlotVersion,
    setDigimonNickname,
    setIsLightsOn,
    setWakeUntil,
    setIsLoadingSlot,
    setDeathReason,
    toggleModal,
    digimonDataVer1: digimonDataForSlot,
    adaptedDataMapsByVersion,
    isFirebaseAvailable,
    navigate,
    isLightsOn,
    wakeUntil,
    activityLogs,
    backgroundSettings,
    setBackgroundSettings,
    setImmersiveSettings,
    selectedDigimon,
    digimonNickname,
    slotVersion,
    isLoadingSlot,
    evolutionDataForSlot,
  });

  const setSelectedDigimonAndSave = useCallback(async (name) => {
    setSelectedDigimon(name);
    if (saveSelectedDigimon) {
      await saveSelectedDigimon(name);
    }
  }, [saveSelectedDigimon, setSelectedDigimon]);

  useEffect(() => {
    recordRuntimeMetric("game_page_commits", {
      slotId,
      currentAnimation,
    });
  });

  useGameRuntimeEffects({
    setCustomTime,
    slotId,
    currentUser,
    digimonStats,
    selectedDigimon,
    digimonDataForSlot,
    isLightsOn,
    wakeUntil,
    deathReason,
    hasSeenDeathPopup,
    appendLogToSubcollection,
    persistDeathSnapshot,
    setDigimonStats,
    setDigimonStatsAndSave,
    setActivityLogs,
    setSleepStatus,
    setIsSleeping,
    setDeathReason,
    setHasSeenDeathPopup,
  });

  useGamePagePersistenceEffects({
    slotId,
    isLoadingSlot,
    selectedDigimon,
    digimonStats,
    activityLogs,
    slotVersion,
    masterDataRevision,
    backgroundSettings,
    saveBackgroundSettings,
    immersiveSettings,
    saveImmersiveSettings,
    width,
    height,
    clearedQuestIndex,
    setClearedQuestIndex,
    setDigimonStats,
    setDigimonStatsAndSave,
  });

  // useGameActions 훅 호출
  const {
    handleFeed: handleFeedFromHook,
    handleTrainResult: handleTrainResultFromHook,
    handleBattleComplete: handleBattleCompleteFromHook,
    handleCleanPoop: handleCleanPoopFromHook,
    eatCycle: eatCycleFromHook,
  } = useGameActions({
    digimonStats,
    setDigimonStats,
    setDigimonStatsAndSave,
    applyLazyUpdateBeforeAction,
    setActivityLogs,
    activityLogs,
    appendLogToSubcollection,
    appendBattleLogToSubcollection,
    selectedDigimon,
    wakeUntil,
    setWakeUntil,
    digimonData: digimonDataForSlot,
    setCurrentAnimation,
    setShowFood: (value) => toggleModal('food', value),
    setFeedStep,
    setFeedType,
    setShowPoopCleanAnimation: (value) => toggleModal('poopCleanAnimation', value),
    setCleanStep,
    slotId,
    currentUser,
    slotName,
    isLightsOn,
    battleType,
    setShowBattleScreen: (value) => toggleModal('battleScreen', value),
    setBattleType,
    setSparringEnemySlot,
    arenaChallenger,
    arenaEnemyId,
    myArenaEntryId,
    setArenaChallenger,
    setArenaEnemyId,
    setMyArenaEntryId,
    setShowArenaScreen: (value) => toggleModal('arenaScreen', value),
    currentSeasonId,
    currentQuestArea,
    setCurrentQuestArea,
    setCurrentQuestRound,
    toggleModal, // 과식 확인 모달용
    onSleepDisturbance: () => {
      // 수면 방해 토스트 표시
      toggleModal('sleepDisturbanceToast', true);
      setTimeout(() => toggleModal('sleepDisturbanceToast', false), 3000);
    },
  });
  // useEvolution 훅 호출 (진화 로직)
  const {
    evolve,
    handleEvolutionButton,
    proceedEvolution: handleProceedEvolution,
    proceedJogressLocal,
    createJogressRoom,
    createJogressRoomForSlot,
    cancelJogressRoom,
    proceedJogressOnlineAsGuest,
    applyHostJogressStatusFromRoom,
    proceedJogressOnlineAsHost,
    proceedJogressOnlineAsHostForRoom,
  } = useEvolution({
    digimonStats,
    setDigimonStats,
    setSelectedDigimon,
    setSelectedDigimonAndSave,
    setDigimonStatsAndSave,
    applyLazyUpdateBeforeAction,
    setActivityLogs,
    activityLogs,
    appendLogToSubcollection,
    selectedDigimon,
    developerMode,
    ignoreEvolutionTime,
    slotId,
    currentUser,
    setIsEvolving,
    setEvolutionStage,
    setEvolvedDigimonName,
    setEvolutionCompleteIsJogress,
    setEvolutionCompleteJogressSummary,
    digimonDataVer1: digimonDataForSlot,
    newDigimonDataVer1: evolutionDataForSlot,
    evolutionDataVer1: newDigimonDataVer1, // 조그레스 시 호스트/게스트 Ver.1 맵용 (항상 v1)
    digimonDataVer2,
    adaptedDataMapsByVersion,
    slotName,
    tamerName,
    digimonNickname,
    toggleModal,
    version: slotVersion || "Ver.1", // 슬롯 버전 전달 (도감 관리용)
  });

  useJogressSubscriptions({
    currentUserUid: currentUser?.uid,
    slotId,
    slotJogressStatus,
    myJogressRoomId,
    setSlotJogressStatus,
    setMyJogressRoomId,
    applyHostJogressStatusFromRoom,
  });

  // useDeath 훅 호출 (죽음/환생 로직)
  const {
    confirmDeath: handleDeathConfirm,
  } = useDeath({
    digimonStats,
    setDigimonStatsAndSave,
    setSelectedDigimonAndSave,
    applyLazyUpdateBeforeAction,
    toggleModal,
    setHasSeenDeathPopup,
    digimonDataVer1: digimonDataForSlot,
    perfectStages,
    selectedDigimon,
    slotId,
    currentUser,
    version: slotVersion || "Ver.1",
    appendLogToSubcollection,
  });

  const {
    startHealCycle,
  } = useGameAnimations({
    digimonStats,
    setDigimonStats,
    activityLogs,
    setActivityLogs,
    appendLogToSubcollection,
    modals,
    toggleModal,
    setCurrentAnimation,
    setFeedStep,
    setCleanStep,
    setHealStep,
    applyLazyUpdateBeforeAction,
    setDigimonStatsAndSave,
    slotId,
    currentUser,
    isLightsOn,
    wakeUntil,
    setWakeUntil,
    selectedDigimon,
    newDigimonDataVer1: evolutionDataForSlot,
    setHealTreatmentMessage,
    setHealModalStats,
    onSleepDisturbance: () => {
      // 수면 방해 토스트 표시
      toggleModal('sleepDisturbanceToast', true);
      setTimeout(() => toggleModal('sleepDisturbanceToast', false), 3000);
    },
  });
  
  // useFridge 훅 호출 (냉장고 기능)
  const {
    putInFridge,
    takeOutFromFridge,
  } = useFridge({
    digimonStats,
    setDigimonStatsAndSave,
    applyLazyUpdateBeforeAction,
    setActivityLogs,
    activityLogs,
    appendLogToSubcollection,
  });

  // useArenaLogic 훅 호출 (아레나 로직)
  const {
    handleArenaStart: handleArenaStartFromHook,
    handleArenaBattleStart: handleArenaBattleStartFromHook,
    handleAdminConfigUpdated: handleAdminConfigUpdatedFromHook,
  } = useArenaLogic({
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
  });

  // useGameHandlers 훅 호출 (이벤트 핸들러 및 인증 로직)
  const {
    handleMenuClick: handleMenuClickFromHook,
    handleQuestStart: handleQuestStartFromHook,
    handleSelectArea: handleSelectAreaFromHook,
    handleCommunicationStart: handleCommunicationStartFromHook,
    handleSparringStart: handleSparringStartFromHook,
    handleSparringSlotSelect: handleSparringSlotSelectFromHook,
    handleQuestComplete: handleQuestCompleteFromHook,
    handleToggleLights: handleToggleLightsFromHook,
    handleLogout: handleLogoutFromHook,
  } = useGameHandlers({
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
    onSleepDisturbance: () => {
      // 수면 방해 토스트 표시
      toggleModal('sleepDisturbanceToast', true);
      setTimeout(() => toggleModal('sleepDisturbanceToast', false), 3000);
    },
    handleCleanPoopFromHook,
    startHealCycle,
    setHealModalStats, // HealModal에 전달할 최신 스탯 설정
    quests,
    digimonDataVer1: digimonDataForSlot,
    slotId,
    currentUser,
    logout,
    navigate,
    setIsSleeping,
  });

  const {
    digimonImageBase,
    idleMotionTimeline,
    idleFrames,
    eatFramesArr,
    rejectFramesArr,
    desiredAnimation,
  } = useMemo(
    () =>
      buildGameAnimationViewModel({
        selectedDigimon,
        digimonStats,
        digimonDataForSlot,
        currentAnimation,
        sleepStatus,
        evolutionStage,
      }),
    [
      selectedDigimon,
      digimonStats,
      digimonDataForSlot,
      currentAnimation,
      sleepStatus,
      evolutionStage,
    ]
  );

  useEffect(() => {
    if (desiredAnimation && currentAnimation !== desiredAnimation) {
      setCurrentAnimation(desiredAnimation);
    }
  }, [desiredAnimation, currentAnimation, setCurrentAnimation]);

  const pageViewModel = useMemo(
    () =>
      buildGamePageViewModel({
        selectedDigimon,
        digimonNickname,
        evolutionDataForSlot,
        digimonStats,
        activityLogs,
        digimonDataForSlot,
        customTime,
        slotVersion: normalizedSlotVersion,
        slotJogressStatus,
        currentAnimation,
        feedType,
        isEvoEnabled,
        isEvolving,
        width,
        height,
        backgroundNumber,
        modals,
        feedStep,
        foodSizeScale,
        cleanStep,
        sleepStatus,
        isLightsOn,
        evolutionStage,
        developerMode,
        wakeUntil,
        deathReason,
      }),
    [
      selectedDigimon,
      digimonNickname,
      digimonStats,
      activityLogs,
      evolutionDataForSlot,
      digimonDataForSlot,
      customTime,
      normalizedSlotVersion,
      slotJogressStatus,
      currentAnimation,
      feedType,
      isEvolving,
      isEvoEnabled,
      width,
      height,
      backgroundNumber,
      modals,
      feedStep,
      foodSizeScale,
      cleanStep,
      sleepStatus,
      isLightsOn,
      evolutionStage,
      developerMode,
      wakeUntil,
      deathReason,
    ]
  );
  const {
    headerDigimonLabel,
    currentTimeText,
    statusBadgeProps,
    controlPanelProps,
    gameScreenDisplayProps,
    jogressControls,
  } = pageViewModel;

  const handleResolveCallAction = useCallback(
    (actionKey) => {
      toggleModal("call", false);

      if (actionKey === "open-feed") {
        setActiveMenu("eat");
        toggleModal("feed", true);
        return;
      }

      if (actionKey === "open-lights") {
        setActiveMenu("electric");
        toggleModal("lights", true);
      }
    },
    [setActiveMenu, toggleModal]
  );

  const handleOverfeedConfirm = useCallback(async () => {
    toggleModal('overfeedConfirm', false);
    // "예" 선택: 현재 로직대로 진행 (overfeed +1, 고기 먹기)
    const updatedStats = await applyLazyUpdateBeforeAction();
    if (updatedStats.isDead) return;

    setDigimonStats(updatedStats);
    setFeedType("meat");
    setCurrentAnimation("eat");
    toggleModal('food', true);
    setFeedStep(0);
    requestAnimationFrame(() => {
      eatCycleFromHook(0, "meat", false);
    });
  }, [
    applyLazyUpdateBeforeAction,
    eatCycleFromHook,
    setCurrentAnimation,
    setDigimonStats,
    setFeedStep,
    setFeedType,
    toggleModal,
  ]);

  const handleOverfeedCancel = useCallback(async () => {
    toggleModal('overfeedConfirm', false);
    // "아니오" 선택: overfeed 증가 없이 거절 애니메이션만
    const updatedStats = await applyLazyUpdateBeforeAction();
    if (updatedStats.isDead) return;

    setDigimonStats(updatedStats);
    setFeedType("meat");
    setCurrentAnimation("foodRejectRefuse");
    toggleModal('food', false);
    setFeedStep(0);
    requestAnimationFrame(() => {
      eatCycleFromHook(0, "meat", true);
    });
  }, [
    applyLazyUpdateBeforeAction,
    eatCycleFromHook,
    setCurrentAnimation,
    setDigimonStats,
    setFeedStep,
    setFeedType,
    toggleModal,
  ]);

  // 먹이 - Lazy Update 적용 후 Firestore에 저장

  // 똥 청소

  // ★ (C) 훈련

  // 리셋 (디지타마로 초기화) - 새로운 시작
  const resetDigimon = useCallback(async () => {
    try {
      console.log("[resetDigimon] 새로운 시작 시작");
      
      // 사망 폼(오하카다몬)일 때는 확인 없이 바로 초기화
      const isOhakadamon = DEATH_FORM_IDS.includes(selectedDigimon);
      if (!isOhakadamon && !window.confirm("정말로 초기화?")) return;
      
      // 최신 스탯 가져오기 (Lazy Update 적용)
      const currentStats = await applyLazyUpdateBeforeAction();
      console.log("[resetDigimon] 현재 스탯:", {
        evolutionStage: currentStats.evolutionStage,
        isDead: currentStats.isDead,
        age: currentStats.age,
      });
      
      // Perfect 이상 단계인지 확인
      const isPerfectStage = perfectStages.includes(currentStats.evolutionStage);
      console.log("[resetDigimon] Perfect 단계 여부:", isPerfectStage);
      
      // 환생 횟수 증가 및 새로운 시작을 위한 필드 초기화
      const updatedStats = {
        ...currentStats,
        // 환생 횟수 증가
        totalReincarnations: (currentStats.totalReincarnations || 0) + 1,
        // 새로운 시작: 사망 상태 해제
        isDead: false,
        // 새로운 시작: 나이 초기화
        age: 0,
        // 새로운 시작: 생년월일 초기화
        birthTime: Date.now(),
        // 사망 관련 필드 초기화
        lastHungerZeroAt: null,
        hungerZeroFrozenDurationMs: 0,
        lastStrengthZeroAt: null,
        strengthZeroFrozenDurationMs: 0,
        injuredAt: null,
        injuryFrozenDurationMs: 0,
        isInjured: false,
        // 새로운 시작: 똥 초기화
        poopCount: 0,
        poopReachedMaxAt: null,
        lastPoopPenaltyAt: null,
        poopPenaltyFrozenDurationMs: 0,
      };
      
      if (isPerfectStage) {
        updatedStats.perfectReincarnations = (currentStats.perfectReincarnations || 0) + 1;
      } else {
        updatedStats.normalReincarnations = (currentStats.normalReincarnations || 0) + 1;
      }
      
      console.log("[resetDigimon] 업데이트된 스탯:", {
        totalReincarnations: updatedStats.totalReincarnations,
        normalReincarnations: updatedStats.normalReincarnations,
        perfectReincarnations: updatedStats.perfectReincarnations,
        isDead: updatedStats.isDead,
        age: updatedStats.age,
      });
      
      // Ver.2는 DigitamaV2, Ver.1은 Digitama로 초기화 (공통 ID 사용 안 함)
      const initialDigimonId = getStarterDigimonId(normalizedSlotVersion);
      const ns = initializeStats(initialDigimonId, updatedStats, digimonDataForSlot);

      // 새로운 시작이므로 isDead와 age를 명시적으로 설정
      ns.isDead = false;
      ns.age = 0;
      ns.birthTime = Date.now();
      ns.lastSavedAt = new Date();
      ns.fullness = 0;
      ns.strength = 0;
      ns.lastHungerZeroAt = null;
      ns.hungerZeroFrozenDurationMs = 0;
      ns.lastStrengthZeroAt = null;
      ns.strengthZeroFrozenDurationMs = 0;
      ns.injuredAt = null;
      ns.injuryFrozenDurationMs = 0;
      ns.isInjured = false;
      ns.injuries = 0;
      ns.poopCount = 0;
      ns.poopReachedMaxAt = null;
      ns.lastPoopPenaltyAt = null;
      ns.poopPenaltyFrozenDurationMs = 0;

      console.log("[resetDigimon] 최종 초기화된 스탯:", {
        evolutionStage: ns.evolutionStage,
        isDead: ns.isDead,
        age: ns.age,
        totalReincarnations: ns.totalReincarnations,
        fullness: ns.fullness,
        strength: ns.strength,
        lastSavedAt: ns.lastSavedAt,
        lastHungerZeroAt: ns.lastHungerZeroAt,
        lastStrengthZeroAt: ns.lastStrengthZeroAt,
        injuredAt: ns.injuredAt,
        isInjured: ns.isInjured,
      });

      const currentLogs = ns.activityLogs || updatedStats.activityLogs || [];
      const newStartLogs = addActivityLog(
        currentLogs,
        "NEW_START",
        `New start: Reborn as ${initialDigimonId}`,
        buildDigimonLogSnapshot(initialDigimonId, digimonDataForSlot, evolutionDataForSlot)
      );
      if (appendLogToSubcollection) appendLogToSubcollection(newStartLogs[newStartLogs.length - 1]).catch(() => {});
      const nsWithLogs = { ...ns, activityLogs: newStartLogs, selectedDigimon: initialDigimonId };
      setSelectedDigimon(initialDigimonId);
      setDigimonStats(nsWithLogs);
      await setDigimonStatsAndSave(nsWithLogs, newStartLogs);
      await setSelectedDigimonAndSave(initialDigimonId);
      toggleModal('deathModal', false);
      setHasSeenDeathPopup(false); // 사망 팝업 플래그 초기화
      
      console.log("[resetDigimon] 새로운 시작 완료 - 로컬 상태 및 Firestore 저장 완료");
    } catch (error) {
      console.error("[resetDigimon] 오류 발생:", error);
    }
  }, [
    appendLogToSubcollection,
    applyLazyUpdateBeforeAction,
    digimonDataForSlot,
    evolutionDataForSlot,
    normalizedSlotVersion,
    selectedDigimon,
    setDigimonStats,
    setDigimonStatsAndSave,
    setHasSeenDeathPopup,
    setSelectedDigimon,
    setSelectedDigimonAndSave,
    toggleModal,
  ]);

  const modalBindings = useMemo(
    () =>
      buildGameModalBindings({
        handlersInput: {
          handleFeed: handleFeedFromHook,
          handleTrainResult: handleTrainResultFromHook,
          handleBattleComplete: handleBattleCompleteFromHook,
          handleQuestStart: handleQuestStartFromHook,
          handleCommunicationStart: handleCommunicationStartFromHook,
          handleSparringStart: handleSparringStartFromHook,
          handleArenaStart: handleArenaStartFromHook,
          handleArenaBattleStart: handleArenaBattleStartFromHook,
          handleSparringSlotSelect: handleSparringSlotSelectFromHook,
          handleSelectArea: handleSelectAreaFromHook,
          handleQuestComplete: handleQuestCompleteFromHook,
          handleAdminConfigUpdated: handleAdminConfigUpdatedFromHook,
          startHealCycle,
          handleDeathConfirm,
          resetDigimon,
          setDigimonStats,
          setDigimonStatsAndSave,
          setSelectedDigimonAndSave,
          setCurrentQuestArea,
          setCurrentQuestRound,
          setBattleType,
          setSparringEnemySlot,
          setArenaChallenger,
          setArenaEnemyId,
          setMyArenaEntryId,
          evolve,
          onOverfeedConfirm: handleOverfeedConfirm,
          onOverfeedCancel: handleOverfeedCancel,
          handleToggleLights: handleToggleLightsFromHook,
          putInFridge,
          takeOutFromFridge,
          proceedEvolution: handleProceedEvolution,
          appendLogToSubcollection,
          onJogressPartnerSelected: (slot) => {
            if (slot?.id != null && proceedJogressLocal) {
              proceedJogressLocal(slot);
            }
          },
          createJogressRoom,
          createJogressRoomForSlot,
          cancelJogressRoom,
          proceedJogressOnlineAsGuest,
          applyHostJogressStatusFromRoom,
          proceedJogressOnlineAsHost,
          proceedJogressOnlineAsHostForRoom,
        },
        dataInput: {
          newDigimonDataVer1: evolutionDataForSlot,
          digimonDataVer1: digimonDataForSlot,
          digimonDataVer2,
          quests,
          questsVer2,
          seasonName,
          seasonDuration,
          ver1DigimonList,
          initializeStats,
          currentUser,
          jogressDigimonDataVer1: newDigimonDataVer1,
          jogressDigimonDataVer2: digimonDataVer2,
          supportedDigimonVersions: SUPPORTED_DIGIMON_VERSIONS,
        },
        uiState: ui,
        statusDetailMessages,
        selectedDigimon,
        digimonDataForSlot,
        digimonStats,
        wakeUntil,
        sleepStatus,
      }),
    [
      handleFeedFromHook,
      handleTrainResultFromHook,
      handleBattleCompleteFromHook,
      handleQuestStartFromHook,
      handleCommunicationStartFromHook,
      handleSparringStartFromHook,
      handleArenaStartFromHook,
      handleArenaBattleStartFromHook,
      handleSparringSlotSelectFromHook,
      handleSelectAreaFromHook,
      handleQuestCompleteFromHook,
      handleAdminConfigUpdatedFromHook,
      startHealCycle,
      handleDeathConfirm,
      resetDigimon,
      setDigimonStats,
      setDigimonStatsAndSave,
      setSelectedDigimonAndSave,
      setCurrentQuestArea,
      setCurrentQuestRound,
      setBattleType,
      setSparringEnemySlot,
      setArenaChallenger,
      setArenaEnemyId,
      setMyArenaEntryId,
      evolve,
      handleOverfeedConfirm,
      handleOverfeedCancel,
      handleToggleLightsFromHook,
      putInFridge,
      takeOutFromFridge,
      handleProceedEvolution,
      appendLogToSubcollection,
      proceedJogressLocal,
      createJogressRoom,
      createJogressRoomForSlot,
      cancelJogressRoom,
      proceedJogressOnlineAsGuest,
      applyHostJogressStatusFromRoom,
      proceedJogressOnlineAsHost,
      proceedJogressOnlineAsHostForRoom,
      evolutionDataForSlot,
      digimonDataForSlot,
      seasonName,
      seasonDuration,
      currentUser,
      ui,
      statusDetailMessages,
      selectedDigimon,
      digimonStats,
      wakeUntil,
      sleepStatus,
    ]
  );
  const { handlers, data, ui: modalUi } = modalBindings;

  // evo 버튼 상태: 진화 시간·조건 반영 (1초마다 customTime으로 재계산해 진화 시간 미충족 시 ❌ 표시)
  useEffect(() => {
    if (isLoadingSlot) {
      setIsEvoEnabled(false);
      return;
    }
    if(digimonStats.isDead && !developerMode) {
      setIsEvoEnabled(false);
      return;
    }
    // 개발자 모드 + '진화조건 무시' 둘 다 켜져 있을 때만 무조건 ⭕. 그 외에는 실제 조건 검사
    if(developerMode && ignoreEvolutionTime) {
      setIsEvoEnabled(true);
      return;
    }
    // '모든 진화 조건 무시' 옵션 시 진화 후보가 있으면 버튼 활성화 (dev mode 없이)
    const currentDigimonData = evolutionDataForSlot[selectedDigimon];
    if (ignoreEvolutionTime && currentDigimonData?.evolutions?.length > 0) {
      const hasNonJogress = currentDigimonData.evolutions.some((e) => !e.jogress);
      if (hasNonJogress) {
        setIsEvoEnabled(true);
        return;
      }
    }
    const statsForEvoCheck = digimonStats;
    if (currentDigimonData && currentDigimonData.evolutions) {
      const evolutionResult = checkEvolution(statsForEvoCheck, currentDigimonData, selectedDigimon, evolutionDataForSlot);
      if(evolutionResult.success){
        setIsEvoEnabled(true);
        return;
      }
    }
    setIsEvoEnabled(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digimonStats, selectedDigimon, developerMode, ignoreEvolutionTime, customTime, isLoadingSlot]);

  // 퀘스트 시작 핸들러

  // Communication 시작 핸들러

  // Sparring 시작 핸들러

  // Arena 시작 핸들러

  // Arena 배틀 시작 핸들러

  // Sparring 슬롯 선택 핸들러

  // 조명 토글: 상태 및 Firestore 동기화

  // Admin 설정 반영 콜백

  // 배틀 완료 핸들러

  const handleOpenStatusDetail = useCallback(
    (messages) => {
      setStatusDetailMessages(messages);
      toggleModal("statusDetail", true);
    },
    [toggleModal]
  );

  const renderSupportActionButtons = (containerClassName = "") => (
    <div
      className={`flex items-center justify-center space-x-2 mt-1 pb-20 flex-wrap gap-2 ${containerClassName}`.trim()}
    >
      {(() => {
        const openJogressFlow = () => toggleModal("jogressModeSelect", true);
        return (
          <>
            {jogressControls.showEvolutionButton && (
              <button
                onClick={handleEvolutionButton}
                disabled={jogressControls.isEvolving}
                className={`px-4 py-2 text-white rounded pixel-art-button flex items-center justify-center ${
                  jogressControls.isEvolving
                    ? "bg-gray-500 cursor-not-allowed"
                    : jogressControls.hasNormalEvolution && isEvoEnabled
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-gray-600 hover:bg-gray-500"
                } ${isMobile ? "evolution-button-mobile" : ""}`}
                style={{ writingMode: "horizontal-tb", textOrientation: "mixed" }}
                title={
                  !jogressControls.hasNormalEvolution
                    ? "이 디지몬은 조그레스로만 진화합니다. 클릭 시 진화 가이드 확인 가능"
                    : undefined
                }
              >
                <span className="whitespace-nowrap">진화!</span>
              </button>
            )}
            {jogressControls.canJogressEvolve && (
              <button
                onClick={openJogressFlow}
                disabled={jogressControls.isEvolving}
                className={`px-4 py-2 text-white rounded pixel-art-button flex items-center justify-center gap-1.5 ${
                  !jogressControls.isEvolving
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-gray-500 cursor-not-allowed"
                } ${isMobile ? "evolution-button-mobile" : ""}`}
                style={{ writingMode: "horizontal-tb", textOrientation: "mixed" }}
              >
                <span className="whitespace-nowrap">조그레스 진화</span>
                <span
                  className={`text-xs font-bold ${
                    jogressControls.jogressLabel === "(조그레스 진화 가능)"
                      ? "text-green-400"
                      : "text-amber-200"
                  }`}
                >
                  {jogressControls.jogressLabel}
                </span>
              </button>
            )}
          </>
        );
      })()}
      <button
        onClick={() => toggleModal("digimonInfo", true)}
        className={`px-3 py-2 text-white bg-blue-500 rounded pixel-art-button hover:bg-blue-600 flex items-center justify-center gap-1 ${
          isMobile ? "guide-button-mobile" : ""
        }`}
        title="디지몬 가이드"
        style={{ writingMode: "horizontal-tb", textOrientation: "mixed" }}
      >
        <span>📖</span>
        <span className="whitespace-nowrap">가이드</span>
      </button>
      {(digimonStats.isDead || DEATH_FORM_IDS.includes(selectedDigimon)) && (
        <button
          onClick={() => toggleModal("deathModal", true)}
          className="px-4 py-2 text-white bg-red-800 rounded pixel-art-button hover:bg-red-900 flex items-center justify-center"
          title={DEATH_FORM_IDS.includes(selectedDigimon) ? "새로운 시작" : "사망 정보"}
          style={{ writingMode: "horizontal-tb", textOrientation: "mixed" }}
        >
          <span className="whitespace-nowrap">
            {DEATH_FORM_IDS.includes(selectedDigimon)
              ? "🥚 새로운 시작"
              : "💀 사망 확인"}
          </span>
        </button>
      )}
    </div>
  );

  const headerStatusSection = (
    <div className="mt-2 flex flex-col items-center gap-2">
      <StatusHearts
        fullness={digimonStats.fullness || 0}
        strength={digimonStats.strength || 0}
        maxOverfeed={digimonStats.maxOverfeed || 0}
        proteinOverdose={digimonStats.proteinOverdose || 0}
        showLabels
        size="sm"
        position="inline"
        isFrozen={digimonStats.isFrozen || false}
      />
      <DigimonStatusBadges
        {...statusBadgeProps}
        onOpenStatusDetail={handleOpenStatusDetail}
      />
    </div>
  );

  const defaultHeaderSection = (
    <div className={gameHeaderClassName}>
      <h2 className="text-base font-bold">
        슬롯 {slotId} - {headerDigimonLabel}
        {digimonStats.isFrozen && (
          <span className="ml-2 text-blue-600">🧊 냉장고</span>
        )}
      </h2>
      <GameHeaderMeta
        slotName={slotName}
        slotCreatedAtText={formatSlotCreatedAt(slotCreatedAt)}
        slotDevice={slotDevice}
        slotVersion={slotVersion}
        currentTimeText={currentTimeText}
      />
      {headerStatusSection}
    </div>
  );

  const sharedGameScreenProps = {
    ...gameScreenDisplayProps,
    idleFrames,
    idleMotionTimeline,
    eatFrames: eatFramesArr,
    foodRejectFrames: rejectFramesArr,
    digimonImageBase,
    meatSprites: MEAT_SPRITES,
    proteinSprites: PROTEIN_SPRITES,
    onCallIconClick: () => toggleModal("call", true),
    onCallModalClose: () => toggleModal("call", false),
    onResolveCallAction: handleResolveCallAction,
    showSleepDisturbanceToast: modals.sleepDisturbanceToast,
    sleepDisturbanceToastMessage: "수면 방해! 😴 (10분 동안 깨어있음)",
  };

  const defaultGameSection = (
    <GameDefaultSection
      headerNode={defaultHeaderSection}
      gameScreenProps={sharedGameScreenProps}
      controlPanelProps={controlPanelProps}
      activeMenu={activeMenu}
      onMenuClick={handleMenuClickFromHook}
      stats={digimonStats}
      isMobile={isMobile}
      supportActionsNode={renderSupportActionButtons()}
    />
  );

  const landscapeScreenWidth = Math.max(
    gameScreenDisplayProps.width || width || 300,
    isMobile ? 300 : 340
  );
  const landscapeScreenHeight = Math.max(
    gameScreenDisplayProps.height || height || 200,
    isMobile ? 200 : 220
  );
  const hasLandscapeFrameSkin = Boolean(
    immersiveSkin.landscapeFrameSrc && immersiveSkin.landscapeViewport
  );
  const renderLandscapeGameScreen = (screenSize = {}) => (
    <GameScreen
      {...sharedGameScreenProps}
      width={screenSize.width || landscapeScreenWidth}
      height={screenSize.height || landscapeScreenHeight}
    />
  );

  const landscapeStatusNode = (
    <div className="immersive-landscape-status">
      <div className="immersive-landscape-status__topline">
        <span>
          슬롯 {slotId} · {normalizedSlotVersion}
        </span>
        {digimonStats.isFrozen ? <span>🧊 냉장고</span> : null}
      </div>
      <strong className="immersive-landscape-status__title">
        {headerDigimonLabel}
      </strong>
      <span className="immersive-landscape-status__meta">
        {slotName || `슬롯${slotId}`} · {slotDevice || "디지바이스"}
      </span>
      <span className="immersive-landscape-status__time">
        현재 시간 {currentTimeText}
      </span>
      <div className="immersive-landscape-status__hearts">
        <StatusHearts
          fullness={digimonStats.fullness || 0}
          strength={digimonStats.strength || 0}
          maxOverfeed={digimonStats.maxOverfeed || 0}
          proteinOverdose={digimonStats.proteinOverdose || 0}
          showLabels={false}
          size="sm"
          position="inline"
          isFrozen={digimonStats.isFrozen || false}
        />
      </div>
      <DigimonStatusBadges
        {...statusBadgeProps}
        onOpenStatusDetail={handleOpenStatusDetail}
      />
    </div>
  );

  const portraitImmersiveSection = defaultGameSection;

  const landscapeImmersiveSection = (
    <ImmersiveLandscapeSection
      deviceShellProps={{
        layoutMode: immersiveLayoutMode,
        skinId: immersiveSkinId,
        isMobile,
        showRotateHint: shouldShowRotateHint,
        landscapeSide: effectiveLandscapeSide,
        landscapeSideMode: landscapeSidePreference,
      }}
      hasLandscapeFrameSkin={hasLandscapeFrameSkin}
      immersiveSkin={immersiveSkin}
      controlsProps={{
        activeMenu,
        onMenuClick: handleMenuClickFromHook,
        isFrozen: digimonStats.isFrozen || false,
        isLightsOn,
        isMobile,
      }}
      renderLandscapeGameScreen={renderLandscapeGameScreen}
      slotMeta={{
        slotId,
        normalizedSlotVersion,
        slotName,
        slotDevice,
        currentTimeText,
        headerDigimonLabel,
        isFrozen: digimonStats.isFrozen || false,
      }}
      statusNode={landscapeStatusNode}
      supportActionsNode={renderSupportActionButtons("immersive-landscape-support")}
    />
  );

  // 로딩 중일 때 표시
  if (isLoadingSlot) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">슬롯 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  // Firebase 로그인 필수: 조건부 렌더링
  if (!isFirebaseAvailable || !currentUser) {
    return null;
  }

  const handleToggleProfileMenu = () => {
    setShowProfileMenu((previous) => !previous);
  };

  const handleCloseProfileMenu = () => {
    setShowProfileMenu(false);
  };

  const handleOpenAccountSettings = () => {
    setShowProfileMenu(false);
    setShowAccountSettingsModal(true);
  };

  const toolbarProps = {
    currentUser,
    isFirebaseAvailable,
    tamerName,
    hasVer1Master,
    hasVer2Master,
    showProfileMenu,
    onToggleProfileMenu: handleToggleProfileMenu,
    onCloseProfileMenu: handleCloseProfileMenu,
    onOpenAccountSettings: handleOpenAccountSettings,
    onOpenSettings: () => toggleModal("settings", true),
    onOpenPlayHub: () => navigate("/play"),
    onOpenImmersiveView: () => navigate(`/play/${slotId}/full`),
    onlineUsersNode: <OnlineUsersCount />,
  };

  const mobileHeaderNode =
    !isImmersive && isMobile ? (
      <GamePageToolbar {...toolbarProps} isMobile />
    ) : null;

  const desktopToolbarNode =
    !isImmersive && !isMobile ? <GamePageToolbar {...toolbarProps} /> : null;

  const immersiveTopBarProps = {
    isMobile,
    isCollapsed: isMobileControlsCollapsed,
    layoutMode: immersiveLayoutMode,
    isChatOpen,
    unreadCount,
    presenceCount: presenceCount || 0,
    showLandscapeSideToggle: isLandscapeImmersive,
    landscapeSidePreference,
    effectiveLandscapeSide,
    onToggleCollapsed: toggleMobileControls,
    onChangeLayoutMode: handleLayoutModeChange,
    onToggleChat: handleToggleImmersiveChat,
    onCycleLandscapeSide: handleCycleLandscapeSide,
    onToggleSkinPicker: toggleSkinPicker,
    onOpenBaseView: () => navigate(`/play/${slotId}`),
    onOpenPlayHub: () => navigate("/play"),
  };

  const immersiveShellNode = (
    <ImmersiveGameView
      ref={immersiveExperienceRef}
      layoutMode={immersiveLayoutMode}
      topBarProps={immersiveTopBarProps}
      orientationStatusMessage={orientationStatusMessage}
      orientationStatusTone={orientationStatusTone}
      isMobile={isMobile}
      isVirtualLandscapeActive={isVirtualLandscapeActive}
      virtualLandscapeDirection={virtualLandscapeDirection}
      virtualLandscapePromptMessage={virtualLandscapePromptMessage}
      showVirtualLandscapePrompt={showVirtualLandscapePrompt}
      onConfirmVirtualLandscape={confirmVirtualLandscape}
      onDismissVirtualLandscape={dismissVirtualLandscape}
      chatOverlayProps={{
        isOpen: isChatOpen,
        isMobile,
        landscapeSide: effectiveLandscapeSide,
        onClose: handleCloseImmersiveChat,
      }}
      skinPickerProps={{
        isOpen: showSkinPicker,
        activeSkinId: immersiveSkinId,
        onSelectSkin: handleSkinSelect,
      }}
      portraitContentNode={portraitImmersiveSection}
      landscapeContentNode={landscapeImmersiveSection}
    />
  );

  const defaultShellNode = (
    <div className={!isImmersive && !isMobile ? "game-page-shell" : ""}>
      {defaultGameSection}
    </div>
  );

  const modalsNode =
    modals && toggleModal && gameState && handlers && data && ui ? (
      <GameModals
        modals={modals}
        toggleModal={toggleModal}
        gameState={{
          ...gameState,
          isLightsOn,
        }}
        handlers={handlers}
        data={data}
        ui={modalUi}
        flags={{
          developerMode,
          setDeveloperMode,
          encyclopediaShowQuestionMark,
          setEncyclopediaShowQuestionMark,
          ignoreEvolutionTime,
          setIgnoreEvolutionTime,
          isEvolving,
          setIsEvolving,
        }}
      />
    ) : null;

  return (
    <>
      <GamePageView
        isMobile={isMobile}
        isImmersive={isImmersive}
        mobileHeaderNode={mobileHeaderNode}
        desktopToolbarNode={desktopToolbarNode}
        defaultShellNode={defaultShellNode}
        immersiveShellNode={immersiveShellNode}
      />

      {modalsNode}
      
      {!isImmersive ? (
        <>
          {/* Google AdSense 광고 */}
          <AdBanner />
          
          {/* 카카오 애드핏 광고 */}
          <KakaoAd />
        </>
      ) : null}
      
      {/* 실시간 채팅 및 접속자 목록 */}
      {/* ChatRoom은 App.jsx에서 전역으로 렌더링됨 */}
      
      {/* 계정 설정 모달 */}
      {showAccountSettingsModal && (
        <AccountSettingsModal
          onClose={() => setShowAccountSettingsModal(false)}
          onLogout={handleLogoutFromHook}
          tamerName={tamerName}
          setTamerName={setTamerName}
          refreshProfile={refreshProfile}
        />
      )}
    </>
  );
}

export default Game;
