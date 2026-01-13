import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

import ControlPanel from "../components/ControlPanel";
import GameModals from "../components/GameModals";
import GameScreen from "../components/GameScreen";
import StatusHearts from "../components/StatusHearts";
import DigimonStatusBadges from "../components/DigimonStatusBadges";

import { getSleepStatus, checkCalls, resetCallStatus, checkCallTimeouts, addActivityLog } from "../hooks/useGameLogic";
import { useDeath } from "../hooks/useDeath";
import { useEvolution } from "../hooks/useEvolution";
import { useGameActions } from "../hooks/useGameActions";
import { useGameAnimations } from "../hooks/useGameAnimations";
import { useArenaLogic } from "../hooks/useArenaLogic";
import { useGameHandlers, getSleepSchedule, isWithinSleepSchedule } from "../hooks/useGameHandlers";
import { useGameData } from "../hooks/useGameData";
import { useGameState } from "../hooks/useGameState";

import digimonAnimations from "../data/digimonAnimations";
import { adaptDataMapToOldFormat } from "../data/v1/adapter";
import { digimonDataVer1 as newDigimonDataVer1 } from "../data/v1/digimons";
import { initializeStats, applyLazyUpdate, updateLifespan } from "../data/stats";
import { quests } from "../data/v1/quests";

import { checkEvolution } from "../logic/evolution/checker";
import { handleHungerTick } from "../logic/stats/hunger";
import { handleStrengthTick } from "../logic/stats/strength";
import { willRefuseMeat } from "../logic/food/meat";

const digimonDataVer1 = adaptDataMapToOldFormat(newDigimonDataVer1);
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

const perfectStages = ["Perfect","Ultimate","SuperUltimate"];

function formatTimeToEvolve(sec=0){
  const d = Math.floor(sec/86400);
  const r = sec %86400;
  const h = Math.floor(r/3600);
  const m = Math.floor((r % 3600)/60);
  const s = r % 60;
  return `${d} day, ${h} hour, ${m} min, ${s} sec`;
}
function formatLifespan(sec=0){
  const d = Math.floor(sec/86400);
  const r = sec %86400;
  const h = Math.floor(r/3600);
  const m = Math.floor((r % 3600)/60);
  const s = r % 60;
  return `${d} day, ${h} hour, ${m} min, ${s} sec`;
}

function Game(){
  const { slotId } = useParams();
  const { currentUser, logout, isFirebaseAvailable } = useAuth();
  
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
    refs,
    actions,
  } = useGameState({
    slotId,
    digimonDataVer1,
    defaultSeasonId: DEFAULT_SEASON_ID,
  });

  const navigate= useNavigate();
  const location = useLocation();
  // location.state에서 mode를 가져오거나, 기본값으로 현재 인증 상태 기반 결정
  const mode = location.state?.mode || ((isFirebaseAvailable && currentUser) ? 'firebase' : 'local');
  
  // 프로필 드롭다운 메뉴 상태
  const [showProfileMenu, setShowProfileMenu] = useState(false);

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
    currentQuestArea,
    setCurrentQuestArea,
    currentQuestRound,
    setCurrentQuestRound,
    clearedQuestIndex,
    setClearedQuestIndex,
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
    currentSeasonId,
    setCurrentSeasonId,
    seasonName,
    setSeasonName,
    seasonDuration,
    setSeasonDuration,
    healModalStats,
    setHealModalStats,
    healTreatmentMessage,
    setHealTreatmentMessage,
  } = gameState;

  const {
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
  } = flags || {};

  const {
    activeMenu,
    setActiveMenu,
    currentAnimation,
    setCurrentAnimation,
    backgroundNumber,
    setBackgroundNumber,
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
  } = ui;

  // tiredStartRef, tiredCountedRef는 더 이상 사용하지 않음 (digimonStats.tiredStartAt으로 대체)

  // 상태 상세 모달용 메시지 저장
  const [statusDetailMessages, setStatusDetailMessages] = useState([]);

  // useGameData 훅 호출 (데이터 저장/로딩 로직)
  const {
    saveStats: setDigimonStatsAndSave,
    applyLazyUpdate: applyLazyUpdateBeforeAction,
    saveBackgroundSettings,
  } = useGameData({
    slotId,
    currentUser,
    mode,
    digimonStats,
    setDigimonStats,
    setSelectedDigimon,
    setActivityLogs,
    setSlotName,
    setSlotCreatedAt,
    setSlotDevice,
    setSlotVersion,
    setIsLightsOn,
    setWakeUntil,
    setDailySleepMistake,
    setIsLoadingSlot,
    setDeathReason,
    toggleModal,
    digimonDataVer1,
    isFirebaseAvailable,
    navigate,
    isLightsOn,
    wakeUntil,
    dailySleepMistake,
    activityLogs,
    backgroundSettings,
    setBackgroundSettings,
  });

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
  
  // backgroundSettings 변경 시 Firebase/localStorage에 저장
  // Firebase 모드: Firebase에 저장
  // 로컬 모드: localStorage에 저장
  // 주의: 초기 로드 중이거나 로드가 완료되기 전에는 저장하지 않음
  useEffect(() => {
    if (!slotId || !backgroundSettings) return;
    
    // 초기 로드 중이면 저장하지 않음 (로드 완료 후 저장)
    if (isLoadingSlot) return;
    
    // 로드가 완료되지 않았으면 저장하지 않음
    if (!backgroundSettingsLoadedRef.current) {
      return;
    }
    
    // saveBackgroundSettings 함수가 있으면 호출 (mode에 따라 Firebase/localStorage 저장)
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
  }, [slotId]);

  // clearedQuestIndex 로컬 스토리지에 저장
  useEffect(() => {
    localStorage.setItem(`slot${slotId}_clearedQuestIndex`, clearedQuestIndex.toString());
  }, [clearedQuestIndex, slotId]);

  // (2) 시계만 업데이트 (스탯은 Lazy Update로 처리)
  useEffect(()=>{
    const clock= setInterval(()=> setCustomTime(new Date()),1000);
    return ()=>{
      clearInterval(clock);
    };
  },[]);

  // (3) 클라이언트 타이머: 1초마다 UI 실시간 업데이트 (Time to Evolve, Lifespan, Waste 등)
  // 주의: Firestore 쓰기는 하지 않음. 메모리 상태만 업데이트하여 UI에 반영
  useEffect(()=>{
    // 사망한 경우 타이머 중지
    if(digimonStats.isDead) {
      return;
    }

    const timer = setInterval(() => {
      // 함수형 업데이트를 사용하여 최신 상태를 참조
      setDigimonStats((prevStats) => {
        // 사망한 경우 업데이트 중지
        if(prevStats.isDead) {
          return prevStats;
        }

        // 수면 로직 (타이머 감소 전에 수면 상태 확인)
        const currentDigimonName = prevStats.evolutionStage ? 
          Object.keys(digimonDataVer1).find(key => digimonDataVer1[key]?.evolutionStage === prevStats.evolutionStage) || "Digitama" :
          "Digitama";
        const schedule = getSleepSchedule(currentDigimonName, digimonDataVer1, prevStats);
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

        // updateLifespan을 호출하여 1초 경과 처리 (lifespanSeconds, timeToEvolveSeconds, poop 등)
        // SLEEPING 상태일 때만 lifespan 증가, TIRED 상태일 때도 poopCountdown은 멈춤
        // isActuallySleeping은 SLEEPING 또는 TIRED 상태를 의미 (배고픔/힘 타이머 정지용)
        let updatedStats = updateLifespan(prevStats, 1, isActuallySleeping);
        // 매뉴얼 기반 배고픔/힘 감소 로직 적용
        const currentDigimonData = digimonDataVer1[currentDigimonName] || digimonDataVer1["Digitama"];
        // 매뉴얼 기반 배고픔/힘 감소 처리 (SLEEPING 또는 TIRED 상태일 때 감소하지 않음)
        updatedStats = handleHungerTick(updatedStats, currentDigimonData, 1, isActuallySleeping);
        updatedStats = handleStrengthTick(updatedStats, currentDigimonData, 1, isActuallySleeping);

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

        // 일자 변경 시 일일 수면 케어 미스 리셋
        const todayKey = nowDate.toDateString();
        if (updatedStats.sleepMistakeDate !== todayKey) {
          updatedStats.sleepMistakeDate = todayKey;
          updatedStats.dailySleepMistake = false;
          setDailySleepMistake(false);
        }

        // TIRED 상태 케어미스 처리 (하루 1회 제한)
        // currentSleepStatus는 위에서 이미 계산됨
        if (currentSleepStatus === "TIRED") {
          if (!updatedStats.tiredStartAt) {
            updatedStats.tiredStartAt = nowMs;
            updatedStats.tiredCounted = false;
          } else {
            const elapsed = nowMs - updatedStats.tiredStartAt;
            const threshold = developerMode ? 60 * 1000 : 30 * 60 * 1000; // 테스트 모드는 1분, 기본 30분
            // dailySleepMistake 체크 추가: 하루 1회만 증가
            if (!updatedStats.tiredCounted && 
                elapsed >= threshold && 
                !dailySleepMistake && 
                !updatedStats.dailySleepMistake) {
              updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
              updatedStats.tiredCounted = true;
              updatedStats.dailySleepMistake = true;
              setDailySleepMistake(true);
              // Activity Log 추가
              const currentLogs = updatedStats.activityLogs || [];
              updatedStats.activityLogs = addActivityLog(
                currentLogs,
                'CAREMISTAKE',
                'Care Mistake: Tired for too long'
              );
            }
          }
        } else {
          // TIRED 상태가 아니면 리셋
          updatedStats.tiredStartAt = null;
          updatedStats.tiredCounted = false;
        }

        // sleepLightOnStart는 UI 표시용으로만 사용 (케어미스 로직은 TIRED 상태 케어미스로 통합)
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

        setIsSleeping(sleepingNow);
        // 수면 상태 변경 시 애니메이션 업데이트 (부상 상태는 아래 애니메이션 우선순위 로직에서 처리)
        if (sleepingNow && !updatedStats.isInjured && !updatedStats.isDead) {
          setCurrentAnimation("sleep");
        } else if (!sleepingNow && currentAnimation === "sleep" && !updatedStats.isInjured && !updatedStats.isDead) {
          setCurrentAnimation("idle");
        }
        // 배고픔/힘이 0이고 12시간 경과 시 사망 체크
        // ⚠️ 새로운 시작 직후에는 사망 체크를 하지 않음 (lastHungerZeroAt이 null이어야 함)
        if(updatedStats.fullness === 0 && updatedStats.lastHungerZeroAt && !updatedStats.isDead){
          const elapsed = (Date.now() - updatedStats.lastHungerZeroAt) / 1000;
          if(elapsed >= 43200){ // 12시간 = 43200초
            console.log("[타이머] 굶주림 사망 체크:", { elapsed, lastHungerZeroAt: updatedStats.lastHungerZeroAt });
            updatedStats.isDead = true;
            const reason = 'STARVATION (굶주림)';
            updatedStats.deathReason = reason; // digimonStats에 저장
            setDeathReason(reason);
          }
        }
        if(updatedStats.strength === 0 && updatedStats.lastStrengthZeroAt && !updatedStats.isDead){
          const elapsed = (Date.now() - updatedStats.lastStrengthZeroAt) / 1000;
          if(elapsed >= 43200){
            console.log("[타이머] 힘 소진 사망 체크:", { elapsed, lastStrengthZeroAt: updatedStats.lastStrengthZeroAt });
            updatedStats.isDead = true;
            const reason = 'EXHAUSTION (힘 소진)';
            updatedStats.deathReason = reason; // digimonStats에 저장
            setDeathReason(reason);
          }
        }
        // 부상 과다 사망 체크: injuries >= 15
        if((updatedStats.injuries || 0) >= 15 && !updatedStats.isDead){
          updatedStats.isDead = true;
          const reason = 'INJURY OVERLOAD (부상 과다: 15회)';
          updatedStats.deathReason = reason; // digimonStats에 저장
          setDeathReason(reason);
        }
        // 부상 방치 사망 체크: isInjured 상태이고 6시간 경과
        if(updatedStats.isInjured && updatedStats.injuredAt && !updatedStats.isDead){
          const injuredTime = typeof updatedStats.injuredAt === 'number'
            ? updatedStats.injuredAt
            : new Date(updatedStats.injuredAt).getTime();
          const elapsedSinceInjury = Date.now() - injuredTime;
          if(elapsedSinceInjury >= 21600000){ // 6시간 = 21600000ms
            updatedStats.isDead = true;
            const reason = 'INJURY NEGLECT (부상 방치: 6시간)';
            updatedStats.deathReason = reason; // digimonStats에 저장
            setDeathReason(reason);
          }
        }
        // 수명 종료 체크 (lifespanSeconds가 최대치에 도달했는지 확인)
        // updateLifespan에서 처리되지만, 여기서도 확인
        const maxLifespan = currentDigimonData?.maxLifespan || 999999;
        if(updatedStats.lifespanSeconds >= maxLifespan && !updatedStats.isDead){
          updatedStats.isDead = true;
          const reason = 'OLD AGE (수명 다함)';
          updatedStats.deathReason = reason; // digimonStats에 저장
          setDeathReason(reason);
        }
        // 호출(Call) 시스템 체크 및 타임아웃 처리
        const sleepSchedule = getSleepSchedule(selectedDigimon, digimonDataVer1, prevStats);
        const oldCallStatus = { ...prevStats.callStatus };
        updatedStats = checkCalls(updatedStats, isLightsOn, sleepSchedule, new Date(), isActuallySleeping);
        // 호출 시작 로그 추가 (이전 로그 보존 - 함수형 업데이트)
        if (!oldCallStatus?.hunger?.isActive && updatedStats.callStatus?.hunger?.isActive) {
          setActivityLogs((prevLogs) => {
            const currentLogs = updatedStats.activityLogs || prevLogs || [];
            return addActivityLog(currentLogs, 'CALL', 'Call: Hungry!');
          });
        }
        if (!oldCallStatus?.strength?.isActive && updatedStats.callStatus?.strength?.isActive) {
          setActivityLogs((prevLogs) => {
            const currentLogs = updatedStats.activityLogs || prevLogs || [];
            return addActivityLog(currentLogs, 'CALL', 'Call: No Energy!');
          });
        }
        if (!oldCallStatus?.sleep?.isActive && updatedStats.callStatus?.sleep?.isActive) {
          setActivityLogs((prevLogs) => {
            const currentLogs = updatedStats.activityLogs || prevLogs || [];
            return addActivityLog(currentLogs, 'CALL', 'Call: Sleepy!');
          });
        }
        const oldCareMistakes = prevStats.careMistakes || 0;
        updatedStats = checkCallTimeouts(updatedStats, new Date(), isActuallySleeping);
        // 케어 미스 로그 추가 (호출 타임아웃) - 이전 로그 보존
        if ((updatedStats.careMistakes || 0) > oldCareMistakes) {
          const newCareMistakes = updatedStats.careMistakes || 0;
          let logText = '';
          // 배고픔 케어미스 발생 체크
          if (oldCallStatus?.hunger?.isActive && !updatedStats.callStatus?.hunger?.isActive) {
            logText = `배고픔 케어미스 발생: ${oldCareMistakes} → ${newCareMistakes}`;
          } 
          // 힘 케어미스 발생 체크
          else if (oldCallStatus?.strength?.isActive && !updatedStats.callStatus?.strength?.isActive) {
            logText = `힘 케어미스 발생: ${oldCareMistakes} → ${newCareMistakes}`;
          } 
          // 수면 케어미스 발생 체크
          else if (oldCallStatus?.sleep?.isActive && !updatedStats.callStatus?.sleep?.isActive) {
            logText = `수면 케어미스 발생: ${oldCareMistakes} → ${newCareMistakes}`;
          }
          // 위 조건에 해당하지 않지만 케어미스가 증가한 경우 (안전장치)
          else {
            logText = `케어미스 발생: ${oldCareMistakes} → ${newCareMistakes}`;
          }
          if (logText) {
            setActivityLogs((prevLogs) => {
              const currentLogs = updatedStats.activityLogs || prevLogs || [];
              return addActivityLog(currentLogs, 'CARE_MISTAKE', logText);
            });
          }
        }
        // 배변 로그 추가 (poopCount 증가 시) - 이전 로그 보존
        const oldPoopCount = prevStats.poopCount || 0;
        if ((updatedStats.poopCount || 0) > oldPoopCount) {
          const newPoopCount = updatedStats.poopCount || 0;
          let logText = `Pooped (Total: ${oldPoopCount}→${newPoopCount})`;
          if (newPoopCount === 8 && updatedStats.isInjured) {
            logText += ' - Injury: Too much poop (8 piles)';
          }
          setActivityLogs((prevLogs) => {
            const currentLogs = updatedStats.activityLogs || prevLogs || [];
            return addActivityLog(currentLogs, 'POOP', logText);
          });
        }
        // 사망 상태 변경 감지 (로그만 추가, 팝업은 자동 표시하지 않음 - Death Info 버튼으로 수동 열기)
        if(!prevStats.isDead && updatedStats.isDead && !hasSeenDeathPopup){
          // 사망 로그 추가 (이전 로그 보존 - 함수형 업데이트)
          const reason = deathReason || 'Unknown';
          setActivityLogs((prevLogs) => {
            const currentLogs = updatedStats.activityLogs || prevLogs || [];
            const updatedLogs = addActivityLog(currentLogs, 'DEATH', `Death: Passed away (Reason: ${reason})`);
            // Firestore에도 저장 (비동기 처리)
            if(slotId && currentUser){
              const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
              updateDoc(slotRef, {
                digimonStats: { ...updatedStats, activityLogs: updatedLogs },
                activityLogs: updatedLogs,
                updatedAt: new Date(),
              }).catch((error) => {
                console.error("사망 로그 저장 오류:", error);
              });
            }
            return updatedLogs;
          });
          // 팝업은 자동으로 표시하지 않음 (Death Info 버튼으로 수동 열기)
          setHasSeenDeathPopup(true);
        }
        // 메모리 상태만 업데이트 (Firestore 쓰기 없음)
        updatedStats.isLightsOn = isLightsOn;
        updatedStats.wakeUntil = wakeUntil;
        updatedStats.dailySleepMistake = dailySleepMistake;
        return updatedStats;
      });
    }, 1000);

    // 컴포넌트 언마운트 시 타이머 정리 (메모리 누수 방지)
    return () => {
      clearInterval(timer);
    };
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
    selectedDigimon,
    wakeUntil,
    setWakeUntil,
    digimonData: digimonDataVer1,
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
    checkEvolutionReady,
  } = useEvolution({
    digimonStats,
    setDigimonStats,
    setSelectedDigimon,
    setSelectedDigimonAndSave,
    setDigimonStatsAndSave,
    applyLazyUpdateBeforeAction,
    setActivityLogs,
    activityLogs,
    selectedDigimon,
    developerMode,
    setIsEvolving,
    setEvolutionStage,
    setEvolvedDigimonName,
    digimonDataVer1,
    newDigimonDataVer1,
  });

  // useDeath 훅 호출 (죽음/환생 로직)
  const {
    confirmDeath: handleDeathConfirm,
    checkDeathCondition,
  } = useDeath({
    digimonStats,
    setDigimonStatsAndSave,
    setSelectedDigimonAndSave,
    applyLazyUpdateBeforeAction,
    toggleModal,
    setHasSeenDeathPopup,
    digimonDataVer1,
    perfectStages,
  });

  const {
    startEatCycle,
    startCleanCycle,
    startHealCycle,
  } = useGameAnimations({
    digimonStats,
    setDigimonStats,
    activityLogs,
    setActivityLogs,
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
    newDigimonDataVer1,
    setHealTreatmentMessage,
    setHealModalStats,
    onSleepDisturbance: () => {
      // 수면 방해 토스트 표시
      toggleModal('sleepDisturbanceToast', true);
      setTimeout(() => toggleModal('sleepDisturbanceToast', false), 3000);
    },
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
    handleHeal: handleHealFromHook,
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
    setBattleType,
    setSparringEnemySlot,
    setClearedQuestIndex,
    setActivityLogs,
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
    digimonDataVer1,
    slotId,
    currentUser,
    mode,
    logout,
    navigate,
    setIsSleeping,
  });

async function setSelectedDigimonAndSave(name) {
    setSelectedDigimon(name);
    if (slotId && currentUser) {
      try {
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        await updateDoc(slotRef, {
          selectedDigimon: name,
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
  
  if(selectedDigimon === "Ohakadamon1" || selectedDigimon === "Ohakadamon2"){
    // 오하카다몬은 고정 스프라이트만 사용 (애니메이션 없음)
    idleFrames = [ `${digimonStats.sprite}` ];
    eatFramesArr = [ `${digimonStats.sprite}` ];
    rejectFramesArr = [ `${digimonStats.sprite}` ];
    // 오하카다몬은 애니메이션 없이 고정 스프라이트만 표시
    if(currentAnimation !== "idle"){
      setCurrentAnimation("idle");
    }
  } else {
    // 일반 디지몬: 기본 애니메이션 계산
    let idleAnimId=1, eatAnimId=2, rejectAnimId=3;
    if(selectedDigimon==="Digitama") idleAnimId=90;
    const idleOff= digimonAnimations[idleAnimId]?.frames||[0];
    const eatOff= digimonAnimations[eatAnimId]?.frames||[0];
    const rejectOff= digimonAnimations[rejectAnimId]?.frames||[14];

    idleFrames= idleOff.map(n=> `${digimonStats.sprite + n}`);
    eatFramesArr= eatOff.map(n=> `${digimonStats.sprite + n}`);
    rejectFramesArr= rejectOff.map(n=> `${digimonStats.sprite + n}`);

    // 애니메이션 우선순위: 죽음 > 부상 > 수면 > 일반
    // 죽음 상태: 모션 15번(아픔2) 사용, 스프라이트 14만 표시
    // ⚠️ 중요: 오하카다몬은 제외 (오하카다몬은 이미 환생한 상태이므로 isDead가 false여야 함)
    if(digimonStats.isDead){
      // 모션 15번 (아픔2) - 죽음 상태에서는 sprite+14만 표시
      idleFrames= [ `${digimonStats.sprite+14}` ];
      eatFramesArr= [ `${digimonStats.sprite+14}` ];
      rejectFramesArr= [ `${digimonStats.sprite+14}` ];
      // 죽음 상태에서는 항상 아픔2 모션 사용
      if(currentAnimation !== "pain2"){
        setCurrentAnimation("pain2");
      }
    }
    // 부상 상태: 모션 10번(sick) 사용, 스프라이트 13과 14 표시
    else if(digimonStats.isInjured){
      // 모션 10번 (sick) - digimonAnimations[10] = { name: "sick", frames: [13, 14] }
      // 스프라이트 13과 14를 번갈아 표시 (애니메이션 정의에 맞춤)
      idleFrames = [`${digimonStats.sprite + 13}`, `${digimonStats.sprite + 14}`];
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
    else if((sleepStatus === "SLEEPING" || sleepStatus === "TIRED") && selectedDigimon !== "Digitama"){
      idleFrames = [`${digimonStats.sprite + 11}`, `${digimonStats.sprite + 12}`];
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
      
      // 오하카다몬일 때는 확인 없이 바로 초기화
      const isOhakadamon = selectedDigimon === "Ohakadamon1" || selectedDigimon === "Ohakadamon2";
      if(!isOhakadamon && !window.confirm("정말로 초기화?")) return;
      
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
        lastMaxPoopTime: null,
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
      
      // 디지타마로 초기화 (환생 횟수는 유지, isDead와 age는 명시적으로 false/0으로 설정)
      const ns = initializeStats("Digitama", updatedStats, digimonDataVer1);
      
      // 새로운 시작이므로 isDead와 age를 명시적으로 설정
      ns.isDead = false;
      ns.age = 0;
      ns.birthTime = Date.now();
      // 새로운 시작: lastSavedAt을 현재 시간으로 설정하여 Lazy Update가 즉시 실행되지 않도록
      ns.lastSavedAt = new Date();
      // 새로운 시작: 기본 스탯 설정
      ns.fullness = 0; // 디지타마는 기본적으로 0
      ns.strength = 0; // 디지타마는 기본적으로 0
      // 새로운 시작: 사망 관련 필드 완전 초기화 (중복이지만 확실히)
      ns.lastHungerZeroAt = null;
      ns.lastStrengthZeroAt = null;
      ns.injuredAt = null;
      ns.isInjured = false;
      ns.injuries = 0;
      // 새로운 시작: 똥 초기화
      ns.poopCount = 0;
      ns.lastMaxPoopTime = null;
      
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
      
      // 로컬 상태를 즉시 업데이트 (UI 반영) - 타이머가 새로운 상태를 참조하도록
      // selectedDigimon을 먼저 업데이트하여 애니메이션 계산이 올바른 스프라이트를 사용하도록 함
      setSelectedDigimon("Digitama");
      setDigimonStats(ns);
      
      // Firestore에 저장 (saveStats에서 새로운 시작 감지하여 applyLazyUpdate 건너뜀)
      await setDigimonStatsAndSave(ns);
      await setSelectedDigimonAndSave("Digitama");
      toggleModal('deathModal', false);
      setHasSeenDeathPopup(false); // 사망 팝업 플래그 초기화
      
      console.log("[resetDigimon] 새로운 시작 완료 - 로컬 상태 및 Firestore 저장 완료");
    } catch (error) {
      console.error("[resetDigimon] 오류 발생:", error);
    }
  }

  // evo 버튼 상태 (간단하게 현재 스탯으로 확인, 실제 진화는 클릭 시 Lazy Update 적용)
  // 진화 가능 여부 확인 (현재 스탯 기준, 실제 진화 시에는 Lazy Update 적용)
  useEffect(() => {
    if(digimonStats.isDead && !developerMode) {
      setIsEvoEnabled(false);
      return;
    }
    if(developerMode) {
      setIsEvoEnabled(true);
      return;
    }
    // Data-Driven 방식: digimons.js의 evolutions 배열 사용
    const currentDigimonData = newDigimonDataVer1[selectedDigimon];
    if(currentDigimonData && currentDigimonData.evolutions){
      const evolutionResult = checkEvolution(digimonStats, currentDigimonData, selectedDigimon, newDigimonDataVer1);
      if(evolutionResult.success){
        setIsEvoEnabled(true);
        return;
      }
    }
    setIsEvoEnabled(false);
  }, [digimonStats, selectedDigimon, developerMode]);

  // 수면 상태 계산 (TIRED 케어미스는 타이머 useEffect에서 처리)
  useEffect(() => {
    const timer = setInterval(() => {
      const status = getSleepStatus({
        sleepSchedule: getSleepSchedule(selectedDigimon, digimonDataVer1, digimonStats),
        isLightsOn,
        wakeUntil,
        fastSleepStart: digimonStats.fastSleepStart || null,
        napUntil: digimonStats.napUntil || null,
        now: new Date(),
      });
      setSleepStatus(status);
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedDigimon, isLightsOn, wakeUntil, digimonStats.fastSleepStart, digimonStats.napUntil]);

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
  };

  // data 객체 생성 (GameModals에 전달할 데이터들)
  const data = {
    newDigimonDataVer1,
    digimonDataVer1,
    quests,
    seasonName,
    seasonDuration,
    ver1DigimonList,
    initializeStats,
  };

  return (
    <>
      {/* 모바일: 통합된 상단 네비게이션 바 */}
      {isMobile ? (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white bg-opacity-95 border-b border-gray-300 shadow-sm mobile-nav-bar">
          <div className="flex items-center justify-between px-3 py-2">
            {/* 왼쪽: Select 버튼 */}
            <button 
              onClick={() => navigate("/select")} 
              className="px-2 py-1.5 bg-gray-400 hover:bg-gray-500 text-white rounded text-sm pixel-art-button flex items-center gap-1"
            >
              <span>← select</span>
            </button>

            {/* 오른쪽: Settings + 프로필 */}
            <div className="flex items-center gap-2">
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
                    <span className="text-xs text-gray-700 hidden sm:inline max-w-[80px] truncate">
                      {currentUser.displayName || currentUser.email?.split('@')[0]}
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
                      <div className="absolute right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-[150px] profile-dropdown">
                        <div className="px-3 py-2 border-b border-gray-200">
                          <p className="text-xs font-semibold text-gray-700 truncate">
                            {currentUser.displayName || currentUser.email}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {currentUser.email}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            handleLogoutFromHook();
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 pixel-art-button"
                        >
                          로그아웃
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : mode === 'local' ? (
                <>
                  <span className="text-xs text-gray-600 font-semibold px-2">로컬 모드로 로그인됨</span>
                  <button
                    onClick={() => {
                      if (window.confirm("로컬 모드를 종료하고 로그인 페이지로 이동하시겠습니까?")) {
                        navigate("/");
                      }
                    }}
                    className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs pixel-art-button"
                  >
                    로컬 모드 로그아웃
                  </button>
                </>
              ) : (
                <span className="text-xs text-gray-500 px-2">localStorage</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 데스크톱: 기존 레이아웃 */}
          {/* 왼쪽 상단 UI 컨테이너 (Select 버튼) */}
          <div className="fixed top-4 left-4 z-50">
            <button 
              onClick={()=> navigate("/select")} 
              className="px-3 py-1 bg-gray-400 hover:bg-gray-500 text-white rounded pixel-art-button"
            >
              ← select
            </button>
          </div>

          {/* 우측 상단 UI 컨테이너 (Settings + 프로필) */}
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
            {/* Settings 버튼 */}
            <button
              onClick={() => toggleModal('settings', true)}
              className="px-3 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded pixel-art-button"
              title="설정"
            >
              ⚙️
            </button>
            {/* 프로필 UI (SelectScreen과 동일한 스타일) */}
            {mode === 'local' ? (
              <>
                <span className="text-sm text-gray-600 font-semibold">로컬 모드로 로그인됨</span>
                <button
                  onClick={() => {
                    if (window.confirm("로컬 모드를 종료하고 로그인 페이지로 이동하시겠습니까?")) {
                      navigate("/");
                    }
                  }}
                  className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm pixel-art-button"
                >
                  로컬 모드 로그아웃
                </button>
              </>
            ) : isFirebaseAvailable && currentUser ? (
              <>
                <div className="flex items-center space-x-2">
                  {currentUser.photoURL && (
                    <img
                      src={currentUser.photoURL}
                      alt="프로필"
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-600">{currentUser.displayName || currentUser.email}</span>
                </div>
                <button
                  onClick={handleLogoutFromHook}
                  className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm pixel-art-button"
                >
                  로그아웃
                </button>
              </>
            ) : null}
            {!isFirebaseAvailable && (
              <span className="text-sm text-gray-500">localStorage 모드</span>
            )}
          </div>
        </>
      )}

      <div className={`text-center mb-1 ${isMobile ? "pt-20" : "pt-20"}`}>
        <h2 className="text-base font-bold">
          슬롯 {slotId} - {newDigimonDataVer1[selectedDigimon]?.name || selectedDigimon}
        </h2>
        <p className="text-xs text-gray-600">슬롯 이름: {slotName} | 생성일: {slotCreatedAt}</p>
        <p className="text-xs text-gray-600">기종: {slotDevice} / 버전: {slotVersion}</p>
        <p className="text-sm font-semibold text-blue-600 mt-1">
          현재 시간: {customTime.toLocaleString('ko-KR', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          })}
        </p>
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
          />
          {/* 디지몬 상태 배지 표시 */}
          <DigimonStatusBadges
            digimonStats={digimonStats}
            sleepStatus={sleepStatus}
            isDead={digimonStats.isDead}
            currentAnimation={currentAnimation}
            feedType={feedType}
            canEvolve={isEvoEnabled}
            sleepSchedule={getSleepSchedule(selectedDigimon, digimonDataVer1, digimonStats)}
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
      <div className={`flex flex-col items-center w-full ${isMobile ? "game-screen-mobile" : ""}`}>
      <GameScreen
        width={width}
        height={height}
        backgroundNumber={backgroundNumber}
        currentAnimation={currentAnimation}
        idleFrames={idleFrames}
        eatFrames={eatFramesArr}
        foodRejectFrames={rejectFramesArr}
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
        />
      </div>

        <div className="flex items-center justify-center space-x-2 mt-1 pb-20">
      <button
        onClick={handleEvolutionButton}
            disabled={!isEvoEnabled || isEvolving}
            className={`px-4 py-2 text-white rounded pixel-art-button flex items-center justify-center ${isEvoEnabled && !isEvolving ? "bg-green-500 hover:bg-green-600" : "bg-gray-500 cursor-not-allowed"} ${isMobile ? 'evolution-button-mobile' : ''}`}
            style={{ writingMode: 'horizontal-tb', textOrientation: 'mixed' }}
      >
        <span className="whitespace-nowrap">진화!</span>
      </button>
          <button
            onClick={() => toggleModal('digimonInfo', true)}
            className={`px-3 py-2 text-white bg-blue-500 rounded pixel-art-button hover:bg-blue-600 flex items-center justify-center gap-1 ${isMobile ? 'guide-button-mobile' : ''}`}
            title="디지몬 가이드"
            style={{ writingMode: 'horizontal-tb', textOrientation: 'mixed' }}
          >
            <span>📖</span>
            <span className="whitespace-nowrap">가이드</span>
          </button>
          {/* Death Info 버튼: 죽었을 때만 표시 */}
          {digimonStats.isDead && (
            <button
              onClick={() => toggleModal('deathModal', true)}
              className="px-4 py-2 text-white bg-red-800 rounded pixel-art-button hover:bg-red-900 flex items-center justify-center"
              title="사망 정보"
              style={{ writingMode: 'horizontal-tb', textOrientation: 'mixed' }}
            >
              <span className="whitespace-nowrap">💀 사망 확인</span>
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
          sleepSchedule: getSleepSchedule(selectedDigimon, digimonDataVer1, digimonStats),
          sleepStatus: sleepStatus,
          wakeUntil: wakeUntil,
          sleepLightOnStart: digimonStats.sleepLightOnStart || null,
        }}
        flags={{ developerMode, setDeveloperMode, isEvolving, setIsEvolving, mode }}
      />
      )}
    </>
  );
}

export default Game;
