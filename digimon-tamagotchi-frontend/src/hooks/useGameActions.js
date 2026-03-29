// src/hooks/useGameActions.js
// Game.jsx의 비즈니스 로직을 분리한 Custom Hook

import { resetCallStatus, hasDuplicateSleepDisturbanceLog } from "./useGameLogic";
import { feedMeat, willRefuseMeat } from "../logic/food/meat";
import { feedProtein, willRefuseProtein } from "../logic/food/protein";
import { doVer1Training } from "../data/train_digitalmonstercolor25th_ver1";
import { calculateInjuryChance } from "../logic/battle/calculator";
import { doc, updateDoc, collection, addDoc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../firebase";
import {
  isTimeWithinSleepSchedule,
  normalizeSleepSchedule,
  shiftSleepScheduleByHours,
} from "../utils/sleepUtils";

/**
 * 수면 스케줄 가져오기 (야행성 모드 반영)
 */
function getSleepSchedule(digimonData, name, digimonStats = null) {
  const data = digimonData[name] || {};
  const baseSchedule = normalizeSleepSchedule(data.sleepSchedule || { start: 22, end: 6 });
  
  // 야행성 모드 확인
  const isNocturnal = digimonStats?.isNocturnal || false;
  
  if (!isNocturnal) return baseSchedule;
  
  // 야행성 모드: 시작 시간과 종료 시간을 3시간 뒤로 미룸 (24시간제 계산)
  return shiftSleepScheduleByHours(baseSchedule, 3);
}

/** 배틀 로그 최대 보관 개수 */
const MAX_BATTLE_LOGS = 100;

/**
 * 배틀 로그 한 건 추가 (배틀 기록 전용 배열에만 저장, activityLogs에는 넣지 않음)
 * @param {Array} prevBattleLogs - 기존 battleLogs
 * @param {Object} entry - { timestamp, mode: 'sparring'|'arena'|'quest'|'skip', text, win?, enemyName?, injury? }
 * @returns {Array} 최대 100개 유지
 */
function appendBattleLog(prevBattleLogs, entry) {
  const list = Array.isArray(prevBattleLogs) ? prevBattleLogs : [];
  return [{ ...entry, timestamp: entry.timestamp || Date.now() }, ...list].slice(0, MAX_BATTLE_LOGS);
}

/**
 * 현재 시간이 수면 스케줄 내에 있는지 확인
 */
function isWithinSleepSchedule(schedule, nowDate = new Date()) {
  return isTimeWithinSleepSchedule(schedule || { start: 22, end: 6 }, nowDate);
}

/**
 * 수면 중 인터랙션 시 10분 깨우기 + 수면방해 카운트
 * 순수 함수로 동작하여 업데이트된 스탯을 반환합니다.
 * 저장은 호출하는 쪽에서 통합하여 처리합니다.
 * 
 * @param {Object} digimonStats - 디지몬 스탯
 * @param {Function} setWakeUntil - wakeUntil 설정 함수
 * @param {Function} setDigimonStatsAndSave - 스탯 저장 함수 (사용하지 않음, 호환성을 위해 유지)
 * @param {boolean} isSleepTime - 정규 수면 시간 여부
 * @param {Function} onSleepDisturbance - 수면 방해 콜백
 * @returns {Object} 업데이트된 디지몬 스탯 (sleepDisturbances가 증가된 상태)
 */
export function wakeForInteraction(digimonStats, setWakeUntil, setDigimonStatsAndSave, isSleepTime = true, onSleepDisturbance = null) {
  const until = Date.now() + 10 * 60 * 1000; // 10분
  setWakeUntil(until);
  
  const nowMs = Date.now();
  const napUntil = digimonStats.napUntil || null;
  const isNapTime = napUntil ? napUntil > nowMs : false;
  
  const updated = {
    ...digimonStats,
    wakeUntil: until,
    // 정규 수면 시간에 깨울 때만 수면 방해(sleepDisturbances) 증가 (낮잠 중에는 증가하지 않음)
    sleepDisturbances: (isSleepTime && !isNapTime) 
      ? (digimonStats.sleepDisturbances || 0) + 1 
      : (digimonStats.sleepDisturbances || 0)
  };
  
  // 저장은 호출하는 쪽에서 통합하여 처리하도록 변경 (중복 저장 방지)
  // setDigimonStatsAndSave(updated);
  
  // 수면 방해 콜백 호출 (낮잠 중이 아닐 때만)
  if (onSleepDisturbance && isSleepTime && !isNapTime) {
    onSleepDisturbance();
  }
  
  // 업데이트된 스탯 반환 (호출하는 쪽에서 사용)
  return updated;
}

/**
 * useGameActions Hook
 * Game.jsx의 비즈니스 로직을 처리하는 Custom Hook
 * 
 * @param {Object} params - 필요한 의존성들
 * @param {Object} params.digimonStats - 현재 디지몬 스탯
 * @param {Function} params.setDigimonStats - 스탯 업데이트 함수
 * @param {Function} params.setDigimonStatsAndSave - 스탯 저장 함수
 * @param {Function} params.applyLazyUpdateBeforeAction - Lazy Update 적용 함수
 * @param {Function} params.setActivityLogs - Activity Logs 업데이트 함수
 * @param {Array} params.activityLogs - 현재 Activity Logs
 * @param {string} params.selectedDigimon - 선택된 디지몬 이름
 * @param {number|null} params.wakeUntil - 강제 기상 만료 시간
 * @param {Function} params.setWakeUntil - wakeUntil 업데이트 함수
 * @param {Object} params.digimonData - 디지몬 데이터 맵
 * @param {Function} params.setCurrentAnimation - 애니메이션 설정 함수
 * @param {Function} params.setShowFood - 먹이 표시 설정 함수
 * @param {Function} params.setFeedStep - 먹이 스텝 설정 함수
 * @param {Function} params.setFeedType - 먹이 타입 설정 함수
 * @param {Function} params.setShowPoopCleanAnimation - 똥 청소 애니메이션 설정 함수
 * @param {Function} params.setCleanStep - 청소 스텝 설정 함수
 * @param {string} params.slotId - 슬롯 ID
 * @param {Object|null} params.currentUser - 현재 사용자
 * @param {string} params.slotName - 슬롯 이름
 * @param {boolean} params.isLightsOn - 조명 상태
 * @param {boolean} params.dailySleepMistake - 일일 수면 케어 미스
 * @param {string|null} params.battleType - 배틀 타입
 * @param {Function} params.setShowBattleScreen - 배틀 화면 표시 설정 함수
 * @param {Function} params.setBattleType - 배틀 타입 설정 함수
 * @param {Function} params.setSparringEnemySlot - 스파링 적 슬롯 설정 함수
 * @param {Object|null} params.arenaChallenger - 아레나 챌린저
 * @param {string|null} params.arenaEnemyId - 아레나 적 ID
 * @param {string|null} params.myArenaEntryId - 내 아레나 Entry ID
 * @param {Function} params.setArenaChallenger - 아레나 챌린저 설정 함수
 * @param {Function} params.setArenaEnemyId - 아레나 적 ID 설정 함수
 * @param {Function} params.setMyArenaEntryId - 내 아레나 Entry ID 설정 함수
 * @param {Function} params.setShowArenaScreen - 아레나 화면 표시 설정 함수
 * @param {string} params.currentSeasonId - 현재 시즌 ID
 * @param {Object|null} params.currentQuestArea - 현재 퀘스트 영역
 * @param {Function} params.setCurrentQuestArea - 현재 퀘스트 영역 설정 함수
 * @param {Function} params.setCurrentQuestRound - 현재 퀘스트 라운드 설정 함수
 * @returns {Object} 게임 액션 핸들러 함수들
 */
export function useGameActions({
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
  digimonData,
  setCurrentAnimation,
  setShowFood,
  setFeedStep,
  setFeedType,
  setShowPoopCleanAnimation,
  setCleanStep,
  slotId,
  currentUser,
  slotName,
  isLightsOn,
  dailySleepMistake,
  battleType,
  setShowBattleScreen,
  setBattleType,
  setSparringEnemySlot,
  arenaChallenger,
  arenaEnemyId,
  myArenaEntryId,
  onSleepDisturbance = null, // 수면 방해 콜백
  setArenaChallenger,
  setArenaEnemyId,
  setMyArenaEntryId,
  setShowArenaScreen,
  currentSeasonId,
  currentQuestArea,
  setCurrentQuestArea,
  setCurrentQuestRound,
  toggleModal, // 과식 확인 모달용
}) {
  // 기본값 제공 및 에러 방지
  if (!digimonStats || !setDigimonStats || !setDigimonStatsAndSave || !applyLazyUpdateBeforeAction) {
    console.error('useGameActions: 필수 의존성이 없습니다');
    return {
      handleFeed: () => {},
      handleTrainResult: () => {},
      handleBattleComplete: () => {},
      handleCleanPoop: () => {},
      eatCycle: () => {},
      cleanCycle: () => {},
    };
  }
  
  /**
   * 먹이 주기 핸들러
   */
  const handleFeed = async (type) => {
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    if(updatedStats.isDead) return;
    
    // 수면방해는 handleMenuClick에서 처리됨 (메뉴 클릭 시점)
    
    // 업데이트된 스탯으로 작업
    setDigimonStats(updatedStats);
    
    // 매뉴얼 기반 거부 체크
    if(type==="meat"){
      if(willRefuseMeat(updatedStats)){
        // 거절 상태: 과식 확인 팝업 표시
        toggleModal('overfeedConfirm', true);
        // 팝업에서 선택한 후 처리하기 위해 상태 저장
        setFeedType(type);
        setDigimonStats(updatedStats);
        return;
      }
    } else {
      if(willRefuseProtein(updatedStats)){
        setCurrentAnimation("foodRejectRefuse");
        setShowFood(false);
        setFeedStep(0);
        // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
        setDigimonStats((prevStats) => {
          const proteinOverdose = updatedStats.proteinOverdose || 0;
          const newLog = {
            type: "FEED",
            text: proteinOverdose >= 7 ? "Feed: Refused (Protein Overdose max reached: 7/7)" : "Feed: Refused",
            timestamp: Date.now(),
          };
          const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 100);
          if (appendLogToSubcollection) appendLogToSubcollection(newLog).catch(() => {});
          const statsWithLogs = { ...updatedStats, activityLogs: updatedLogs };
          setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
            console.error("먹이 거부 로그 저장 오류:", error);
          });
          return statsWithLogs;
        });
        setTimeout(()=> setCurrentAnimation("idle"),2000);
        return;
      }
    }
    setFeedType(type);
    // 모바일에서 애니메이션이 확실히 보이도록 애니메이션을 먼저 설정
    setCurrentAnimation("eat");
    setShowFood(true);
    setFeedStep(0);
    // requestAnimationFrame을 사용하여 다음 프레임에서 애니메이션 시작 (모바일 최적화)
    requestAnimationFrame(() => {
      eatCycle(0, type);
    });
  };

  /**
   * 먹이 주기 사이클 (애니메이션)
   * 첫 번째 프레임에서 스탯을 즉시 증가시킴
   * @param {number} step - 현재 프레임
   * @param {string} type - "meat" | "protein"
   * @param {boolean} isRefused - 거절 상태 여부 (고기 거절 시 true)
   */
  const eatCycle = async (step, type, isRefused = false) => {
    const frameCount = (type==="protein"?3:4);
    
    // 첫 번째 프레임에서 스탯 즉시 업데이트 (실제 액션 수행 시점)
    if (step === 0) {
      // 최신 스탯 가져오기
      const currentStats = await applyLazyUpdateBeforeAction();
      
      // 수면 중 먹이 시도 시 수면 방해 처리 (실제 액션 수행 시점)
      const schedule = getSleepSchedule(digimonData, selectedDigimon, currentStats);
      const isSleepTime = isWithinSleepSchedule(schedule, new Date());
      const nowSleeping = isSleepTime && !(wakeUntil && Date.now() < wakeUntil);
      
      // wakeForInteraction에서 이미 sleepDisturbances가 증가된 스탯을 반환받음
      let statsAfterWake = currentStats;
      if (nowSleeping) {
        if (hasDuplicateSleepDisturbanceLog(currentStats.activityLogs || [], Date.now())) {
          statsAfterWake = currentStats; // 15분 창 내 중복 수면 방해 방지
        } else {
          statsAfterWake = wakeForInteraction(currentStats, setWakeUntil, setDigimonStatsAndSave, isSleepTime, onSleepDisturbance);
          setDigimonStats((prevStats) => {
            // 레이스 컨디션 방지: 동일 액션이 연달아 호출되면 prev에 이미 로그가 있을 수 있음
            if (hasDuplicateSleepDisturbanceLog(prevStats.activityLogs || [], Date.now())) return prevStats;
            const actionType = type === "meat" ? "고기" : "프로틴";
            const newLog = {
              type: "CARE_MISTAKE",
              text: `수면 방해(사유: 먹이 주기 - ${actionType}): 10분 동안 깨어있음`,
              timestamp: Date.now(),
            };
            const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 100);
            if (appendLogToSubcollection) appendLogToSubcollection(newLog).catch(() => {});
            const statsWithLogs = { ...statsAfterWake, activityLogs: updatedLogs };
            setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
              console.error("수면 방해 로그 저장 오류:", error);
            });
            return statsWithLogs;
          });
        }
      }
      // 수면 방해로 깨어난 경우 statsAfterWake를 사용, 그렇지 않으면 currentStats 사용
      const baseStats = nowSleeping ? statsAfterWake : currentStats;
      
      const oldFullness = baseStats.fullness || 0;
      const oldWeight = baseStats.weight || 0;
      const oldStrength = baseStats.strength || 0;
      const oldEnergy = baseStats.energy || 0;
      const oldOverfeeds = baseStats.overfeeds || 0;
      
      // 먹이기 로직 실행 (결과 객체도 함께 받음)
      let eatResult;
      let updatedStats;
      if (isRefused && type === "meat") {
        // 거절 상태이고 "아니오"를 선택한 경우: feedMeat 호출하지 않음 (overfeed 증가 없음)
        updatedStats = baseStats;
        eatResult = { updatedStats, fullnessIncreased: false, canEatMore: false, isOverfeed: false };
      } else if (type === "meat") {
        // 거절 상태에서 "예"를 선택한 경우 forceFeed = true로 전달
        const wasRefusing = willRefuseMeat(baseStats);
        eatResult = feedMeat(baseStats, wasRefusing && !isRefused); // wasRefusing이 true이고 isRefused가 false면 forceFeed = true
        updatedStats = eatResult.updatedStats;
      } else {
        eatResult = feedProtein(baseStats);
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
      
      // 디버깅: 오버피드 관련 변수 추적
      if (type === "meat") {
        console.log("[eatCycle] 오버피드 변수 추적:", {
          oldFullness,
          newFullness,
          oldOverfeeds,
          newOverfeeds,
          isOverfeed: eatResult.isOverfeed,
          maxFullness: 5 + (baseStats.maxOverfeed || 0),
        });
      }
      
      // 델타 계산
      const weightDelta = newWeight - oldWeight;
      const fullnessDelta = newFullness - oldFullness;
      const strengthDelta = newStrength - oldStrength;
      const energyDelta = newEnergy - oldEnergy;
      
      let logText = '';
      if (type === "meat") {
        if (eatResult.isOverfeed) {
          // 오버피드 발생 시: 거절 상태에서 고기를 주면 오버피드만 증가
          logText = `Overfeed! (거절 상태, Overfeed ${oldOverfeeds}→${newOverfeeds})`;
        } else if (isRefused) {
          // 거절 애니메이션만 (overfeed 증가 없음)
          logText = `Feed: Refused (고기 거절, Overfeed 증가 없음)`;
        } else {
          logText = `Feed: Meat (Wt +${weightDelta}g, Hun +${fullnessDelta}) => (Wt ${oldWeight}→${newWeight}g, Hun ${oldFullness}→${newFullness})`;
        }
      } else {
        // Protein 로그: Strength는 항상 표시
        const strengthChanged = strengthDelta > 0;
        const strengthText = strengthChanged ? `, Str +${strengthDelta}` : '';
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
      setDigimonStats((prevStats) => {
        const newLog = { type: "FEED", text: logText, timestamp: Date.now() };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 100);
        if (appendLogToSubcollection) appendLogToSubcollection(newLog).catch(() => {});
        const statsWithLogs = { ...updatedStats, activityLogs: updatedLogs };
        setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
          console.error("먹이 로그 저장 오류:", error);
        });
        return statsWithLogs;
      });
    }
    
    // 거절 상태일 때는 4프레임 애니메이션 (각 500ms, 총 2초)
    if (isRefused) {
      // 거절 애니메이션: 4프레임 (각 500ms)
      if (step >= 4) {
        // 애니메이션 종료
        setCurrentAnimation("idle");
        setShowFood(false);
        setFeedStep(0);
        return;
      }
      // 거절 애니메이션 진행
      setCurrentAnimation("foodRejectRefuse");
      setFeedStep(step);
      setTimeout(() => eatCycle(step + 1, type, isRefused), 500);
      return;
    }
    
    // 애니메이션 종료 처리
    if(step>=frameCount){
      setCurrentAnimation("idle");
      setShowFood(false);
      return;
    }
    
    // 애니메이션 진행
    setCurrentAnimation("eat");
    setFeedStep(step);
    setTimeout(()=> eatCycle(step+1, type, isRefused),500);
  };

  /**
   * 훈련 결과 핸들러
   */
  const handleTrainResult = async (userSelections) => {
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    
    // 수면 중 훈련 시도 시 수면 방해 처리 (실제 액션 수행 시점)
    const schedule = getSleepSchedule(digimonData, selectedDigimon, updatedStats);
    const isSleepTime = isWithinSleepSchedule(schedule, new Date());
    const nowSleeping = isSleepTime && !(wakeUntil && Date.now() < wakeUntil);
    
    // wakeForInteraction에서 이미 sleepDisturbances가 증가된 스탯을 반환받음
    let statsAfterWake = updatedStats;
    if (nowSleeping) {
      if (hasDuplicateSleepDisturbanceLog(updatedStats.activityLogs || [], Date.now())) {
        statsAfterWake = updatedStats; // 15분 창 내 중복 수면 방해 방지
      } else {
        statsAfterWake = wakeForInteraction(updatedStats, setWakeUntil, setDigimonStatsAndSave, isSleepTime, onSleepDisturbance);
        setDigimonStats((prevStats) => {
          if (hasDuplicateSleepDisturbanceLog(prevStats.activityLogs || [], Date.now())) return prevStats;
          const newLog = {
            type: "CARE_MISTAKE",
            text: "수면 방해(사유: 훈련): 10분 동안 깨어있음",
            timestamp: Date.now(),
          };
          const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 100);
          if (appendLogToSubcollection) appendLogToSubcollection(newLog).catch(() => {});
          const statsWithLogs = { ...statsAfterWake, activityLogs: updatedLogs };
          setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
            console.error("수면 방해 로그 저장 오류:", error);
          });
          return statsWithLogs;
        });
      }
    }
    
    // 수면 방해로 깨어난 경우 statsAfterWake를 사용, 그렇지 않으면 updatedStats 사용
    const baseStats = nowSleeping ? statsAfterWake : updatedStats;
    setDigimonStats(baseStats);
    
    // Weight 체크: Weight가 0 이하면 훈련 불가
    if ((baseStats.weight || 0) <= 0) {
      setDigimonStats((prevStats) => {
        const w = baseStats.weight ?? 0;
        const newLog = {
          type: "TRAIN",
          text: `훈련 건너뜀(사유: 체중 부족). 무게: ${w}g`,
          timestamp: Date.now(),
        };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 100);
        if (appendLogToSubcollection) appendLogToSubcollection(newLog).catch(() => {});
        const statsWithLogs = { ...baseStats, activityLogs: updatedLogs };
        setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
          console.error("체중 부족 로그 저장 오류:", error);
        });
        return statsWithLogs;
      });
      alert("⚠️ 체중이 너무 낮습니다!\n🍖 Eat food to gain weight!");
      return null; // null 반환하여 TrainPopup에서 처리할 수 있도록
    }
    
    // 에너지 부족 체크
    if ((baseStats.energy || 0) <= 0) {
      setDigimonStats((prevStats) => {
        const en = baseStats.energy ?? 0;
        const w = baseStats.weight ?? 0;
        const newLog = {
          type: "TRAIN",
          text: `훈련 건너뜀(사유: 에너지 부족). 에너지: ${en}, 무게: ${w}g`,
          timestamp: Date.now(),
        };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 100);
        if (appendLogToSubcollection) appendLogToSubcollection(newLog).catch(() => {});
        const statsWithLogs = { ...baseStats, activityLogs: updatedLogs };
        setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
          console.error("에너지 부족 로그 저장 오류:", error);
        });
        return statsWithLogs;
      });
      // 에너지 부족 알림 가이드
      alert("⚠️ 에너지가 부족합니다!\n💤 Sleep to restore Energy!");
      return null; // null 반환하여 TrainPopup에서 처리할 수 있도록
    }
    
    // userSelections: 길이5의 "U"/"D" 배열
    // doVer1Training -> stats 업데이트
    const result = doVer1Training(baseStats, userSelections);
    let finalStats = result.updatedStats;
    
    // 호출 해제: strength > 0이 되면 strength 호출 리셋
    if (finalStats.strength > 0) {
      finalStats = resetCallStatus(finalStats, 'strength');
    }
    
    // 훈련 로그: 변화 전·후 값 포함
    const beforeW = baseStats.weight ?? 0;
    const beforeS = baseStats.strength ?? 0;
    const beforeE = baseStats.energy ?? 0;
    const beforeT = baseStats.trainings ?? 0;
    const afterW = finalStats.weight ?? 0;
    const afterS = finalStats.strength ?? 0;
    const afterE = finalStats.energy ?? 0;
    const afterT = finalStats.trainings ?? 0;
    const trainLogText = result.isSuccess
      ? `훈련 성공! 힘 ${beforeS}→${afterS}, 무게 ${beforeW}→${afterW}g, 에너지 ${beforeE}→${afterE}, 훈련횟수 ${beforeT}→${afterT}`
      : `훈련 실패. 힘 ${beforeS}→${afterS}, 무게 ${beforeW}→${afterW}g, 에너지 ${beforeE}→${afterE}, 훈련횟수 ${beforeT}→${afterT}`;

    setDigimonStats((prev) => {
      const newLog = {
        text: trainLogText,
        type: "TRAIN",
        timestamp: Date.now(),
      };
      const updatedLogs = [newLog, ...(prev.activityLogs || [])].slice(0, 100);
      if (appendLogToSubcollection) appendLogToSubcollection(newLog).catch(() => {});
      const finalStatsWithLogs = { ...finalStats, activityLogs: updatedLogs };
      setDigimonStatsAndSave(finalStatsWithLogs, updatedLogs).catch((error) => {
        console.error("훈련 결과 저장 오류:", error);
      });
      return finalStatsWithLogs;
    });
    
    // 주의: 여기서 addActivityLog()를 또 부르지 마세요! 위에서 했으니까요.
    
    // 훈련 결과 반환 (TrainPopup에서 사용)
    return result;
  };

  /**
   * 똥 청소 핸들러
   */
  const handleCleanPoop = async () => {
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    if(updatedStats.poopCount<=0){
      return;
    }
    
    // 수면 중 청소 시도 시 수면 방해 처리 (실제 액션 수행 시점)
    // cleanCycle 완료 시점(step > 3)에 처리하므로 여기서는 처리하지 않음
    // cleanCycle 내부에서 처리
    
    setDigimonStats(updatedStats);
    setShowPoopCleanAnimation(true);
    setCleanStep(0);
    cleanCycle(0);
  };

  /**
   * 똥 청소 사이클 (애니메이션)
   */
  const cleanCycle = async (step) => {
    if(step>3){
      setShowPoopCleanAnimation(false);
      setCleanStep(0);
      const now = new Date();
      
      // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
      setDigimonStats((prevStats) => {
        const oldPoopCount = prevStats.poopCount || 0;
        
        const updatedStats = {
          ...prevStats,
          poopCount: 0,
          lastMaxPoopTime: null,
          // 똥 청소 시 부상 상태는 해제하지 않음 (치료제로만 회복 가능)
          // isInjured는 그대로 유지
          lastSavedAt: now
        };
        
        // Activity Log 추가
        let logText = `Cleaned Poop (Full flush, ${oldPoopCount} → 0)`;
        // 똥 청소 시 부상 상태는 자동으로 회복되지 않음
        
        const newLog = { type: "CLEAN", text: logText, timestamp: Date.now() };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 100);
        if (appendLogToSubcollection) appendLogToSubcollection(newLog).catch(() => {});
        const statsWithLogs = { ...updatedStats, activityLogs: updatedLogs };
        setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
          console.error("청소 상태 저장 오류:", error);
        });
        return statsWithLogs;
      });
      return;
    }
    setCleanStep(step);
    setTimeout(()=> cleanCycle(step+1), 400);
  };

  /**
   * 배틀 완료 핸들러
   */
  const handleBattleComplete = async (battleResult) => {
    // Sparring 모드는 배틀 횟수에 반영하지 않고 로그만 남김
    if (battleType === 'sparring') {
      const updatedStats = await applyLazyUpdateBeforeAction();
      
      // Ver.1 스펙: Weight -4g, Energy -1 (승패 무관)
      const oldWeight = updatedStats.weight || 0;
      const oldEnergy = updatedStats.energy || 0;
      const battleStats = {
        ...updatedStats,
        weight: Math.max(0, (updatedStats.weight || 0) - 4),
        energy: Math.max(0, (updatedStats.energy || 0) - 1),
      };
      const newWeight = battleStats.weight || 0;
      const newEnergy = battleStats.energy || 0;
      const weightDelta = newWeight - oldWeight;
      const energyDelta = newEnergy - oldEnergy;
      
      const sparringText = `Sparring: Practice Match (No Record) (Wt ${weightDelta}g, En ${energyDelta})`;
      const sparringEntry = { mode: "sparring", text: sparringText, win: battleResult.win, timestamp: Date.now() };
      setDigimonStats((prevStats) => {
        const updatedBattleLogs = appendBattleLog(prevStats.battleLogs, sparringEntry);
        if (appendBattleLogToSubcollection) appendBattleLogToSubcollection(sparringEntry).catch(() => {});
        const statsWithBattleLogs = { ...battleStats, battleLogs: updatedBattleLogs };
        setDigimonStatsAndSave(statsWithBattleLogs).catch((error) => {
          console.error("스파링 로그 저장 오류:", error);
        });
        return statsWithBattleLogs;
      });
      
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

      const enemyEntryId = arenaEnemyId || arenaChallenger.id;
      if (!enemyEntryId) {
        console.error("Arena Enemy Entry ID가 없습니다. 업데이트를 건너뜁니다.");
        alert("배틀 결과를 저장할 수 없습니다. Enemy Entry ID가 없습니다.");
        setShowBattleScreen(false);
        setBattleType(null);
        setArenaChallenger(null);
        setArenaEnemyId(null);
        setMyArenaEntryId(null);
        setShowArenaScreen(true);
        return;
      }

      // 디버깅: myArenaEntryId 확인
      console.log("🔍 [Arena Battle Complete] 디버깅 정보:", {
        myArenaEntryId,
        enemyEntryId,
        battleResult: battleResult.win ? "WIN" : "LOSS",
        currentSlotId: slotId,
        currentUser: currentUser.uid
      });

      if (!myArenaEntryId) {
        console.warn("⚠️ 내 엔트리 ID가 없습니다! 현재 슬롯과 매칭되는 엔트리를 찾을 수 없습니다.");
        alert("⚠️ 경고: 내 엔트리 ID를 찾을 수 없어 내 승패 기록이 업데이트되지 않을 수 있습니다.\n\n현재 슬롯이 아레나에 등록되어 있는지 확인해주세요.");
      }

      try {
        const challengerRef = doc(db, 'arena_entries', enemyEntryId);
        
        // 내 엔트리와 상대방 엔트리 모두 업데이트
        const updatePromises = [];

        if (battleResult.win) {
          // 내가 승리: 내 엔트리 wins 증가, 상대방 losses 증가
          if (myArenaEntryId) {
            const myEntryRef = doc(db, 'arena_entries', myArenaEntryId);
            updatePromises.push(
              updateDoc(myEntryRef, {
                'record.wins': increment(1),
                'record.seasonWins': increment(1),
                'record.seasonId': currentSeasonId,
              }).then(() => {
                console.log("✅ 내 엔트리 wins 업데이트 완료:", myArenaEntryId);
              }).catch((error) => {
                console.error("❌ 내 엔트리 wins 업데이트 실패:", error);
                throw error;
              })
            );
            console.log("📝 내 엔트리 wins 업데이트 예정:", myArenaEntryId);
          } else {
            console.warn("⚠️ myArenaEntryId가 없어 내 엔트리 업데이트를 건너뜁니다.");
          }
          
          updatePromises.push(
            updateDoc(challengerRef, {
              'record.losses': increment(1),
              'record.seasonLosses': increment(1),
              'record.seasonId': currentSeasonId,
            }).then(() => {
              console.log("✅ 상대방 losses 업데이트 완료:", enemyEntryId);
            }).catch((error) => {
              console.error("❌ 상대방 losses 업데이트 실패:", error);
              throw error;
            })
          );
          console.log("📝 상대방 losses 업데이트 예정:", enemyEntryId);
        } else {
          // 내가 패배: 내 엔트리 losses 증가, 상대방 wins 증가
          if (myArenaEntryId) {
            const myEntryRef = doc(db, 'arena_entries', myArenaEntryId);
            updatePromises.push(
              updateDoc(myEntryRef, {
                'record.losses': increment(1),
                'record.seasonLosses': increment(1),
                'record.seasonId': currentSeasonId,
              }).then(() => {
                console.log("✅ 내 엔트리 losses 업데이트 완료:", myArenaEntryId);
              }).catch((error) => {
                console.error("❌ 내 엔트리 losses 업데이트 실패:", error);
                throw error;
              })
            );
            console.log("📝 내 엔트리 losses 업데이트 예정:", myArenaEntryId);
          } else {
            console.warn("⚠️ myArenaEntryId가 없어 내 엔트리 업데이트를 건너뜁니다.");
          }
          
          updatePromises.push(
            updateDoc(challengerRef, {
              'record.wins': increment(1),
              'record.seasonWins': increment(1),
              'record.seasonId': currentSeasonId,
            }).then(() => {
              console.log("✅ 상대방 wins 업데이트 완료:", enemyEntryId);
            }).catch((error) => {
              console.error("❌ 상대방 wins 업데이트 실패:", error);
              throw error;
            })
          );
          console.log("📝 상대방 wins 업데이트 예정:", enemyEntryId);
        }
        
        // 모든 업데이트를 병렬로 실행
        await Promise.all(updatePromises);
        console.log("✅ DB Update Success: 내 엔트리와 상대방 엔트리 모두 업데이트 완료");
        
        // 업데이트 후 잠시 대기 (Firestore 반영 시간)
        await new Promise(resolve => setTimeout(resolve, 500));

        const userDigimonName = selectedDigimon || "Unknown";
        const enemyDigimonName = arenaChallenger.digimonSnapshot?.digimonName || "Unknown";
        const logSummary = battleResult.win
          ? `${currentUser.displayName || slotName || `슬롯${slotId}`}'s ${userDigimonName} defeated ${arenaChallenger.tamerName || arenaChallenger.trainerName || 'Unknown'}'s ${enemyDigimonName}`
          : `${arenaChallenger.tamerName || arenaChallenger.trainerName || 'Unknown'}'s ${enemyDigimonName} defeated ${currentUser.displayName || slotName || `슬롯${slotId}`}'s ${userDigimonName}`;

        const battleLogData = {
          attackerId: currentUser.uid,
          attackerName: currentUser.displayName || slotName || `슬롯${slotId}`,
          attackerDigimonName: userDigimonName, // 공격자의 디지몬 이름
          defenderId: arenaChallenger.userId,
          defenderName: arenaChallenger.tamerName || arenaChallenger.trainerName || 'Unknown',
          defenderDigimonName: enemyDigimonName, // 방어자의 디지몬 이름
          defenderEntryId: enemyEntryId,
          myEntryId: myArenaEntryId,
          winnerId: battleResult.win ? currentUser.uid : arenaChallenger.userId,
          timestamp: serverTimestamp(),
          logSummary: logSummary,
          logs: battleResult.logs || [], // 배틀 상세 로그 저장 (다시보기용)
        };

        const battleLogsRef = collection(db, 'arena_battle_logs');
        const logDocRef = await addDoc(battleLogsRef, battleLogData);
        console.log("✅ DB Update Success: 배틀 로그 저장 완료, ID:", logDocRef.id);
        console.log("✅ 배틀 결과가 성공적으로 저장되었습니다!");
      } catch (error) {
        console.error("❌ DB Update Failed:", error);
        console.error("오류 상세:", {
          code: error.code,
          message: error.message,
          challengerId: enemyEntryId,
        });
        alert(`❌ 배틀 결과 저장 실패:\n${error.message || error.code || "알 수 없는 오류"}`);
      }

      // Arena 모드: 로컬 스탯 업데이트 (배틀 기록 + Activity Log)
      const updatedStats = await applyLazyUpdateBeforeAction();
      const oldWeight = updatedStats.weight || 0;
      const oldEnergy = updatedStats.energy || 0;
      
      // Ver.1 스펙: Weight -4g, Energy -1 (승패 무관)
      const battleStats = {
        ...updatedStats,
        weight: Math.max(0, (updatedStats.weight || 0) - 4),
        energy: Math.max(0, (updatedStats.energy || 0) - 1),
      };
      
      // 배틀 스탯 업데이트 (Quest 모드와 동일한 로직)
      let finalStats;
      if (battleResult.win) {
        // 승리 시 배틀 기록 업데이트
        // 현재 디지몬 값
        const newBattles = (battleStats.battles || 0) + 1;
        const newBattlesWon = (battleStats.battlesWon || 0) + 1;
        const newWinRate = newBattles > 0 ? Math.round((newBattlesWon / newBattles) * 100) : 0;
        
        // 총 토탈 값
        const newTotalBattles = (battleStats.totalBattles || 0) + 1;
        const newTotalBattlesWon = (battleStats.totalBattlesWon || 0) + 1;
        const newTotalWinRate = newTotalBattles > 0 ? Math.round((newTotalBattlesWon / newTotalBattles) * 100) : 0;
        
        finalStats = {
          ...battleStats,
          // 현재 디지몬 값
          battles: newBattles,
          battlesWon: newBattlesWon,
          winRate: newWinRate,
          // 총 토탈 값
          totalBattles: newTotalBattles,
          totalBattlesWon: newTotalBattlesWon,
          totalWinRate: newTotalWinRate,
        };
      } else {
        // 패배 시 배틀 기록 업데이트
        // 현재 디지몬 값
        const newBattles = (battleStats.battles || 0) + 1;
        const newBattlesLost = (battleStats.battlesLost || 0) + 1;
        const newBattlesWon = battleStats.battlesWon || 0;
        const newWinRate = newBattles > 0 ? Math.round((newBattlesWon / newBattles) * 100) : 0;
        
        // 총 토탈 값
        const newTotalBattles = (battleStats.totalBattles || 0) + 1;
        const newTotalBattlesLost = (battleStats.totalBattlesLost || 0) + 1;
        const newTotalBattlesWon = battleStats.totalBattlesWon || 0;
        const newTotalWinRate = newTotalBattles > 0 ? Math.round((newTotalBattlesWon / newTotalBattles) * 100) : 0;
        
        finalStats = {
          ...battleStats,
          // 현재 디지몬 값
          battles: newBattles,
          battlesLost: newBattlesLost,
          winRate: newWinRate,
          // 총 토탈 값
          totalBattles: newTotalBattles,
          totalBattlesLost: newTotalBattlesLost,
          totalWinRate: newTotalWinRate,
        };
      }
      
      const newWeight = battleStats.weight || 0;
      const newEnergy = battleStats.energy || 0;
      const weightDelta = newWeight - oldWeight;
      const energyDelta = newEnergy - oldEnergy;
      
      const tamerName = arenaChallenger.tamerName || arenaChallenger.trainerName || "Unknown";
      const arenaText = battleResult.win
        ? `Arena: Won vs ${tamerName} (Rank UP) (Wt ${weightDelta}g, En ${energyDelta})`
        : `Arena: Lost vs ${tamerName} (Wt ${weightDelta}g, En ${energyDelta})`;
      const arenaEntry = { mode: "arena", text: arenaText, win: battleResult.win, enemyName: tamerName, timestamp: Date.now() };
      setDigimonStats((prevStats) => {
        const updatedBattleLogs = appendBattleLog(prevStats.battleLogs, arenaEntry);
        if (appendBattleLogToSubcollection) appendBattleLogToSubcollection(arenaEntry).catch(() => {});
        const statsWithBattleLogs = { ...finalStats, battleLogs: updatedBattleLogs };
        setDigimonStatsAndSave(statsWithBattleLogs).catch((error) => {
          console.error("아레나 로그 저장 오류:", error);
        });
        return statsWithBattleLogs;
      });
      
      console.log("✅ [Arena] 로컬 배틀 스탯 업데이트 완료:", {
        battles: finalStats.battles,
        battlesWon: finalStats.battlesWon,
        battlesLost: finalStats.battlesLost,
        winRate: finalStats.winRate,
        totalBattles: finalStats.totalBattles,
      });

      setShowBattleScreen(false);
      setBattleType(null);
      setArenaChallenger(null);
      setArenaEnemyId(null);
      setMyArenaEntryId(null);
      setShowArenaScreen(true);
      return;
    }

    // Quest 모드: Ver.1 스펙 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    
    // 에너지 부족 체크 (배틀 시작 전)
    if ((updatedStats.energy || 0) <= 0) {
      setDigimonStats((prevStats) => {
        const skipEntry = { mode: "skip", text: "Battle: Skipped (Not enough Energy)", timestamp: Date.now() };
        const updatedBattleLogs = appendBattleLog(prevStats.battleLogs, skipEntry);
        if (appendBattleLogToSubcollection) appendBattleLogToSubcollection(skipEntry).catch(() => {});
        const statsWithBattleLogs = { ...updatedStats, battleLogs: updatedBattleLogs };
        setDigimonStatsAndSave(statsWithBattleLogs).catch((error) => {
          console.error("에너지 부족 배틀 로그 저장 오류:", error);
        });
        return statsWithBattleLogs;
      });
      alert("⚠️ 에너지가 부족합니다!\n💤 Sleep to restore Energy!");
      setShowBattleScreen(false);
      setBattleType(null);
      return;
    }
    
    // 수면 중 배틀 시도 시 수면 방해 처리 (실제 액션 수행 시점)
    const schedule = getSleepSchedule(digimonData, selectedDigimon, updatedStats);
    const isSleepTime = isWithinSleepSchedule(schedule, new Date());
    const nowSleeping = isSleepTime && !(wakeUntil && Date.now() < wakeUntil);
    
    // wakeForInteraction에서 이미 sleepDisturbances가 증가된 스탯을 반환받음
    let statsAfterWake = updatedStats;
    if (nowSleeping) {
      if (hasDuplicateSleepDisturbanceLog(updatedStats.activityLogs || [], Date.now())) {
        statsAfterWake = updatedStats; // 15분 창 내 중복 수면 방해 방지
      } else {
        statsAfterWake = wakeForInteraction(updatedStats, setWakeUntil, setDigimonStatsAndSave, isSleepTime, onSleepDisturbance);
        setDigimonStats((prevStats) => {
          if (hasDuplicateSleepDisturbanceLog(prevStats.activityLogs || [], Date.now())) return prevStats;
          const battleTypeText = battleType === "quest" ? "퀘스트" : battleType === "sparring" ? "스파링" : battleType === "arena" ? "아레나" : "배틀";
          const newLog = {
            type: "CARE_MISTAKE",
            text: `수면 방해(사유: 배틀 - ${battleTypeText}): 10분 동안 깨어있음`,
            timestamp: Date.now(),
          };
          const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 100);
          if (appendLogToSubcollection) appendLogToSubcollection(newLog).catch(() => {});
          const statsWithLogs = { ...statsAfterWake, activityLogs: updatedLogs };
          setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
            console.error("수면 방해 로그 저장 오류:", error);
          });
          return statsWithLogs;
        });
      }
    }
    
    const baseStats = nowSleeping ? statsAfterWake : updatedStats;
    
    // Ver.1 스펙: Weight -4g, Energy -1 (승패 무관)
    const oldWeight = baseStats.weight || 0;
    const oldEnergy = baseStats.energy || 0;
    
    const battleStats = {
      ...baseStats,
      weight: Math.max(0, (baseStats.weight || 0) - 4),
      energy: Math.max(0, (baseStats.energy || 0) - 1),
    };
    
    const enemyName = battleResult.enemyName || battleResult.enemy?.name || currentQuestArea?.name || 'Unknown Enemy';
    
    if (battleResult.win) {
      // 승리 시 배틀 기록 업데이트
      // 현재 디지몬 값
      const newBattles = (battleStats.battles || 0) + 1;
      const newBattlesWon = (battleStats.battlesWon || 0) + 1;
      const newWinRate = newBattles > 0 ? Math.round((newBattlesWon / newBattles) * 100) : 0;
      
      // 총 토탈 값
      const newTotalBattles = (battleStats.totalBattles || 0) + 1;
      const newTotalBattlesWon = (battleStats.totalBattlesWon || 0) + 1;
      const newTotalWinRate = newTotalBattles > 0 ? Math.round((newTotalBattlesWon / newTotalBattles) * 100) : 0;
      
      const finalStats = {
        ...battleStats,
        // 현재 디지몬 값
        battles: newBattles,
        battlesWon: newBattlesWon,
        winRate: newWinRate,
        // 총 토탈 값
        totalBattles: newTotalBattles,
        totalBattlesWon: newTotalBattlesWon,
        totalWinRate: newTotalWinRate,
      };
      
      // 부상 확률 체크 (승리 시 20%)
      const proteinOverdose = battleStats.proteinOverdose || 0;
      const injuryChance = calculateInjuryChance(true, proteinOverdose);
      const isInjured = Math.random() * 100 < injuryChance;
      
      if (isInjured) {
        finalStats.isInjured = true;
        finalStats.injuredAt = Date.now();
        finalStats.injuries = (battleStats.injuries || 0) + 1;
        finalStats.healedDosesCurrent = 0;
        finalStats.injuryReason = 'battle'; // 부상 원인 저장
      }
      
      const newWeight = battleStats.weight || 0;
      const newEnergy = battleStats.energy || 0;
      const weightDelta = newWeight - oldWeight;
      const energyDelta = newEnergy - oldEnergy;
      
      let questWinText = battleResult.isAreaClear
        ? `Quest: Defeated ${enemyName} (Stage Clear) (Wt ${weightDelta}g, En ${energyDelta})`
        : `Quest: Defeated ${enemyName} (Wt ${weightDelta}g, En ${energyDelta})`;
      if (isInjured) questWinText += " - Battle: Injured! (Chance hit)";
      const questWinEntry = { mode: "quest", text: questWinText, win: true, enemyName, injury: isInjured, timestamp: Date.now() };
      setDigimonStats((prevStats) => {
        const updatedBattleLogs = appendBattleLog(prevStats.battleLogs, questWinEntry);
        if (appendBattleLogToSubcollection) appendBattleLogToSubcollection(questWinEntry).catch(() => {});
        const statsWithBattleLogs = { ...finalStats, battleLogs: updatedBattleLogs };
        setDigimonStatsAndSave(statsWithBattleLogs).catch((error) => {
          console.error("퀘스트 승리 로그 저장 오류:", error);
        });
        return statsWithBattleLogs;
      });

      if (battleResult.isAreaClear) {
        alert(battleResult.reward || "Area 클리어!");
        setShowBattleScreen(false);
        setCurrentQuestArea(null);
        setCurrentQuestRound(0);
      } else {
        setCurrentQuestRound(prev => prev + 1);
      }
    } else {
      // 패배 시 배틀 기록 업데이트
      // 현재 디지몬 값
      const newBattles = (battleStats.battles || 0) + 1;
      const newBattlesLost = (battleStats.battlesLost || 0) + 1;
      const newBattlesWon = battleStats.battlesWon || 0;
      const newWinRate = newBattles > 0 ? Math.round((newBattlesWon / newBattles) * 100) : 0;
      
      // 총 토탈 값
      const newTotalBattles = (battleStats.totalBattles || 0) + 1;
      const newTotalBattlesLost = (battleStats.totalBattlesLost || 0) + 1;
      const newTotalBattlesWon = battleStats.totalBattlesWon || 0;
      const newTotalWinRate = newTotalBattles > 0 ? Math.round((newTotalBattlesWon / newTotalBattles) * 100) : 0;
      
      const finalStats = {
        ...battleStats,
        // 현재 디지몬 값
        battles: newBattles,
        battlesLost: newBattlesLost,
        winRate: newWinRate,
        // 총 토탈 값
        totalBattles: newTotalBattles,
        totalBattlesLost: newTotalBattlesLost,
        totalWinRate: newTotalWinRate,
      };
      
      // 부상 확률 체크 (패배 시 10% + 프로틴 과다 * 10%, 최대 80%)
      const proteinOverdose = battleStats.proteinOverdose || 0;
      const injuryChance = calculateInjuryChance(false, proteinOverdose);
      const isInjured = Math.random() * 100 < injuryChance;
      
      if (isInjured) {
        finalStats.isInjured = true;
        finalStats.injuredAt = Date.now();
        finalStats.injuries = (battleStats.injuries || 0) + 1;
        finalStats.healedDosesCurrent = 0;
        finalStats.injuryReason = 'battle'; // 부상 원인 저장
      }
      
      const newWeight = battleStats.weight || 0;
      const newEnergy = battleStats.energy || 0;
      const weightDelta = newWeight - oldWeight;
      const energyDelta = newEnergy - oldEnergy;
      
      let questLoseText = `Quest: Defeated by ${enemyName} (Wt ${weightDelta}g, En ${energyDelta})`;
      if (isInjured) questLoseText += " - Battle: Injured! (Chance hit)";
      const questLoseEntry = { mode: "quest", text: questLoseText, win: false, enemyName, injury: isInjured, timestamp: Date.now() };
      setDigimonStats((prevStats) => {
        const updatedBattleLogs = appendBattleLog(prevStats.battleLogs, questLoseEntry);
        if (appendBattleLogToSubcollection) appendBattleLogToSubcollection(questLoseEntry).catch(() => {});
        const statsWithBattleLogs = { ...finalStats, battleLogs: updatedBattleLogs };
        setDigimonStatsAndSave(statsWithBattleLogs).catch((error) => {
          console.error("퀘스트 패배 로그 저장 오류:", error);
        });
        return statsWithBattleLogs;
      });
    }
  };

  return {
    handleFeed,
    handleTrainResult,
    handleBattleComplete,
    handleCleanPoop,
    eatCycle,
    cleanCycle,
  };
}
