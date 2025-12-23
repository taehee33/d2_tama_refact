// src/pages/Game.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../firebase";
import { getSleepStatus, checkCalls, resetCallStatus, checkCallTimeouts } from "../hooks/useGameLogic";

import Canvas from "../components/Canvas";
import StatsPanel from "../components/StatsPanel";
import StatsPopup from "../components/StatsPopup";
import FeedPopup from "../components/FeedPopup";
import SettingsModal from "../components/SettingsModal";
import MenuIconButtons from "../components/MenuIconButtons";
import BattleSelectionModal from "../components/BattleSelectionModal";
import BattleScreen from "../components/BattleScreen";
import QuestSelectionModal from "../components/QuestSelectionModal";
import CommunicationModal from "../components/CommunicationModal";
import SparringModal from "../components/SparringModal";
import ArenaScreen from "../components/ArenaScreen";
import AdminModal from "../components/AdminModal";
import DeathPopup from "../components/DeathPopup";
import DigimonInfoModal from "../components/DigimonInfoModal";
import { initializeActivityLogs, addActivityLog } from "../hooks/useGameLogic";
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
import { handleStrengthTick, feedProtein, willRefuseProtein } from "../logic/stats/strength";
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
  const navigate= useNavigate();
  const { currentUser, logout, isFirebaseAvailable } = useAuth();
  const mode = 'firebase';

  const [selectedDigimon, setSelectedDigimon]= useState("Digitama");
  const [digimonStats, setDigimonStats]= useState(
    initializeStats("Digitama", {}, digimonDataVer1)
  );

  // 사망확인
  const [showDeathConfirm, setShowDeathConfirm]= useState(false);
  const [deathReason, setDeathReason] = useState(null);
  const [isDeathModalOpen, setIsDeathModalOpen] = useState(false); // 사망 모달 표시 여부
  const [hasSeenDeathPopup, setHasSeenDeathPopup] = useState(false); // 사망 팝업이 자동으로 한 번 떴는지 체크

  // 슬롯 정보
  const [slotName, setSlotName]= useState("");
  const [slotCreatedAt, setSlotCreatedAt]= useState("");
  const [slotDevice, setSlotDevice]= useState("");
  const [slotVersion, setSlotVersion]= useState("");

  // Canvas/UI
  const [width, setWidth]= useState(300);
  const [height, setHeight]= useState(200);
  const [backgroundNumber, setBackgroundNumber]= useState(162);
  const [currentAnimation, setCurrentAnimation]= useState("idle");

  // 팝업
  const [showStatsPopup, setShowStatsPopup]= useState(false);
  const [showFeedPopup, setShowFeedPopup]= useState(false);
  const [showSettingsModal, setShowSettingsModal]= useState(false);
  const [activeMenu, setActiveMenu]= useState(null);

  const [developerMode, setDeveloperMode]= useState(false);

  // 시간
  const [customTime, setCustomTime]= useState(new Date());
  const [timeSpeed, setTimeSpeed]= useState(1);

  // feed
  const [feedType, setFeedType]= useState(null);
  const [showFood, setShowFood]= useState(false);
  const [feedStep, setFeedStep]= useState(0);
  const [foodSizeScale, setFoodSizeScale]= useState(0.31);

  const meatSprites= ["/images/526.png","/images/527.png","/images/528.png","/images/529.png"];
  const proteinSprites= ["/images/530.png","/images/531.png","/images/532.png"];

  // (A) 청소 애니
  const [showPoopCleanAnimation, setShowPoopCleanAnimation]= useState(false);
  const [cleanStep, setCleanStep]= useState(0);

  // ★ (B) 훈련 팝업
  const [showTrainPopup, setShowTrainPopup]= useState(false);

  // 배틀 관련 상태
  const [showBattleSelectionModal, setShowBattleSelectionModal] = useState(false);
  const [showBattleScreen, setShowBattleScreen] = useState(false);
  const [currentQuestArea, setCurrentQuestArea] = useState(null);
  const [currentQuestRound, setCurrentQuestRound] = useState(0);
  const [clearedQuestIndex, setClearedQuestIndex] = useState(0); // 0이면 Area 1 도전 가능, 1이면 Area 2 해금...
  const [showQuestSelectionModal, setShowQuestSelectionModal] = useState(false);
  const [showCommunicationModal, setShowCommunicationModal] = useState(false);
  const [showSparringModal, setShowSparringModal] = useState(false);
  const [showArenaScreen, setShowArenaScreen] = useState(false);
  const [battleType, setBattleType] = useState(null); // 'quest' | 'sparring' | 'arena'
  const [sparringEnemySlot, setSparringEnemySlot] = useState(null); // 스파링 상대 슬롯 정보
  const [arenaChallenger, setArenaChallenger] = useState(null); // Arena 챌린저 정보
  const [arenaEnemyId, setArenaEnemyId] = useState(null); // Arena Enemy Entry ID (Firestore Document ID)
  const [myArenaEntryId, setMyArenaEntryId] = useState(null); // 내 Arena Entry ID
  const [currentSeasonId, setCurrentSeasonId] = useState(DEFAULT_SEASON_ID);
  const [seasonName, setSeasonName] = useState(`Season ${DEFAULT_SEASON_ID}`);
  const [seasonDuration, setSeasonDuration] = useState("");

  // Admin Modal
  const [showAdminModal, setShowAdminModal] = useState(false);

  // 수면/조명 상태
  const [isLightsOn, setIsLightsOn] = useState(true);
  const [wakeUntil, setWakeUntil] = useState(null);
  const [dailySleepMistake, setDailySleepMistake] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [sleepStatus, setSleepStatus] = useState("AWAKE"); // 'AWAKE' | 'TIRED' | 'SLEEPING'

  // 진화 애니메이션 상태
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionStage, setEvolutionStage] = useState('idle'); // 'idle' | 'shaking' | 'flashing' | 'complete'
  const [evolvedDigimonName, setEvolvedDigimonName] = useState(null); // 진화된 디지몬 이름
  const [showDigimonInfo, setShowDigimonInfo] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const tiredStartRef = useRef(null);
  const tiredCountedRef = useRef(false);

  // 치료 애니메이션 상태
  const [showHealAnimation, setShowHealAnimation] = useState(false);
  const [healStep, setHealStep] = useState(0);

  // 호출(Call) 팝업 상태
  const [showCallModal, setShowCallModal] = useState(false);
  // 호출(Call) Toast 상태
  const [showCallToast, setShowCallToast] = useState(false);
  const [callToastMessage, setCallToastMessage] = useState("");

  // 로딩 상태 관리
  const [isLoadingSlot, setIsLoadingSlot] = useState(true);

  // (1) SLOT LOAD - Firestore에서 슬롯 데이터 로드
  useEffect(()=>{
    if(!slotId) {
      setIsLoadingSlot(false);
      return;
    }

    // Arena 시즌 설정 로드
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
    
    // Firebase 모드인데 로그인 안 되어 있으면 리디렉션
    if(!isFirebaseAvailable || !currentUser) {
      setIsLoadingSlot(false);
      navigate("/");
      return;
    }

    const loadSlot = async () => {
      setIsLoadingSlot(true);
      try {
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        const slotSnap = await getDoc(slotRef);
        
        if(slotSnap.exists()) {
          const slotData = slotSnap.data();
          
          setSlotName(slotData.slotName || `슬롯${slotId}`);
          setSlotCreatedAt(slotData.createdAt || "");
          setSlotDevice(slotData.device || "");
          setSlotVersion(slotData.version || "Ver.1");
          setIsLightsOn(slotData.isLightsOn !== undefined ? slotData.isLightsOn : true);
          setWakeUntil(slotData.wakeUntil || null);
          if (slotData.dailySleepMistake !== undefined) setDailySleepMistake(slotData.dailySleepMistake);
          
          // Activity Logs 로드
          const logs = initializeActivityLogs(slotData.activityLogs);
          setActivityLogs(logs);

          const savedName = slotData.selectedDigimon || "Digitama";
          let savedStats = slotData.digimonStats || {};
          
          if(Object.keys(savedStats).length === 0){
            const ns = initializeStats("Digitama", {}, digimonDataVer1);
        setSelectedDigimon("Digitama");
        setDigimonStats(ns);
      } else {
            const lastSavedAt = slotData.lastSavedAt || slotData.updatedAt || new Date();
            savedStats = applyLazyUpdate(savedStats, lastSavedAt);
            
        setSelectedDigimon(savedName);
            setDigimonStats(savedStats);
            
            await updateDoc(slotRef, {
              digimonStats: savedStats,
              lastSavedAt: savedStats.lastSavedAt,
              updatedAt: new Date(),
            });
      }
    } else {
          const ns = initializeStats("Digitama", {}, digimonDataVer1);
      setSelectedDigimon("Digitama");
      setDigimonStats(ns);
          setSlotName(`슬롯${slotId}`);
        }
      } catch (error) {
        console.error("슬롯 로드 오류:", error);
        const ns = initializeStats("Digitama", {}, digimonDataVer1);
        setSelectedDigimon("Digitama");
        setDigimonStats(ns);
      } finally {
        setIsLoadingSlot(false);
      }
    };

    loadSlot();
  },[slotId, currentUser, navigate, isFirebaseAvailable]);

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
        
        // 호출 시작 로그 추가
        if (!oldCallStatus?.hunger?.isActive && updatedStats.callStatus?.hunger?.isActive) {
          const updatedLogs = addActivityLog(activityLogs, 'CALL', 'Call: Hungry!');
          setActivityLogs(updatedLogs);
        }
        if (!oldCallStatus?.strength?.isActive && updatedStats.callStatus?.strength?.isActive) {
          const updatedLogs = addActivityLog(activityLogs, 'CALL', 'Call: No Energy!');
          setActivityLogs(updatedLogs);
        }
        if (!oldCallStatus?.sleep?.isActive && updatedStats.callStatus?.sleep?.isActive) {
          const updatedLogs = addActivityLog(activityLogs, 'CALL', 'Call: Sleepy!');
          setActivityLogs(updatedLogs);
        }
        
        const oldCareMistakes = prevStats.careMistakes || 0;
        updatedStats = checkCallTimeouts(updatedStats, new Date());
        
        // 케어 미스 로그 추가 (호출 타임아웃)
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
            const updatedLogs = addActivityLog(activityLogs, 'CARE_MISTAKE', logText);
            setActivityLogs(updatedLogs);
          }
        }
        
        // 배변 로그 추가 (poopCount 증가 시)
        const oldPoopCount = prevStats.poopCount || 0;
        if ((updatedStats.poopCount || 0) > oldPoopCount) {
          const newPoopCount = updatedStats.poopCount || 0;
          let logText = `Pooped (Total: ${oldPoopCount}→${newPoopCount})`;
          if (newPoopCount === 8 && updatedStats.isInjured) {
            logText += ' - Injury: Too much poop (8 piles)';
          }
          const updatedLogs = addActivityLog(activityLogs, 'POOP', logText);
          setActivityLogs(updatedLogs);
        }
        
        // 사망 상태 변경 감지 (한 번만 자동으로 팝업 표시)
        if(!prevStats.isDead && updatedStats.isDead && !hasSeenDeathPopup){
          setIsDeathModalOpen(true);
          setHasSeenDeathPopup(true);
          // 사망 로그 추가
          const reason = deathReason || 'Unknown';
          const updatedLogs = addActivityLog(activityLogs, 'DEATH', `Death: Passed away (Reason: ${reason})`);
          setActivityLogs(updatedLogs);
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

  async function setDigimonStatsAndSave(newStats, updatedLogs = null){
    const baseStats = await applyLazyUpdateBeforeAction();
    const now = new Date();
    const finalStats = {
      ...baseStats,
      ...newStats,
      isLightsOn,
      wakeUntil,
      dailySleepMistake,
      lastSavedAt: now,
    };

    setDigimonStats(finalStats);
    
    // Activity Logs 업데이트
    if (updatedLogs !== null) {
      setActivityLogs(updatedLogs);
    }

    if(slotId && currentUser){
      try {
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        const updateData = {
          digimonStats: finalStats,
          isLightsOn,
          wakeUntil,
          lastSavedAt: finalStats.lastSavedAt,
          updatedAt: now,
        };
        
        // Activity Logs 저장
        if (updatedLogs !== null) {
          updateData.activityLogs = updatedLogs;
        }
        
        await updateDoc(slotRef, updateData);
      } catch (error) {
        console.error("스탯 저장 오류:", error);
      }
    }
  }

  // 액션 전에 Lazy Update 적용하는 헬퍼 함수 (Firestore 전용)
  async function applyLazyUpdateBeforeAction() {
    if(!slotId || !currentUser) {
      return digimonStats;
    }

    try {
      const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
      const slotSnap = await getDoc(slotRef);
      
      if(slotSnap.exists()) {
        const slotData = slotSnap.data();
        const lastSavedAt = slotData.lastSavedAt || slotData.updatedAt || digimonStats.lastSavedAt;
        const updated = applyLazyUpdate(digimonStats, lastSavedAt);
        
        // 사망 상태 변경 감지
        if(!digimonStats.isDead && updated.isDead){
          if(updated.fullness === 0 && updated.lastHungerZeroAt){
            const elapsed = (Date.now() - updated.lastHungerZeroAt) / 1000;
            if(elapsed >= 43200){
              setDeathReason('STARVATION (굶주림)');
            }
          } else if(updated.strength === 0 && updated.lastStrengthZeroAt){
            const elapsed = (Date.now() - updated.lastStrengthZeroAt) / 1000;
            if(elapsed >= 43200){
              setDeathReason('EXHAUSTION (힘 소진)');
            }
          } else if((updated.injuries || 0) >= 15){
            setDeathReason('INJURY OVERLOAD (부상 과다: 15회)');
          } else if(updated.isInjured && updated.injuredAt){
            const injuredTime = typeof updated.injuredAt === 'number'
              ? updated.injuredAt
              : new Date(updated.injuredAt).getTime();
            const elapsedSinceInjury = Date.now() - injuredTime;
            if(elapsedSinceInjury >= 21600000){
              setDeathReason('INJURY NEGLECT (부상 방치: 6시간)');
            }
          } else {
            setDeathReason('OLD AGE (수명 다함)');
          }
          if(!hasSeenDeathPopup){
            setIsDeathModalOpen(true);
            setHasSeenDeathPopup(true);
          }
        }
        
        return updated;
      }
    } catch (error) {
      console.error("Lazy Update 적용 오류:", error);
    }

    return digimonStats;
  }
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

  // 진화
  async function handleEvolutionButton(){
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    setDigimonStats(updatedStats);
    
    if(updatedStats.isDead && !developerMode) return;
    
    // 현재 디지몬 데이터 가져오기 (새 데이터 구조 사용 - evolutionCriteria 포함)
    // selectedDigimon이 없으면 evolutionStage를 통해 찾기
    const digimonName = selectedDigimon || (updatedStats.evolutionStage ? 
      Object.keys(newDigimonDataVer1).find(key => newDigimonDataVer1[key]?.stage === updatedStats.evolutionStage) : 
      "Digitama");
    
    const currentDigimonData = newDigimonDataVer1[digimonName];
    if(!currentDigimonData) {
      console.error(`No data for ${digimonName} in newDigimonDataVer1!`);
      console.error('Available keys:', Object.keys(newDigimonDataVer1));
      console.error('selectedDigimon:', selectedDigimon);
      console.error('evolutionStage:', updatedStats.evolutionStage);
      return;
    }
    
    if(developerMode) {
      // 개발자 모드: 시간 조건만 무시하고 다른 조건은 체크
      // 시간 조건을 임시로 0으로 설정하여 체크
      const statsForCheck = {
        ...updatedStats,
        timeToEvolveSeconds: 0, // 시간 조건만 무시
      };
      const evolutionResult = checkEvolution(statsForCheck, currentDigimonData, digimonName, newDigimonDataVer1);
      
      if(evolutionResult.success) {
        const targetId = evolutionResult.targetId;
        const targetData = newDigimonDataVer1[targetId];
        const evolvedName = targetData?.name || targetData?.id || targetId;
        setEvolvedDigimonName(evolvedName);
        setEvolutionStage('complete');
        await handleEvolution(targetId);
      } else {
        alert(`진화 조건을 만족하지 못했습니다!\n\n${evolutionResult.details?.map(d => `${d.target}: ${d.missing}`).join('\n') || evolutionResult.reason}`);
      }
        return;
      }
    
    // 매뉴얼 기반 진화 판정 (상세 결과 객체 반환)
    // Data-Driven 방식: digimons.js의 evolutions 배열을 직접 사용
    const evolutionResult = checkEvolution(updatedStats, currentDigimonData, digimonName, newDigimonDataVer1);
    
    if(evolutionResult.success) {
      // 진화 성공 - 애니메이션 시작
      const targetId = evolutionResult.targetId;
      // targetName 찾기 (Fallback 처리) - 새 데이터 사용
      const targetData = newDigimonDataVer1[targetId];
      const targetName = targetData?.name || targetData?.id || targetId;
      
      // 진화 애니메이션 시작
      setIsEvolving(true);
      setEvolutionStage('shaking');
      
      // Step 1: Shaking (2초)
      setTimeout(() => {
        setEvolutionStage('flashing');
        
        // Step 2: Flashing (2초)
        setTimeout(() => {
          setEvolutionStage('complete');
          
          // Step 3: Complete - 실제 진화 처리
          setTimeout(async () => {
            // 진화된 디지몬 이름 저장
            const targetData = newDigimonDataVer1[targetId];
            const evolvedName = targetData?.name || targetData?.id || targetId;
            setEvolvedDigimonName(evolvedName);
            await handleEvolution(targetId);
            setIsEvolving(false);
            // evolutionStage는 'complete'로 유지하여 확인 버튼을 눌러야만 닫히도록 함
          }, 500);
        }, 2000);
      }, 2000);
    } else if(evolutionResult.reason === "NOT_READY") {
      // 시간 부족
      const remainingSeconds = evolutionResult.remainingTime;
      const mm = Math.floor(remainingSeconds / 60);
      const ss = Math.floor(remainingSeconds % 60);
      alert(`아직 진화할 준비가 안 됐어!\n\n남은 시간: ${mm}분 ${ss}초`);
    } else if(evolutionResult.reason === "CONDITIONS_UNMET") {
      // 조건 부족
      const detailsText = evolutionResult.details
        .map(d => `• ${d.target}: ${d.missing}`)
        .join("\n");
      alert(`진화 조건을 만족하지 못했어!\n\n[부족한 조건]\n${detailsText}`);
    }
  }
  
  async function handleEvolution(newName){
    if(!digimonDataVer1[newName]){
      console.error(`No data for ${newName} in digimonDataVer1! fallback => Digitama`);
      newName="Digitama";
    }
    const currentStats = await applyLazyUpdateBeforeAction();
    const old={...currentStats};
    
    // 진화 시 스탯 리셋 (매뉴얼 규칙)
    // careMistakes, overfeeds, battlesForEvolution, proteinOverdose, injuries 등은 initializeStats에서 리셋됨
    // 하지만 여기서 명시적으로 리셋하여 확실히 함
    const resetStats = {
      ...old,
      careMistakes: 0,
      overfeeds: 0,
      battlesForEvolution: 0,
      proteinOverdose: 0,
      injuries: 0,
      trainings: 0,
      sleepDisturbances: 0,
      trainings: 0,
    };
    
    const nx= initializeStats(newName, resetStats, digimonDataVer1);
    const newDigimonData = digimonDataVer1[newName] || {};
    const newDigimonName = newDigimonData.name || newName;
    const updatedLogs = addActivityLog(activityLogs, 'EVOLUTION', `Evolution: Evolved to ${newDigimonName}!`);
    await setDigimonStatsAndSave(nx, updatedLogs);
    await setSelectedDigimonAndSave(newName);
  }

  async function handleDeathConfirm(){
    // 최신 스탯 가져오기
    const currentStats = await applyLazyUpdateBeforeAction();
    
    let ohaka="Ohakadamon1";
    if(perfectStages.includes(currentStats.evolutionStage)){
      ohaka="Ohakadamon2";
    }
    if(!digimonDataVer1[ohaka]){
      console.error(`No data for ${ohaka} in digimonDataVer1!? fallback => Digitama`);
      ohaka="Digitama";
    }
    const old= {...currentStats};
    const nx= initializeStats(ohaka, old, digimonDataVer1);
    await setDigimonStatsAndSave(nx);
    await setSelectedDigimonAndSave(ohaka);
    setIsDeathModalOpen(false);
    setHasSeenDeathPopup(false); // 사망 팝업 플래그 초기화
    setDeathReason(null); // 사망 원인 초기화
  }

  // 먹이 - Lazy Update 적용 후 Firestore에 저장
  async function handleFeed(type){
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    if(updatedStats.isDead) return;
    
    // 수면 중 먹이 시도 시 수면 방해 처리
    const schedule = getSleepSchedule(selectedDigimon);
    const nowSleeping = isWithinSleepSchedule(schedule, new Date()) && !(wakeUntil && Date.now() < wakeUntil);
    if (nowSleeping) {
      wakeForInteraction(updatedStats, setWakeUntil, setDigimonStatsAndSave);
      const updatedLogs = addActivityLog(activityLogs, 'CARE_MISTAKE', 'Disturbed Sleep! (Wake +10m, Mistake +1)');
      setDigimonStatsAndSave({ ...updatedStats, sleepDisturbances: (updatedStats.sleepDisturbances || 0) + 1 }, updatedLogs);
    }
    
    // 업데이트된 스탯으로 작업
    setDigimonStats(updatedStats);
    
    // 매뉴얼 기반 거부 체크
    if(type==="meat"){
      if(willRefuseMeat(updatedStats)){
        setCurrentAnimation("foodRejectRefuse");
        setShowFood(false);
        setFeedStep(0);
        const updatedLogs = addActivityLog(activityLogs, 'FEED', 'Feed: Refused (Already stuffed)');
        setDigimonStatsAndSave(updatedStats, updatedLogs);
        setTimeout(()=> setCurrentAnimation("idle"),2000);
        return;
      }
    } else {
      if(willRefuseProtein(updatedStats)){
        setCurrentAnimation("foodRejectRefuse");
        setShowFood(false);
        setFeedStep(0);
        const updatedLogs = addActivityLog(activityLogs, 'FEED', 'Feed: Refused (Already stuffed)');
        setDigimonStatsAndSave(updatedStats, updatedLogs);
        setTimeout(()=> setCurrentAnimation("idle"),2000);
        return;
      }
    }
    setFeedType(type);
    setShowFood(true);
    setFeedStep(0);
    eatCycle(0, type);
  }
  async function eatCycle(step,type){
    const frameCount= (type==="protein"?3:4);
    if(step>=frameCount){
      setCurrentAnimation("idle");
      setShowFood(false);
      // 최신 스탯 가져오기
      const currentStats = await applyLazyUpdateBeforeAction();
      const oldFullness = currentStats.fullness || 0;
      const oldWeight = currentStats.weight || 0;
      const oldStrength = currentStats.strength || 0;
      const oldEnergy = currentStats.energy || 0;
      const oldOverfeeds = currentStats.overfeeds || 0;
      
      let updatedStats = applyEatResult(currentStats, type);
      
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
      
      // 델타 계산
      const weightDelta = newWeight - oldWeight;
      const fullnessDelta = newFullness - oldFullness;
      const strengthDelta = newStrength - oldStrength;
      const energyDelta = newEnergy - oldEnergy;
      const overfeedsDelta = newOverfeeds - oldOverfeeds;
      
      let logText = '';
      if (type === "meat") {
        if (newOverfeeds > oldOverfeeds) {
          logText = `Overfeed: Stuffed! (Wt +${weightDelta}g, Hun +${fullnessDelta}, Overfeed +${overfeedsDelta}) => (Wt ${oldWeight}→${newWeight}g, Hun ${oldFullness}→${newFullness}, Overfeed ${oldOverfeeds}→${newOverfeeds})`;
        } else {
          logText = `Feed: Meat (Wt +${weightDelta}g, Hun +${fullnessDelta}) => (Wt ${oldWeight}→${newWeight}g, Hun ${oldFullness}→${newFullness})`;
        }
      } else {
        const energyText = energyDelta > 0 ? `, En +${energyDelta}` : '';
        const energyResultText = newEnergy > oldEnergy ? `, En ${oldEnergy}→${newEnergy}` : '';
        logText = `Feed: Protein (Wt +${weightDelta}g, Str +${strengthDelta}${energyText}) => (Wt ${oldWeight}→${newWeight}g, Str ${oldStrength}→${newStrength}${energyResultText})`;
      }
      const updatedLogs = addActivityLog(activityLogs, 'FEED', logText);
      
      setDigimonStatsAndSave(updatedStats, updatedLogs);
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
  async function handleCleanPoop(){
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    if(updatedStats.poopCount<=0){
      return;
    }
    setDigimonStats(updatedStats);
    setShowPoopCleanAnimation(true);
    setCleanStep(0);
    cleanCycle(0);
  }
  async function cleanCycle(step){
    if(step>3){
      setShowPoopCleanAnimation(false);
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
      
      // Activity Log 추가
      let logText = `Cleaned Poop (Full flush, ${oldPoopCount} → 0)`;
      if (wasInjured) {
        logText += ' - Injury healed!';
      }
      const updatedLogs = addActivityLog(activityLogs, 'CLEAN', logText);
      
      setDigimonStats(updatedStats);
      if(slotId && currentUser){
        try {
          const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
          await updateDoc(slotRef, {
            digimonStats: updatedStats,
            isLightsOn,
            wakeUntil,
            activityLogs: updatedLogs,
            lastSavedAt: now,
            updatedAt: now,
          });
          setActivityLogs(updatedLogs);
        } catch (error) {
          console.error("청소 상태 저장 오류:", error);
        }
      }
      return;
    }
    setCleanStep(step);
    setTimeout(()=> cleanCycle(step+1), 400);
  }

  // ★ (C) 훈련
  async function handleTrainResult(userSelections){
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    
    // 수면 중 훈련 시도 시 수면 방해 처리
    const schedule = getSleepSchedule(selectedDigimon);
    const nowSleeping = isWithinSleepSchedule(schedule, new Date()) && !(wakeUntil && Date.now() < wakeUntil);
    if (nowSleeping) {
      wakeForInteraction(updatedStats, setWakeUntil, setDigimonStatsAndSave);
      const updatedLogs = addActivityLog(activityLogs, 'CARE_MISTAKE', 'Disturbed Sleep! (Wake +10m, Mistake +1)');
      setDigimonStatsAndSave({ ...updatedStats, sleepDisturbances: (updatedStats.sleepDisturbances || 0) + 1 }, updatedLogs);
    }
    
    setDigimonStats(updatedStats);
    
    // 에너지 부족 체크
    if ((updatedStats.energy || 0) <= 0) {
      const updatedLogs = addActivityLog(activityLogs, 'TRAIN', 'Training: Skipped (Not enough Energy)');
      setDigimonStatsAndSave(updatedStats, updatedLogs);
      return;
    }
    
    // userSelections: 길이5의 "U"/"D" 배열
    // doVer1Training -> stats 업데이트
    const oldWeight = updatedStats.weight || 0;
    const oldStrength = updatedStats.strength || 0;
    const oldEnergy = updatedStats.energy || 0;
    
    const result= doVer1Training(updatedStats, userSelections);
    let finalStats = result.updatedStats;
    
    // 호출 해제: strength > 0이 되면 strength 호출 리셋
    if (finalStats.strength > 0) {
      finalStats = resetCallStatus(finalStats, 'strength');
    }
    
    // 상세 Activity Log 추가 (변경값 + 결과값 모두 포함)
    const newWeight = finalStats.weight || 0;
    const newStrength = finalStats.strength || 0;
    const newEnergy = finalStats.energy || 0;
    
    // 델타 계산
    const weightDelta = newWeight - oldWeight;
    const strengthDelta = newStrength - oldStrength;
    const energyDelta = newEnergy - oldEnergy;
    
    let logText = '';
    if (result.isSuccess) {
      logText = `Training: Success (Str +${strengthDelta}, Wt ${weightDelta}g, En ${energyDelta}) => (Str ${oldStrength}→${newStrength}, Wt ${oldWeight}→${newWeight}g, En ${oldEnergy}→${newEnergy})`;
    } else {
      logText = `Training: Fail (Wt ${weightDelta}g, En ${energyDelta}) => (Wt ${oldWeight}→${newWeight}g, En ${oldEnergy}→${newEnergy})`;
    }
    const updatedLogs = addActivityLog(activityLogs, 'TRAIN', logText);
    
    setDigimonStatsAndSave(finalStats, updatedLogs);
    // 그냥 콘솔
    console.log("훈련 결과:", result);
  }

  // 리셋
  async function resetDigimon(){
    if(!window.confirm("정말로 초기화?")) return;
    const ns = initializeStats("Digitama", {}, digimonDataVer1);
    await setDigimonStatsAndSave(ns);
    await setSelectedDigimonAndSave("Digitama");
    setIsDeathModalOpen(false);
    setHasSeenDeathPopup(false); // 사망 팝업 플래그 초기화
  }

  // evo 버튼 상태 (간단하게 현재 스탯으로 확인, 실제 진화는 클릭 시 Lazy Update 적용)
  const [isEvoEnabled, setIsEvoEnabled] = useState(false);
  
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
        setShowFeedPopup(true);
        break;
      case "status":
        setShowStatsPopup(true);
        break;
      case "bathroom":
        handleCleanPoop();
        break;
      case "train":
        setShowTrainPopup(true);
        break;
      case "battle":
        setShowBattleSelectionModal(true);
        break;
      case "heal":
        handleHeal();
        break;
      case "callSign":
        setShowCallModal(true);
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
    
    // 부상이 없으면 치료 불가
    if (!updatedStats.isInjured) {
      const updatedLogs = addActivityLog(updatedStats.activityLogs || [], 'HEAL', 'Not injured!');
      setDigimonStatsAndSave({ ...updatedStats, activityLogs: updatedLogs }, updatedLogs);
      alert("Not injured!");
      return;
    }
    
    // 치료 연출 시작
    setShowHealAnimation(true);
    setHealStep(0);
    healCycle(0, updatedStats);
  }
  
  async function healCycle(step, currentStats) {
    if (step >= 1) {
      setShowHealAnimation(false);
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
        alert("Fully Healed!");
      } else {
        const updatedLogs = addActivityLog(updatedStats.activityLogs || [], 'HEAL', `Need more medicine... (${newHealedDoses}/${requiredDoses})`);
        setDigimonStatsAndSave({ ...updatedStats, activityLogs: updatedLogs }, updatedLogs);
      }
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
          const updatedLogs = addActivityLog(activityLogs, 'CAREMISTAKE', 'Care Mistake: Tired for too long');
          
          setDigimonStatsAndSave({
            ...digimonStats,
            careMistakes: (digimonStats.careMistakes || 0) + 1,
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
    setShowQuestSelectionModal(true);
  };

  const handleSelectArea = (areaId) => {
    setCurrentQuestArea(areaId);
    setCurrentQuestRound(0);
    setShowQuestSelectionModal(false);
    setBattleType('quest');
    setSparringEnemySlot(null);
    setShowBattleScreen(true);
  };

  // Communication 시작 핸들러
  const handleCommunicationStart = () => {
    setShowCommunicationModal(true);
  };

  // Sparring 시작 핸들러
  const handleSparringStart = () => {
    setShowSparringModal(true);
  };

  // Arena 시작 핸들러
  const handleArenaStart = () => {
    setShowArenaScreen(true);
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
    setShowBattleScreen(true);
    setShowArenaScreen(false); // ArenaScreen 닫기
  };

  // Sparring 슬롯 선택 핸들러
  const handleSparringSlotSelect = (enemySlot) => {
    setSparringEnemySlot(enemySlot);
    setBattleType('sparring');
    setCurrentQuestArea(null);
    setCurrentQuestRound(0);
    setShowBattleScreen(true);
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
    
    // Activity Log 추가
    const logText = next ? 'Lights: ON' : 'Lights: OFF';
    const updatedLogs = addActivityLog(activityLogs, 'ACTION', logText);
    
    if(slotId && currentUser){
      try{
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        await updateDoc(slotRef, {
          isLightsOn: next,
          digimonStats: updatedStats,
          activityLogs: updatedLogs,
          updatedAt: new Date(),
        });
        setActivityLogs(updatedLogs);
      } catch (error){
        console.error("조명 상태 저장 오류:", error);
      }
    }
  };

  // Admin 설정 반영 콜백
  const handleAdminConfigUpdated = (config) => {
    if (config.currentSeasonId) setCurrentSeasonId(config.currentSeasonId);
    if (config.seasonName) setSeasonName(config.seasonName);
    if (config.seasonDuration) setSeasonDuration(config.seasonDuration);
  };

  // 배틀 완료 핸들러
  const handleBattleComplete = async (battleResult) => {
    // Sparring 모드는 기록하지 않음
    if (battleType === 'sparring') {
      if (battleResult.win) {
        alert("Practice Match Completed - WIN!");
      } else {
        alert("Practice Match Completed - LOSE...");
      }
      setShowBattleScreen(false);
      setBattleType(null);
      setSparringEnemySlot(null);
      return;
    }

    // Arena 모드: Firestore에 결과 반영
    if (battleType === 'arena' && arenaChallenger && currentUser) {
      // 디버깅 로그
      console.log("Arena Result Update:", {
        battleType,
        challengerId: arenaEnemyId || arenaChallenger.id,
        challengerUserId: arenaChallenger.userId,
        myEntryId: myArenaEntryId,
        result: battleResult.win ? 'WIN' : 'LOSE',
        battleResult,
      });

      const enemyEntryId = arenaEnemyId || arenaChallenger.id;
      if (!enemyEntryId) {
        console.error("Arena Enemy Entry ID가 없습니다. 업데이트를 건너뜁니다.");
        alert("배틀 결과를 저장할 수 없습니다. Enemy Entry ID가 없습니다.");
        setShowBattleScreen(false);
        setBattleType(null);
        setArenaChallenger(null);
        setArenaEnemyId(null);
        setMyArenaEntryId(null);
        setShowArenaScreen(true); // Arena 화면으로 복귀
        return;
      }

      try {
        // Document ID를 사용하여 정확한 문서 타겟팅
        const challengerRef = doc(db, 'arena_entries', enemyEntryId);
        console.log("업데이트할 문서 참조:", challengerRef.path);

        if (battleResult.win) {
          // 내가 승리 → 상대방 losses +1, 시즌 패배 +1
          await updateDoc(challengerRef, {
            'record.losses': increment(1),
            'record.seasonLosses': increment(1),
            'record.seasonId': currentSeasonId,
          });
          console.error("✅ DB Update Success: 상대방 losses +1 (seasonLosses 포함)");
        } else {
          // 내가 패배 → 상대방 wins +1, 시즌 승리 +1
          await updateDoc(challengerRef, {
            'record.wins': increment(1),
            'record.seasonWins': increment(1),
            'record.seasonId': currentSeasonId,
          });
          console.error("✅ DB Update Success: 상대방 wins +1 (seasonWins 포함)");
        }

        // 전투 기록 저장 (arena_battle_logs 컬렉션)
        const userDigimonName = selectedDigimon || "Unknown";
        const enemyDigimonName = arenaChallenger.digimonSnapshot?.digimonName || "Unknown";
        const logSummary = battleResult.win
          ? `${currentUser.displayName || slotName || `슬롯${slotId}`}'s ${userDigimonName} defeated ${arenaChallenger.tamerName || arenaChallenger.trainerName || 'Unknown'}'s ${enemyDigimonName}`
          : `${arenaChallenger.tamerName || arenaChallenger.trainerName || 'Unknown'}'s ${enemyDigimonName} defeated ${currentUser.displayName || slotName || `슬롯${slotId}`}'s ${userDigimonName}`;

        const battleLogData = {
          attackerId: currentUser.uid,
          attackerName: currentUser.displayName || slotName || `슬롯${slotId}`,
          defenderId: arenaChallenger.userId,
          defenderName: arenaChallenger.tamerName || arenaChallenger.trainerName || 'Unknown',
          defenderEntryId: enemyEntryId, // 상대방 Entry ID
          myEntryId: myArenaEntryId, // 내 Entry ID (있을 경우)
          winnerId: battleResult.win ? currentUser.uid : arenaChallenger.userId,
          timestamp: serverTimestamp(),
          logSummary: logSummary,
        };

        const battleLogsRef = collection(db, 'arena_battle_logs');
        const logDocRef = await addDoc(battleLogsRef, battleLogData);
        console.error("✅ DB Update Success: 배틀 로그 저장 완료, ID:", logDocRef.id);

        alert("✅ 배틀 결과가 성공적으로 저장되었습니다!");
      } catch (error) {
        console.error("❌ DB Update Failed:", error);
        console.error("오류 상세:", {
          code: error.code,
          message: error.message,
          challengerId: enemyEntryId,
        });
        alert(`❌ 배틀 결과 저장 실패:\n${error.message || error.code || "알 수 없는 오류"}`);
      }

      setShowBattleScreen(false);
      setBattleType(null);
      setArenaChallenger(null);
      setArenaEnemyId(null);
      setMyArenaEntryId(null);
      setShowArenaScreen(true); // Arena 화면으로 복귀
      return;
    }

    // Quest 모드: Ver.1 스펙 적용
    // 배틀 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    
    // 수면 중 배틀 시도 시 수면 방해 처리
    const schedule = getSleepSchedule(selectedDigimon);
    const nowSleeping = isWithinSleepSchedule(schedule, new Date()) && !(wakeUntil && Date.now() < wakeUntil);
    if (nowSleeping) {
      wakeForInteraction(updatedStats, setWakeUntil, setDigimonStatsAndSave);
      const updatedLogs = addActivityLog(activityLogs, 'CARE_MISTAKE', 'Disturbed Sleep! (Wake +10m, Mistake +1)');
      setDigimonStatsAndSave({ ...updatedStats, sleepDisturbances: (updatedStats.sleepDisturbances || 0) + 1 }, updatedLogs);
    }
    
    // Ver.1 스펙: Weight -4g, Energy -1 (승패 무관)
    const oldWeight = updatedStats.weight || 0;
    const oldEnergy = updatedStats.energy || 0;
    
    const battleStats = {
      ...updatedStats,
      weight: Math.max(0, (updatedStats.weight || 0) - 4),
      energy: Math.max(0, (updatedStats.energy || 0) - 1),
    };
    
    const enemyName = battleResult.enemyName || battleResult.enemy?.name || currentQuestArea?.name || 'Unknown Enemy';
    const rank = battleResult.rank || battleResult.enemy?.rank || '';
    
    if (battleResult.win) {
      // 승리 시 배틀 기록 업데이트
      const finalStats = {
        ...battleStats,
        battles: (battleStats.battles || 0) + 1,
        battlesWon: (battleStats.battlesWon || 0) + 1,
        battlesForEvolution: (battleStats.battlesForEvolution || 0) + 1,
      };
      
      // 부상 확률 체크 (승리 시 20%)
      const proteinOverdose = battleStats.proteinOverdose || 0;
      const injuryChance = calculateInjuryChance(true, proteinOverdose);
      const isInjured = Math.random() * 100 < injuryChance;
      
      if (isInjured) {
        finalStats.isInjured = true;
        finalStats.injuredAt = Date.now();
        finalStats.injuries = (battleStats.injuries || 0) + 1;
        finalStats.healedDosesCurrent = 0; // 치료제 횟수 리셋
      }
      
      // 상세 Activity Log 추가 (변경값 + 결과값 모두 포함)
      const newWeight = battleStats.weight || 0;
      const newEnergy = battleStats.energy || 0;
      
      // 델타 계산
      const weightDelta = newWeight - oldWeight;
      const energyDelta = newEnergy - oldEnergy;
      
      let logText = '';
      if (battleResult.isAreaClear) {
        logText = `Battle: Win vs ${enemyName} (Area Cleared! ${battleResult.reward || ''}) (Wt ${weightDelta}g, En ${energyDelta}) => (Wt ${oldWeight}→${newWeight}g, En ${oldEnergy}→${newEnergy})`;
      } else {
        logText = `Battle: Win vs ${enemyName}${rank ? ` (Rank ${rank})` : ''} (Wt ${weightDelta}g, En ${energyDelta}) => (Wt ${oldWeight}→${newWeight}g, En ${oldEnergy}→${newEnergy})`;
      }
      if (isInjured) {
        logText += ' - Battle: Injured! (Chance hit)';
      }
      const updatedLogs = addActivityLog(activityLogs, 'BATTLE', logText);
      
      setDigimonStatsAndSave(finalStats, updatedLogs);

      // Area 클리어 확인
      if (battleResult.isAreaClear) {
        alert(battleResult.reward || "Area 클리어!");
        setShowBattleScreen(false);
        setCurrentQuestArea(null);
        setCurrentQuestRound(0);
      } else {
        // 다음 라운드로 진행
        setCurrentQuestRound(prev => prev + 1);
      }
    } else {
      // 패배 시 배틀 기록 업데이트
      const finalStats = {
        ...battleStats,
        battles: (battleStats.battles || 0) + 1,
        battlesLost: (battleStats.battlesLost || 0) + 1,
      };
      
      // 부상 확률 체크 (패배 시 10% + 프로틴 과다 * 10%, 최대 80%)
      const proteinOverdose = battleStats.proteinOverdose || 0;
      const injuryChance = calculateInjuryChance(false, proteinOverdose);
      const isInjured = Math.random() * 100 < injuryChance;
      
      if (isInjured) {
        finalStats.isInjured = true;
        finalStats.injuredAt = Date.now();
        finalStats.injuries = (battleStats.injuries || 0) + 1;
        finalStats.healedDosesCurrent = 0; // 치료제 횟수 리셋
      }
      
      // 상세 Activity Log 추가 (변경값 + 결과값 모두 포함)
      const newWeight = battleStats.weight || 0;
      const newEnergy = battleStats.energy || 0;
      
      // 델타 계산
      const weightDelta = newWeight - oldWeight;
      const energyDelta = newEnergy - oldEnergy;
      
      let logText = `Battle: Loss vs ${enemyName} (Wt ${weightDelta}g, En ${energyDelta}) => (Wt ${oldWeight}→${newWeight}g, En ${oldEnergy}→${newEnergy})`;
      if (isInjured) {
        logText += ' - Battle: Injured! (Chance hit)';
      }
      const updatedLogs = addActivityLog(activityLogs, 'BATTLE', logText);
      
      setDigimonStatsAndSave(finalStats, updatedLogs);
    }
  };

  // 로딩 중일 때 표시
  if (isLoadingSlot) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">슬롯 데이터 로딩 중...</p>
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
          onClick={() => setShowSettingsModal(true)}
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

    <div className="flex flex-col items-center min-h-screen p-4 bg-gray-200">
      <h2 className="text-lg font-bold mb-2">
        슬롯 {slotId} - {selectedDigimon}
      </h2>
      <p>슬롯 이름: {slotName}</p>
      <p>생성일: {slotCreatedAt}</p>
      <p>기종: {slotDevice} / 버전: {slotVersion}</p>

      <div style={{position:"relative", width,height, border:"2px solid #555"}}>
        <img
          src={`/images/${backgroundNumber}.png`}
          alt="bg"
          style={{
            position:"absolute",
            top:0,left:0,
            width:"100%",height:"100%",
            imageRendering:"pixelated",
            zIndex:1
          }}
        />
          {/* Lights Off Overlay (게임 화면만) */}
          {!isLightsOn && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.6)",
                pointerEvents: "none",
                zIndex: 3,
              }}
            />
          )}
          {/* 수면/피곤 상태 아이콘 */}
          {(sleepStatus === "SLEEPING" || sleepStatus === "TIRED") && (
            <div
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 4,
                background: "rgba(0,0,0,0.4)",
                color: "white",
                padding: "4px 8px",
                borderRadius: 8,
                fontWeight: "bold",
                fontSize: 12,
              }}
            >
              {sleepStatus === "SLEEPING" ? "Zzz…" : "💡 불 꺼줘!"}
            </div>
          )}
          {/* 부상 상태 아이콘 (병원 십자가) */}
          {digimonStats.isInjured && !digimonStats.isDead && (
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                zIndex: 4,
                background: "rgba(255,0,0,0.6)",
                color: "white",
                padding: "4px 8px",
                borderRadius: 8,
                fontWeight: "bold",
                fontSize: 16,
                animation: "float 2s ease-in-out infinite",
              }}
            >
              🏥😵‍💫🏥
            </div>
          )}
          {/* 치료 연출 (주사기) */}
          {showHealAnimation && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 5,
                fontSize: 32,
                animation: "fadeInOut 1.5s ease-in-out",
              }}
            >
              💉
            </div>
          )}
          {/* 호출(Call) 아이콘 */}
          {digimonStats.callStatus && (
            (digimonStats.callStatus.hunger?.isActive || 
             digimonStats.callStatus.strength?.isActive || 
             digimonStats.callStatus.sleep?.isActive) && (
              <button
                onClick={() => {
                  const messages = [];
                  if (digimonStats.callStatus.hunger?.isActive) messages.push("Hungry!");
                  if (digimonStats.callStatus.strength?.isActive) messages.push("No Energy!");
                  if (digimonStats.callStatus.sleep?.isActive) messages.push("Sleepy!");
                  
                  setCallToastMessage(messages.join(" "));
                  setShowCallToast(true);
                  setTimeout(() => {
                    setShowCallToast(false);
                  }, 2000);
                }}
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  zIndex: 4,
                  background: "rgba(255, 165, 0, 0.8)",
                  color: "white",
                  border: "2px solid #000",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 24,
                  cursor: "pointer",
                  animation: "blink 1s infinite",
                  fontWeight: "bold",
                }}
                title="Call Icon - Click to see reason"
              >
                📣
              </button>
            )
          )}
          {/* 호출 Toast 메시지 (간략) */}
          {showCallToast && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 6,
                background: "rgba(0, 0, 0, 0.8)",
                color: "white",
                padding: "16px 24px",
                borderRadius: 8,
                fontSize: 20,
                fontWeight: "bold",
                border: "2px solid #fff",
                animation: "fadeInOut 2s ease-in-out",
              }}
            >
              {callToastMessage}
            </div>
          )}
          {/* 호출 상세 정보 팝업 (callSign 버튼 클릭 시) */}
          {showCallModal && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={() => setShowCallModal(false)}
            >
              <div
                className="bg-white p-6 rounded-lg shadow-xl w-96 max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                style={{
                  border: "3px solid #000",
                }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">📣 Call Status Log</h2>
                  <button
                    onClick={() => setShowCallModal(false)}
                    className="text-red-500 hover:text-red-700 text-2xl font-bold"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  {digimonStats.callStatus?.hunger?.isActive && (
                    <div className="border-2 border-red-400 p-3 rounded bg-red-50">
                      <h3 className="font-bold text-lg text-red-700 mb-2">🍽️ Hunger Call</h3>
                      <div className="text-sm space-y-1">
                        <p><strong>Status:</strong> Active</p>
                        <p><strong>Started At:</strong> {digimonStats.callStatus.hunger.startedAt 
                          ? new Date(digimonStats.callStatus.hunger.startedAt).toLocaleString('ko-KR')
                          : 'N/A'}</p>
                        <p><strong>Elapsed Time:</strong> {digimonStats.callStatus.hunger.startedAt 
                          ? `${Math.floor((Date.now() - digimonStats.callStatus.hunger.startedAt) / 1000 / 60)}분 ${Math.floor(((Date.now() - digimonStats.callStatus.hunger.startedAt) / 1000) % 60)}초`
                          : 'N/A'}</p>
                        <p><strong>Timeout:</strong> 10분</p>
                        <p><strong>Reason:</strong> Fullness reached 0</p>
                        <p className="text-red-600 font-semibold">⚠️ If ignored for 10 minutes, Care Mistake will increase!</p>
                      </div>
                    </div>
                  )}
                  
                  {digimonStats.callStatus?.strength?.isActive && (
                    <div className="border-2 border-blue-400 p-3 rounded bg-blue-50">
                      <h3 className="font-bold text-lg text-blue-700 mb-2">💪 Strength Call</h3>
                      <div className="text-sm space-y-1">
                        <p><strong>Status:</strong> Active</p>
                        <p><strong>Started At:</strong> {digimonStats.callStatus.strength.startedAt 
                          ? new Date(digimonStats.callStatus.strength.startedAt).toLocaleString('ko-KR')
                          : 'N/A'}</p>
                        <p><strong>Elapsed Time:</strong> {digimonStats.callStatus.strength.startedAt 
                          ? `${Math.floor((Date.now() - digimonStats.callStatus.strength.startedAt) / 1000 / 60)}분 ${Math.floor(((Date.now() - digimonStats.callStatus.strength.startedAt) / 1000) % 60)}초`
                          : 'N/A'}</p>
                        <p><strong>Timeout:</strong> 10분</p>
                        <p><strong>Reason:</strong> Strength reached 0</p>
                        <p className="text-blue-600 font-semibold">⚠️ If ignored for 10 minutes, Care Mistake will increase!</p>
                      </div>
                    </div>
                  )}
                  
                  {digimonStats.callStatus?.sleep?.isActive && (
                    <div className="border-2 border-purple-400 p-3 rounded bg-purple-50">
                      <h3 className="font-bold text-lg text-purple-700 mb-2">😴 Sleep Call</h3>
                      <div className="text-sm space-y-1">
                        <p><strong>Status:</strong> Active</p>
                        <p><strong>Started At:</strong> {digimonStats.callStatus.sleep.startedAt 
                          ? new Date(digimonStats.callStatus.sleep.startedAt).toLocaleString('ko-KR')
                          : 'N/A'}</p>
                        <p><strong>Elapsed Time:</strong> {digimonStats.callStatus.sleep.startedAt 
                          ? `${Math.floor((Date.now() - digimonStats.callStatus.sleep.startedAt) / 1000 / 60)}분 ${Math.floor(((Date.now() - digimonStats.callStatus.sleep.startedAt) / 1000) % 60)}초`
                          : 'N/A'}</p>
                        <p><strong>Timeout:</strong> 60분</p>
                        <p><strong>Reason:</strong> Sleep time and lights are ON</p>
                        <p className="text-purple-600 font-semibold">⚠️ If ignored for 60 minutes, Care Mistake will increase!</p>
                      </div>
                    </div>
                  )}
                  
                  {(!digimonStats.callStatus?.hunger?.isActive && 
                    !digimonStats.callStatus?.strength?.isActive && 
                    !digimonStats.callStatus?.sleep?.isActive) && (
                    <div className="border-2 border-gray-300 p-3 rounded bg-gray-50">
                      <p className="text-gray-600">No active calls at the moment.</p>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500">
                    💡 <strong>Tip:</strong> Respond to calls before timeout to avoid Care Mistakes!
                  </p>
                </div>
              </div>
            </div>
          )}
        <Canvas
            style={{
              position:"absolute",
              top:0,
              left:0,
              zIndex:2,
              animation: evolutionStage === 'shaking' ? 'shake 0.5s infinite' : 'none',
              filter: evolutionStage === 'flashing' ? 'invert(1)' : 'none',
              transition: evolutionStage === 'flashing' ? 'filter 0.1s' : 'none',
            }}
            className={evolutionStage === 'flashing' ? 'evolution-flashing' : ''}
          width={width}
          height={height}
          currentAnimation={currentAnimation}
          idleFrames={idleFrames}
          eatFrames={eatFramesArr}
          foodRejectFrames={rejectFramesArr}
          showFood={showFood}
          feedStep={feedStep}
          foodSizeScale={foodSizeScale}
          developerMode={developerMode}
          foodSprites={(feedType==="protein")? proteinSprites: meatSprites}
          poopCount={digimonStats.poopCount || 0}
          showPoopCleanAnimation={showPoopCleanAnimation}
          cleanStep={cleanStep}
            sleepStatus={sleepStatus}
        />
      </div>

        <div className="flex items-center space-x-2 mt-2">
      <button
        onClick={handleEvolutionButton}
            disabled={!isEvoEnabled || isEvolving}
            className={`px-4 py-2 text-white rounded pixel-art-button ${isEvoEnabled && !isEvolving ? "bg-green-500 hover:bg-green-600" : "bg-gray-500 cursor-not-allowed"}`}
      >
        Evolution
      </button>
          <button
            onClick={() => setShowDigimonInfo(true)}
            className="px-3 py-2 text-white bg-blue-500 rounded pixel-art-button hover:bg-blue-600"
            title="Digimon Info"
          >
            ❓
          </button>
          {digimonStats.isDead && (
            <button
              onClick={() => setIsDeathModalOpen(true)}
              className="px-4 py-2 text-white bg-red-800 rounded pixel-art-button hover:bg-red-900"
              title="사망 정보"
            >
              💀 Death Info
            </button>
          )}
        </div>

      {isDeathModalOpen && (
        <DeathPopup
          isOpen={isDeathModalOpen}
          onConfirm={handleDeathConfirm}
          onClose={() => setIsDeathModalOpen(false)}
          reason={deathReason}
        />
      )}

      <div className="mt-2 text-lg">
        <p>Time to Evolve: {formatTimeToEvolve(digimonStats.timeToEvolveSeconds)}</p>
        <p>Lifespan: {formatLifespan(digimonStats.lifespanSeconds)}</p>
        <p>Current Time: {customTime.toLocaleString()}</p>
      </div>

      <div className="flex space-x-4 mt-4">
        <StatsPanel stats={digimonStats} sleepStatus={sleepStatus} />
        <MenuIconButtons
          width={width}
          height={height}
          activeMenu={activeMenu}
          onMenuClick={handleMenuClick}
        />
      </div>


      {showStatsPopup && (
        <StatsPopup
          stats={digimonStats}
          digimonData={newDigimonDataVer1[selectedDigimon || (digimonStats.evolutionStage ? 
            Object.keys(newDigimonDataVer1).find(key => newDigimonDataVer1[key]?.stage === digimonStats.evolutionStage) : 
            "Digitama")]}
          onClose={()=> setShowStatsPopup(false)}
          devMode={developerMode}
          onChangeStats={(ns)=> setDigimonStatsAndSave(ns)}
        />
      )}

      {showFeedPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <FeedPopup
            onClose={()=> setShowFeedPopup(false)}
            onSelect={(foodType)=>{
              setShowFeedPopup(false);
              handleFeed(foodType);
            }}
          />
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <SettingsModal
            onClose={()=> setShowSettingsModal(false)}
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
        <div className="mt-2 p-2 border">
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
      {showTrainPopup && (
        <TrainPopup
          onClose={()=> setShowTrainPopup(false)}
          digimonStats={digimonStats}
          setDigimonStatsAndSave={setDigimonStatsAndSave}
          onTrainResult={handleTrainResult}
        />
      )}

      {/* 배틀 모드 선택 모달 */}
      {showBattleSelectionModal && (
        <BattleSelectionModal
          onClose={() => setShowBattleSelectionModal(false)}
          onQuestStart={handleQuestStart}
          onCommunicationStart={handleCommunicationStart}
        />
      )}

      {/* Communication 모달 */}
      {showCommunicationModal && (
        <CommunicationModal
          onClose={() => setShowCommunicationModal(false)}
          onSparringStart={handleSparringStart}
          onArenaStart={handleArenaStart}
        />
      )}

      {/* Arena Screen */}
      {showArenaScreen && (
        <ArenaScreen
          onClose={() => setShowArenaScreen(false)}
          onStartBattle={handleArenaBattleStart}
          currentSlotId={parseInt(slotId)}
          mode={mode}
          currentSeasonId={currentSeasonId}
          isDevMode={developerMode}
          onOpenAdmin={() => setShowAdminModal(true)}
        />
      )}

      {/* Sparring 모달 */}
      {showSparringModal && (
        <SparringModal
          onClose={() => setShowSparringModal(false)}
          onSelectSlot={handleSparringSlotSelect}
          currentSlotId={parseInt(slotId)}
          mode={mode}
        />
      )}

      {/* 퀘스트 선택 모달 */}
      {showQuestSelectionModal && (
        <QuestSelectionModal
          quests={quests}
          clearedQuestIndex={clearedQuestIndex}
          onSelectArea={handleSelectArea}
          onClose={() => setShowQuestSelectionModal(false)}
        />
      )}

      {/* 배틀 스크린 */}
      {showBattleScreen && (currentQuestArea || battleType === 'sparring' || battleType === 'arena') && (
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
          onBattleComplete={handleBattleComplete}
          onQuestClear={handleQuestComplete}
          onClose={() => {
            setShowBattleScreen(false);
            setCurrentQuestArea(null);
            setCurrentQuestRound(0);
            
            // Arena 모드일 때는 Arena 화면으로 복귀
            if (battleType === 'arena') {
              setShowArenaScreen(true);
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
      {developerMode && showAdminModal && (
        <AdminModal
          onClose={() => setShowAdminModal(false)}
          currentSeasonId={currentSeasonId}
          seasonName={seasonName}
          seasonDuration={seasonDuration}
          onConfigUpdated={handleAdminConfigUpdated}
        />
      )}

      {/* Digimon Info Modal */}
      {showDigimonInfo && (
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
          onClose={() => setShowDigimonInfo(false)}
        />
      )}

      {/* 진화 애니메이션 완료 메시지 */}
      {evolutionStage === 'complete' && evolvedDigimonName && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
          <div className="bg-yellow-400 border-4 border-yellow-600 rounded-lg p-8 text-center pixel-art-modal">
            <h2 className="text-3xl font-bold text-black mb-4 pixel-art-text"> 🎉 디지몬 진화~~! 🎉</h2>
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