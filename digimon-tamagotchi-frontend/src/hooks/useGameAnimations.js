// src/hooks/useGameAnimations.js
// Game.jsx의 애니메이션 사이클 로직을 분리한 Custom Hook

import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { addActivityLog, resetCallStatus } from "./useGameLogic";
import { feedMeat } from "../logic/food/meat";
import { feedProtein } from "../logic/food/protein";
import { getSleepSchedule, isWithinSleepSchedule } from "./useGameHandlers";

/**
 * useGameAnimations Hook
 * 애니메이션 사이클 로직을 관리하는 Custom Hook
 * 
 * @param {Object} params - Hook 파라미터
 * @param {Object} params.digimonStats - 현재 디지몬 스탯
 * @param {Function} params.setDigimonStats - 스탯 업데이트 함수
 * @param {Array} params.activityLogs - 활동 로그 배열
 * @param {Function} params.setActivityLogs - 활동 로그 업데이트 함수
 * @param {Object} params.modals - 모달 상태 객체
 * @param {Function} params.toggleModal - 모달 토글 함수
 * @param {Function} params.setCurrentAnimation - 애니메이션 설정 함수
 * @param {Function} params.setFeedStep - 먹이 단계 설정 함수
 * @param {Function} params.setCleanStep - 청소 단계 설정 함수
 * @param {Function} params.setHealStep - 치료 단계 설정 함수
 * @param {Function} params.applyLazyUpdateBeforeAction - 액션 전 Lazy Update 적용 함수
 * @param {Function} params.setDigimonStatsAndSave - 스탯 저장 함수
 * @param {string} params.slotId - 슬롯 ID
 * @param {Object} params.currentUser - 현재 사용자 객체
 * @param {boolean} params.isLightsOn - 조명 상태
 * @param {number} params.wakeUntil - 깨울 때까지 시간
 * @param {string} params.selectedDigimon - 선택된 디지몬 이름
 * @param {Object} params.newDigimonDataVer1 - 디지몬 데이터
 * @returns {Object} 애니메이션 시작 함수들
 */
export function useGameAnimations({
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
  onSleepDisturbance = null,
}) {
  /**
   * 먹이기 애니메이션 사이클
   * 첫 번째 프레임에서 스탯을 즉시 증가시킴
   * @param {number} step - 현재 단계
   * @param {string} type - 먹이 타입 ("meat" | "protein")
   */
  const eatCycle = async (step, type) => {
    const frameCount = type === "protein" ? 3 : 4;
    
    // 첫 번째 프레임에서 스탯 즉시 업데이트
    if (step === 0) {
      // 최신 스탯 가져오기
      const currentStats = await applyLazyUpdateBeforeAction();
      const oldFullness = currentStats.fullness || 0;
      const oldWeight = currentStats.weight || 0;
      const oldStrength = currentStats.strength || 0;
      const oldEnergy = currentStats.energy || 0;
      const oldOverfeeds = currentStats.overfeeds || 0;
      const oldHungerCountdown = currentStats.hungerCountdown || 0;
      
      // 먹이기 로직 실행
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
      
      // 상세 Activity Log 추가
      const newFullness = updatedStats.fullness || 0;
      const newWeight = updatedStats.weight || 0;
      const newStrength = updatedStats.strength || 0;
      const newEnergy = updatedStats.energy || 0;
      const newOverfeeds = updatedStats.overfeeds || 0;
      const newHungerCountdown = updatedStats.hungerCountdown || 0;
      
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
          // 오버피드 발생 시
          const hungerCycleMinutes = Math.floor(hungerCountdownDelta / 60);
          logText = `Overfeed! Hunger drop delayed (Wt +${weightDelta}g, HungerCycle +${hungerCycleMinutes}min)`;
        } else if (newOverfeeds > oldOverfeeds) {
          logText = `Overfeed: Stuffed! (Wt +${weightDelta}g, Hun +${fullnessDelta}, Overfeed +${overfeedsDelta}) => (Wt ${oldWeight}→${newWeight}g, Hun ${oldFullness}→${newFullness}, Overfeed ${oldOverfeeds}→${newOverfeeds})`;
        } else {
          logText = `Feed: Meat (Wt +${weightDelta}g, Hun +${fullnessDelta}) => (Wt ${oldWeight}→${newWeight}g, Hun ${oldFullness}→${newFullness})`;
        }
      } else {
        // Protein 로그
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
      
      // Activity Log 추가
      const currentLogs = updatedStats.activityLogs || activityLogs || [];
      const updatedLogs = addActivityLog(currentLogs, 'FEED', logText);
      
      // updatedStats에 activityLogs 포함하여 저장
      const statsWithLogs = {
        ...updatedStats,
        activityLogs: updatedLogs,
      };
      setDigimonStatsAndSave(statsWithLogs, updatedLogs);
    }
    
    // 애니메이션 종료 처리
    if (step >= frameCount) {
      setCurrentAnimation("idle");
      toggleModal('food', false);
      return;
    }
    
    setCurrentAnimation("eat");
    setFeedStep(step);
    setTimeout(() => eatCycle(step + 1, type), 500);
  };

  /**
   * 청소 애니메이션 사이클
   * @param {number} step - 현재 단계
   */
  const cleanCycle = async (step) => {
    if (step > 3) {
      toggleModal('poopCleanAnimation', false);
      setCleanStep(0);
      
      const now = new Date();
      const oldPoopCount = digimonStats.poopCount || 0;
      
      // 수면 중 청소 시도 시 수면 방해 처리 (실제 액션 수행 시점)
      const schedule = getSleepSchedule(selectedDigimon, newDigimonDataVer1, digimonStats);
      const nowSleeping = isWithinSleepSchedule(schedule, now) && !(wakeUntil && Date.now() < wakeUntil);
      
      let updatedStats = {
        ...digimonStats,
        poopCount: 0,
        lastMaxPoopTime: null,
        // 똥 청소 시 부상 상태는 해제하지 않음 (치료제로만 회복 가능)
        // isInjured는 그대로 유지
        lastSavedAt: now
      };
      
      // 수면방해 처리
      if (nowSleeping && setWakeUntil) {
        const until = Date.now() + 10 * 60 * 1000; // 10분
        setWakeUntil(until);
        updatedStats.wakeUntil = until;
        updatedStats.sleepDisturbances = (updatedStats.sleepDisturbances || 0) + 1;
        // 수면 방해 콜백 호출
        if (onSleepDisturbance) {
          onSleepDisturbance();
        }
      }
      
      // Activity Log 추가
      let logText = `Cleaned Poop (Full flush, ${oldPoopCount} → 0)`;
      if (nowSleeping) {
        logText = `수면 방해: 화장실 청소 - 10분 동안 깨어있음`;
      }
      
      setDigimonStats(updatedStats);
      setActivityLogs((prevLogs) => {
        const currentLogs = updatedStats.activityLogs || prevLogs || [];
        const updatedLogs = addActivityLog(currentLogs, nowSleeping ? 'CARE_MISTAKE' : 'CLEAN', logText);
        
        // Firestore에도 저장 (비동기 처리)
        if (slotId && currentUser) {
          const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
          updateDoc(slotRef, {
            digimonStats: { ...updatedStats, activityLogs: updatedLogs },
            isLightsOn,
            wakeUntil: nowSleeping ? updatedStats.wakeUntil : wakeUntil,
            // activityLogs는 digimonStats 안에 이미 포함되어 있으므로 별도 저장 불필요 (중복 저장 방지)
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
    setTimeout(() => cleanCycle(step + 1), 400);
  };

  /**
   * 치료 애니메이션 사이클
   * 치료 버튼 클릭 시 즉시 치료 로직 실행 (애니메이션 없음)
   * @param {number} step - 현재 단계 (사용하지 않음, 호환성을 위해 유지)
   * @param {Object} currentStats - 현재 스탯
   */
  const healCycle = async (step, currentStats) => {
    // 즉시 치료 로직 실행 (애니메이션 단계 없음)
    setHealStep(0);
    
    // 수면 중 치료 시도 시 수면 방해 처리 (실제 액션 수행 시점)
    const schedule = getSleepSchedule(selectedDigimon, newDigimonDataVer1, currentStats);
    const nowSleeping = isWithinSleepSchedule(schedule, new Date()) && !(wakeUntil && Date.now() < wakeUntil);
    
    // 치료 로직
    const currentDigimonData = newDigimonDataVer1[selectedDigimon] || {};
    const requiredDoses = currentDigimonData.stats?.healDoses || 1; // 기본값 1
    const newHealedDoses = (currentStats.healedDosesCurrent || 0) + 1;
    
    // 랜덤 치료 종류 선택
    const treatmentTypes = [
      "수술 치료",
      "약물 치료",
      "방사선 치료",
      "물리 치료",
      "심리 치료",
      "통합 치료"
    ];
    const randomTreatment = treatmentTypes[Math.floor(Math.random() * treatmentTypes.length)];
    const treatmentMessage = `${randomTreatment} 성공`;
    
    let updatedStats = {
      ...currentStats,
      healedDosesCurrent: newHealedDoses,
    };
    
    // 수면방해 처리
    if (nowSleeping && setWakeUntil) {
      const until = Date.now() + 10 * 60 * 1000; // 10분
      setWakeUntil(until);
      updatedStats.wakeUntil = until;
      updatedStats.sleepDisturbances = (updatedStats.sleepDisturbances || 0) + 1;
      // 수면 방해 콜백 호출
      if (onSleepDisturbance) {
        onSleepDisturbance();
      }
    }
    
    // 필요 치료 횟수 충족 시 완전 회복
    if (newHealedDoses >= requiredDoses) {
      updatedStats.isInjured = false;
      updatedStats.injuredAt = null;
      updatedStats.healedDosesCurrent = 0;
      updatedStats.injuryReason = null; // 부상 원인 리셋
      const logType = nowSleeping ? 'CARE_MISTAKE' : 'HEAL';
      const logText = nowSleeping ? '수면 방해: 치료 - 10분 동안 깨어있음' : treatmentMessage;
      const updatedLogs = addActivityLog(updatedStats.activityLogs || [], logType, logText);
      setDigimonStatsAndSave({ ...updatedStats, activityLogs: updatedLogs }, updatedLogs);
      // 완전 회복 시 모달은 열어두고 확인 버튼만 보이도록 함 (모달에서 처리)
    } else {
      const logType = nowSleeping ? 'CARE_MISTAKE' : 'HEAL';
      const logText = nowSleeping ? '수면 방해: 치료 - 10분 동안 깨어있음' : treatmentMessage;
      const updatedLogs = addActivityLog(updatedStats.activityLogs || [], logType, logText);
      setDigimonStatsAndSave({ ...updatedStats, activityLogs: updatedLogs }, updatedLogs);
      // 추가 치료 필요 시 모달은 열어두고 "추가 치료가 필요합니다." 메시지 표시
    }
    
    // 스탯 업데이트하여 모달이 최신 상태를 반영하도록 함
    setDigimonStats(updatedStats);
    
    // healModalStats에 treatmentMessage를 포함하여 업데이트
    // 이렇게 하면 한 번의 상태 업데이트로 모든 정보가 전달됨
    if (setHealModalStats) {
      const modalStatsWithMessage = {
        ...updatedStats,
        treatmentMessage: treatmentMessage, // 치료 메시지를 스탯에 포함
      };
      setHealModalStats(modalStatsWithMessage);
      console.log('[healCycle] healModalStats 업데이트 (메시지 포함):', modalStatsWithMessage);
    }
    
    // treatmentMessage 상태도 별도로 업데이트 (호환성을 위해)
    if (setHealTreatmentMessage) {
      setHealTreatmentMessage(treatmentMessage);
    }
    // 모달은 열어두고 (닫지 않음) 최신 스탯으로 업데이트
  };

  /**
   * 먹이기 애니메이션 시작
   * @param {string} type - 먹이 타입 ("meat" | "protein")
   */
  const startEatCycle = (type) => {
    eatCycle(0, type);
  };

  /**
   * 청소 애니메이션 시작
   */
  const startCleanCycle = () => {
    cleanCycle(0);
  };

  /**
   * 치료 애니메이션 시작
   * 치료 버튼 클릭 시 즉시 치료 로직 실행 (애니메이션 없음)
   */
  const startHealCycle = async () => {
    const updatedStats = await applyLazyUpdateBeforeAction();
    if (updatedStats.isDead || !updatedStats.isInjured) {
      toggleModal('heal', false);
      return;
    }
    // 모달은 이미 열려있으므로 치료 로직만 즉시 실행
    healCycle(0, updatedStats);
  };

  return {
    startEatCycle,
    startCleanCycle,
    startHealCycle,
  };
}


