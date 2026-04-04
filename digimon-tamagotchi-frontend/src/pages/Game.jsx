import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { db } from "../firebase";
import { updateDoc, doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { useMasterData } from "../contexts/MasterDataContext";

import ControlPanel from "../components/ControlPanel";
import GameHeaderMeta from "../components/GameHeaderMeta";
import GameModals from "../components/GameModals";
import GameScreen from "../components/GameScreen";
import StatusHearts from "../components/StatusHearts";
import DigimonStatusBadges from "../components/DigimonStatusBadges";

import {
  getSleepStatus,
  checkCalls,
  checkCallTimeouts,
  addActivityLog,
} from "../hooks/useGameLogic";
import {
  initializeCareMistakeLedger,
  repairCareMistakeLedger,
} from "../logic/stats/careMistakeLedger";
import { useDeath } from "../hooks/useDeath";
import { useEvolution } from "../hooks/useEvolution";
import { useGameActions } from "../hooks/useGameActions";
import { useGameAnimations } from "../hooks/useGameAnimations";
import { useArenaLogic } from "../hooks/useArenaLogic";
import { useGameHandlers, getSleepSchedule, isWithinSleepSchedule } from "../hooks/useGameHandlers";
import { useGameData } from "../hooks/useGameData";
import { useGameState } from "../hooks/useGameState";
import { useFridge } from "../hooks/useFridge";
import { formatSlotCreatedAt } from "../utils/dateUtils";
import AdBanner from "../components/AdBanner";
import KakaoAd from "../components/KakaoAd";
import AccountSettingsModal from "../components/AccountSettingsModal";
import OnlineUsersCount from "../components/OnlineUsersCount";
import ImmersiveGameTopBar from "../components/layout/ImmersiveGameTopBar";
import { useTamerProfile } from "../hooks/useTamerProfile";

import digimonAnimations from "../data/digimonAnimations";
import { resolveIdleMotionTimeline } from "../data/idleMotionTimeline";
import { adaptDataMapToOldFormat } from "../data/v1/adapter";
import { digimonDataVer1 as newDigimonDataVer1 } from "../data/v1/digimons";
import { digimonDataVer2 } from "../data/v2modkor";
import { questsVer2 } from "../data/v2modkor/quests";
import { initializeStats, updateLifespan } from "../data/stats";
import { handleEnergyRecovery } from "../logic/stats/stats";
import { quests } from "../data/v1/quests";

import { checkEvolution } from "../logic/evolution/checker";
import { handleHungerTick } from "../logic/stats/hunger";
import { handleStrengthTick } from "../logic/stats/strength";
import { evaluateDeathConditions } from "../logic/stats/death";
import { getMasterDataSnapshotForSync } from "../utils/masterDataUtils";

const DEFAULT_SEASON_ID = 1;

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

/** 사망 폼 ID (Ver.1: Ohakadamon1/2, Ver.2: Ohakadamon1V2/2V2 — 공통 ID 사용 안 함) */
const DEATH_FORM_IDS = ["Ohakadamon1", "Ohakadamon2", "Ohakadamon1V2", "Ohakadamon2V2"];

const perfectStages = ["Perfect","Ultimate","SuperUltimate"];

function syncRemainingByElapsed(previousTotal, nextTotal, currentRemaining) {
  const safeNextTotal = Math.max(0, Number(nextTotal) || 0);

  if (safeNextTotal === 0) {
    return 0;
  }

  const safeCurrentRemaining = Number.isFinite(currentRemaining)
    ? currentRemaining
    : safeNextTotal;
  const safePreviousTotal = Math.max(0, Number(previousTotal) || 0);

  if (safePreviousTotal === 0) {
    return safeNextTotal;
  }

  const elapsed = Math.max(0, safePreviousTotal - safeCurrentRemaining);
  return Math.max(0, Math.min(safeNextTotal, safeNextTotal - elapsed));
}

function Game({ immersive = false }){
  const { slotId } = useParams();
  const { currentUser, logout, isFirebaseAvailable } = useAuth();
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
  
  // 모바일 감지
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
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

  // v1·v2 병합 없이 슬롯 버전에 따라 해당 버전 데이터만 사용
  const digimonDataForSlot = slotVersion === "Ver.2" ? adaptedV2 : adaptedV1;
  const evolutionDataForSlot = slotVersion === "Ver.2" ? digimonDataVer2 : newDigimonDataVer1;

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
    dailySleepMistake,
    setDailySleepMistake,
  } = flags || {};

  const {
    activeMenu,
    setActiveMenu,
    currentAnimation,
    setCurrentAnimation,
    backgroundNumber,
    backgroundSettings,
    setBackgroundSettings,
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
    callToastMessage,
    setCallToastMessage,
  } = ui;

  // tiredStartRef, tiredCountedRef는 더 이상 사용하지 않음 (digimonStats.tiredStartAt으로 대체)

  // 상태 상세 모달용 메시지 저장
  const [statusDetailMessages, setStatusDetailMessages] = useState([]);
  // 온라인 조그레스: 현재 슬롯의 jogressStatus (canEvolve 시 진화 버튼 노출)
  const [slotJogressStatus, setSlotJogressStatus] = useState(null);
  const masterDataSyncSnapshotRef = useRef(null);

  // useGameData 훅 호출 (데이터 저장/로딩 로직)
  const {
    saveStats: setDigimonStatsAndSave,
    applyLazyUpdate: applyLazyUpdateBeforeAction,
    saveBackgroundSettings,
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
    setDailySleepMistake,
    setIsLoadingSlot,
    setDeathReason,
    toggleModal,
    digimonDataVer1: digimonDataForSlot,
    adaptedV1,
    adaptedV2,
    isFirebaseAvailable,
    navigate,
    isLightsOn,
    wakeUntil,
    dailySleepMistake,
    activityLogs,
    backgroundSettings,
    setBackgroundSettings,
    selectedDigimon,
    digimonNickname,
    slotVersion,
    isLoadingSlot,
    evolutionDataForSlot,
  });

  useEffect(() => {
    if (!selectedDigimon || !digimonStats || isLoadingSlot) {
      return;
    }

    const versionLabel = slotVersion === "Ver.2" ? "Ver.2" : "Ver.1";
    const currentSnapshot = getMasterDataSnapshotForSync(versionLabel, selectedDigimon);

    if (!currentSnapshot) {
      return;
    }

    const previousSnapshot = masterDataSyncSnapshotRef.current;

    if (
      !previousSnapshot ||
      previousSnapshot.digimonId !== currentSnapshot.digimonId ||
      previousSnapshot.versionLabel !== currentSnapshot.versionLabel
    ) {
      masterDataSyncSnapshotRef.current = currentSnapshot;
      return;
    }

    const speciesChanged = [
      "sprite",
      "hungerTimer",
      "strengthTimer",
      "poopTimer",
      "maxOverfeed",
      "minWeight",
      "maxEnergy",
      "basePower",
      "attackSprite",
      "altAttackSprite",
      "type",
      "timeToEvolveSeconds",
    ].some((key) => previousSnapshot[key] !== currentSnapshot[key]);

    if (!speciesChanged) {
      masterDataSyncSnapshotRef.current = currentSnapshot;
      return;
    }

    const syncedStats = {
      ...digimonStats,
      sprite: currentSnapshot.sprite,
      hungerTimer: currentSnapshot.hungerTimer,
      strengthTimer: currentSnapshot.strengthTimer,
      poopTimer: currentSnapshot.poopTimer,
      maxOverfeed: currentSnapshot.maxOverfeed,
      minWeight: currentSnapshot.minWeight,
      maxStamina: currentSnapshot.maxEnergy,
      maxEnergy: currentSnapshot.maxEnergy,
      power: currentSnapshot.basePower,
      attackSprite: currentSnapshot.attackSprite,
      altAttackSprite: currentSnapshot.altAttackSprite,
      type: currentSnapshot.type,
      hungerCountdown: syncRemainingByElapsed(
        previousSnapshot.hungerTimer * 60,
        currentSnapshot.hungerTimer * 60,
        digimonStats.hungerCountdown
      ),
      strengthCountdown: syncRemainingByElapsed(
        previousSnapshot.strengthTimer * 60,
        currentSnapshot.strengthTimer * 60,
        digimonStats.strengthCountdown
      ),
      poopCountdown: syncRemainingByElapsed(
        previousSnapshot.poopTimer * 60,
        currentSnapshot.poopTimer * 60,
        digimonStats.poopCountdown
      ),
      timeToEvolveSeconds: syncRemainingByElapsed(
        previousSnapshot.timeToEvolveSeconds,
        currentSnapshot.timeToEvolveSeconds,
        digimonStats.timeToEvolveSeconds
      ),
    };

    masterDataSyncSnapshotRef.current = currentSnapshot;

    if (setDigimonStatsAndSave) {
      void setDigimonStatsAndSave(syncedStats, activityLogs);
      return;
    }

    setDigimonStats(syncedStats);
  }, [
    activityLogs,
    digimonStats,
    isLoadingSlot,
    selectedDigimon,
    setDigimonStats,
    setDigimonStatsAndSave,
    slotVersion,
    masterDataRevision,
  ]);

  const meatSprites= ["/images/526.png","/images/527.png","/images/528.png","/images/529.png"];
  const proteinSprites= ["/images/530.png","/images/531.png","/images/532.png"];

  // 배경화면 설정이 로드되었는지 추적하는 ref
  // useGameData에서 로드 완료 후 true로 설정됨
  const backgroundSettingsLoadedRef = useRef(false);
  
  // useGameData에서 로드 완료 후 플래그 설정
  // isLoadingSlot이 false가 되면 로드 완료로 간주
  useEffect(() => {
    if (!isLoadingSlot && slotId) {
      // 로드 완료 후 약간의 지연을 두고 플래그 설정 (useGameData의 setBackgroundSettings 호출 후)
      const timer = setTimeout(() => {
        backgroundSettingsLoadedRef.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoadingSlot, slotId]);
  
  // backgroundSettings 변경 시에만 Firebase/localStorage에 저장 (사용자가 배경을 바꿀 때만)
  // ⚠️ saveBackgroundSettings는 useGameData에서 useCallback으로 고정되어 있어, 1초 리렌더 시 참조가 바뀌지 않음.
  //    (이전에는 매 렌더마다 새 함수라 이 effect가 1초마다 실행되며 updatedAt이 1초마다 갱신되는 원인이 됨)
  useEffect(() => {
    if (!slotId || !backgroundSettings) return;
    if (isLoadingSlot) return;
    if (!backgroundSettingsLoadedRef.current) return;
    if (saveBackgroundSettings) {
      saveBackgroundSettings(backgroundSettings);
    }
  }, [backgroundSettings, slotId, saveBackgroundSettings, isLoadingSlot]);
  
  // 슬롯 변경 시 로드 플래그 리셋
  useEffect(() => {
    backgroundSettingsLoadedRef.current = false;
  }, [slotId]);

  // width/height 변경 시 localStorage에 저장
  useEffect(() => {
    const saveSpriteSettings = (newWidth, newHeight) => {
      try {
        const settings = {
          width: newWidth,
          height: newHeight,
        };
        localStorage.setItem('digimon_view_settings', JSON.stringify(settings));
      } catch (error) {
        console.error("Sprite settings 저장 오류:", error);
      }
    };
    saveSpriteSettings(width, height);
  }, [width, height]);

  // clearedQuestIndex 로컬 스토리지에서 로드
  useEffect(() => {
    const savedClearedQuestIndex = localStorage.getItem(`slot${slotId}_clearedQuestIndex`);
    if (savedClearedQuestIndex !== null) {
      setClearedQuestIndex(parseInt(savedClearedQuestIndex, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId]);

  // clearedQuestIndex 로컬 스토리지에 저장
  useEffect(() => {
    localStorage.setItem(`slot${slotId}_clearedQuestIndex`, clearedQuestIndex.toString());
  }, [clearedQuestIndex, slotId]);

  // 탭 이탈/닫기 시 현재 스탯 저장 시도 (비용 절감: 액션 기반 + 탭 이탈 시 1회)
  const latestStatsRef = useRef(digimonStats);
  useEffect(() => {
    latestStatsRef.current = digimonStats;
  }, [digimonStats]);
  useEffect(() => {
    if (!slotId || !currentUser || !setDigimonStatsAndSave) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setDigimonStatsAndSave(latestStatsRef.current).catch((err) =>
          console.warn("[Game] 탭 이탈 시 저장 실패:", err)
        );
      }
    };
    const handleBeforeUnload = () => {
      setDigimonStatsAndSave(latestStatsRef.current).catch(() => {});
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId, currentUser]);

  // (2) 시계만 업데이트 (스탯은 Lazy Update로 처리)
  useEffect(()=>{
    const clock= setInterval(()=> setCustomTime(new Date()),1000);
    return ()=>{
      clearInterval(clock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // (3) 클라이언트 타이머: 1초마다 UI 실시간 업데이트 (Time to Evolve, Lifespan, Waste 등)
  // ⚠️ Firestore 쓰기 금지: 이 타이머에서는 setDigimonStats(메모리)만 수행합니다.
  //    서버 저장은 사망 시 1회 또는 먹이/훈련/배틀 등 액션 시에만 수행됩니다.
  //    (1초마다 저장 시 1시간 접속만으로 3,600회 쓰기 발생 → 비용·한도 소모)
  const lastUpdateTimeRef = useRef(Date.now());
  const prevSleepingRef = useRef(null);
  /** stale state로 같은 케어미스 이벤트가 다시 들어와도 한 번만 처리하기 위한 이벤트 ID 집합 */
  const lastAddedCareMistakeKeysRef = useRef(new Set());

  useEffect(()=>{
    // 사망한 경우 타이머 중지
    if(digimonStats.isDead) {
      return;
    }

    // 타이머 시작 시 마지막 업데이트 시간 초기화
    lastUpdateTimeRef.current = Date.now();

    const timer = setInterval(() => {
      const now = Date.now();
      const actualElapsedSeconds = Math.floor((now - lastUpdateTimeRef.current) / 1000);
      lastUpdateTimeRef.current = now; // 다음 업데이트를 위해 시간 갱신
      
      // 실제 경과 시간이 0이면 스킵 (너무 빠른 업데이트 방지)
      if (actualElapsedSeconds <= 0) {
        return;
      }
      
      // 실제 경과 시간이 너무 크면 (예: 1분 이상) 최대 60초로 제한 (안전장치)
      const safeElapsedSeconds = Math.min(actualElapsedSeconds, 60);
      
      // 함수형 업데이트를 사용하여 최신 상태를 참조
      setDigimonStats((prevStats) => {
        // 사망한 경우 업데이트 중지
        if(prevStats.isDead) {
          return prevStats;
        }
        
        // 냉장고 상태에서는 모든 수치 고정 (시간 정지)
        if(prevStats.isFrozen) {
          return prevStats;
        }

        // 수면 로직 (타이머 감소 전에 수면 상태 확인)
        const currentDigimonName = prevStats.evolutionStage ? 
          Object.keys(digimonDataForSlot).find(key => digimonDataForSlot[key]?.evolutionStage === prevStats.evolutionStage) || "Digitama" :
          "Digitama";
        const schedule = getSleepSchedule(currentDigimonName, digimonDataForSlot, prevStats);
        const nowMs = Date.now();
        const nowDate = new Date(nowMs);
        const inSchedule = isWithinSleepSchedule(schedule, nowDate);
        const wakeOverride = wakeUntil && nowMs < wakeUntil;
        const sleepingNow = inSchedule && !wakeOverride;
        
        // 수면 상태 계산 (SLEEPING 또는 TIRED일 때 타이머 감소하지 않음)
        const currentSleepStatus = getSleepStatus({
          sleepSchedule: schedule,
          isLightsOn,
          wakeUntil,
          fastSleepStart: prevStats.fastSleepStart || null,
          napUntil: prevStats.napUntil || null,
          now: nowDate,
        });
        // SLEEPING 또는 TIRED 상태일 때 타이머 정지 (배고픔, 힘 감소 중단)
        const isActuallySleeping = currentSleepStatus === 'SLEEPING' || currentSleepStatus === 'TIRED';

        // updateLifespan을 호출하여 실제 경과 시간만큼 처리 (lifespanSeconds, timeToEvolveSeconds, poop 등)
        // SLEEPING 상태일 때만 lifespan 증가, TIRED 상태일 때도 poopCountdown은 멈춤
        // isActuallySleeping은 SLEEPING 또는 TIRED 상태를 의미 (배고픔/힘 타이머 정지용)
        let updatedStats = updateLifespan(prevStats, safeElapsedSeconds, isActuallySleeping);
        // 매뉴얼 기반 배고픔/힘 감소 로직 적용
        const currentDigimonData = digimonDataForSlot[currentDigimonName] || digimonDataForSlot["Digitama"];
        // 매뉴얼 기반 배고픔/힘 감소 처리 (SLEEPING 또는 TIRED 상태일 때 감소하지 않음)
        // 실제 경과 시간만큼 처리하여 브라우저 탭 throttling 문제 해결
        updatedStats = handleHungerTick(updatedStats, currentDigimonData, safeElapsedSeconds, isActuallySleeping);
        updatedStats = handleStrengthTick(updatedStats, currentDigimonData, safeElapsedSeconds, isActuallySleeping);
        
        // 에너지 회복 처리 (기상 시간 회복 및 30분마다 회복)
        const maxEnergy = currentDigimonData?.stats?.maxEnergy || updatedStats.maxEnergy || updatedStats.maxStamina || 0;
        updatedStats = handleEnergyRecovery(updatedStats, schedule, maxEnergy, nowDate);

        // 수면 관련 스탯 업데이트
        updatedStats.sleepDisturbances = updatedStats.sleepDisturbances || 0;
        
        // fastSleepStart 보존 (타이머에서 업데이트 시 유지)
        updatedStats.fastSleepStart = prevStats.fastSleepStart || null;
        
        // napUntil 보존 (타이머에서 업데이트 시 유지)
        updatedStats.napUntil = prevStats.napUntil || null;
        
        // 낮잠 시간이 지나면 napUntil 리셋
        if (updatedStats.napUntil && nowMs >= updatedStats.napUntil) {
          updatedStats.napUntil = null;
        }
        
        // tiredStartAt 보존 (타이머에서 업데이트 시 유지)
        updatedStats.tiredStartAt = prevStats.tiredStartAt || null;
        updatedStats.tiredCounted = prevStats.tiredCounted || false;

        // 구 저장 데이터 호환용 일일 수면 필드 리셋
        const todayStartMs = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
        const storedSleepMistake = updatedStats.sleepMistakeDate;
        const isNewDay = typeof storedSleepMistake === "number"
          ? storedSleepMistake !== todayStartMs
          : storedSleepMistake !== nowDate.toDateString(); // 구 데이터(문자열) 호환
        if (isNewDay) {
          updatedStats.sleepMistakeDate = todayStartMs;
          updatedStats.dailySleepMistake = false;
          setDailySleepMistake(false);
        }

        // sleepLightOnStart는 UI 표시용으로만 사용
        if (sleepingNow && isLightsOn) {
          // UI 표시를 위해 sleepLightOnStart 업데이트 (케어미스 로직은 제거)
          if (!updatedStats.sleepLightOnStart) {
            updatedStats.sleepLightOnStart = nowMs;
          }
          // 불이 켜져 있으면 빠른 잠들기 시점 리셋
          updatedStats.fastSleepStart = null;
        } else {
          updatedStats.sleepLightOnStart = null;
          // wakeUntil이 활성화되어 있으면 fastSleepStart를 절대 리셋하지 않음
          // (fastSleepStart가 완료되어 SLEEPING 상태가 되어도 wakeUntil이 있으면 유지)
          if (wakeUntil && nowMs < wakeUntil) {
            // wakeUntil이 활성화되어 있으면 fastSleepStart 유지 (리셋하지 않음)
            // 이렇게 하면 fastSleepStart가 완료되어 SLEEPING 상태가 되어도
            // wakeUntil이 활성화되어 있는 동안 SLEEPING 상태를 유지할 수 있음
          } else {
            // wakeUntil이 만료되었을 때만 fastSleepStart 리셋 고려
            // 하지만 SLEEPING 상태가 유지되도록 하려면 리셋하지 않는 것이 좋음
            // fastSleepStart는 불을 켜거나 명시적으로 리셋할 때만 리셋
            // (현재는 리셋하지 않음)
          }
        }

        // 잠듦/깨어남 활동 로그 (SLEEP_START / SLEEP_END)
        const wasSleeping = prevSleepingRef.current;
        if (wasSleeping !== null) {
          const timeStr = new Date(nowMs).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
          const currentLogs = updatedStats.activityLogs || [];
          if (!wasSleeping && sleepingNow) {
            const newLogs = addActivityLog(currentLogs, "SLEEP_START", `잠들음 (${timeStr})`);
            updatedStats.activityLogs = newLogs;
            if (appendLogToSubcollection) appendLogToSubcollection(newLogs[newLogs.length - 1]).catch(() => {});
          } else if (wasSleeping && !sleepingNow) {
            const newLogs = addActivityLog(currentLogs, "SLEEP_END", `깨어남 (${timeStr})`);
            updatedStats.activityLogs = newLogs;
            if (appendLogToSubcollection) appendLogToSubcollection(newLogs[newLogs.length - 1]).catch(() => {});
          }
        }
        prevSleepingRef.current = sleepingNow;

        setIsSleeping(sleepingNow);
        // 수면 상태 변경 시 애니메이션 업데이트 (부상 상태는 아래 애니메이션 우선순위 로직에서 처리)
        if (sleepingNow && !updatedStats.isInjured && !updatedStats.isDead) {
          setCurrentAnimation("sleep");
        } else if (!sleepingNow && currentAnimation === "sleep" && !updatedStats.isInjured && !updatedStats.isDead) {
          setCurrentAnimation("idle");
        }
        if (!updatedStats.isDead) {
          const deathEvaluation = evaluateDeathConditions(updatedStats, Date.now());
          if (deathEvaluation.isDead) {
            updatedStats.isDead = true;
            if (deathEvaluation.reason) {
              updatedStats.deathReason = deathEvaluation.reason;
              setDeathReason(deathEvaluation.reason);
            }
          }
        }
        // 수명 종료 체크 제거됨 - 수명으로 인한 사망 없음
        // 호출(Call) 시스템 체크 및 타임아웃 처리
        const sleepSchedule = getSleepSchedule(selectedDigimon, digimonDataForSlot, prevStats);
        const oldCallStatus = { ...prevStats.callStatus };
        updatedStats = checkCalls(updatedStats, isLightsOn, sleepSchedule, new Date(), isActuallySleeping);
        // 호출 시작 로그 추가 (이전 로그 보존 - 함수형 업데이트)
        if (!oldCallStatus?.hunger?.isActive && updatedStats.callStatus?.hunger?.isActive) {
          setActivityLogs((prevLogs) => {
            const currentLogs = updatedStats.activityLogs || prevLogs || [];
            const updated = addActivityLog(currentLogs, "CALL", "Call: Hungry!");
            if (appendLogToSubcollection) appendLogToSubcollection(updated[updated.length - 1]).catch(() => {});
            return updated;
          });
        }
        if (!oldCallStatus?.strength?.isActive && updatedStats.callStatus?.strength?.isActive) {
          setActivityLogs((prevLogs) => {
            const currentLogs = updatedStats.activityLogs || prevLogs || [];
            const updated = addActivityLog(currentLogs, "CALL", "Call: No Energy!");
            if (appendLogToSubcollection) appendLogToSubcollection(updated[updated.length - 1]).catch(() => {});
            return updated;
          });
        }
        if (!oldCallStatus?.sleep?.isActive && updatedStats.callStatus?.sleep?.isActive) {
          setActivityLogs((prevLogs) => {
            const currentLogs = updatedStats.activityLogs || prevLogs || [];
            const updated = addActivityLog(currentLogs, "CALL", "Call: Sleepy!");
            if (appendLogToSubcollection) appendLogToSubcollection(updated[updated.length - 1]).catch(() => {});
            return updated;
          });
        }
        const repairedPrevStats = repairCareMistakeLedger(prevStats, prevStats.activityLogs || []).nextStats;
        const oldCareMistakes = repairedPrevStats.careMistakes || 0;
        const previousLedger = initializeCareMistakeLedger(repairedPrevStats.careMistakeLedger);
        updatedStats = checkCallTimeouts(updatedStats, new Date(), isActuallySleeping);
        let nextLedger = initializeCareMistakeLedger(updatedStats.careMistakeLedger);
        const previousLedgerIds = new Set(previousLedger.map((entry) => entry.id));
        const duplicateEventIds = [];
        const newCareMistakeEntries = nextLedger
          .filter((entry) => !previousLedgerIds.has(entry.id))
          .filter((entry) => {
            if (!entry?.id) return false;
            if (lastAddedCareMistakeKeysRef.current.has(entry.id)) {
              duplicateEventIds.push(entry.id);
              return false;
            }
            lastAddedCareMistakeKeysRef.current.add(entry.id);
            return true;
          });
        if (duplicateEventIds.length > 0) {
          nextLedger = nextLedger.filter((entry) => !duplicateEventIds.includes(entry.id));
          updatedStats = {
            ...updatedStats,
            careMistakes: Math.max(oldCareMistakes + newCareMistakeEntries.length, (updatedStats.careMistakes || 0) - duplicateEventIds.length),
            careMistakeLedger: nextLedger,
          };
        }
        if (newCareMistakeEntries.length > 0) {
          const orderedEntries = [...newCareMistakeEntries].sort((a, b) => (a.occurredAt || 0) - (b.occurredAt || 0));
          let currentLogs = updatedStats.activityLogs || prevStats.activityLogs || [];
          orderedEntries.forEach((entry) => {
            const newLogs = addActivityLog(currentLogs, "CAREMISTAKE", entry.text, entry.occurredAt);
            const appendedLog = newLogs[newLogs.length - 1];
            const wasAdded = newLogs.length > currentLogs.length;
            currentLogs = newLogs;
            if (wasAdded && appendLogToSubcollection && appendedLog) {
              appendLogToSubcollection(appendedLog).catch(() => {});
            }
          });
          setActivityLogs(currentLogs);
          updatedStats = { ...updatedStats, activityLogs: currentLogs };
        }
        const oldPoopCount = prevStats.poopCount || 0;
        if ((updatedStats.poopCount || 0) > oldPoopCount) {
          const newPoopCount = updatedStats.poopCount || 0;
          let logText = `Pooped (Total: ${oldPoopCount}→${newPoopCount})`;
          // 똥 8개 부상: 최초 8개 도달 시각을 즉시 부상 시각으로 사용
          const poopInjuryTs = (newPoopCount === 8 && updatedStats.isInjured && updatedStats.poopReachedMaxAt)
            ? (typeof updatedStats.poopReachedMaxAt === 'number' ? updatedStats.poopReachedMaxAt : new Date(updatedStats.poopReachedMaxAt).getTime())
            : undefined;
          if (newPoopCount === 8 && updatedStats.isInjured) {
            logText += " - Injury: Too much poop (8 piles)";
          }
          const currentLogs = updatedStats.activityLogs || prevStats.activityLogs || [];
          const newLogs = addActivityLog(currentLogs, "POOP", logText, poopInjuryTs);
          setActivityLogs(newLogs);
          if (appendLogToSubcollection) appendLogToSubcollection(newLogs[newLogs.length - 1]).catch(() => {});
          updatedStats = { ...updatedStats, activityLogs: newLogs };
        }
        if (!prevStats.isDead && updatedStats.isDead && !hasSeenDeathPopup) {
          const reason = deathReason || "Unknown";
          setActivityLogs((prevLogs) => {
            const currentLogs = updatedStats.activityLogs || prevLogs || [];
            const updatedLogs = addActivityLog(currentLogs, "DEATH", `Death: Passed away (Reason: ${reason})`);
            if (appendLogToSubcollection) appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
            if (slotId && currentUser) {
              const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
              const { activityLogs: _dropLogs, ...statsForDoc } = updatedStats;
              updateDoc(slotRef, { digimonStats: statsForDoc, updatedAt: new Date() }).catch((error) => {
                console.error("사망 스탯 저장 오류:", error);
              });
            }
            return updatedLogs;
          });
          setHasSeenDeathPopup(true);
        }
        // 메모리 상태만 업데이트 (Firestore 쓰기 없음)
        updatedStats.isLightsOn = isLightsOn;
        updatedStats.wakeUntil = wakeUntil;
        if (typeof updatedStats.dailySleepMistake !== "boolean") {
          updatedStats.dailySleepMistake = dailySleepMistake;
        }
        // 호출 활성화·데드라인·케어미스·부상 발생 시 DB 저장 → 새로고침 없이 이력 유지
        const zeroAtChanged = updatedStats.lastHungerZeroAt !== prevStats.lastHungerZeroAt ||
          updatedStats.lastStrengthZeroAt !== prevStats.lastStrengthZeroAt;
        const deadlineChanged = (updatedStats.hungerMistakeDeadline !== prevStats.hungerMistakeDeadline) ||
          (updatedStats.strengthMistakeDeadline !== prevStats.strengthMistakeDeadline);
        const careMistakeJustIncreased = (updatedStats.careMistakes || 0) > (prevStats.careMistakes || 0);
        const injuryJustHappened = (updatedStats.poopCount || 0) > (prevStats.poopCount || 0) &&
          updatedStats.isInjured && (updatedStats.poopCount || 0) >= 8;
        if (slotId && currentUser && setDigimonStatsAndSave &&
            (zeroAtChanged || deadlineChanged || careMistakeJustIncreased || injuryJustHappened)) {
          setTimeout(() => setDigimonStatsAndSave(updatedStats).catch(() => {}), 0);
        }
        return updatedStats;
      });
    }, 1000);

    // 컴포넌트 언마운트 시 타이머 정리 (메모리 누수 방지)
    return () => {
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digimonStats.isDead]); // isDead가 변경될 때만 재설정

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
    dailySleepMistake,
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

async function setSelectedDigimonAndSave(name) {
    setSelectedDigimon(name);
    if (slotId && currentUser) {
      try {
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        // 진화/사망 시 표시명도 함께 갱신. 한글명 또는 ID만 (버전 안 붙임)
        const displayNameFromData = evolutionDataForSlot?.[name]?.name;
        const baseDisplayName = displayNameFromData || name;
        const digimonDisplayName = (digimonNickname && digimonNickname.trim()) ? `${digimonNickname.trim()}(${baseDisplayName})` : baseDisplayName;
        await updateDoc(slotRef, {
          selectedDigimon: name,
          digimonDisplayName,
          isLightsOn,
          wakeUntil,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("디지몬 이름 저장 오류:", error);
      }
    }
  }

// 애니메이션
  // ⚠️ 중요: 오하카다몬은 고정 스프라이트만 사용하므로 기본 애니메이션 계산을 건너뜀
  let idleFrames, eatFramesArr, rejectFramesArr;
  
  // ⚠️ 중요: 모든 프레임 계산에서 selectedDigimon에서 직접 스프라이트 가져오기
  // digimonStats.sprite가 잘못된 값일 수 있으므로 데이터 일관성 보장
  const digimonData = digimonDataForSlot[selectedDigimon];
  const baseSprite = digimonData?.sprite ?? digimonStats.sprite;
  // v2 디지몬은 Ver2_Mod_Kor, v1은 /images
  const digimonImageBase = digimonData?.spriteBasePath || "/images";
  const idleMotionTimeline = useMemo(() => {
    const safeBaseSprite = Number(baseSprite);
    const isDigitama = selectedDigimon === "Digitama" || selectedDigimon === "DigitamaV2";

    if (!Number.isFinite(safeBaseSprite) || isDigitama || DEATH_FORM_IDS.includes(selectedDigimon)) {
      return [];
    }

    return resolveIdleMotionTimeline(safeBaseSprite);
  }, [baseSprite, selectedDigimon]);
  
  if (DEATH_FORM_IDS.includes(selectedDigimon)) {
    // 사망 폼(오하카다몬)은 고정 스프라이트만 사용 (애니메이션 없음)
    idleFrames = [ `${baseSprite}` ];
    eatFramesArr = [ `${baseSprite}` ];
    rejectFramesArr = [ `${baseSprite}` ];
    // 오하카다몬은 애니메이션 없이 고정 스프라이트만 표시
    if(currentAnimation !== "idle"){
      setCurrentAnimation("idle");
    }
  } else {
    // 일반 디지몬: 기본 애니메이션 계산
    let idleAnimId=1, eatAnimId=2, rejectAnimId=3;
    if (selectedDigimon === "Digitama" || selectedDigimon === "DigitamaV2") idleAnimId = 90;
    const idleOff= digimonAnimations[idleAnimId]?.frames||[0];
    const eatOff= digimonAnimations[eatAnimId]?.frames||[0];
    const rejectOff= digimonAnimations[rejectAnimId]?.frames||[14];

    idleFrames= idleOff.map(n=> `${baseSprite + n}`);
    eatFramesArr= eatOff.map(n=> `${baseSprite + n}`);
    rejectFramesArr= rejectOff.map(n=> `${baseSprite + n}`);

    // 애니메이션 우선순위: 죽음 > 부상 > 수면 > 일반
    // 죽음 상태: 모션 15번(아픔2) 사용, 스프라이트 14만 표시
    // ⚠️ 중요: 오하카다몬은 제외 (오하카다몬은 이미 환생한 상태이므로 isDead가 false여야 함)
    if(digimonStats.isDead){
      // 모션 15번 (아픔2) - 죽음 상태에서는 sprite+14만 표시
      idleFrames= [ `${baseSprite+14}` ];
      eatFramesArr= [ `${baseSprite+14}` ];
      rejectFramesArr= [ `${baseSprite+14}` ];
      // 죽음 상태에서는 항상 아픔2 모션 사용
      if(currentAnimation !== "pain2"){
        setCurrentAnimation("pain2");
      }
    }
    // 부상 상태: 모션 10번(sick) 사용, 스프라이트 13과 14 표시
    else if(digimonStats.isInjured){
      // 모션 10번 (sick) - digimonAnimations[10] = { name: "sick", frames: [13, 14] }
      // 스프라이트 13과 14를 번갈아 표시 (애니메이션 정의에 맞춤)
      idleFrames = [`${baseSprite + 13}`, `${baseSprite + 14}`];
      eatFramesArr = idleFrames;
      rejectFramesArr = idleFrames;
      // 부상 상태에서는 항상 sick 모션 사용
      if(currentAnimation !== "sick"){
        setCurrentAnimation("sick");
      }
    }
    // 수면/피곤 상태: 모션 8번(sleep) 사용, 스프라이트 11과 12 표시
    // digimonAnimations[8] = { name: "sleep", frames: [11, 12] } 정의에 맞춤
    // ⚠️ 디지타마는 수면 상태 없음
    // baseSprite는 위에서 이미 계산됨
    else if ((sleepStatus === "SLEEPING" || sleepStatus === "TIRED") && selectedDigimon !== "Digitama" && selectedDigimon !== "DigitamaV2") {
      idleFrames = [`${baseSprite + 11}`, `${baseSprite + 12}`];
      eatFramesArr = idleFrames;
      rejectFramesArr = idleFrames;
      // 수면 상태에서는 sleep 모션 사용
      if(currentAnimation !== "sleep"){
        setCurrentAnimation("sleep");
      }
    }
    // 일반 상태: idle 모션으로 복귀
    else if(currentAnimation === "sick" || currentAnimation === "sleep" || currentAnimation === "pain2"){
      setCurrentAnimation("idle");
    }
  }

  // 먹이 - Lazy Update 적용 후 Firestore에 저장

  // 똥 청소

  // ★ (C) 훈련

  // 리셋 (디지타마로 초기화) - 새로운 시작
  async function resetDigimon(){
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
        lastStrengthZeroAt: null,
        injuredAt: null,
        isInjured: false,
        // 새로운 시작: 똥 초기화
        poopCount: 0,
        poopReachedMaxAt: null,
        lastPoopPenaltyAt: null,
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
      const initialDigimonId = slotVersion === "Ver.2" ? "DigitamaV2" : "Digitama";
      const ns = initializeStats(initialDigimonId, updatedStats, digimonDataForSlot);

      // 새로운 시작이므로 isDead와 age를 명시적으로 설정
      ns.isDead = false;
      ns.age = 0;
      ns.birthTime = Date.now();
      ns.lastSavedAt = new Date();
      ns.fullness = 0;
      ns.strength = 0;
      ns.lastHungerZeroAt = null;
      ns.lastStrengthZeroAt = null;
      ns.injuredAt = null;
      ns.isInjured = false;
      ns.injuries = 0;
      ns.poopCount = 0;
      ns.poopReachedMaxAt = null;
      ns.lastPoopPenaltyAt = null;

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
        `New start: Reborn as ${initialDigimonId}`
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
  }

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

  // 수면 상태 계산 (TIRED/Sleep Call은 경고 상태로만 유지)
  useEffect(() => {
    const timer = setInterval(() => {
      const status = getSleepStatus({
        sleepSchedule: getSleepSchedule(selectedDigimon, digimonDataForSlot, digimonStats),
        isLightsOn,
        wakeUntil,
        fastSleepStart: digimonStats.fastSleepStart || null,
        napUntil: digimonStats.napUntil || null,
        now: new Date(),
      });
      setSleepStatus(status);
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDigimon, isLightsOn, wakeUntil, digimonStats.fastSleepStart, digimonStats.napUntil]);

  // 온라인 조그레스: 현재 슬롯 문서 구독 (jogressStatus.canEvolve 실시간 반영)
  useEffect(() => {
    if (!db || !currentUser?.uid || slotId == null) {
      setSlotJogressStatus(null);
      return;
    }
    const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
    const unsub = onSnapshot(slotRef, (snap) => {
      const data = snap.data() || {};
      setSlotJogressStatus(data.jogressStatus && typeof data.jogressStatus === "object" ? data.jogressStatus : null);
    }, (err) => {
      console.warn("[Game] slot jogressStatus 구독 오류:", err);
      setSlotJogressStatus(null);
    });
    return () => unsub();
  }, [currentUser?.uid, slotId]);

  // 온라인 조그레스: 내가 만든 방 구독 → paired 시 호스트 슬롯에 canEvolve 반영
  useEffect(() => {
    if (!db || !currentUser?.uid || !myJogressRoomId || !applyHostJogressStatusFromRoom) return;
    const roomRef = doc(db, "jogress_rooms", myJogressRoomId);
    const unsub = onSnapshot(roomRef, (snap) => {
      const data = snap.data() || {};
      if (data.status === "paired") {
        applyHostJogressStatusFromRoom(data, myJogressRoomId);
        setMyJogressRoomId(null);
        return;
      }
      if (data.status === "cancelled" || data.status === "completed") {
        setMyJogressRoomId(null);
      }
    }, (err) => {
      console.warn("[Game] jogress room 구독 오류:", err);
      setMyJogressRoomId(null);
    });
    return () => unsub();
  }, [currentUser?.uid, myJogressRoomId, applyHostJogressStatusFromRoom, setMyJogressRoomId]);

  // 온라인 조그레스: 현재 슬롯이 대기 중인 방(roomId) 구독 → paired 시 해당 슬롯에 canEvolve 반영 (모달에서 방 생성 시 myJogressRoomId 미설정 대비)
  useEffect(() => {
    if (!db || !currentUser?.uid || !slotId || !applyHostJogressStatusFromRoom) return;
    const roomIdToSub = slotJogressStatus?.roomId && !slotJogressStatus?.canEvolve ? slotJogressStatus.roomId : null;
    if (!roomIdToSub) return;
    const roomRef = doc(db, "jogress_rooms", roomIdToSub);
    const unsub = onSnapshot(roomRef, (snap) => {
      const data = snap.data() || {};
      if (data.status === "paired" && data.hostUid === currentUser.uid) {
        applyHostJogressStatusFromRoom(data, roomIdToSub);
      }
    }, (err) => {
      console.warn("[Game] slot jogress room 구독 오류:", err);
    });
    return () => unsub();
  }, [currentUser?.uid, slotId, slotJogressStatus?.roomId, slotJogressStatus?.canEvolve, applyHostJogressStatusFromRoom]);

  // 냉장고 꺼내기 애니메이션 완료 처리 (3.5초 후 takeOutAt을 null로 설정)
  useEffect(() => {
    if (!digimonStats.takeOutAt) return;
    
    const takeOutTime = typeof digimonStats.takeOutAt === 'number' 
      ? digimonStats.takeOutAt 
      : new Date(digimonStats.takeOutAt).getTime();
    const elapsedMs = Date.now() - takeOutTime;
    
    // 3.5초(3500ms) 이상 경과하면 takeOutAt을 null로 설정
    if (elapsedMs >= 3500) {
      setDigimonStats((prevStats) => {
        if (!prevStats.takeOutAt) return prevStats;
        return {
          ...prevStats,
          takeOutAt: null,
        };
      });
    } else {
      // 아직 애니메이션 중이면 남은 시간만큼 대기 후 다시 체크
      const remainingMs = 3500 - elapsedMs;
      const timer = setTimeout(() => {
        setDigimonStats((prevStats) => {
          if (!prevStats.takeOutAt) return prevStats;
          return {
            ...prevStats,
            takeOutAt: null,
          };
        });
      }, remainingMs);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digimonStats.takeOutAt]);

  // 퀘스트 시작 핸들러

  // Communication 시작 핸들러

  // Sparring 시작 핸들러

  // Arena 시작 핸들러

  // Arena 배틀 시작 핸들러

  // Sparring 슬롯 선택 핸들러

  // 조명 토글: 상태 및 Firestore 동기화

  // Admin 설정 반영 콜백

  // 배틀 완료 핸들러

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

  // 화면 렌더
  // 로그아웃 핸들러

  // handlers 객체 생성 (GameModals에 전달할 핸들러들)
  // 과식 확인 핸들러
  const handleOverfeedConfirm = async () => {
    toggleModal('overfeedConfirm', false);
    // "예" 선택: 현재 로직대로 진행 (overfeed +1, 고기 먹기)
    const updatedStats = await applyLazyUpdateBeforeAction();
    if (updatedStats.isDead) return;
    
    setDigimonStats(updatedStats);
    setFeedType("meat");
    setCurrentAnimation("eat");
    toggleModal('food', true); // setShowFood(true) 대신 toggleModal 사용
    setFeedStep(0);
    // requestAnimationFrame을 사용하여 다음 프레임에서 애니메이션 시작
    requestAnimationFrame(() => {
      eatCycleFromHook(0, "meat", false); // isRefused = false (정상 먹기)
    });
  };

  const handleOverfeedCancel = async () => {
    toggleModal('overfeedConfirm', false);
    // "아니오" 선택: overfeed 증가 없이 거절 애니메이션만
    const updatedStats = await applyLazyUpdateBeforeAction();
    if (updatedStats.isDead) return;
    
    setDigimonStats(updatedStats);
    setFeedType("meat");
    setCurrentAnimation("foodRejectRefuse");
    toggleModal('food', false); // setShowFood(false) 대신 toggleModal 사용
    setFeedStep(0);
    // 거절 애니메이션 시작 (overfeed 증가 없음)
    requestAnimationFrame(() => {
      eatCycleFromHook(0, "meat", true); // isRefused = true (거절 애니메이션만)
    });
  };

  const handlers = {
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
  };

  // data 객체 생성 (GameModals에 전달할 데이터들)
  const data = {
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
    // 조그레스 파트너 슬롯 모달용 (버전별 디지몬 데이터)
    jogressDigimonDataVer1: newDigimonDataVer1,
    jogressDigimonDataVer2: digimonDataVer2,
  };

  // Firebase 로그인 필수: 조건부 렌더링
  if (!isFirebaseAvailable || !currentUser) {
    return null;
  }

  const currentTimeText = customTime.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <>
      {isImmersive ? (
        <ImmersiveGameTopBar
          isMobile={isMobile}
          onOpenBaseView={() => navigate(`/play/${slotId}`)}
          onOpenPlayHub={() => navigate("/play")}
        />
      ) : isMobile ? (
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
                onClick={() => toggleModal('settings', true)}
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
                        {currentUser.displayName?.[0] || currentUser.email?.[0] || 'U'}
                      </span>
                    )}
                    <span className="text-sm text-gray-700 flex items-center gap-1 flex-wrap">
                      <span>테이머: {tamerName || currentUser.displayName || currentUser.email?.split('@')[0]}</span>
                      {hasVer1Master && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium shrink-0">👑 Ver.1</span>
                      )}
                      {hasVer2Master && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-medium shrink-0">👑 Ver.2</span>
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
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">👑 Ver.1</span>
                            )}
                            {hasVer2Master && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-medium">👑 Ver.2</span>
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

        <div className={gameHeaderClassName}>
          <h2 className="text-base font-bold">
            슬롯 {slotId} - {(() => {
              const digimonName = evolutionDataForSlot[selectedDigimon]?.name || selectedDigimon;
              const baseName = digimonName; // 한글명 또는 ID만 (버전 안 붙임)
              if (digimonNickname && digimonNickname.trim()) {
                return `${digimonNickname}(${baseName})`;
              }
              return baseName;
            })()}
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
          {/* 상태 하트 표시 (시계 아래) */}
          <div className="mt-2 flex flex-col items-center gap-2">
            <StatusHearts
              fullness={digimonStats.fullness || 0}
              strength={digimonStats.strength || 0}
              maxOverfeed={digimonStats.maxOverfeed || 0}
              proteinOverdose={digimonStats.proteinOverdose || 0}
              showLabels={true}
              size="sm"
              position="inline"
              isFrozen={digimonStats.isFrozen || false}
            />
            {/* 디지몬 상태 배지 표시 */}
            <DigimonStatusBadges
              digimonStats={digimonStats}
              sleepStatus={sleepStatus}
              isDead={digimonStats.isDead}
              currentAnimation={currentAnimation}
              feedType={feedType}
              canEvolve={isEvoEnabled}
              sleepSchedule={getSleepSchedule(selectedDigimon, digimonDataForSlot, digimonStats)}
              wakeUntil={wakeUntil}
              sleepLightOnStart={digimonStats.sleepLightOnStart || null}
              deathReason={deathReason}
              onOpenStatusDetail={(messages) => {
                // 상태 상세 모달을 열기 위해 임시로 상태 저장
                setStatusDetailMessages(messages);
                toggleModal('statusDetail', true);
              }}
            />
          </div>
        </div>
      </div>
      <div className={`flex flex-col items-center w-full ${isMobile ? "game-screen-mobile" : ""}`}>
      <GameScreen
        width={width}
        height={height}
        backgroundNumber={backgroundNumber}
        currentAnimation={currentAnimation}
        idleFrames={idleFrames}
        idleMotionTimeline={idleMotionTimeline}
        eatFrames={eatFramesArr}
        foodRejectFrames={rejectFramesArr}
        digimonImageBase={digimonImageBase}
        showFood={modals.food}
        feedStep={feedStep}
        feedType={feedType}
        foodSizeScale={foodSizeScale}
        meatSprites={meatSprites}
        proteinSprites={proteinSprites}
        poopCount={digimonStats.poopCount || 0}
        showPoopCleanAnimation={modals.poopCleanAnimation}
        cleanStep={cleanStep}
        sleepStatus={sleepStatus}
        isLightsOn={isLightsOn}
        digimonStats={digimonStats}
        selectedDigimon={selectedDigimon}
        showHealAnimation={modals.healAnimation}
        showCallToast={modals.callToast}
        callToastMessage={callToastMessage}
        showCallModal={modals.call}
        isFrozen={digimonStats.isFrozen || false}
        frozenAt={digimonStats.frozenAt || null}
        takeOutAt={digimonStats.takeOutAt || null}
        onCallIconClick={() => {
          const messages = [];
          if (digimonStats.callStatus?.hunger?.isActive) messages.push("Hungry!");
          if (digimonStats.callStatus?.strength?.isActive) messages.push("No Energy!");
          if (digimonStats.callStatus?.sleep?.isActive) messages.push("Sleepy!");
          setCallToastMessage(messages.join(" "));
          toggleModal('callToast', true);
          setTimeout(() => toggleModal('callToast', false), 2000);
        }}
        onCallModalClose={() => toggleModal('call', false)}
        showSleepDisturbanceToast={modals.sleepDisturbanceToast}
        sleepDisturbanceToastMessage="수면 방해! 😴 (10분 동안 깨어있음)"
        evolutionStage={evolutionStage}
        developerMode={developerMode}
        isRefused={currentAnimation === "foodRejectRefuse" && feedType === "meat"}
      />
      <div className={`flex justify-center w-full ${isMobile ? "control-panel-mobile" : ""}`}>
        <ControlPanel
          width={width}
          height={height}
          activeMenu={activeMenu}
          onMenuClick={handleMenuClickFromHook}
          stats={digimonStats}
          sleepStatus={sleepStatus}
          isMobile={isMobile}
          isFrozen={digimonStats.isFrozen || false}
        />
      </div>

        <div className="flex items-center justify-center space-x-2 mt-1 pb-20 flex-wrap gap-2">
      {/* 진화 / 조그레스: "진화!" 버튼 + "조그레스 진화" 버튼(상태에 따라 텍스트만 변경) */}
      {(() => {
        const currentDigimonDataForEvo = evolutionDataForSlot[selectedDigimon];
        const canJogressEvolve = !!(currentDigimonDataForEvo?.evolutions?.some((e) => e.jogress));
        const hasNormalEvolution = !!(currentDigimonDataForEvo?.evolutions?.some((e) => !e.jogress));
        const showEvolutionButton = hasNormalEvolution || canJogressEvolve;
        const openJogressFlow = () => toggleModal('jogressModeSelect', true);
        const jogressLabel = slotJogressStatus?.canEvolve
          ? "(조그레스 진화 가능)"
          : slotJogressStatus?.isWaiting
            ? "(대기중)"
            : "(-)";
        return (
          <>
            {showEvolutionButton && (
              <button
                onClick={handleEvolutionButton}
                disabled={isEvolving}
                className={`px-4 py-2 text-white rounded pixel-art-button flex items-center justify-center ${isEvolving ? "bg-gray-500 cursor-not-allowed" : hasNormalEvolution && isEvoEnabled ? "bg-green-500 hover:bg-green-600" : "bg-gray-600 hover:bg-gray-500"} ${isMobile ? 'evolution-button-mobile' : ''}`}
                style={{ writingMode: 'horizontal-tb', textOrientation: 'mixed' }}
                title={!hasNormalEvolution ? "이 디지몬은 조그레스로만 진화합니다. 클릭 시 진화 가이드 확인 가능" : undefined}
              >
                <span className="whitespace-nowrap">진화!</span>
              </button>
            )}
            {canJogressEvolve && (
              <button
                onClick={openJogressFlow}
                disabled={isEvolving}
                className={`px-4 py-2 text-white rounded pixel-art-button flex items-center justify-center gap-1.5 ${!isEvolving ? "bg-amber-600 hover:bg-amber-700" : "bg-gray-500 cursor-not-allowed"} ${isMobile ? 'evolution-button-mobile' : ''}`}
                style={{ writingMode: 'horizontal-tb', textOrientation: 'mixed' }}
              >
                <span className="whitespace-nowrap">조그레스 진화</span>
                <span className={`text-xs font-bold ${jogressLabel === "(조그레스 진화 가능)" ? "text-green-400" : "text-amber-200"}`}>{jogressLabel}</span>
              </button>
            )}
          </>
        );
      })()}
          <button
            onClick={() => toggleModal('digimonInfo', true)}
            className={`px-3 py-2 text-white bg-blue-500 rounded pixel-art-button hover:bg-blue-600 flex items-center justify-center gap-1 ${isMobile ? 'guide-button-mobile' : ''}`}
            title="디지몬 가이드"
            style={{ writingMode: 'horizontal-tb', textOrientation: 'mixed' }}
          >
            <span>📖</span>
            <span className="whitespace-nowrap">가이드</span>
          </button>
          {/* Death Info 버튼: 죽었을 때 또는 오하카다몬일 때 표시 */}
          {(digimonStats.isDead || DEATH_FORM_IDS.includes(selectedDigimon)) && (
            <button
              onClick={() => toggleModal('deathModal', true)}
              className="px-4 py-2 text-white bg-red-800 rounded pixel-art-button hover:bg-red-900 flex items-center justify-center"
              title={DEATH_FORM_IDS.includes(selectedDigimon) ? "새로운 시작" : "사망 정보"}
              style={{ writingMode: 'horizontal-tb', textOrientation: 'mixed' }}
            >
              <span className="whitespace-nowrap">
                {DEATH_FORM_IDS.includes(selectedDigimon) ? "🥚 새로운 시작" : "💀 사망 확인"}
              </span>
            </button>
          )}
        </div>
      </div>

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
          ui={{ 
            ...ui, 
            statusDetailMessages,
            sleepSchedule: getSleepSchedule(selectedDigimon, digimonDataForSlot, digimonStats),
            sleepStatus: sleepStatus,
            wakeUntil: wakeUntil,
            sleepLightOnStart: digimonStats.sleepLightOnStart || null,
          }}
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
