import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

import ControlPanel from "../components/ControlPanel";
import GameModals from "../components/GameModals";
import GameScreen from "../components/GameScreen";

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

  const { tiredStartRef, tiredCountedRef } = refs;

  // useGameData 훅 호출 (데이터 저장/로딩 로직)
  const {
    saveStats: setDigimonStatsAndSave,
    applyLazyUpdate: applyLazyUpdateBeforeAction,
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
  });

  const meatSprites= ["/images/526.png","/images/527.png","/images/528.png","/images/529.png"];
  const proteinSprites= ["/images/530.png","/images/531.png","/images/532.png"];

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

        // updateLifespan을 호출하여 1초 경과 처리 (lifespanSeconds, timeToEvolveSeconds, poop 등)
        let updatedStats = updateLifespan(prevStats, 1);
        // 매뉴얼 기반 배고픔/힘 감소 로직 적용
        // prevStats에서 evolutionStage를 통해 디지몬 데이터 찾기
        const currentDigimonName = prevStats.evolutionStage ? 
          Object.keys(digimonDataVer1).find(key => digimonDataVer1[key]?.evolutionStage === prevStats.evolutionStage) || "Digitama" :
          "Digitama";
        const currentDigimonData = digimonDataVer1[currentDigimonName] || digimonDataVer1["Digitama"];
        // 매뉴얼 기반 배고픔/힘 감소 처리
        updatedStats = handleHungerTick(updatedStats, currentDigimonData, 1);
        updatedStats = handleStrengthTick(updatedStats, currentDigimonData, 1);

        // 수면 로직
        updatedStats.sleepDisturbances = updatedStats.sleepDisturbances || 0;
        const schedule = getSleepSchedule(currentDigimonName, digimonDataVer1);
        const nowMs = Date.now();
        const nowDate = new Date(nowMs);
        const inSchedule = isWithinSleepSchedule(schedule, nowDate);
        const wakeOverride = wakeUntil && nowMs < wakeUntil;
        const sleepingNow = inSchedule && !wakeOverride;

        // 일자 변경 시 일일 수면 케어 미스 리셋
        const todayKey = nowDate.toDateString();
        if (updatedStats.sleepMistakeDate !== todayKey) {
          updatedStats.sleepMistakeDate = todayKey;
          updatedStats.dailySleepMistake = false;
          setDailySleepMistake(false);
        }

        if (sleepingNow && isLightsOn) {
          if (!updatedStats.sleepLightOnStart) {
            updatedStats.sleepLightOnStart = nowMs;
          } else {
            const elapsed = nowMs - updatedStats.sleepLightOnStart;
            if (elapsed >= 30 * 60 * 1000 && !dailySleepMistake && !updatedStats.dailySleepMistake) {
              updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
              updatedStats.dailySleepMistake = true;
              setDailySleepMistake(true);
              updatedStats.sleepLightOnStart = nowMs;
            }
          }
        } else {
          updatedStats.sleepLightOnStart = null;
        }

        setIsSleeping(sleepingNow);
        if (sleepingNow) {
          setCurrentAnimation("sleep");
        } else if (currentAnimation === "sleep") {
          setCurrentAnimation("idle");
        }
        // 배고픔/힘이 0이고 12시간 경과 시 사망 체크
        if(updatedStats.fullness === 0 && updatedStats.lastHungerZeroAt){
          const elapsed = (Date.now() - updatedStats.lastHungerZeroAt) / 1000;
          if(elapsed >= 43200){ // 12시간 = 43200초
            updatedStats.isDead = true;
            setDeathReason('STARVATION (굶주림)');
          }
        }
        if(updatedStats.strength === 0 && updatedStats.lastStrengthZeroAt){
          const elapsed = (Date.now() - updatedStats.lastStrengthZeroAt) / 1000;
          if(elapsed >= 43200){
            updatedStats.isDead = true;
            setDeathReason('EXHAUSTION (힘 소진)');
          }
        }
        // 부상 과다 사망 체크: injuries >= 15
        if((updatedStats.injuries || 0) >= 15 && !updatedStats.isDead){
          updatedStats.isDead = true;
          setDeathReason('INJURY OVERLOAD (부상 과다: 15회)');
        }
        // 부상 방치 사망 체크: isInjured 상태이고 6시간 경과
        if(updatedStats.isInjured && updatedStats.injuredAt && !updatedStats.isDead){
          const injuredTime = typeof updatedStats.injuredAt === 'number'
            ? updatedStats.injuredAt
            : new Date(updatedStats.injuredAt).getTime();
          const elapsedSinceInjury = Date.now() - injuredTime;
          if(elapsedSinceInjury >= 21600000){ // 6시간 = 21600000ms
            updatedStats.isDead = true;
            setDeathReason('INJURY NEGLECT (부상 방치: 6시간)');
          }
        }
        // 수명 종료 체크 (lifespanSeconds가 최대치에 도달했는지 확인)
        // updateLifespan에서 처리되지만, 여기서도 확인
        const maxLifespan = currentDigimonData?.maxLifespan || 999999;
        if(updatedStats.lifespanSeconds >= maxLifespan && !updatedStats.isDead){
          updatedStats.isDead = true;
          setDeathReason('OLD AGE (수명 다함)');
        }
        // 호출(Call) 시스템 체크 및 타임아웃 처리
        const sleepSchedule = getSleepSchedule(selectedDigimon, digimonDataVer1);
        const oldCallStatus = { ...prevStats.callStatus };
        updatedStats = checkCalls(updatedStats, isLightsOn, sleepSchedule, new Date());
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
        updatedStats = checkCallTimeouts(updatedStats, new Date());
        // 케어 미스 로그 추가 (호출 타임아웃) - 이전 로그 보존
        if ((updatedStats.careMistakes || 0) > oldCareMistakes) {
          const mistakesAdded = (updatedStats.careMistakes || 0) - oldCareMistakes;
          let logText = '';
          if (oldCallStatus?.hunger?.isActive && !updatedStats.callStatus?.hunger?.isActive) {
            logText = `Care Mistake: Ignored Hunger Call (${mistakesAdded} mistake${mistakesAdded > 1 ? 's' : ''})`;
          } else if (oldCallStatus?.strength?.isActive && !updatedStats.callStatus?.strength?.isActive) {
            logText = `Care Mistake: Ignored Strength Call (${mistakesAdded} mistake${mistakesAdded > 1 ? 's' : ''})`;
          } else if (oldCallStatus?.sleep?.isActive && !updatedStats.callStatus?.sleep?.isActive) {
            logText = `Care Mistake: Lights left on (${mistakesAdded} mistake${mistakesAdded > 1 ? 's' : ''})`;
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
        // 사망 상태 변경 감지 (한 번만 자동으로 팝업 표시)
        if(!prevStats.isDead && updatedStats.isDead && !hasSeenDeathPopup){
          toggleModal('deathModal', true);
          setHasSeenDeathPopup(true);
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
    selectedDigimon,
    newDigimonDataVer1,
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
    handleCleanPoopFromHook,
    startHealCycle,
    quests,
    digimonDataVer1,
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
  let idleAnimId=1, eatAnimId=2, rejectAnimId=3;
  if(selectedDigimon==="Digitama") idleAnimId=90;
  const idleOff= digimonAnimations[idleAnimId]?.frames||[0];
  const eatOff= digimonAnimations[eatAnimId]?.frames||[0];
  const rejectOff= digimonAnimations[rejectAnimId]?.frames||[14];

  let idleFrames= idleOff.map(n=> `${digimonStats.sprite + n}`);
  let eatFramesArr= eatOff.map(n=> `${digimonStats.sprite + n}`);
  let rejectFramesArr= rejectOff.map(n=> `${digimonStats.sprite + n}`);

  // 수면/피곤 상태에서는 고정 슬립 프레임
  if(sleepStatus === "SLEEPING" || sleepStatus === "TIRED"){
    idleFrames = [`${digimonStats.sprite + 12}`, `${digimonStats.sprite + 13}`];
    eatFramesArr = idleFrames;
    rejectFramesArr = idleFrames;
  }

  if(digimonStats.isDead){
    idleFrames= [ `${digimonStats.sprite+15}` ];
    eatFramesArr= [ `${digimonStats.sprite+15}` ];
    rejectFramesArr= [ `${digimonStats.sprite+15}` ];
  }

  // 먹이 - Lazy Update 적용 후 Firestore에 저장

  // 똥 청소

  // ★ (C) 훈련

  // 리셋
  async function resetDigimon(){
    if(!window.confirm("정말로 초기화?")) return;
    const ns = initializeStats("Digitama", {}, digimonDataVer1);
    await setDigimonStatsAndSave(ns);
    await setSelectedDigimonAndSave("Digitama");
    toggleModal('deathModal', false);
    setHasSeenDeathPopup(false); // 사망 팝업 플래그 초기화
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

  // 수면 상태 계산 및 TIRED 케어미스 처리
  useEffect(() => {
    const timer = setInterval(() => {
      const status = getSleepStatus({
        sleepSchedule: getSleepSchedule(selectedDigimon, digimonDataVer1),
        isLightsOn,
        wakeUntil,
        now: new Date(),
      });
      setSleepStatus(status);

      if (status === "TIRED") {
        if (!tiredStartRef.current) {
          tiredStartRef.current = Date.now();
          tiredCountedRef.current = false;
        }
        const threshold = developerMode ? 60 * 1000 : 30 * 60 * 1000; // 테스트 모드는 1분, 기본 30분
        if (!tiredCountedRef.current && tiredStartRef.current && (Date.now() - tiredStartRef.current) >= threshold) {
          tiredCountedRef.current = true;
          // Activity Log 추가
          const currentLogs = digimonStats.activityLogs || activityLogs || [];
          const updatedLogs = addActivityLog(currentLogs, 'CAREMISTAKE', 'Care Mistake: Tired for too long');
          setDigimonStatsAndSave({
            ...digimonStats,
            careMistakes: (digimonStats.careMistakes || 0) + 1,
            activityLogs: updatedLogs,
          }, updatedLogs);
        }
      } else {
        tiredStartRef.current = null;
        tiredCountedRef.current = false;
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedDigimon, isLightsOn, wakeUntil, developerMode, digimonStats]);

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
      {/* 왼쪽 상단 UI 컨테이너 (Select 화면 버튼) */}
      <div className="fixed top-4 left-4 z-50">
        <button 
          onClick={()=> navigate("/select")} 
          className="px-3 py-1 bg-gray-400 hover:bg-gray-500 text-white rounded pixel-art-button"
        >
          ← Select 화면
        </button>
      </div>

      {/* 우측 상단 UI 컨테이너 (Settings + 프로필) */}
      <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 ${isMobile ? "settings-button-mobile" : ""}`}>
        {/* Settings 버튼 */}
        <button
          onClick={() => toggleModal('settings', true)}
          className="px-3 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded pixel-art-button"
          title="설정"
        >
          ⚙️
        </button>
        {/* 프로필 UI (SelectScreen과 동일한 스타일) */}
        {isFirebaseAvailable && currentUser && (
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
        )}
        {!isFirebaseAvailable && (
          <span className="text-sm text-gray-500">localStorage 모드</span>
        )}
      </div>

      <div className={`text-center mb-1 ${isMobile ? "pt-20" : ""}`}>
        <h2 className="text-base font-bold">
          슬롯 {slotId} - {selectedDigimon}
        </h2>
        <p className="text-xs text-gray-600">슬롯 이름: {slotName} | 생성일: {slotCreatedAt}</p>
        <p className="text-xs text-gray-600">기종: {slotDevice} / 버전: {slotVersion}</p>
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
        evolutionStage={evolutionStage}
        developerMode={developerMode}
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

        <div className="flex items-center justify-center space-x-2 mt-1">
      <button
        onClick={handleEvolutionButton}
            disabled={!isEvoEnabled || isEvolving}
            className={`px-4 py-2 text-white rounded pixel-art-button ${isEvoEnabled && !isEvolving ? "bg-green-500 hover:bg-green-600" : "bg-gray-500 cursor-not-allowed"}`}
      >
        Evolution
      </button>
          <button
            onClick={() => toggleModal('digimonInfo', true)}
            className="px-3 py-2 text-white bg-blue-500 rounded pixel-art-button hover:bg-blue-600"
            title="Digimon Info"
          >
            ❓
          </button>
          {digimonStats.isDead && (
            <button
              onClick={() => toggleModal('deathModal', true)}
              className="px-4 py-2 text-white bg-red-800 rounded pixel-art-button hover:bg-red-900"
              title="사망 정보"
            >
              💀 Death Info
            </button>
          )}
        </div>
      </div>

      {modals && toggleModal && gameState && handlers && data && ui && (
      <GameModals
        modals={modals}
        toggleModal={toggleModal}
        gameState={gameState}
        handlers={handlers}
        data={data}
        ui={ui}
        flags={{ developerMode, setDeveloperMode, isEvolving, setIsEvolving, mode }}
      />
      )}
    </>
  );
}

export default Game;
