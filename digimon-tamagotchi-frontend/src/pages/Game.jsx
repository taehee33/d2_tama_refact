// src/pages/Game.jsx
import React, { useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { getSleepStatus, checkCalls, resetCallStatus, checkCallTimeouts } from "../hooks/useGameLogic";

import GameScreen from "../components/GameScreen";
import ControlPanel from "../components/ControlPanel";
import StatsPopup from "../components/StatsPopup";
import FeedPopup from "../components/FeedPopup";
import SettingsModal from "../components/SettingsModal";

import BattleSelectionModal from "../components/BattleSelectionModal";
import BattleScreen from "../components/BattleScreen";
import QuestSelectionModal from "../components/QuestSelectionModal";
import CommunicationModal from "../components/CommunicationModal";
import SparringModal from "../components/SparringModal";
import ArenaScreen from "../components/ArenaScreen";
import AdminModal from "../components/AdminModal";
import DeathPopup from "../components/DeathPopup";
import DigimonInfoModal from "../components/DigimonInfoModal";
import HealModal from "../components/HealModal";
import { initializeActivityLogs, addActivityLog } from "../hooks/useGameLogic";
import { useGameActions } from "../hooks/useGameActions";
import { useGameState } from "../hooks/useGameState";
import { useGameData } from "../hooks/useGameData";
import { useEvolution } from "../hooks/useEvolution";
import { useDeath } from "../hooks/useDeath";
import { quests } from "../data/v1/quests";

import digimonAnimations from "../data/digimonAnimations";
import { initializeStats, applyLazyUpdate, updateLifespan } from "../data/stats";
// 새 데이터 구조 import
import { digimonDataVer1 as newDigimonDataVer1 } from "../data/v1/digimons";
import { adaptDataMapToOldFormat } from "../data/v1/adapter";
// Deprecated: evolutionConditionsVer1은 더 이상 사용하지 않음 (Data-Driven 방식으로 전환)
// import { evolutionConditionsVer1 } from "../data/evolution_digitalmonstercolor25th_ver1";
// 매뉴얼 기반 스탯 로직 import
import { handleHungerTick } from "../logic/stats/hunger";
import { feedMeat, willRefuseMeat } from "../logic/food/meat";
import { handleStrengthTick } from "../logic/stats/strength";
import { feedProtein, willRefuseProtein } from "../logic/food/protein";
// 매뉴얼 기반 진화 판정 로직 import
import { checkEvolution, findEvolutionTarget } from "../logic/evolution/checker";
// 훈련 로직 (Ver1) import
import { doVer1Training } from "../data/train_digitalmonstercolor25th_ver1";
import TrainPopup from "../components/TrainPopup";
// 배틀 부상 확률 계산 import
import { calculateInjuryChance } from "../logic/battle/calculator"; 

// 호환성을 위해 새 데이터를 옛날 형식으로 변환
const digimonDataVer1 = adaptDataMapToOldFormat(newDigimonDataVer1);
// Arena 시즌 관리 상수 (기본값)
const DEFAULT_SEASON_ID = 1;

// 디버깅: 새 데이터가 제대로 import되었는지 확인
if (process.env.NODE_ENV === 'development') {
  console.log('[Game.jsx] 새 데이터 import 확인:', {
    'newDigimonDataVer1 키 개수': Object.keys(newDigimonDataVer1).length,
    '변환된 digimonDataVer1 키 개수': Object.keys(digimonDataVer1).length,
    '새 데이터 Botamon 예시': newDigimonDataVer1['Botamon'],
    '변환된 데이터 Botamon 예시': digimonDataVer1['Botamon'],
  });
} 

// 예시: Ver1 디지몬 목록
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

// 시간 포맷
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

  // 수면 스케줄 체크
  const getSleepSchedule = (name) => {
    const data = digimonDataVer1[name] || {};
    return data.sleepSchedule || { start: 22, end: 6 };
  };

  const isWithinSleepSchedule = (schedule, nowDate = new Date()) => {
    const hour = nowDate.getHours();
    const { start, end } = schedule || { start: 22, end: 6 };
    if (start === end) return false;
    if (start < end) {
      return hour >= start && hour < end;
    }
    // 자정 넘김
    return hour >= start || hour < end;
  };

// 수면 중 인터랙션 시 10분 깨우기 + 수면방해 카운트
function wakeForInteraction(digimonStats, setWakeUntilCb, setStatsCb) {
  const until = Date.now() + 10 * 60 * 1000; // 10분
  setWakeUntilCb(until);
  const updated = {
    ...digimonStats,
    wakeUntil: until,
    sleepDisturbances: (digimonStats.sleepDisturbances || 0) + 1,
  };
  // 수면 방해 로그는 호출하는 쪽에서 추가 (액션별로 다른 메시지)
  setStatsCb(updated);
}

function Game(){
  const { slotId } = useParams();
  const { currentUser, logout, isFirebaseAvailable } = useAuth();
  // useGameState 훅 호출
  const {
    gameState,
    modals,
    setModals,
    toggleModal,
    closeAllModals,
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
  } = flags;

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
    isLoading: isLoadingData,
    error: dataError,
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
        console.error('Sprite settings 저장 오류:', error);
      }
    };
    saveSpriteSettings(width, height);
  }, [width, height]);

  // Arena 시즌 설정 로드
  useEffect(()=>{
    if(!slotId) {
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
        const schedule = getSleepSchedule(currentDigimonName);
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
        const sleepSchedule = getSleepSchedule(selectedDigimon);
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


  async function setSelectedDigimonAndSave(name){
    setSelectedDigimon(name);
    if(slotId && currentUser){
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

  async function eatCycle(step,type){
    const frameCount= (type==="protein"?3:4);
    if(step>=frameCount){
      setCurrentAnimation("idle");
      toggleModal('food', false);
      // 최신 스탯 가져오기
      const currentStats = await applyLazyUpdateBeforeAction();
      const oldFullness = currentStats.fullness || 0;
      const oldWeight = currentStats.weight || 0;
      const oldStrength = currentStats.strength || 0;
      const oldEnergy = currentStats.energy || 0;
      const oldOverfeeds = currentStats.overfeeds || 0;
      const oldHungerCountdown = currentStats.hungerCountdown || 0;
      const oldProteinCount = currentStats.proteinCount || 0;
      const oldProteinOverdose = currentStats.proteinOverdose || 0;
      
      // 먹이기 로직 실행 (결과 객체도 함께 받음)
      let eatResult;
      let updatedStats;
      if (type === "meat") {
        eatResult = feedMeat(currentStats);
        updatedStats = eatResult.updatedStats;
      } else {
        eatResult = feedProtein(currentStats);
        updatedStats = eatResult.updatedStats;
      }
      
      // 호출 해제: fullness > 0이 되면 hunger 호출 리셋
      if (updatedStats.fullness > 0) {
        updatedStats = resetCallStatus(updatedStats, 'hunger');
      }
      // 단백질을 먹었고 strength > 0이 되면 strength 호출 리셋
      if (type === "protein" && updatedStats.strength > 0) {
        updatedStats = resetCallStatus(updatedStats, 'strength');
      }
      
      // 상세 Activity Log 추가 (변경값 + 결과값 모두 포함)
      const newFullness = updatedStats.fullness || 0;
      const newWeight = updatedStats.weight || 0;
      const newStrength = updatedStats.strength || 0;
      const newEnergy = updatedStats.energy || 0;
      const newOverfeeds = updatedStats.overfeeds || 0;
      const newHungerCountdown = updatedStats.hungerCountdown || 0;
      const newProteinCount = updatedStats.proteinCount || 0;
      const newProteinOverdose = updatedStats.proteinOverdose || 0;
      
      // 델타 계산
      const weightDelta = newWeight - oldWeight;
      const fullnessDelta = newFullness - oldFullness;
      const strengthDelta = newStrength - oldStrength;
      const energyDelta = newEnergy - oldEnergy;
      const overfeedsDelta = newOverfeeds - oldOverfeeds;
      const hungerCountdownDelta = newHungerCountdown - oldHungerCountdown;
      
      let logText = '';
      if (type === "meat") {
        if (eatResult.isOverfeed) {
          // 오버피드 발생 시: "Overfeed! Hunger drop delayed (Wt +1g)"
          const hungerCycleMinutes = Math.floor(hungerCountdownDelta / 60);
          logText = `Overfeed! Hunger drop delayed (Wt +${weightDelta}g, HungerCycle +${hungerCycleMinutes}min)`;
        } else if (newOverfeeds > oldOverfeeds) {
          logText = `Overfeed: Stuffed! (Wt +${weightDelta}g, Hun +${fullnessDelta}, Overfeed +${overfeedsDelta}) => (Wt ${oldWeight}→${newWeight}g, Hun ${oldFullness}→${newFullness}, Overfeed ${oldOverfeeds}→${newOverfeeds})`;
        } else {
          logText = `Feed: Meat (Wt +${weightDelta}g, Hun +${fullnessDelta}) => (Wt ${oldWeight}→${newWeight}g, Hun ${oldFullness}→${newFullness})`;
        }
      } else {
        // Protein 로그: Strength는 항상 표시
        // Strength가 증가했는지 확인
        const strengthChanged = strengthDelta > 0;
        const strengthText = strengthChanged ? `, Str +${strengthDelta}` : '';
        // Strength 결과는 항상 표시 (변화가 없어도)
        const strengthResultText = `, Str ${oldStrength}→${newStrength}`;
        
        if (eatResult.energyRestored) {
          // 4회 보너스 발생 시
          const energyText = energyDelta > 0 ? `, En +${energyDelta}` : '';
          const energyResultText = energyDelta > 0 ? `, En ${oldEnergy}→${newEnergy}` : '';
          logText = `Feed: Protein (Wt +${weightDelta}g${strengthText}${energyText}) - Protein Bonus! (En +1, Overdose +1) => (Wt ${oldWeight}→${newWeight}g${strengthResultText}${energyResultText})`;
        } else {
          logText = `Feed: Protein (Wt +${weightDelta}g${strengthText}) => (Wt ${oldWeight}→${newWeight}g${strengthResultText})`;
        }
      }
      // Activity Log 추가: 최신 상태를 확실히 가져와서 누적
      // updatedStats에 activityLogs가 없을 수 있으므로 여러 소스 확인
      const currentLogs = updatedStats.activityLogs || activityLogs || [];
      const updatedLogs = addActivityLog(currentLogs, 'FEED', logText);
      
      // updatedStats에 activityLogs 포함하여 저장
      const statsWithLogs = {
        ...updatedStats,
        activityLogs: updatedLogs,
      };
      
      setDigimonStatsAndSave(statsWithLogs, updatedLogs);
      return;
    }
    setCurrentAnimation("eat");
    setFeedStep(step);
    setTimeout(()=> eatCycle(step+1,type),500);
  }
  function applyEatResult(old,type){
    // 매뉴얼 기반 먹이기 로직 사용
    if(type==="meat"){
      const result = feedMeat(old);
      return result.updatedStats;
    } else {
      const result = feedProtein(old);
      return result.updatedStats;
    }
  }

  // 똥 청소
  async function cleanCycle(step){
    if(step>3){
      toggleModal('poopCleanAnimation', false);
      setCleanStep(0);
      const now = new Date();
      const oldPoopCount = digimonStats.poopCount || 0;
      const wasInjured = digimonStats.isInjured || false;
      
      const updatedStats = {
        ...digimonStats,
        poopCount: 0,
        lastMaxPoopTime: null,
        isInjured: false, // 똥 청소 시 부상 상태 해제
        lastSavedAt: now
      };
      
      // Activity Log 추가 (함수형 업데이트)
      let logText = `Cleaned Poop (Full flush, ${oldPoopCount} → 0)`;
      if (wasInjured) {
        logText += ' - Injury healed!';
      }
      
      setDigimonStats(updatedStats);
      setActivityLogs((prevLogs) => {
        const currentLogs = updatedStats.activityLogs || prevLogs || [];
        const updatedLogs = addActivityLog(currentLogs, 'CLEAN', logText);
        // Firestore에도 저장 (비동기 처리)
        if(slotId && currentUser){
          const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
          updateDoc(slotRef, {
            digimonStats: { ...updatedStats, activityLogs: updatedLogs },
            isLightsOn,
            wakeUntil,
            activityLogs: updatedLogs,
            lastSavedAt: now,
            updatedAt: now,
          }).catch((error) => {
            console.error("청소 상태 저장 오류:", error);
          });
        }
        return updatedLogs;
      });
      return;
    }
    setCleanStep(step);
    setTimeout(()=> cleanCycle(step+1), 400);
  }

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

  // 메뉴 클릭 (train 버튼 시)
  const handleMenuClick = (menu)=>{
    // 수면 중 인터랙션 시 10분 깨우고 sleepDisturbances 증가
    const schedule = getSleepSchedule(selectedDigimon);
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
        console.log("menu:", menu);
    }
  };

  // 치료(Heal) 액션
  async function handleHeal() {
    const updatedStats = await applyLazyUpdateBeforeAction();
    if (updatedStats.isDead) return;
    
    // 수면 중 치료 시도 시 수면 방해 처리
    const schedule = getSleepSchedule(selectedDigimon);
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
  }
  
  // 치료 모달에서 실제 치료 실행
  async function executeHeal() {
    const updatedStats = await applyLazyUpdateBeforeAction();
    if (updatedStats.isDead || !updatedStats.isInjured) {
      toggleModal('heal', false);
      return;
    }
    
    // 치료 연출 시작
    toggleModal('heal', true);
    setHealStep(0);
    healCycle(0, updatedStats);
  }
  
  async function healCycle(step, currentStats) {
    if (step >= 1) {
      toggleModal('heal', false);
      setHealStep(0);
      
      // 치료 로직
      const currentDigimonData = newDigimonDataVer1[selectedDigimon] || {};
      const requiredDoses = currentDigimonData.stats?.healDoses || 1; // 기본값 1
      const newHealedDoses = (currentStats.healedDosesCurrent || 0) + 1;
      
      let updatedStats = {
        ...currentStats,
        healedDosesCurrent: newHealedDoses,
      };
      
      // 필요 치료 횟수 충족 시 완전 회복
      if (newHealedDoses >= requiredDoses) {
        updatedStats.isInjured = false;
        updatedStats.injuredAt = null;
        updatedStats.healedDosesCurrent = 0;
        
        const updatedLogs = addActivityLog(updatedStats.activityLogs || [], 'HEAL', 'Fully Healed!');
        setDigimonStatsAndSave({ ...updatedStats, activityLogs: updatedLogs }, updatedLogs);
        // 모달은 유지하되 상태 업데이트 (완치 메시지 표시)
      } else {
        const updatedLogs = addActivityLog(updatedStats.activityLogs || [], 'HEAL', `Need more medicine... (${newHealedDoses}/${requiredDoses})`);
        setDigimonStatsAndSave({ ...updatedStats, activityLogs: updatedLogs }, updatedLogs);
        // 모달은 유지하되 상태 업데이트 (진행 중 메시지 표시)
      }
      
      // 스탯 업데이트하여 모달이 최신 상태를 반영하도록 함
      setDigimonStats(updatedStats);
      return;
    }
    
    setHealStep(step);
    setTimeout(() => healCycle(step + 1, currentStats), 500);
  }

  // 수면 상태 계산 및 TIRED 케어미스 처리
  useEffect(() => {
    const timer = setInterval(() => {
      const status = getSleepStatus({
        sleepSchedule: getSleepSchedule(selectedDigimon),
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
  const handleQuestStart = () => {
    // 퀘스트 선택 모달 표시
    toggleModal('questSelection', true);
  };

  const handleSelectArea = (areaId) => {
    setCurrentQuestArea(areaId);
    setCurrentQuestRound(0);
    toggleModal('questSelection', false);
    setBattleType('quest');
    setSparringEnemySlot(null);
    toggleModal('battleScreen', true);
  };

  // Communication 시작 핸들러
  const handleCommunicationStart = () => {
    toggleModal('communication', true);
  };

  // Sparring 시작 핸들러
  const handleSparringStart = () => {
    toggleModal('sparring', true);
  };

  // Arena 시작 핸들러
  const handleArenaStart = () => {
    toggleModal('arenaScreen', true);
  };

  // Arena 배틀 시작 핸들러
  const handleArenaBattleStart = (challenger, myEntryId = null) => {
    if (!challenger.id) {
      console.error("Arena Challenger에 Document ID가 없습니다:", challenger);
      alert("배틀을 시작할 수 없습니다. Challenger 데이터에 문제가 있습니다.");
      return;
    }
    console.log("Arena 배틀 시작:", { challengerId: challenger.id, challenger, myEntryId });
    setArenaChallenger(challenger);
    setArenaEnemyId(challenger.id); // 상대방의 Document ID 저장
    setMyArenaEntryId(myEntryId); // 내 디지몬의 Document ID 저장
    setBattleType('arena');
    setCurrentQuestArea(null);
    setCurrentQuestRound(0);
    toggleModal('battleScreen', true);
    toggleModal('arenaScreen', false); // ArenaScreen 닫기
  };

  // Sparring 슬롯 선택 핸들러
  const handleSparringSlotSelect = (enemySlot) => {
    setSparringEnemySlot(enemySlot);
    setBattleType('sparring');
    setCurrentQuestArea(null);
    setCurrentQuestRound(0);
    toggleModal('battleScreen', true);
  };

  const handleQuestComplete = () => {
    // 현재 깬 Area가 clearedQuestIndex와 같으면 다음 Area 해금
    const currentAreaIndex = quests.findIndex(q => q.areaId === currentQuestArea);
    if (currentAreaIndex === clearedQuestIndex) {
      setClearedQuestIndex(prev => prev + 1);
    }
  };

  // 조명 토글: 상태 및 Firestore 동기화
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

  // Admin 설정 반영 콜백
  const handleAdminConfigUpdated = (config) => {
    if (config.currentSeasonId) setCurrentSeasonId(config.currentSeasonId);
    if (config.seasonName) setSeasonName(config.seasonName);
    if (config.seasonDuration) setSeasonDuration(config.seasonDuration);
  };

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
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error("로그아웃 오류:", err);
    }
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
              onClick={handleLogout}
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

      <div className="text-center mb-1">
        <h2 className="text-base font-bold">
          슬롯 {slotId} - {selectedDigimon}
        </h2>
        <p className="text-xs text-gray-600">슬롯 이름: {slotName} | 생성일: {slotCreatedAt}</p>
        <p className="text-xs text-gray-600">기종: {slotDevice} / 버전: {slotVersion}</p>
      </div>
      <div className="flex flex-col items-center w-full">
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

      {modals.deathModal && (
        <DeathPopup
          isOpen={modals.deathModal}
          onConfirm={handleDeathConfirm}
          onClose={() => toggleModal('deathModal', false)}
          reason={deathReason}
        />
      )}

      <div className="mt-1 text-sm text-center">
        <p className="text-xs">Time to Evolve: {formatTimeToEvolve(digimonStats.timeToEvolveSeconds)}</p>
        <p className="text-xs">Lifespan: {formatLifespan(digimonStats.lifespanSeconds)}</p>
        <p className="text-xs">Current Time: {customTime.toLocaleString()}</p>
      </div>

      <div className="flex justify-center w-full">
      <ControlPanel
        width={width}
        height={height}
        activeMenu={activeMenu}
        onMenuClick={handleMenuClick}
        stats={digimonStats}
        sleepStatus={sleepStatus}
      />
      </div>


      {modals.stats && (
        <StatsPopup
          stats={digimonStats}
          digimonData={newDigimonDataVer1[selectedDigimon || (digimonStats.evolutionStage ? 
            Object.keys(newDigimonDataVer1).find(key => newDigimonDataVer1[key]?.stage === digimonStats.evolutionStage) : 
            "Digitama")]}
          onClose={()=> toggleModal('stats', false)}
          devMode={developerMode}
          onChangeStats={(ns)=> setDigimonStatsAndSave(ns)}
        />
      )}

      {modals.feed && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <FeedPopup
            onClose={()=> toggleModal('feed', false)}
            onSelect={(foodType)=>{
              toggleModal('feed', false);
              handleFeedFromHook(foodType);
            }}
          />
        </div>
      )}

      {modals.settings && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <SettingsModal
            onClose={()=> toggleModal('settings', false)}
            developerMode={developerMode}
            setDeveloperMode={setDeveloperMode}
            width={width}
            height={height}
            setWidth={setWidth}
            setHeight={setHeight}
            backgroundNumber={backgroundNumber}
            setBackgroundNumber={setBackgroundNumber}
            timeSpeed={timeSpeed}
            setTimeSpeed={setTimeSpeed}
            customTime={customTime}
            setCustomTime={setCustomTime}
            foodSizeScale={foodSizeScale}
            setFoodSizeScale={setFoodSizeScale}
          />
        </div>
      )}

      {developerMode && slotVersion==="Ver.1" && (
        <div className="mt-1 p-2 border">
          <label className="mr-1">Dev Digimon Select:</label>
          <select
            onChange={(e)=>{
              const nm= e.target.value;
              if(!digimonDataVer1[nm]){
                console.error(`No data for ${nm}`);
                const fallback= initializeStats("Digitama", digimonStats, digimonDataVer1);
                setDigimonStatsAndSave(fallback);
                setSelectedDigimonAndSave("Digitama");
                return;
              }
              const old= {...digimonStats};
              const nx= initializeStats(nm, old, digimonDataVer1);
              setDigimonStatsAndSave(nx);
              setSelectedDigimonAndSave(nm);
            }}
            defaultValue={selectedDigimon}
          >
            {ver1DigimonList.map(d=>(
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}

      {/* ★ (D) 훈련 팝업 */}
      {modals.train && (
        <TrainPopup
          onClose={()=> toggleModal('train', false)}
          digimonStats={digimonStats}
          setDigimonStatsAndSave={setDigimonStatsAndSave}
          onTrainResult={handleTrainResultFromHook}
        />
      )}

      {/* 배틀 모드 선택 모달 */}
      {modals.battleSelection && (
        <BattleSelectionModal
          onClose={() => toggleModal('battleSelection', false)}
          onQuestStart={handleQuestStart}
          onCommunicationStart={handleCommunicationStart}
        />
      )}

      {/* Communication 모달 */}
      {modals.communication && (
        <CommunicationModal
          onClose={() => toggleModal('communication', false)}
          onSparringStart={handleSparringStart}
          onArenaStart={handleArenaStart}
        />
      )}

      {/* Arena Screen */}
      {modals.arenaScreen && (
        <ArenaScreen
          onClose={() => toggleModal('arenaScreen', false)}
          onStartBattle={handleArenaBattleStart}
          currentSlotId={parseInt(slotId)}
          mode={mode}
          currentSeasonId={currentSeasonId}
          isDevMode={developerMode}
          onOpenAdmin={() => toggleModal('admin', true)}
        />
      )}

      {/* Sparring 모달 */}
      {modals.sparring && (
        <SparringModal
          onClose={() => toggleModal('sparring', false)}
          onSelectSlot={handleSparringSlotSelect}
          currentSlotId={parseInt(slotId)}
          mode={mode}
        />
      )}

      {/* 퀘스트 선택 모달 */}
      {modals.questSelection && (
        <QuestSelectionModal
          quests={quests}
          clearedQuestIndex={clearedQuestIndex}
          onSelectArea={handleSelectArea}
          onClose={() => toggleModal('questSelection', false)}
        />
      )}

      {/* 배틀 스크린 */}
      {modals.battleScreen && (currentQuestArea || battleType === 'sparring' || battleType === 'arena') && (
        <BattleScreen
          userDigimon={newDigimonDataVer1[selectedDigimon] || {
            id: selectedDigimon,
            name: selectedDigimon,
            stats: digimonDataVer1[selectedDigimon] || {},
          }}
          userStats={digimonStats}
          userSlotName={slotName || `슬롯${slotId}`}
          areaId={currentQuestArea}
          roundIndex={currentQuestRound}
          battleType={battleType}
          sparringEnemySlot={sparringEnemySlot}
          arenaChallenger={arenaChallenger}
          onBattleComplete={handleBattleCompleteFromHook}
          onQuestClear={handleQuestComplete}
          onClose={() => {
            toggleModal('battleScreen', false);
            setCurrentQuestArea(null);
            setCurrentQuestRound(0);
            
            // Arena 모드일 때는 Arena 화면으로 복귀
            if (battleType === 'arena') {
              toggleModal('arenaScreen', true);
            }
            
            setBattleType(null);
            setSparringEnemySlot(null);
            setArenaChallenger(null);
            setArenaEnemyId(null);
            setMyArenaEntryId(null);
          }}
        />
      )}

      {/* Admin Modal (Dev 모드에서만 표시) */}
      {developerMode && modals.admin && (
        <AdminModal
          onClose={() => toggleModal('admin', false)}
          currentSeasonId={currentSeasonId}
          seasonName={seasonName}
          seasonDuration={seasonDuration}
          onConfigUpdated={handleAdminConfigUpdated}
        />
      )}

      {/* Digimon Info Modal */}
      {modals.digimonInfo && (
        <DigimonInfoModal
          currentDigimonName={selectedDigimon || (digimonStats.evolutionStage ? 
            Object.keys(newDigimonDataVer1).find(key => newDigimonDataVer1[key]?.stage === digimonStats.evolutionStage) : 
            "Digitama")}
          currentDigimonData={newDigimonDataVer1[selectedDigimon || (digimonStats.evolutionStage ? 
            Object.keys(newDigimonDataVer1).find(key => newDigimonDataVer1[key]?.stage === digimonStats.evolutionStage) : 
            "Digitama")]}
          currentStats={digimonStats}
          digimonDataMap={newDigimonDataVer1}
          activityLogs={activityLogs}
          onClose={() => toggleModal('digimonInfo', false)}
        />
      )}

      {/* Heal Modal */}
      {modals.heal && (
        <HealModal
          isInjured={digimonStats.isInjured || false}
          currentDoses={digimonStats.healedDosesCurrent || 0}
          requiredDoses={newDigimonDataVer1[selectedDigimon]?.stats?.healDoses || 1}
          onHeal={executeHeal}
          onClose={() => toggleModal('heal', false)}
        />
      )}

      {/* 진화 애니메이션 완료 메시지 */}
      {evolutionStage === 'complete' && evolvedDigimonName && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
          <div className="bg-yellow-400 border-4 border-yellow-600 rounded-lg p-8 text-center pixel-art-modal">
            <h2 className="text-3xl font-bold text-black mb-2 pixel-art-text"> 🎉 디지몬 진화~~! 🎉</h2>
            <p className="text-2xl font-bold text-black mb-6 pixel-art-text"> 🎉 {evolvedDigimonName} 🎉 </p>
            <button
              onClick={() => {
                setEvolutionStage('idle');
                setEvolvedDigimonName(null);
                setIsEvolving(false);
              }}
              className="px-6 py-3 bg-green-500 text-white font-bold rounded pixel-art-button hover:bg-green-600"
            >
              확인
            </button>
    </div>
        </div>
      )}
    </div>
    </>
  );
}


export default Game;