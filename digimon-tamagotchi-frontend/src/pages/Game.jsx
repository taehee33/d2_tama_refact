import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePresenceContext } from "../contexts/AblyContext";
import { useMasterData } from "../contexts/MasterDataContext";

import ControlPanel from "../components/ControlPanel";
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
import ImmersiveChatOverlay from "../components/chat/ImmersiveChatOverlay";
import ImmersiveDeviceShell from "../components/layout/ImmersiveDeviceShell";
import ImmersiveGameTopBar from "../components/layout/ImmersiveGameTopBar";
import ImmersiveLandscapeFrameStage from "../components/layout/ImmersiveLandscapeFrameStage";
import ImmersiveLandscapeControls from "../components/layout/ImmersiveLandscapeControls";
import ImmersiveSkinPicker from "../components/layout/ImmersiveSkinPicker";
import { useTamerProfile } from "../hooks/useTamerProfile";

import {
  DEFAULT_IMMERSIVE_SETTINGS,
  IMMERSIVE_LANDSCAPE_SIDES,
  IMMERSIVE_LAYOUT_MODES,
} from "../data/immersiveSettings";
import { adaptDataMapToOldFormat } from "../data/v1/adapter";
import { digimonDataVer1 as newDigimonDataVer1 } from "../data/v1/digimons";
import { digimonDataVer2 } from "../data/v2modkor";
import { digimonDataVer3 } from "../data/v3";
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
} from "../utils/digimonVersionUtils";
import {
  getImmersiveSkinById,
  getNextImmersiveLandscapeSide,
  normalizeImmersiveSettings,
} from "../utils/immersiveSettings";
import {
  enterImmersiveLandscapeMode,
  exitImmersiveLandscapeMode,
  getImmersiveOrientationSupportState,
  isImmersiveFullscreenActive,
} from "../utils/immersiveOrientation";
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

function getDetectedLandscapeSide() {
  if (typeof window === "undefined") {
    return IMMERSIVE_LANDSCAPE_SIDES.RIGHT;
  }

  const screenOrientation = window.screen?.orientation;
  const orientationType = screenOrientation?.type;

  if (orientationType === "landscape-primary") {
    return IMMERSIVE_LANDSCAPE_SIDES.RIGHT;
  }

  if (orientationType === "landscape-secondary") {
    return IMMERSIVE_LANDSCAPE_SIDES.LEFT;
  }

  const rawAngle =
    typeof screenOrientation?.angle === "number"
      ? screenOrientation.angle
      : typeof window.orientation === "number"
        ? window.orientation
        : null;

  if (rawAngle === 90) {
    return IMMERSIVE_LANDSCAPE_SIDES.RIGHT;
  }

  if (rawAngle === -90 || rawAngle === 270) {
    return IMMERSIVE_LANDSCAPE_SIDES.LEFT;
  }

  return IMMERSIVE_LANDSCAPE_SIDES.RIGHT;
}

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
  const adaptedV2 = useMemo(() => {
    const revisionKey = masterDataRevision;
    void revisionKey;
    return adaptDataMapToOldFormat(digimonDataVer2);
  }, [masterDataRevision]);
  const adaptedV3 = useMemo(() => {
    const revisionKey = masterDataRevision;
    void revisionKey;
    return adaptDataMapToOldFormat(digimonDataVer3);
  }, [masterDataRevision]);
  
  // 모바일 감지
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isViewportPortrait, setIsViewportPortrait] = useState(
    window.innerHeight >= window.innerWidth
  );
  const [detectedLandscapeSide, setDetectedLandscapeSide] = useState(
    getDetectedLandscapeSide
  );
  const [showSkinPicker, setShowSkinPicker] = useState(false);
  const immersiveExperienceRef = useRef(null);
  const [isImmersiveFullscreen, setIsImmersiveFullscreen] = useState(() =>
    isImmersiveFullscreenActive(document)
  );
  const [orientationLockSupported, setOrientationLockSupported] = useState(false);
  const [orientationLockError, setOrientationLockError] = useState(null);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsViewportPortrait(window.innerHeight >= window.innerWidth);
      setDetectedLandscapeSide(getDetectedLandscapeSide());
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    window.addEventListener("orientationchange", handleResize);
    window.screen?.orientation?.addEventListener?.("change", handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener("orientationchange", handleResize);
      window.screen?.orientation?.removeEventListener?.("change", handleResize);
    };
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsImmersiveFullscreen(isImmersiveFullscreenActive(document));
    };

    syncFullscreenState();

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, []);

  const navigate= useNavigate();
  const location = useLocation();
  const isImmersive = immersive || location.pathname.endsWith("/full");
  const gameHeaderClassName = [
    "game-page-header",
    isImmersive ? "game-page-header--immersive" : "game-page-header--default",
    !isImmersive && isMobile ? "game-page-header--default-mobile" : "",
    isImmersive && isMobile ? "game-page-header--immersive-mobile" : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    if (!isImmersive) {
      setOrientationLockError(null);
      return undefined;
    }

    return () => {
      setIsChatOpen(false);
      void exitImmersiveLandscapeMode({
        documentRef: document,
        screenRef: window.screen,
        userAgent: window.navigator?.userAgent || "",
        vendor: window.navigator?.vendor || "",
      });
    };
  }, [isImmersive, setIsChatOpen]);
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
    normalizedSlotVersion === "Ver.3"
      ? adaptedV3
      : normalizedSlotVersion === "Ver.2"
        ? adaptedV2
        : adaptedV1;
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
    adaptedV1,
    adaptedV2,
    adaptedV3,
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

  const normalizedImmersiveSettings = useMemo(
    () => normalizeImmersiveSettings(immersiveSettings),
    [immersiveSettings]
  );
  const immersiveLayoutMode =
    normalizedImmersiveSettings.layoutMode ||
    DEFAULT_IMMERSIVE_SETTINGS.layoutMode;
  const immersiveSkinId =
    normalizedImmersiveSettings.skinId || DEFAULT_IMMERSIVE_SETTINGS.skinId;
  const landscapeSidePreference =
    normalizedImmersiveSettings.landscapeSide ||
    DEFAULT_IMMERSIVE_SETTINGS.landscapeSide;
  const immersiveSkin = useMemo(
    () => getImmersiveSkinById(immersiveSkinId),
    [immersiveSkinId]
  );
  const isLandscapeImmersive =
    isImmersive && immersiveLayoutMode === IMMERSIVE_LAYOUT_MODES.LANDSCAPE;
  const effectiveLandscapeSide =
    landscapeSidePreference === IMMERSIVE_LANDSCAPE_SIDES.AUTO
      ? detectedLandscapeSide
      : landscapeSidePreference;
  const shouldShowRotateHint =
    isLandscapeImmersive && isMobile && isViewportPortrait;
  const orientationStatusMessage =
    isLandscapeImmersive && isMobile
      ? orientationLockError ||
        (isImmersiveFullscreen && orientationLockSupported
          ? "가로 전체화면으로 보는 중"
          : null)
      : null;
  const orientationStatusTone =
    orientationLockError && isLandscapeImmersive && isMobile ? "warning" : "success";

  useEffect(() => {
    if (!isImmersive) {
      setShowSkinPicker(false);
    }
  }, [isImmersive]);

  useEffect(() => {
    if (!isMobile) {
      setOrientationLockSupported(false);
      return;
    }

    const supportState = getImmersiveOrientationSupportState({
      element: immersiveExperienceRef.current,
      documentRef: document,
      screenRef: window.screen,
      userAgent: window.navigator?.userAgent || "",
      vendor: window.navigator?.vendor || "",
    });

    setOrientationLockSupported(supportState.orientationLockSupported);
  }, [isMobile, isImmersive]);

  const updateImmersiveSettings = useCallback(
    (partialSettings) => {
      setImmersiveSettings((previousSettings) =>
        normalizeImmersiveSettings({
          ...normalizeImmersiveSettings(previousSettings),
          ...partialSettings,
        })
      );
    },
    [setImmersiveSettings]
  );

  const handleLayoutModeChange = useCallback(
    async (nextLayoutMode) => {
      const isSwitchingToLandscape =
        nextLayoutMode === IMMERSIVE_LAYOUT_MODES.LANDSCAPE;
      const isSwitchingToPortrait =
        nextLayoutMode === IMMERSIVE_LAYOUT_MODES.PORTRAIT;
      const isSameLayoutMode = immersiveLayoutMode === nextLayoutMode;

      if (!isSameLayoutMode) {
        updateImmersiveSettings({ layoutMode: nextLayoutMode });
      }

      if (!isImmersive || !isMobile) {
        if (isSwitchingToPortrait) {
          setOrientationLockError(null);
        }
        return;
      }

      if (isSwitchingToPortrait) {
        setOrientationLockError(null);

        const result = await exitImmersiveLandscapeMode({
          documentRef: document,
          screenRef: window.screen,
          userAgent: window.navigator?.userAgent || "",
          vendor: window.navigator?.vendor || "",
        });

        setIsImmersiveFullscreen(result.isFullscreen);
        setOrientationLockSupported(result.orientationLockSupported);
        return;
      }

      if (!isSwitchingToLandscape) {
        return;
      }

      const shouldSkipRetry =
        isSameLayoutMode &&
        isImmersiveFullscreen &&
        orientationLockSupported &&
        !orientationLockError;

      if (shouldSkipRetry) {
        return;
      }

      setOrientationLockError(null);

      const result = await enterImmersiveLandscapeMode({
        element: immersiveExperienceRef.current,
        documentRef: document,
        screenRef: window.screen,
        userAgent: window.navigator?.userAgent || "",
        vendor: window.navigator?.vendor || "",
      });

      setIsImmersiveFullscreen(result.isFullscreen);
      setOrientationLockSupported(result.orientationLockSupported);
      setOrientationLockError(result.errorMessage);
    },
    [
      immersiveLayoutMode,
      isImmersive,
      isImmersiveFullscreen,
      isMobile,
      orientationLockError,
      orientationLockSupported,
      updateImmersiveSettings,
    ]
  );

  const handleCycleLandscapeSide = useCallback(() => {
    updateImmersiveSettings({
      landscapeSide: getNextImmersiveLandscapeSide(landscapeSidePreference),
    });
  }, [landscapeSidePreference, updateImmersiveSettings]);

  const handleToggleImmersiveChat = useCallback(() => {
    setIsChatOpen((previous) => !previous);
  }, [setIsChatOpen]);

  const handleCloseImmersiveChat = useCallback(() => {
    setIsChatOpen(false);
  }, [setIsChatOpen]);

  const handleSkinSelect = useCallback(
    (nextSkinId) => {
      updateImmersiveSettings({ skinId: nextSkinId });
      setShowSkinPicker(false);
    },
    [updateImmersiveSettings]
  );

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
    <>
      {defaultHeaderSection}
      <div className={`flex flex-col items-center w-full ${isMobile ? "game-screen-mobile" : ""}`}>
        <GameScreen {...sharedGameScreenProps} />
        <div className={`flex justify-center w-full ${isMobile ? "control-panel-mobile" : ""}`}>
          <ControlPanel
            {...controlPanelProps}
            activeMenu={activeMenu}
            onMenuClick={handleMenuClickFromHook}
            stats={digimonStats}
            isMobile={isMobile}
          />
        </div>
        {renderSupportActionButtons()}
      </div>
    </>
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

  const portraitImmersiveSection = defaultGameSection;

  const landscapeImmersiveSection = (
    <ImmersiveDeviceShell
      layoutMode={immersiveLayoutMode}
      skinId={immersiveSkinId}
      isMobile={isMobile}
      showRotateHint={shouldShowRotateHint}
      landscapeSide={effectiveLandscapeSide}
      landscapeSideMode={landscapeSidePreference}
    >
      <div
        className={`immersive-landscape-layout ${
          hasLandscapeFrameSkin ? "immersive-landscape-layout--frame-skin" : ""
        } immersive-landscape-layout--side-${effectiveLandscapeSide}`.trim()}
      >
        <div
          className={`immersive-landscape-display ${
            hasLandscapeFrameSkin
              ? "immersive-landscape-display--frame-skin"
              : ""
          }`.trim()}
        >
          {hasLandscapeFrameSkin ? (
            <>
              <ImmersiveLandscapeControls
                layout="strip"
                groupId="basic"
                activeMenu={activeMenu}
                onMenuClick={handleMenuClickFromHook}
                isFrozen={digimonStats.isFrozen || false}
                isLightsOn={isLightsOn}
                isMobile={isMobile}
              />
              <ImmersiveLandscapeFrameStage
                skin={immersiveSkin}
                renderScreen={renderLandscapeGameScreen}
              />
              <ImmersiveLandscapeControls
                layout="strip"
                groupId="care"
                activeMenu={activeMenu}
                onMenuClick={handleMenuClickFromHook}
                isFrozen={digimonStats.isFrozen || false}
                isLightsOn={isLightsOn}
                isMobile={isMobile}
              />
            </>
          ) : (
            <div className="immersive-landscape-display__lcd">
              {renderLandscapeGameScreen()}
            </div>
          )}
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
          {renderSupportActionButtons("immersive-landscape-support")}
        </div>
        {!hasLandscapeFrameSkin ? (
          <ImmersiveLandscapeControls
            activeMenu={activeMenu}
            onMenuClick={handleMenuClickFromHook}
            isFrozen={digimonStats.isFrozen || false}
            isLightsOn={isLightsOn}
            isMobile={isMobile}
          />
        ) : null}
      </div>
    </ImmersiveDeviceShell>
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

  return (
    <>
      {isImmersive ? null : isMobile ? (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white bg-opacity-95 border-b border-gray-300 shadow-sm mobile-nav-bar">
          <div className="flex items-center justify-between px-3 py-2">
            {/* 왼쪽: 플레이 허브 버튼 */}
            <button 
              onClick={() => navigate("/play")} 
              className="px-2 py-1.5 bg-gray-400 hover:bg-gray-500 text-white rounded text-sm pixel-art-button flex items-center gap-1"
            >
              <span>← 허브</span>
            </button>

            {/* 오른쪽: 접속자 수 + 전체 화면 + Settings + 프로필 */}
            <div className="flex items-center gap-2">
              {/* 접속 중인 테이머 수 */}
              <OnlineUsersCount />

              <button
                onClick={() => navigate(`/play/${slotId}/full`)}
                className="px-2 py-1.5 bg-slate-900 text-white rounded pixel-art-button"
                title="몰입형 플레이"
              >
                ⛶
              </button>
              
              {/* Settings 버튼 */}
              <button
                onClick={() => toggleModal('settings', true)}
                className="px-2 py-1.5 bg-gray-400 hover:bg-gray-500 text-white rounded pixel-art-button"
                title="설정"
              >
                ⚙️
              </button>
              
              {/* 프로필 UI */}
              {isFirebaseAvailable && currentUser ? (
                <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded pixel-art-button"
                  >
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt="프로필"
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                        {currentUser.displayName?.[0] || currentUser.email?.[0] || 'U'}
                      </span>
                    )}
                    <span className="text-xs text-gray-700 hidden sm:inline max-w-[80px] truncate flex items-center gap-1 flex-wrap">
                      <span className="truncate">{tamerName || currentUser.displayName || currentUser.email?.split('@')[0]}</span>
                      {hasVer1Master && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium shrink-0">👑 Ver.1</span>
                      )}
                      {hasVer2Master && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-indigo-100 text-indigo-800 text-xs font-medium shrink-0">👑 Ver.2</span>
                      )}
                    </span>
                    <span className="text-xs">▼</span>
                  </button>
                  
                  {/* 드롭다운 메뉴 */}
                  {showProfileMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowProfileMenu(false)}
                      />
                      <div className="absolute right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-[150px] w-max max-w-[min(90vw,280px)] profile-dropdown">
                        <div className="px-3 py-2 border-b border-gray-200">
                          <p className="text-xs font-semibold text-gray-700 whitespace-nowrap truncate flex flex-wrap items-center gap-1">
                            <span>테이머: {tamerName || currentUser.displayName || currentUser.email}</span>
                            {hasVer1Master && (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">👑 Ver.1</span>
                            )}
                            {hasVer2Master && (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-indigo-100 text-indigo-800 text-xs font-medium">👑 Ver.2</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {currentUser.email}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            setShowAccountSettingsModal(true);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 pixel-art-button"
                        >
                          계정 설정/로그아웃
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          {/* 모바일: 테이머명 + 칭호 항상 표시 (버튼 클릭 없이) */}
          {isFirebaseAvailable && currentUser && (
            <div className="px-3 py-1.5 border-t border-gray-100 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-600">테이머: {tamerName || currentUser.displayName || currentUser.email?.split('@')[0]}</span>
              {hasVer1Master && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">👑 Ver.1</span>
              )}
              {hasVer2Master && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-medium">👑 Ver.2</span>
              )}
            </div>
          )}
        </div>
      ) : null}

      {isImmersive ? (
        <div className="immersive-mode-root" ref={immersiveExperienceRef}>
          <ImmersiveGameTopBar
            isMobile={isMobile}
            layoutMode={immersiveLayoutMode}
            isChatOpen={isChatOpen}
            unreadCount={unreadCount}
            presenceCount={presenceCount || 0}
            showLandscapeSideToggle={isLandscapeImmersive}
            landscapeSidePreference={landscapeSidePreference}
            effectiveLandscapeSide={effectiveLandscapeSide}
            onChangeLayoutMode={handleLayoutModeChange}
            onToggleChat={handleToggleImmersiveChat}
            onCycleLandscapeSide={handleCycleLandscapeSide}
            onToggleSkinPicker={() => setShowSkinPicker((previous) => !previous)}
            onOpenBaseView={() => navigate(`/play/${slotId}`)}
            onOpenPlayHub={() => navigate("/play")}
          />
          <div className="immersive-game-shell">
            {orientationStatusMessage ? (
              <div
                className={`immersive-orientation-status immersive-orientation-status--${orientationStatusTone}`.trim()}
                role="status"
                aria-live="polite"
              >
                {orientationStatusMessage}
              </div>
            ) : null}
            <ImmersiveChatOverlay
              isOpen={isChatOpen}
              isMobile={isMobile}
              landscapeSide={effectiveLandscapeSide}
              onClose={handleCloseImmersiveChat}
            />
            <ImmersiveSkinPicker
              isOpen={showSkinPicker}
              activeSkinId={immersiveSkinId}
              onSelectSkin={handleSkinSelect}
            />
            {isLandscapeImmersive
              ? landscapeImmersiveSection
              : portraitImmersiveSection}
          </div>
        </div>
      ) : (
        <div className={!isImmersive && !isMobile ? "game-page-shell" : ""}>
          {!isImmersive && !isMobile && (
            <div className="game-page-toolbar">
              <div className="game-page-toolbar__actions">
                <button
                  onClick={() => navigate("/play")}
                  className="px-3 py-1 bg-gray-400 hover:bg-gray-500 text-white rounded pixel-art-button"
                >
                  ← 플레이 허브
                </button>
                <button
                  onClick={() => navigate(`/play/${slotId}/full`)}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-700 text-white rounded pixel-art-button"
                >
                  몰입형 플레이
                </button>
              </div>

              <div className="game-page-toolbar__utilities">
                <OnlineUsersCount />

                <button
                  onClick={() => toggleModal("settings", true)}
                  className="px-3 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded pixel-art-button"
                  title="설정"
                >
                  ⚙️
                </button>

                {isFirebaseAvailable && currentUser ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded pixel-art-button"
                    >
                      {currentUser.photoURL ? (
                        <img
                          src={currentUser.photoURL}
                          alt="프로필"
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-semibold text-gray-700">
                          {currentUser.displayName?.[0] || currentUser.email?.[0] || "U"}
                        </span>
                      )}
                      <span className="text-sm text-gray-700 flex items-center gap-1 flex-wrap">
                        <span>
                          테이머: {tamerName || currentUser.displayName || currentUser.email?.split("@")[0]}
                        </span>
                        {hasVer1Master && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium shrink-0">
                            👑 Ver.1
                          </span>
                        )}
                        {hasVer2Master && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-medium shrink-0">
                            👑 Ver.2
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-gray-500">▼</span>
                    </button>

                    {showProfileMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowProfileMenu(false)}
                        />
                        <div className="absolute right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-[200px] w-max max-w-[min(90vw,280px)]">
                          <div className="px-3 py-2 border-b border-gray-200">
                            <p className="text-sm font-semibold text-gray-700 whitespace-nowrap truncate flex flex-wrap items-center gap-1">
                              <span>테이머: {tamerName || currentUser.displayName || currentUser.email}</span>
                              {hasVer1Master && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">
                                  👑 Ver.1
                                </span>
                              )}
                              {hasVer2Master && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-medium">
                                  👑 Ver.2
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {currentUser.email}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setShowProfileMenu(false);
                              setShowAccountSettingsModal(true);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 pixel-art-button"
                          >
                            계정 설정/로그아웃
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}

                {!isFirebaseAvailable && (
                  <span className="text-sm text-gray-500">Firebase 미설정</span>
                )}
              </div>
            </div>
          )}

          {defaultGameSection}
        </div>
      )}

      {modals && toggleModal && gameState && handlers && data && ui && (
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
          flags={{ developerMode, setDeveloperMode, encyclopediaShowQuestionMark, setEncyclopediaShowQuestionMark, ignoreEvolutionTime, setIgnoreEvolutionTime, isEvolving, setIsEvolving }}
        />
      )}
      
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
