// src/hooks/useGameData.js
// Game.jsx의 데이터 저장/로딩 로직을 분리한 Custom Hook

import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { applyLazyUpdate } from "../data/stats";
import { initializeStats } from "../data/stats";
import { initializeActivityLogs } from "../hooks/useGameLogic";
import { getSleepSchedule } from "../hooks/useGameHandlers";

/**
 * useGameData Hook
 * 데이터 저장/로딩 로직을 담당하는 Custom Hook
 * 
 * @param {Object} params - 초기화 파라미터
 * @param {string} params.slotId - 슬롯 ID
 * @param {Object} params.currentUser - 현재 사용자 (Firebase Auth)
 * @param {string} params.mode - 모드 ('firebase' | 'local')
 * @param {Object} params.digimonStats - 현재 디지몬 스탯
 * @param {Function} params.setDigimonStats - 스탯 업데이트 함수
 * @param {Function} params.setSelectedDigimon - 선택된 디지몬 설정 함수
 * @param {Function} params.setActivityLogs - Activity Logs 설정 함수
 * @param {Function} params.setSlotName - 슬롯 이름 설정 함수
 * @param {Function} params.setSlotCreatedAt - 슬롯 생성일 설정 함수
 * @param {Function} params.setSlotDevice - 슬롯 기종 설정 함수
 * @param {Function} params.setSlotVersion - 슬롯 버전 설정 함수
 * @param {Function} params.setIsLightsOn - 불 켜짐 상태 설정 함수
 * @param {Function} params.setWakeUntil - 깨울 때까지 시간 설정 함수
 * @param {Function} params.setDailySleepMistake - 일일 수면 실수 설정 함수
 * @param {Function} params.setIsLoadingSlot - 로딩 상태 설정 함수
 * @param {Function} params.setDeathReason - 사망 사유 설정 함수
 * @param {Function} params.toggleModal - 모달 토글 함수
 * @param {Object} params.digimonDataVer1 - 디지몬 데이터 맵
 * @param {boolean} params.isFirebaseAvailable - Firebase 사용 가능 여부
 * @param {Function} params.navigate - 네비게이션 함수
 * @returns {Object} saveStats, applyLazyUpdate, isLoading, error
 */
export function useGameData({
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
  // 추가 상태들 (applyLazyUpdateBeforeAction에서 사용)
  isLightsOn,
  wakeUntil,
  dailySleepMistake,
  activityLogs,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * 스탯을 저장하는 함수 (Firestore 또는 localStorage)
   * @param {Object} newStats - 새로운 스탯
   * @param {Array} updatedLogs - 업데이트된 로그 (선택적)
   */
  async function saveStats(newStats, updatedLogs = null) {
    // 새로운 시작인지 확인 (isDead가 false로 명시적으로 설정되고, evolutionStage가 Digitama인 경우)
    const isNewStart = newStats.isDead === false && 
                       newStats.evolutionStage === "Digitama" && 
                       newStats.totalReincarnations !== undefined;
    
    console.log("[saveStats] 호출:", {
      isNewStart,
      isDead: newStats.isDead,
      evolutionStage: newStats.evolutionStage,
      totalReincarnations: newStats.totalReincarnations,
    });
    
    // newStats에서 중요한 필드들을 먼저 보존 (applyLazyUpdate가 덮어쓸 수 있음)
    const preservedStats = {
      strength: newStats.strength !== undefined ? newStats.strength : undefined,
      weight: newStats.weight !== undefined ? newStats.weight : undefined,
      fullness: newStats.fullness !== undefined ? newStats.fullness : undefined,
      energy: newStats.energy !== undefined ? newStats.energy : undefined,
      proteinCount: newStats.proteinCount !== undefined ? newStats.proteinCount : undefined,
      proteinOverdose: newStats.proteinOverdose !== undefined ? newStats.proteinOverdose : undefined,
      consecutiveMeatFed: newStats.consecutiveMeatFed !== undefined ? newStats.consecutiveMeatFed : undefined,
      overfeeds: newStats.overfeeds !== undefined ? newStats.overfeeds : undefined,
      hungerCountdown: newStats.hungerCountdown !== undefined ? newStats.hungerCountdown : undefined,
      // 새로운 시작일 때 사망 관련 필드 보존
      isDead: isNewStart ? false : undefined,
      lastHungerZeroAt: isNewStart ? null : undefined,
      lastStrengthZeroAt: isNewStart ? null : undefined,
      injuredAt: isNewStart ? null : undefined,
      isInjured: isNewStart ? false : undefined,
      // 새로운 시작일 때 똥 초기화
      poopCount: isNewStart ? 0 : undefined,
      lastMaxPoopTime: isNewStart ? null : undefined,
    };
    
    // 새로운 시작이면 applyLazyUpdate를 건너뛰고 newStats를 직접 사용
    let baseStats;
    if (isNewStart) {
      console.log("[saveStats] 새로운 시작 감지 - applyLazyUpdate 건너뜀");
      baseStats = { ...digimonStats, ...newStats };
    } else {
      baseStats = await applyLazyUpdateForAction();
    }
    const now = new Date();
    
    // Activity Logs 처리: 함수형 업데이트로 확실히 누적
    let finalLogs;
    if (updatedLogs !== null) {
      // updatedLogs는 이미 addActivityLog로 생성된 배열 (이전 로그 포함)
      finalLogs = updatedLogs;
      // setActivityLogs를 함수형 업데이트로 호출하여 이전 로그 보존 보장
      setActivityLogs((prevLogs) => {
        // updatedLogs가 이미 이전 로그를 포함하고 있어야 하지만,
        // 혹시 모를 상황을 대비해 최신 상태 확인 후 반환
        // updatedLogs는 addActivityLog로 생성되었으므로 이전 로그를 포함하고 있음
        return updatedLogs;
      });
    } else {
      // updatedLogs가 null이면 이전 로그 유지
      finalLogs = baseStats.activityLogs || activityLogs || [];
      setActivityLogs((prevLogs) => {
        // 이전 로그가 없으면 빈 배열로 초기화
        return prevLogs || [];
      });
    }
    
    // preservedStats의 값들을 우선 적용 (undefined가 아닌 경우만)
    const mergedStats = { ...baseStats };
    Object.keys(preservedStats).forEach(key => {
      if (preservedStats[key] !== undefined) {
        mergedStats[key] = preservedStats[key];
      }
    });
    
    // 새로운 시작일 때는 newStats의 사망 관련 필드를 확실히 보존
    const finalStats = {
      ...mergedStats,
      ...newStats, // newStats의 모든 필드를 최종적으로 덮어씀
      // 새로운 시작일 때 사망 관련 필드 강제 보존
      ...(isNewStart ? {
        isDead: false,
        lastHungerZeroAt: null,
        lastStrengthZeroAt: null,
        injuredAt: null,
        isInjured: false,
        injuries: 0,
        poopCount: 0,
        lastMaxPoopTime: null,
      } : {}),
      activityLogs: finalLogs, // activityLogs를 finalStats에 포함
      isLightsOn,
      wakeUntil,
      dailySleepMistake,
      lastSavedAt: now,
    };
    
    console.log("[saveStats] finalStats:", {
      isNewStart,
      isDead: finalStats.isDead,
      lastHungerZeroAt: finalStats.lastHungerZeroAt,
      lastStrengthZeroAt: finalStats.lastStrengthZeroAt,
      evolutionStage: finalStats.evolutionStage,
    });

    setDigimonStats(finalStats);

    // Firestore 모드일 때만 저장
    if (slotId && currentUser && mode === 'firebase') {
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
        setError(error);
      }
    } else if (slotId && mode === 'local') {
      // localStorage 모드
      try {
        localStorage.setItem(`slot${slotId}_digimonStats`, JSON.stringify(finalStats));
        localStorage.setItem(`slot${slotId}_isLightsOn`, isLightsOn ? 'true' : 'false');
        if (wakeUntil) localStorage.setItem(`slot${slotId}_wakeUntil`, wakeUntil.toString());
        localStorage.setItem(`slot${slotId}_dailySleepMistake`, dailySleepMistake ? 'true' : 'false');
        if (updatedLogs !== null) {
          localStorage.setItem(`slot${slotId}_activityLogs`, JSON.stringify(updatedLogs));
        }
      } catch (error) {
        console.error("localStorage 저장 오류:", error);
        setError(error);
      }
    }
  }

  /**
   * 액션 전에 Lazy Update 적용하는 헬퍼 함수
   * @returns {Promise<Object>} 업데이트된 스탯
   */
  async function applyLazyUpdateForAction() {
    if (!slotId) {
      return digimonStats;
    }

    // 현재 디지몬 정보 가져오기 (sleepSchedule, maxEnergy 계산용)
    let sleepSchedule = null;
    let maxEnergy = null;
    
    if (digimonDataVer1) {
      // evolutionStage로 현재 디지몬 찾기
      const currentDigimonName = digimonStats.evolutionStage 
        ? Object.keys(digimonDataVer1).find(key => digimonDataVer1[key]?.evolutionStage === digimonStats.evolutionStage) || "Digitama"
        : "Digitama";
      
      const digimonData = digimonDataVer1[currentDigimonName];
      if (digimonData) {
        // sleepSchedule 계산
        if (digimonData.stats?.sleepSchedule) {
          sleepSchedule = digimonData.stats.sleepSchedule;
        } else if (digimonData.sleepSchedule) {
          sleepSchedule = digimonData.sleepSchedule;
        } else {
          // Stage별 기본값
          const stage = digimonData.stage || digimonStats.evolutionStage || "Digitama";
          if (stage === "Digitama" || stage === "Baby I" || stage === "Baby II") {
            sleepSchedule = { start: 20, end: 8 };
          } else if (stage === "Child") {
            sleepSchedule = { start: 21, end: 7 };
          } else if (stage === "Adult" || stage === "Perfect") {
            sleepSchedule = { start: 22, end: 6 };
          } else {
            sleepSchedule = { start: 23, end: 7 };
          }
        }
        
        // maxEnergy 가져오기
        maxEnergy = digimonData.stats?.maxEnergy || digimonStats.maxEnergy || digimonStats.maxStamina || 100;
      }
    }

    // localStorage 모드
    if (mode === 'local') {
      try {
        const savedStatsStr = localStorage.getItem(`slot${slotId}_digimonStats`);
        if (savedStatsStr) {
          const savedStats = JSON.parse(savedStatsStr);
          const lastSavedAt = savedStats.lastSavedAt ? new Date(savedStats.lastSavedAt) : new Date();
          const updated = applyLazyUpdate(digimonStats, lastSavedAt, sleepSchedule, maxEnergy);
          
          // 사망 상태 변경 감지
          checkDeathStatus(updated);
          
          return updated;
        }
      } catch (error) {
        console.error("localStorage Lazy Update 적용 오류:", error);
      }
      return digimonStats;
    }

    // Firestore 모드
    if (!currentUser) {
      return digimonStats;
    }

    try {
      const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
      const slotSnap = await getDoc(slotRef);
      
      if (slotSnap.exists()) {
        const slotData = slotSnap.data();
        const lastSavedAt = slotData.lastSavedAt || slotData.updatedAt || digimonStats.lastSavedAt;
        const updated = applyLazyUpdate(digimonStats, lastSavedAt, sleepSchedule, maxEnergy);
        
        // 사망 상태 변경 감지
        checkDeathStatus(updated);
        
        return updated;
      }
    } catch (error) {
      console.error("Lazy Update 적용 오류:", error);
      setError(error);
    }

    return digimonStats;
  }

  /**
   * 사망 상태 변경 감지 및 처리
   * @param {Object} updated - 업데이트된 스탯
   */
  function checkDeathStatus(updated) {
    if (!digimonStats.isDead && updated.isDead) {
      if (updated.fullness === 0 && updated.lastHungerZeroAt) {
        const elapsed = (Date.now() - updated.lastHungerZeroAt) / 1000;
        if (elapsed >= 43200) {
          setDeathReason('STARVATION (굶주림)');
        }
      } else if (updated.strength === 0 && updated.lastStrengthZeroAt) {
        const elapsed = (Date.now() - updated.lastStrengthZeroAt) / 1000;
        if (elapsed >= 43200) {
          setDeathReason('EXHAUSTION (힘 소진)');
        }
      } else if ((updated.injuries || 0) >= 15) {
        setDeathReason('INJURY OVERLOAD (부상 과다: 15회)');
      } else if (updated.isInjured && updated.injuredAt) {
        const injuredTime = typeof updated.injuredAt === 'number'
          ? updated.injuredAt
          : new Date(updated.injuredAt).getTime();
        const elapsedSinceInjury = Date.now() - injuredTime;
        if (elapsedSinceInjury >= 21600000) {
          setDeathReason('INJURY NEGLECT (부상 방치: 6시간)');
        }
      } else {
        setDeathReason('OLD AGE (수명 다함)');
      }
      // 사망 팝업 표시 (hasSeenDeathPopup은 useGameState에서 관리)
      toggleModal('deathModal', true);
    }
  }

  /**
   * 슬롯 데이터 로드 (useEffect 내부에서 호출)
   */
  useEffect(() => {
    if (!slotId) return;

    // 로컬 모드일 때는 리디렉션하지 않음
    if (mode === 'firebase' && (!isFirebaseAvailable || !currentUser)) {
      setIsLoadingSlot(false);
      navigate("/");
      return;
    }
    
    // 로컬 모드일 때는 Firebase 체크를 건너뛰고 localStorage에서 로드
    if (mode === 'local') {
      const loadSlotLocal = async () => {
        setIsLoadingSlot(true);
        setIsLoading(true);
        setError(null);
        try {
          const savedName = localStorage.getItem(`slot${slotId}_selectedDigimon`) || "Digitama";
          const savedStatsStr = localStorage.getItem(`slot${slotId}_digimonStats`);
          const savedStats = savedStatsStr ? JSON.parse(savedStatsStr) : {};
          
          setSlotName(localStorage.getItem(`slot${slotId}_slotName`) || `슬롯${slotId}`);
          setSlotCreatedAt(localStorage.getItem(`slot${slotId}_createdAt`) || "");
          setSlotDevice(localStorage.getItem(`slot${slotId}_device`) || "");
          setSlotVersion(localStorage.getItem(`slot${slotId}_version`) || "Ver.1");
          
          const isLightsOnSaved = localStorage.getItem(`slot${slotId}_isLightsOn`);
          if (isLightsOnSaved !== null) setIsLightsOn(isLightsOnSaved === 'true');
          
          const wakeUntilSaved = localStorage.getItem(`slot${slotId}_wakeUntil`);
          if (wakeUntilSaved) setWakeUntil(parseInt(wakeUntilSaved));
          
          const dailySleepMistakeSaved = localStorage.getItem(`slot${slotId}_dailySleepMistake`);
          if (dailySleepMistakeSaved !== null) setDailySleepMistake(dailySleepMistakeSaved === 'true');
          
          // Activity Logs 로드
          const logsStr = localStorage.getItem(`slot${slotId}_activityLogs`);
          const logs = logsStr ? JSON.parse(logsStr) : [];
          setActivityLogs(initializeActivityLogs(logs));
          
          if (Object.keys(savedStats).length === 0) {
            const ns = initializeStats("Digitama", {}, digimonDataVer1);
            ns.birthTime = Date.now();
            setSelectedDigimon("Digitama");
            setDigimonStats(ns);
          } else {
            const lastSavedAt = savedStats.lastSavedAt ? new Date(savedStats.lastSavedAt) : new Date();
            
            // sleepSchedule과 maxEnergy 계산
            let sleepSchedule = null;
            let maxEnergy = null;
            if (digimonDataVer1 && savedName) {
              sleepSchedule = getSleepSchedule(savedName, digimonDataVer1);
              const digimonData = digimonDataVer1[savedName];
              if (digimonData) {
                maxEnergy = digimonData.stats?.maxEnergy || savedStats.maxEnergy || savedStats.maxStamina || 100;
              }
            }
            
            const updatedStats = applyLazyUpdate(savedStats, lastSavedAt, sleepSchedule, maxEnergy);
            setSelectedDigimon(savedName);
            setDigimonStats(updatedStats);
          }
        } catch (error) {
          console.error("로컬 슬롯 로드 오류:", error);
          setError(error);
          const ns = initializeStats("Digitama", {}, digimonDataVer1);
          setSelectedDigimon("Digitama");
          setDigimonStats(ns);
        } finally {
          setIsLoadingSlot(false);
          setIsLoading(false);
        }
      };
      
      loadSlotLocal();
      return;
    }

    // Firestore 모드
    const loadSlot = async () => {
      setIsLoadingSlot(true);
      setIsLoading(true);
      setError(null);
      try {
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        const slotSnap = await getDoc(slotRef);
        
        if (slotSnap.exists()) {
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
          setActivityLogs((prevLogs) => logs || prevLogs || []);

          const savedName = slotData.selectedDigimon || "Digitama";
          let savedStats = slotData.digimonStats || {};
          
          if (Object.keys(savedStats).length === 0) {
            const ns = initializeStats("Digitama", {}, digimonDataVer1);
            // 새 디지몬 생성 시 birthTime 설정
            ns.birthTime = Date.now();
            setSelectedDigimon("Digitama");
            setDigimonStats(ns);
          } else {
            const lastSavedAt = slotData.lastSavedAt || slotData.updatedAt || new Date();
            
            // sleepSchedule과 maxEnergy 계산
            let sleepSchedule = null;
            let maxEnergy = null;
            if (digimonDataVer1 && savedName) {
              sleepSchedule = getSleepSchedule(savedName, digimonDataVer1);
              const digimonData = digimonDataVer1[savedName];
              if (digimonData) {
                maxEnergy = digimonData.stats?.maxEnergy || savedStats.maxEnergy || savedStats.maxStamina || 100;
              }
            }
            
            savedStats = applyLazyUpdate(savedStats, lastSavedAt, sleepSchedule, maxEnergy);
            
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
        setError(error);
        const ns = initializeStats("Digitama", {}, digimonDataVer1);
        setSelectedDigimon("Digitama");
        setDigimonStats(ns);
      } finally {
        setIsLoadingSlot(false);
        setIsLoading(false);
      }
    };

    loadSlot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId, currentUser, mode, isFirebaseAvailable, navigate]);

  return {
    saveStats,
    applyLazyUpdate: applyLazyUpdateForAction,
    isLoading,
    error,
  };
}

