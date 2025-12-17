// src/pages/Game.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../firebase";

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
import { quests } from "../data/v1/quests";

import digimonAnimations from "../data/digimonAnimations";
import { initializeStats, applyLazyUpdate, updateLifespan } from "../data/stats";
// 새 데이터 구조 import
import { digimonDataVer1 as newDigimonDataVer1 } from "../data/v1/digimons";
import { adaptDataMapToOldFormat } from "../data/v1/adapter";
import { evolutionConditionsVer1 } from "../data/evolution_digitalmonstercolor25th_ver1";
// 매뉴얼 기반 스탯 로직 import
import { handleHungerTick, feedMeat, willRefuseMeat } from "../logic/stats/hunger";
import { handleStrengthTick, feedProtein, willRefuseProtein } from "../logic/stats/strength";
// 매뉴얼 기반 진화 판정 로직 import
import { checkEvolution, findEvolutionTarget } from "../logic/evolution/checker";
// 훈련 로직 (Ver1) import
import { doVer1Training } from "../data/train_digitalmonstercolor25th_ver1";
import TrainPopup from "../components/TrainPopup";

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
  const m = Math.floor(sec/60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
function formatLifespan(sec=0){
  const d = Math.floor(sec/86400);
  const r = sec %86400;
  const mm= Math.floor(r/60);
  const ss= r%60;
  return `${d} day, ${mm} min, ${ss} sec`;
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
  setStatsCb(updated);
}

function Game(){
  const { slotId } = useParams();
  const navigate= useNavigate();
  const location = useLocation();
  const { currentUser, isFirebaseAvailable } = useAuth();
  
  // mode 값 가져오기 (location.state에서 가져오거나, 기본값은 firebase)
  const mode = location.state?.mode || (isFirebaseAvailable && currentUser ? 'firebase' : 'local');

  const [selectedDigimon, setSelectedDigimon]= useState("Digitama");
  const [digimonStats, setDigimonStats]= useState(
    initializeStats("Digitama", {}, digimonDataVer1)
  );

  // 사망확인
  const [showDeathConfirm, setShowDeathConfirm]= useState(false);
  const [deathReason, setDeathReason] = useState(null);

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

  // 로딩 상태 관리
  const [isLoadingSlot, setIsLoadingSlot] = useState(true);

  // (1) SLOT LOAD - mode에 따라 Firestore 또는 localStorage에서 슬롯 데이터 로드
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
    // 단, 데이터 로딩이 완료된 후에만 리디렉션
    if(mode === 'firebase' && (!isFirebaseAvailable || !currentUser)) {
      setIsLoadingSlot(false);
      navigate("/");
      return;
    }

    const loadSlot = async () => {
      setIsLoadingSlot(true);
      try {
        if(mode === 'firebase' && isFirebaseAvailable && currentUser) {
          // Firestore 모드
          const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
          const slotSnap = await getDoc(slotRef);
          
          if(slotSnap.exists()) {
            const slotData = slotSnap.data();
            
            setSlotName(slotData.slotName || `슬롯${slotId}`);
            setSlotCreatedAt(slotData.createdAt || "");
            setSlotDevice(slotData.device || "");
            setSlotVersion(slotData.version || "Ver.1");

            const savedName = slotData.selectedDigimon || "Digitama";
            let savedStats = slotData.digimonStats || {};
            
            if(Object.keys(savedStats).length === 0){
              const ns = initializeStats("Digitama", {}, digimonDataVer1);
              setSelectedDigimon("Digitama");
              setDigimonStats(ns);
            } else {
              // Lazy Update: 마지막 저장 시간부터 현재까지 경과한 시간 적용
              const lastSavedAt = slotData.lastSavedAt || slotData.updatedAt || new Date();
              savedStats = applyLazyUpdate(savedStats, lastSavedAt);
              
              setSelectedDigimon(savedName);
              setDigimonStats(savedStats);
              if (savedStats.isLightsOn !== undefined) setIsLightsOn(savedStats.isLightsOn);
              if (savedStats.wakeUntil) setWakeUntil(savedStats.wakeUntil);
              if (savedStats.dailySleepMistake !== undefined) setDailySleepMistake(savedStats.dailySleepMistake);
              setIsSleeping(false);
              
              // 업데이트된 스탯을 Firestore에 저장
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
        } else {
          // localStorage 모드
          const digimonName = localStorage.getItem(`slot${slotId}_selectedDigimon`);
          const statsJson = localStorage.getItem(`slot${slotId}_digimonStats`);
          const slotName = localStorage.getItem(`slot${slotId}_slotName`) || `슬롯${slotId}`;
          const createdAt = localStorage.getItem(`slot${slotId}_createdAt`) || "";
          const device = localStorage.getItem(`slot${slotId}_device`) || "";
          const version = localStorage.getItem(`slot${slotId}_version`) || "Ver.1";
          
          setSlotName(slotName);
          setSlotCreatedAt(createdAt);
          setSlotDevice(device);
          setSlotVersion(version);
          
          if(digimonName) {
            let savedStats = statsJson ? JSON.parse(statsJson) : {};
            
            if(Object.keys(savedStats).length === 0){
              const ns = initializeStats("Digitama", {}, digimonDataVer1);
              setSelectedDigimon("Digitama");
              setDigimonStats(ns);
            } else {
              // Lazy Update: 마지막 저장 시간부터 현재까지 경과한 시간 적용
              const lastSavedAt = savedStats.lastSavedAt || new Date();
              savedStats = applyLazyUpdate(savedStats, lastSavedAt);
              
              setSelectedDigimon(digimonName);
                setDigimonStats(savedStats);
                if (savedStats.isLightsOn !== undefined) setIsLightsOn(savedStats.isLightsOn);
                if (savedStats.wakeUntil) setWakeUntil(savedStats.wakeUntil);
                if (savedStats.dailySleepMistake !== undefined) setDailySleepMistake(savedStats.dailySleepMistake);
              setIsSleeping(false);
              
              // 업데이트된 스탯을 localStorage에 저장
              localStorage.setItem(`slot${slotId}_digimonStats`, JSON.stringify(savedStats));
            }
          } else {
            const ns = initializeStats("Digitama", {}, digimonDataVer1);
            setSelectedDigimon("Digitama");
            setDigimonStats(ns);
            setSlotName(`슬롯${slotId}`);
          }
        }
      } catch (error) {
        console.error("슬롯 로드 오류:", error);
        const ns = initializeStats("Digitama", {}, digimonDataVer1);
        setSelectedDigimon("Digitama");
        setDigimonStats(ns);
      } finally {
        // 데이터 로딩 완료
        setIsLoadingSlot(false);
      }
    };

    loadSlot();
  },[slotId, currentUser, navigate, isFirebaseAvailable, mode]);

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
        if(updatedStats.health === 0 && updatedStats.lastStrengthZeroAt){
          const elapsed = (Date.now() - updatedStats.lastStrengthZeroAt) / 1000;
          if(elapsed >= 43200){
            updatedStats.isDead = true;
            setDeathReason('INJURY (부상 과다)');
          }
        }
        
        // 수명 종료 체크 (lifespanSeconds가 최대치에 도달했는지 확인)
        // updateLifespan에서 처리되지만, 여기서도 확인
        const maxLifespan = currentDigimonData?.maxLifespan || 999999;
        if(updatedStats.lifespanSeconds >= maxLifespan && !updatedStats.isDead){
          updatedStats.isDead = true;
          setDeathReason('OLD AGE (수명 다함)');
        }
        
        // 사망 상태 변경 감지
        if(!prevStats.isDead && updatedStats.isDead){
          setShowDeathConfirm(true);
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

  async function setDigimonStatsAndSave(newStats){
    // Lazy Update 적용: 액션 시점에 경과 시간 반영
    const updatedStats = await applyLazyUpdateBeforeAction();
    const finalStats = { 
      ...updatedStats, 
      ...newStats,
      isLightsOn,
      wakeUntil,
      dailySleepMistake,
    };
    
    setDigimonStats(finalStats);
    
    // mode에 따라 Firestore 또는 localStorage에 저장
    if(slotId){
      try {
        if(mode === 'firebase' && currentUser){
          // Firestore에 저장
          const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
          await updateDoc(slotRef, {
            digimonStats: finalStats,
            lastSavedAt: finalStats.lastSavedAt || new Date(),
            updatedAt: new Date(),
          });
        } else {
          // localStorage에 저장
          localStorage.setItem(`slot${slotId}_digimonStats`, JSON.stringify(finalStats));
        }
      } catch (error) {
        console.error("스탯 저장 오류:", error);
      }
    }
  }

  // 액션 전에 Lazy Update 적용하는 헬퍼 함수
  // mode에 따라 Firestore 또는 localStorage에서 마지막 저장 시간을 가져와 경과 시간을 계산하여 스탯 업데이트
  async function applyLazyUpdateBeforeAction() {
    if(!slotId) {
      return digimonStats;
    }

    try {
      if(mode === 'firebase' && currentUser){
        // Firestore 모드
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        const slotSnap = await getDoc(slotRef);
        
        if(slotSnap.exists()) {
          const slotData = slotSnap.data();
          const lastSavedAt = slotData.lastSavedAt || slotData.updatedAt || digimonStats.lastSavedAt;
          const updated = applyLazyUpdate(digimonStats, lastSavedAt);
          
          // 사망 상태 변경 감지
          if(!digimonStats.isDead && updated.isDead){
            // 사망 원인 확인 (Lazy Update에서 감지된 경우)
            if(updated.fullness === 0 && updated.lastHungerZeroAt){
              const elapsed = (Date.now() - updated.lastHungerZeroAt) / 1000;
              if(elapsed >= 43200){
                setDeathReason('STARVATION (굶주림)');
              }
            } else if(updated.health === 0 && updated.lastStrengthZeroAt){
              const elapsed = (Date.now() - updated.lastStrengthZeroAt) / 1000;
              if(elapsed >= 43200){
                setDeathReason('INJURY (부상 과다)');
              }
            } else {
              setDeathReason('OLD AGE (수명 다함)');
            }
            setShowDeathConfirm(true);
          }
          
          return updated;
        }
      } else {
        // localStorage 모드
        const statsJson = localStorage.getItem(`slot${slotId}_digimonStats`);
        if(statsJson) {
          const savedStats = JSON.parse(statsJson);
          const lastSavedAt = savedStats.lastSavedAt || digimonStats.lastSavedAt;
          const updated = applyLazyUpdate(digimonStats, lastSavedAt);
          
          // 사망 상태 변경 감지
          if(!digimonStats.isDead && updated.isDead){
            // 사망 원인 확인 (Lazy Update에서 감지된 경우)
            if(updated.fullness === 0 && updated.lastHungerZeroAt){
              const elapsed = (Date.now() - updated.lastHungerZeroAt) / 1000;
              if(elapsed >= 43200){
                setDeathReason('STARVATION (굶주림)');
              }
            } else if(updated.health === 0 && updated.lastStrengthZeroAt){
              const elapsed = (Date.now() - updated.lastStrengthZeroAt) / 1000;
              if(elapsed >= 43200){
                setDeathReason('INJURY (부상 과다)');
              }
            } else {
              setDeathReason('OLD AGE (수명 다함)');
            }
            setShowDeathConfirm(true);
          }
          
          return updated;
        }
      }
    } catch (error) {
      console.error("Lazy Update 적용 오류:", error);
    }
    
    return digimonStats;
  }
  async function setSelectedDigimonAndSave(name){
    setSelectedDigimon(name);
    if(slotId){
      try {
        if(mode === 'firebase' && currentUser){
          // Firestore에 저장
          const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
          await updateDoc(slotRef, {
            selectedDigimon: name,
            updatedAt: new Date(),
          });
        } else {
          // localStorage에 저장
          localStorage.setItem(`slot${slotId}_selectedDigimon`, name);
        }
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
      // 개발자 모드에서는 바로 진화 가능
      const evo= evolutionConditionsVer1[digimonName];
      if(evo && evo.evolution.length > 0){
        await handleEvolution(evo.evolution[0].next);
      }
      return;
    }
    
    // 매뉴얼 기반 진화 판정 (상세 결과 객체 반환)
    // 5번째 인자로 전체 데이터 맵 전달 (targetName 찾기용) - 새 데이터 사용
    const evolutionResult = checkEvolution(updatedStats, currentDigimonData, evolutionConditionsVer1, digimonName, newDigimonDataVer1);
    
    if(evolutionResult.success) {
      // 진화 성공
      const targetId = evolutionResult.targetId;
      // targetName 찾기 (Fallback 처리) - 새 데이터 사용
      const targetData = newDigimonDataVer1[targetId];
      const targetName = targetData?.name || targetData?.id || targetId;
      alert(`디지몬 진화~~~! 🎉\n\n곧 ${targetName}으로 진화합니다!`);
      await handleEvolution(targetId);
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
      trainingCount: 0,
    };
    
    const nx= initializeStats(newName, resetStats, digimonDataVer1);
    await setDigimonStatsAndSave(nx);
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
    setShowDeathConfirm(false);
    setDeathReason(null); // 사망 원인 초기화
  }

  // 먹이 - Lazy Update 적용 후 Firestore에 저장
  async function handleFeed(type){
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    if(updatedStats.isDead) return;
    
    // 업데이트된 스탯으로 작업
    setDigimonStats(updatedStats);
    
    // 매뉴얼 기반 거부 체크
    if(type==="meat"){
      if(willRefuseMeat(updatedStats)){
        setCurrentAnimation("foodRejectRefuse");
        setShowFood(false);
        setFeedStep(0);
        setTimeout(()=> setCurrentAnimation("idle"),2000);
        return;
      }
    } else {
      if(willRefuseProtein(updatedStats)){
        setCurrentAnimation("foodRejectRefuse");
        setShowFood(false);
        setFeedStep(0);
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
      setDigimonStatsAndSave(applyEatResult(currentStats, type));
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
      const updatedStats = {
        ...digimonStats,
        poopCount: 0,
        lastMaxPoopTime: null,
        lastSavedAt: now
      };
      setDigimonStats(updatedStats);
      // mode에 따라 Firestore 또는 localStorage에 저장 (청소 시 저장)
      if(slotId){
        try {
          if(mode === 'firebase' && currentUser){
            // Firestore에 저장
            const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
            await updateDoc(slotRef, {
              digimonStats: updatedStats,
              lastSavedAt: now,
              updatedAt: now,
            });
          } else {
            // localStorage에 저장
            localStorage.setItem(`slot${slotId}_digimonStats`, JSON.stringify(updatedStats));
          }
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
    setDigimonStats(updatedStats);
    
    // userSelections: 길이5의 "U"/"D" 배열
    // doVer1Training -> stats 업데이트
    const result= doVer1Training(updatedStats, userSelections);
    setDigimonStatsAndSave(result.updatedStats);
    // 그냥 콘솔
    console.log("훈련 결과:", result);
  }

  // 리셋
  async function resetDigimon(){
    if(!window.confirm("정말로 초기화?")) return;
    const ns = initializeStats("Digitama", {}, digimonDataVer1);
    await setDigimonStatsAndSave(ns);
    await setSelectedDigimonAndSave("Digitama");
    setShowDeathConfirm(false);
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
    
    const evo= evolutionConditionsVer1[selectedDigimon];
    if(evo){
      for(let e of evo.evolution){
        if(e.condition.check(digimonStats)){
          setIsEvoEnabled(true);
          return;
        }
      }
    }
    setIsEvoEnabled(false);
  }, [digimonStats, selectedDigimon, developerMode]);

  // 메뉴 클릭 (train 버튼 시)
  const handleMenuClick = (menu)=>{
    // 수면 중 인터랙션 시 10분 깨우고 sleepDisturbances 증가
    const schedule = getSleepSchedule(selectedDigimon);
    const nowSleeping = isWithinSleepSchedule(schedule, new Date()) && !(wakeUntil && Date.now() < wakeUntil);
    if (nowSleeping) {
      wakeForInteraction(digimonStats, setWakeUntil, setDigimonStatsAndSave);
      setIsSleeping(false);
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
      default:
        console.log("menu:", menu);
    }
  };

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

    // Quest 모드: 기존 로직 유지
    if (battleResult.win) {
      // 승리 시 배틀 기록 업데이트
      const updatedStats = {
        ...digimonStats,
        battles: (digimonStats.battles || 0) + 1,
        battlesWon: (digimonStats.battlesWon || 0) + 1,
        battlesForEvolution: (digimonStats.battlesForEvolution || 0) + 1,
      };
      setDigimonStatsAndSave(updatedStats);

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
      const updatedStats = {
        ...digimonStats,
        battles: (digimonStats.battles || 0) + 1,
        battlesLost: (digimonStats.battlesLost || 0) + 1,
      };
      setDigimonStatsAndSave(updatedStats);
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
  return (
    <div className="flex flex-col items-center min-h-screen p-4 bg-gray-200">
      {/* Lights Off Overlay */}
      {!isLightsOn && (
        <div className="fixed inset-0 bg-black" style={{ opacity: 0.6, pointerEvents: "none", zIndex: 40 }}></div>
      )}

      <h2 className="text-lg font-bold mb-2">
        슬롯 {slotId} - {selectedDigimon}
      </h2>
      <p>슬롯 이름: {slotName}</p>
      <p>생성일: {slotCreatedAt}</p>
      <p>기종: {slotDevice} / 버전: {slotVersion}</p>

      <button onClick={()=> navigate("/select")} className="mb-2 px-3 py-1 bg-gray-400 text-white rounded">
        ← Select 화면
      </button>

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
        <Canvas
          style={{ position:"absolute", top:0,left:0, zIndex:2 }}
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
        />
      </div>

      <button
        onClick={handleEvolutionButton}
        disabled={!isEvoEnabled}
        className={`mt-2 px-4 py-2 text-white rounded ${isEvoEnabled? "bg-green-500":"bg-gray-500"}`}
      >
        Evolution
      </button>

      {showDeathConfirm && (
        <DeathPopup
          onConfirm={handleDeathConfirm}
          reason={deathReason}
        />
      )}

      <div className="mt-2 text-lg">
        <p>Time to Evolve: {formatTimeToEvolve(digimonStats.timeToEvolveSeconds)}</p>
        <p>Lifespan: {formatLifespan(digimonStats.lifespanSeconds)}</p>
        <p>Current Time: {customTime.toLocaleString()}</p>
      </div>

      <div className="flex space-x-4 mt-4">
        <StatsPanel stats={digimonStats} />
        <MenuIconButtons
          width={width}
          height={height}
          activeMenu={activeMenu}
          onMenuClick={handleMenuClick}
        />
      </div>

      <button
        onClick={()=> setShowSettingsModal(true)}
        className="px-4 py-2 bg-yellow-500 text-white rounded mt-4"
      >
        Settings
      </button>

      {showStatsPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <StatsPopup
            stats={digimonStats}
            onClose={()=> setShowStatsPopup(false)}
            devMode={developerMode}
            onChangeStats={(ns)=> setDigimonStatsAndSave(ns)}
          />
        </div>
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

      <button
        onClick={resetDigimon}
        className="px-4 py-2 bg-red-500 text-white rounded mt-4"
      >
        Reset Digimon
      </button>
      <button
        onClick={() => setIsLightsOn((prev) => !prev)}
        className="px-4 py-2 bg-yellow-500 text-white rounded mt-2"
      >
        {isLightsOn ? "Lights Off" : "Lights On"}
      </button>

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
    </div>
  );
}

export default Game;