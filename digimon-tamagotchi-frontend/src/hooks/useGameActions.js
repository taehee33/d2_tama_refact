// src/hooks/useGameActions.js
// Game.jsx의 비즈니스 로직을 분리한 Custom Hook

import { resetCallStatus } from "./useGameLogic";
import { feedMeat, willRefuseMeat } from "../logic/food/meat";
import { feedProtein, willRefuseProtein } from "../logic/food/protein";
import { doVer1Training } from "../data/train_digitalmonstercolor25th_ver1";
import { calculateInjuryChance } from "../logic/battle/calculator";
import { doc, updateDoc, collection, addDoc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../firebase";

/**
 * 수면 스케줄 가져오기
 */
function getSleepSchedule(digimonData, name) {
  const data = digimonData[name] || {};
  return data.sleepSchedule || { start: 22, end: 6 };
}

/**
 * 현재 시간이 수면 스케줄 내에 있는지 확인
 */
function isWithinSleepSchedule(schedule, nowDate = new Date()) {
  const hour = nowDate.getHours();
  const { start, end } = schedule || { start: 22, end: 6 };
  if (start === end) return false;
  if (start < end) {
    return hour >= start && hour < end;
  }
  // 자정 넘김
  return hour >= start || hour < end;
}

/**
 * 수면 중 인터랙션 시 10분 깨우기 + 수면방해 카운트
 */
function wakeForInteraction(digimonStats, setWakeUntil, setDigimonStatsAndSave) {
  const until = Date.now() + 10 * 60 * 1000; // 10분
  setWakeUntil(until);
  const updated = {
    ...digimonStats,
    wakeUntil: until,
    sleepDisturbances: (digimonStats.sleepDisturbances || 0) + 1,
  };
  setDigimonStatsAndSave(updated);
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
  setArenaChallenger,
  setArenaEnemyId,
  setMyArenaEntryId,
  setShowArenaScreen,
  currentSeasonId,
  currentQuestArea,
  setCurrentQuestArea,
  setCurrentQuestRound,
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
    
    // 수면 중 먹이 시도 시 수면 방해 처리
    const schedule = getSleepSchedule(digimonData, selectedDigimon);
    const nowSleeping = isWithinSleepSchedule(schedule, new Date()) && !(wakeUntil && Date.now() < wakeUntil);
    if (nowSleeping) {
      wakeForInteraction(updatedStats, setWakeUntil, setDigimonStatsAndSave);
      // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
      setDigimonStats((prevStats) => {
        const newLog = {
          type: 'CARE_MISTAKE',
          text: 'Disturbed Sleep! (Wake +10m, Mistake +1)',
          timestamp: Date.now()
        };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
        const statsWithLogs = {
          ...updatedStats,
          sleepDisturbances: (updatedStats.sleepDisturbances || 0) + 1,
          activityLogs: updatedLogs
        };
        setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
          console.error("수면 방해 로그 저장 오류:", error);
        });
        return statsWithLogs;
      });
    }
    
    // 업데이트된 스탯으로 작업
    setDigimonStats(updatedStats);
    
    // 매뉴얼 기반 거부 체크
    if(type==="meat"){
      if(willRefuseMeat(updatedStats)){
        setCurrentAnimation("foodRejectRefuse");
        setShowFood(false);
        setFeedStep(0);
        // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
        setDigimonStats((prevStats) => {
          const newLog = {
            type: 'FEED',
            text: 'Feed: Refused (Already stuffed)',
            timestamp: Date.now()
          };
          const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
          const statsWithLogs = {
            ...updatedStats,
            activityLogs: updatedLogs
          };
          setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
            console.error("먹이 거부 로그 저장 오류:", error);
          });
          return statsWithLogs;
        });
        setTimeout(()=> setCurrentAnimation("idle"),2000);
        return;
      }
    } else {
      if(willRefuseProtein(updatedStats)){
        setCurrentAnimation("foodRejectRefuse");
        setShowFood(false);
        setFeedStep(0);
        // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
        setDigimonStats((prevStats) => {
          const newLog = {
            type: 'FEED',
            text: 'Feed: Refused (Already stuffed)',
            timestamp: Date.now()
          };
          const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
          const statsWithLogs = {
            ...updatedStats,
            activityLogs: updatedLogs
          };
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
    setShowFood(true);
    setFeedStep(0);
    eatCycle(0, type);
  };

  /**
   * 먹이 주기 사이클 (애니메이션)
   */
  const eatCycle = async (step, type) => {
    const frameCount = (type==="protein"?3:4);
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
      const oldHungerCountdown = currentStats.hungerCountdown || 0;
      
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
      // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
      setDigimonStats((prevStats) => {
        const newLog = {
          type: 'FEED',
          text: logText,
          timestamp: Date.now()
        };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
        const statsWithLogs = {
          ...updatedStats,
          activityLogs: updatedLogs
        };
        setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
          console.error("먹이 로그 저장 오류:", error);
        });
        return statsWithLogs;
      });
      return;
    }
    setCurrentAnimation("eat");
    setFeedStep(step);
    setTimeout(()=> eatCycle(step+1,type),500);
  };

  /**
   * 훈련 결과 핸들러
   */
  const handleTrainResult = async (userSelections) => {
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    
    // 수면 중 훈련 시도 시 수면 방해 처리
    const schedule = getSleepSchedule(digimonData, selectedDigimon);
    const nowSleeping = isWithinSleepSchedule(schedule, new Date()) && !(wakeUntil && Date.now() < wakeUntil);
    if (nowSleeping) {
      wakeForInteraction(updatedStats, setWakeUntil, setDigimonStatsAndSave);
      // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
      setDigimonStats((prevStats) => {
        const newLog = {
          type: 'CARE_MISTAKE',
          text: 'Disturbed Sleep! (Wake +10m, Mistake +1)',
          timestamp: Date.now()
        };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
        const statsWithLogs = {
          ...updatedStats,
          sleepDisturbances: (updatedStats.sleepDisturbances || 0) + 1,
          activityLogs: updatedLogs
        };
        setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
          console.error("수면 방해 로그 저장 오류:", error);
        });
        return statsWithLogs;
      });
    }
    
    setDigimonStats(updatedStats);
    
    // 에너지 부족 체크
    if ((updatedStats.energy || 0) <= 0) {
      // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
      setDigimonStats((prevStats) => {
        const newLog = {
          type: 'TRAIN',
          text: 'Training: Skipped (Not enough Energy)',
          timestamp: Date.now()
        };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
        const statsWithLogs = {
          ...updatedStats,
          activityLogs: updatedLogs
        };
        setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
          console.error("에너지 부족 로그 저장 오류:", error);
        });
        return statsWithLogs;
      });
      // 에너지 부족 알림 가이드
      alert("⚠️ 에너지가 부족합니다!\n💤 Sleep to restore Energy!");
      return;
    }
    
    // userSelections: 길이5의 "U"/"D" 배열
    // doVer1Training -> stats 업데이트
    const oldWeight = updatedStats.weight || 0;
    const oldStrength = updatedStats.strength || 0;
    const oldEnergy = updatedStats.energy || 0;
    
    const result = doVer1Training(updatedStats, userSelections);
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
    
    // 🔥 제안 코드 패턴 적용: 스탯 계산과 로그를 하나의 함수형 업데이트로 통합
    setDigimonStats((prev) => {
      // 1. 로그 내용 미리 생성
      const newLog = { 
        text: result.isSuccess 
          ? "훈련 성공! (힘 +1, 무게 -2g)" 
          : "훈련 실패...", 
        type: 'TRAIN', 
        timestamp: Date.now() 
      };

      // 2. 스탯 계산 + 로그 합치기 (동시 리턴)
      const updatedLogs = [newLog, ...(prev.activityLogs || [])].slice(0, 50);
      const finalStatsWithLogs = {
        ...finalStats,  // 실제 계산된 스탯 (doVer1Training 결과)
        // 로그 변경 (여기서 같이 함!)
        activityLogs: updatedLogs
      };
      
      // 3. Firestore 저장 (비동기, 함수형 업데이트 내부에서 호출)
      setDigimonStatsAndSave(finalStatsWithLogs, updatedLogs).catch((error) => {
        console.error("훈련 결과 저장 오류:", error);
      });
      
      return finalStatsWithLogs;
    });
    
    // 주의: 여기서 addActivityLog()를 또 부르지 마세요! 위에서 했으니까요.
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
        const wasInjured = prevStats.isInjured || false;
        
        const updatedStats = {
          ...prevStats,
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
        
        const newLog = {
          type: 'CLEAN',
          text: logText,
          timestamp: Date.now()
        };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
        const statsWithLogs = {
          ...updatedStats,
          activityLogs: updatedLogs
        };
        
        // Firestore에도 저장 (비동기 처리)
        if(slotId && currentUser){
          const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
          updateDoc(slotRef, {
            digimonStats: statsWithLogs,
            isLightsOn,
            wakeUntil,
            activityLogs: updatedLogs,
            lastSavedAt: now,
            updatedAt: now,
          }).catch((error) => {
            console.error("청소 상태 저장 오류:", error);
          });
        }
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
      
      // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
      setDigimonStats((prevStats) => {
        const newLog = {
          type: 'BATTLE',
          text: `Sparring: Practice Match (No Record) (Wt ${weightDelta}g, En ${energyDelta})`,
          timestamp: Date.now()
        };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
        const statsWithLogs = {
          ...battleStats,
          activityLogs: updatedLogs
        };
        setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
          console.error("스파링 로그 저장 오류:", error);
        });
        return statsWithLogs;
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

      try {
        const challengerRef = doc(db, 'arena_entries', enemyEntryId);

        if (battleResult.win) {
          await updateDoc(challengerRef, {
            'record.losses': increment(1),
            'record.seasonLosses': increment(1),
            'record.seasonId': currentSeasonId,
          });
          console.error("✅ DB Update Success: 상대방 losses +1 (seasonLosses 포함)");
        } else {
          await updateDoc(challengerRef, {
            'record.wins': increment(1),
            'record.seasonWins': increment(1),
            'record.seasonId': currentSeasonId,
          });
          console.error("✅ DB Update Success: 상대방 wins +1 (seasonWins 포함)");
        }

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
          defenderEntryId: enemyEntryId,
          myEntryId: myArenaEntryId,
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

      // Arena 모드 Activity Log 추가
      const updatedStats = await applyLazyUpdateBeforeAction();
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
      
      const tamerName = arenaChallenger.tamerName || arenaChallenger.trainerName || 'Unknown';
      let logText = '';
      if (battleResult.win) {
        logText = `Arena: Won vs ${tamerName} (Rank UP) (Wt ${weightDelta}g, En ${energyDelta})`;
      } else {
        logText = `Arena: Lost vs ${tamerName} (Wt ${weightDelta}g, En ${energyDelta})`;
      }
      
      // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
      setDigimonStats((prevStats) => {
        const newLog = {
          type: 'BATTLE',
          text: logText,
          timestamp: Date.now()
        };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
        const statsWithLogs = {
          ...battleStats,
          activityLogs: updatedLogs
        };
        setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
          console.error("아레나 로그 저장 오류:", error);
        });
        return statsWithLogs;
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
      // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
      setDigimonStats((prevStats) => {
        const newLog = {
          type: 'BATTLE',
          text: 'Battle: Skipped (Not enough Energy)',
          timestamp: Date.now()
        };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
        const statsWithLogs = {
          ...updatedStats,
          activityLogs: updatedLogs
        };
        setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
          console.error("에너지 부족 배틀 로그 저장 오류:", error);
        });
        return statsWithLogs;
      });
      // 에너지 부족 알림 가이드
      alert("⚠️ 에너지가 부족합니다!\n💤 Sleep to restore Energy!");
      setShowBattleScreen(false);
      setBattleType(null);
      return;
    }
    
    // 수면 중 배틀 시도 시 수면 방해 처리
    const schedule = getSleepSchedule(digimonData, selectedDigimon);
    const nowSleeping = isWithinSleepSchedule(schedule, new Date()) && !(wakeUntil && Date.now() < wakeUntil);
    if (nowSleeping) {
      wakeForInteraction(updatedStats, setWakeUntil, setDigimonStatsAndSave);
      // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
      setDigimonStats((prevStats) => {
        const newLog = {
          type: 'CARE_MISTAKE',
          text: 'Disturbed Sleep! (Wake +10m, Mistake +1)',
          timestamp: Date.now()
        };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
        const statsWithLogs = {
          ...updatedStats,
          sleepDisturbances: (updatedStats.sleepDisturbances || 0) + 1,
          activityLogs: updatedLogs
        };
        setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
          console.error("수면 방해 로그 저장 오류:", error);
        });
        return statsWithLogs;
      });
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
    
    if (battleResult.win) {
      // 승리 시 배틀 기록 업데이트
      const newBattles = (battleStats.battles || 0) + 1;
      const newBattlesWon = (battleStats.battlesWon || 0) + 1;
      // 승률 재계산 (0으로 나누기 방지)
      const newWinRate = newBattles > 0 ? Math.round((newBattlesWon / newBattles) * 100) : 0;
      
      const finalStats = {
        ...battleStats,
        battles: newBattles,
        battlesWon: newBattlesWon,
        battlesForEvolution: (battleStats.battlesForEvolution || 0) + 1,
        winRate: newWinRate,
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
      }
      
      const newWeight = battleStats.weight || 0;
      const newEnergy = battleStats.energy || 0;
      const weightDelta = newWeight - oldWeight;
      const energyDelta = newEnergy - oldEnergy;
      
      // Quest 모드 로그 포맷: 요청된 형식으로 수정
      let logText = '';
      if (battleResult.isAreaClear) {
        logText = `Quest: Defeated ${enemyName} (Stage Clear) (Wt ${weightDelta}g, En ${energyDelta})`;
      } else {
        logText = `Quest: Defeated ${enemyName} (Wt ${weightDelta}g, En ${energyDelta})`;
      }
      if (isInjured) {
        logText += ' - Battle: Injured! (Chance hit)';
      }
      
      // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
      setDigimonStats((prevStats) => {
        const newLog = {
          type: 'BATTLE',
          text: logText,
          timestamp: Date.now()
        };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
        const statsWithLogs = {
          ...finalStats,
          activityLogs: updatedLogs
        };
        setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
          console.error("퀘스트 승리 로그 저장 오류:", error);
        });
        return statsWithLogs;
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
      const newBattles = (battleStats.battles || 0) + 1;
      const newBattlesLost = (battleStats.battlesLost || 0) + 1;
      const newBattlesWon = battleStats.battlesWon || 0;
      // 승률 재계산 (0으로 나누기 방지)
      const newWinRate = newBattles > 0 ? Math.round((newBattlesWon / newBattles) * 100) : 0;
      
      const finalStats = {
        ...battleStats,
        battles: newBattles,
        battlesLost: newBattlesLost,
        winRate: newWinRate,
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
      }
      
      const newWeight = battleStats.weight || 0;
      const newEnergy = battleStats.energy || 0;
      const weightDelta = newWeight - oldWeight;
      const energyDelta = newEnergy - oldEnergy;
      
      // Quest 모드 로그 포맷: 요청된 형식으로 수정
      let logText = `Quest: Defeated by ${enemyName} (Wt ${weightDelta}g, En ${energyDelta})`;
      if (isInjured) {
        logText += ' - Battle: Injured! (Chance hit)';
      }
      
      // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
      setDigimonStats((prevStats) => {
        const newLog = {
          type: 'BATTLE',
          text: logText,
          timestamp: Date.now()
        };
        const updatedLogs = [newLog, ...(prevStats.activityLogs || [])].slice(0, 50);
        const statsWithLogs = {
          ...finalStats,
          activityLogs: updatedLogs
        };
        setDigimonStatsAndSave(statsWithLogs, updatedLogs).catch((error) => {
          console.error("퀘스트 패배 로그 저장 오류:", error);
        });
        return statsWithLogs;
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

