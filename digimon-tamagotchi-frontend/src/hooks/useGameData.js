// src/hooks/useGameData.js
// Game.jsx의 데이터 저장/로딩 로직을 분리한 Custom Hook

import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, updateDoc, deleteField, collection, addDoc, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { applyLazyUpdate } from "../data/stats";
import { initializeStats } from "../data/stats";
import { MAX_ACTIVITY_LOGS } from "../constants/activityLogs";
import { initializeActivityLogs } from "../hooks/useGameLogic";
import { getSleepSchedule } from "../hooks/useGameHandlers";
import { DEFAULT_BACKGROUND_SETTINGS } from "../data/backgroundData";
import { filterEntriesForSlotCreation } from "../utils/slotLogUtils";
import { shouldPersistActivityLog } from "../utils/activityLogPersistence";
import { buildDigimonLogSnapshot } from "../utils/digimonLogSnapshot";
import { repairCareMistakeLedger } from "../logic/stats/careMistakeLedger";
import { evaluateDeathConditions } from "../logic/stats/death";

/**
 * 저장 직전 null/undefined 필드 제거 (문서 용량 절감, spriteBasePath: null 등 불필요 저장 방지)
 * @param {Object} obj - 1depth 객체 (중첩 객체/배열은 그대로 유지)
 * @returns {Object} null/undefined가 제거된 새 객체
 */
function cleanObject(obj) {
  if (obj == null || typeof obj !== "object") return obj;
  const result = { ...obj };
  Object.keys(result).forEach((key) => {
    if (result[key] === null || result[key] === undefined) {
      delete result[key];
    }
  });
  return result;
}

/**
 * 슬롯 루트 전용 상태 필드 해석
 * newStats에 최신 값이 들어오면 그 값을 우선 사용하고, 없으면 현재 훅 상태를 fallback으로 사용합니다.
 *
 * @param {Object} newStats
 * @param {{ isLightsOn: boolean, wakeUntil: number|null, dailySleepMistake: boolean }} currentRootState
 * @returns {{ isLightsOn: boolean, wakeUntil: number|null, dailySleepMistake: boolean }}
 */
export function resolveRootSlotFields(newStats = {}, currentRootState = {}) {
  return {
    isLightsOn:
      newStats.isLightsOn !== undefined ? newStats.isLightsOn : currentRootState.isLightsOn,
    wakeUntil:
      newStats.wakeUntil !== undefined ? newStats.wakeUntil : (currentRootState.wakeUntil ?? null),
    dailySleepMistake:
      typeof newStats.dailySleepMistake === "boolean"
        ? newStats.dailySleepMistake
        : Boolean(currentRootState.dailySleepMistake),
  };
}

/**
 * useGameData Hook
 * 데이터 저장/로딩 로직을 담당하는 Custom Hook
 * 
 * @param {Object} params - 초기화 파라미터
 * @param {string} params.slotId - 슬롯 ID
 * @param {Object} params.currentUser - 현재 사용자 (Firebase Auth)
 * @param {Object|null} params.currentUser - 현재 사용자 (Firebase Auth, 필수)
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
 * @param {Object} params.digimonDataVer1 - 디지몬 데이터 맵 (현재 슬롯용, 호환)
 * @param {Object} [params.adaptedV1] - v1 adapted 데이터 맵 (슬롯 로드 시 버전별 선택용)
 * @param {Object} [params.adaptedV2] - v2 adapted 데이터 맵 (슬롯 로드 시 버전별 선택용)
 * @param {boolean} params.isFirebaseAvailable - Firebase 사용 가능 여부
 * @param {Function} params.navigate - 네비게이션 함수
 * @param {string} [params.selectedDigimon] - 현재 선택된 디지몬 ID (digimonDisplayName 계산용)
 * @param {string|null} [params.digimonNickname] - 현재 슬롯의 디지몬 별명 (있으면 "별명(한글명)" 형태로 저장)
 * @param {string} [params.slotVersion] - 슬롯 버전 (Ver.1 | Ver.2, 데이터 맵 선택용)
 * @param {boolean} [params.isLoadingSlot] - 슬롯 로딩 중 여부 (로드 완료 전 digimonDisplayName 저장 방지용)
 * @param {Object} [params.evolutionDataForSlot] - 진화용 원본 데이터 맵 (한글명 .name 포함, adapted가 아님). 없으면 selectedDigimon+버전으로 fallback
 * @returns {Object} saveStats, applyLazyUpdate, isLoading, error
 */
export function useGameData({
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
  digimonDataVer1,
  adaptedV1,
  adaptedV2,
  isFirebaseAvailable,
  navigate,
  // 추가 상태들 (applyLazyUpdateBeforeAction에서 사용)
  isLightsOn,
  wakeUntil,
  dailySleepMistake,
  activityLogs,
  // 배경화면 설정
  backgroundSettings,
  setBackgroundSettings,
  // 디지몬 표시명 (구글 스크립트/Discord 알림용 - 슬롯 문서 digimonDisplayName)
  selectedDigimon = null,
  digimonNickname = null,
  slotVersion = "Ver.1",
  isLoadingSlot = true, // 기본 true: 로드 완료 전에는 digimonDisplayName 쓰지 않음
  evolutionDataForSlot = null, // 한글명 .name 포함된 원본 맵 (adapted 맵에는 name 없음)
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
      // proteinCount 제거됨 - strength로 통합
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
      poopReachedMaxAt: isNewStart ? null : undefined,
      lastPoopPenaltyAt: isNewStart ? null : undefined,
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
    const effectiveSelectedDigimon =
      newStats.selectedDigimon ||
      digimonStats?.selectedDigimon ||
      selectedDigimon ||
      null;
    const rootSlotFields = resolveRootSlotFields(newStats, {
      isLightsOn,
      wakeUntil,
      dailySleepMistake,
    });

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
        poopReachedMaxAt: null,
        lastPoopPenaltyAt: null,
      } : {}),
      activityLogs: finalLogs, // activityLogs를 finalStats에 포함
      ...rootSlotFields,
      lastSavedAt: now,
    };
    const repairedFinalStats = repairCareMistakeLedger(finalStats, finalLogs).nextStats;
    
    console.log("[saveStats] finalStats:", {
      isNewStart,
      isDead: finalStats.isDead,
      lastHungerZeroAt: finalStats.lastHungerZeroAt,
      lastStrengthZeroAt: finalStats.lastStrengthZeroAt,
      evolutionStage: finalStats.evolutionStage,
    });

    // proteinCount 필드 제거 (strength로 통합됨)
    const { proteinCount, lastMaxPoopTime, ...statsWithoutProteinCount } = repairedFinalStats;
    if (proteinCount !== undefined) {
      console.log("[saveStats] proteinCount 필드 제거됨:", proteinCount);
    }
    void lastMaxPoopTime;

    const statsForState = effectiveSelectedDigimon
      ? { ...statsWithoutProteinCount, selectedDigimon: effectiveSelectedDigimon }
      : statsWithoutProteinCount;

    setDigimonStats(statsForState);

    // Firebase 로그인 필수
    if (slotId && currentUser && isFirebaseAvailable) {
      try {
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        // 루트 전용 필드는 digimonStats에 중복 저장하지 않음 (isLightsOn, wakeUntil, lastSavedAt)
        // activityLogs·battleLogs는 서브컬렉션에만 저장하므로 슬롯 문서에서는 제외
        const {
          isLightsOn: _dropl,
          wakeUntil: _dropw,
          lastSavedAt: _dropt,
          activityLogs: _dropLogs,
          battleLogs: _dropBattleLogs,
          selectedDigimon: _dropSelectedDigimon,
          ...digimonStatsOnly
        } = statsForState;
        const updateData = {
          digimonStats: cleanObject(digimonStatsOnly),
          ...rootSlotFields,
          lastSavedAt: statsForState.lastSavedAt,
          updatedAt: now,
        };
        
        // digimonDisplayName·selectedDigimon: 로드 완료 후에만 저장. 한글명 또는 ID만 (버전 안 붙임)
        if (!isLoadingSlot && effectiveSelectedDigimon) {
          const displayNameFromData = evolutionDataForSlot?.[effectiveSelectedDigimon]?.name;
          const baseDisplayName = displayNameFromData || effectiveSelectedDigimon;
          const digimonDisplayName = (digimonNickname && digimonNickname.trim()) ? `${digimonNickname.trim()}(${baseDisplayName})` : baseDisplayName;
          updateData.digimonDisplayName = digimonDisplayName;
          updateData.selectedDigimon = effectiveSelectedDigimon;
        }
        
        // 배경화면 설정 저장 (backgroundSettings가 전달된 경우)
        if (backgroundSettings !== undefined) {
          updateData.backgroundSettings = backgroundSettings;
        }
        
        // Activity Logs는 digimonStats 안에 이미 포함되어 있으므로 별도 저장 불필요
        // (중복 저장 방지)
        
        // 기존 데이터에서도 proteinCount 제거 (마이그레이션)
        await updateDoc(slotRef, {
          ...updateData,
          'digimonStats.proteinCount': deleteField(), // Firestore에서 필드 제거
        });
      } catch (error) {
        console.error("스탯 저장 오류:", error);
        setError(error);
      }
    } else if (slotId) {
      // Firebase 로그인 필수: 로그인하지 않은 경우 에러
      console.error("Firebase 로그인이 필요합니다.");
      setError(new Error("Firebase 로그인이 필요합니다."));
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
        
        // maxEnergy 가져오기 (0도 유효한 값이므로 ?? 사용)
        maxEnergy = digimonData.stats?.maxEnergy ?? digimonStats.maxEnergy ?? digimonStats.maxStamina ?? 0;
      }
    }

    // Firebase 로그인 필수
    if (!currentUser || !isFirebaseAvailable) {
      return digimonStats;
    }

    try {
      const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
      const slotSnap = await getDoc(slotRef);
      
      if (slotSnap.exists()) {
        const slotData = slotSnap.data();
        const lastSavedAt = slotData.lastSavedAt || slotData.updatedAt || digimonStats.lastSavedAt;
        const digimonSnapshot = buildDigimonLogSnapshot(
          selectedDigimon || digimonStats?.selectedDigimon || null,
          evolutionDataForSlot,
          adaptedV1,
          adaptedV2,
          digimonDataVer1
        );
        const prevLogs = Array.isArray(digimonStats.activityLogs) ? digimonStats.activityLogs : [];
        const updated = repairCareMistakeLedger(
          applyLazyUpdate(digimonStats, lastSavedAt, sleepSchedule, maxEnergy, {
            digimonSnapshot,
          }),
          digimonStats.activityLogs || []
        ).nextStats;

        // 과거 재구성 시 추가된 로그(부상/케어미스)를 서브컬렉션에 반영
        const nextLogs = Array.isArray(updated.activityLogs) ? updated.activityLogs : [];
        const newLogs = nextLogs.slice(prevLogs.length);
        newLogs.forEach((log) => {
          if (log?.type) appendLogToSubcollection(log).catch(() => {});
        });

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
      const deathEvaluation = evaluateDeathConditions(updated, Date.now());
      const reason = updated.deathReason ?? deathEvaluation.reason;
      
      if (reason) {
        updated.deathReason = reason; // digimonStats에 저장
        setDeathReason(reason);
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

    // Firebase 로그인 필수
    if (!isFirebaseAvailable || !currentUser) {
      setIsLoadingSlot(false);
      navigate("/");
      return;
    }

    // Firestore에서 슬롯 로드
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
          setDigimonNickname(slotData.digimonNickname || null);
          setIsLightsOn(slotData.isLightsOn !== undefined ? slotData.isLightsOn : true);
          setWakeUntil(slotData.wakeUntil || null);
          if (slotData.dailySleepMistake !== undefined) setDailySleepMistake(slotData.dailySleepMistake);
          
          // 배경화면 설정 로드
          if (setBackgroundSettings) {
            if (slotData.backgroundSettings) {
              setBackgroundSettings(slotData.backgroundSettings);
            } else {
              // Firebase에 저장된 값이 없으면 기본값 사용
              setBackgroundSettings(DEFAULT_BACKGROUND_SETTINGS);
            }
          }
          
          // 버전별 데이터 맵 (로드 시점에 slotData.version 기준으로 선택 — slotVersion 상태는 아직 반영 전)
          const dataMap = slotData.version === "Ver.2" ? (adaptedV2 || digimonDataVer1) : (adaptedV1 || digimonDataVer1);
          // Ver.2 슬롯은 디지타마(DigitamaV2), Ver.1은 디지타마(Digitama)로 시작
          const savedName = slotData.selectedDigimon || (slotData.version === "Ver.2" ? "DigitamaV2" : "Digitama");
          let savedStats = slotData.digimonStats || {};
          
          // Activity Logs 로드: 서브컬렉션 logs 우선, 없으면 구 문서 activityLogs 사용 (마이그레이션 호환)
          // 로드한 로그를 savedStats.activityLogs에 넣어야 StatsPopup/케어미스 이력에 반영됨 (서브컬렉션만 쓰면 digimonStats.activityLogs가 비어 이력이 사라진 것처럼 보임)
          let loadedActivityLogs = [];
          const slotRefForLogs = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
          try {
            const logsRef = collection(slotRefForLogs, "logs");
            const logsQuery = query(logsRef, orderBy("timestamp", "desc"), limit(MAX_ACTIVITY_LOGS));
            const logsSnap = await getDocs(logsQuery);
            if (!logsSnap.empty) {
              loadedActivityLogs = filterEntriesForSlotCreation(
                logsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
                slotData.createdAt
              );
              setActivityLogs(loadedActivityLogs);
            } else {
              loadedActivityLogs = initializeActivityLogs(savedStats.activityLogs || slotData.activityLogs || []);
              setActivityLogs(loadedActivityLogs);
            }
          } catch (_e) {
            loadedActivityLogs = initializeActivityLogs(savedStats.activityLogs || slotData.activityLogs || []);
            setActivityLogs(loadedActivityLogs);
          }
          // 서브컬렉션은 timestamp desc이므로 오래된 순(이력 표시용)으로 뒤집어 digimonStats에 넣음
          savedStats.activityLogs = [...loadedActivityLogs].reverse();

          // Battle Logs 로드: 서브컬렉션 battleLogs 우선, 없으면 구 문서 digimonStats.battleLogs 사용 (마이그레이션 호환)
          let loadedBattleLogs = savedStats.battleLogs || [];
          try {
            const battleLogsRef = collection(slotRefForLogs, "battleLogs");
            const battleLogsQuery = query(battleLogsRef, orderBy("timestamp", "desc"), limit(100));
            const battleLogsSnap = await getDocs(battleLogsQuery);
            if (!battleLogsSnap.empty) {
              loadedBattleLogs = filterEntriesForSlotCreation(
                battleLogsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
                slotData.createdAt
              );
            }
          } catch (_e) {
            // fallback: 문서 내 battleLogs 유지
          }
          savedStats.battleLogs = loadedBattleLogs;

          // proteinCount 필드 제거 (마이그레이션)
          if (savedStats.proteinCount !== undefined) {
            delete savedStats.proteinCount;
            // Firestore에서도 제거
            const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
            await updateDoc(slotRef, {
              'digimonStats.proteinCount': deleteField(), // Firestore에서 필드 제거
            });
          }
          
          if (Object.keys(savedStats).length === 0) {
            // 새 디지몬: 저장된 이름(Ver.2면 DigitamaV2, Ver.1이면 Digitama)으로 버전별 데이터 맵으로 초기화
            const ns = initializeStats(savedName, {}, dataMap);
            ns.birthTime = Date.now();
            setSelectedDigimon(savedName);
            setDigimonStats({ ...ns, selectedDigimon: savedName });
          } else {
            // 루트 lastSavedAt 우선, 없으면 구 문서 호환으로 digimonStats.lastSavedAt 사용
            const lastSavedAt = slotData.lastSavedAt || slotData.updatedAt || savedStats.lastSavedAt || new Date();
            
            // sleepSchedule과 maxEnergy 계산 (버전별 데이터 맵 사용)
            let sleepSchedule = null;
            let maxEnergy = null;
            if (dataMap && savedName) {
              sleepSchedule = getSleepSchedule(savedName, dataMap, savedStats);
              const digimonData = dataMap[savedName];
              if (digimonData) {
                maxEnergy = digimonData.stats?.maxEnergy ?? savedStats.maxEnergy ?? savedStats.maxStamina ?? 0;
              }
              // 디지타마/디지타마V2인데 timeToEvolveSeconds 없음·0·NaN이면 데이터맵 값으로 보정 (구 저장·초기화 누락 대비)
              if ((savedName === "Digitama" || savedName === "DigitamaV2") && digimonData?.timeToEvolveSeconds != null) {
                const tte = savedStats.timeToEvolveSeconds;
                if (tte === undefined || tte === null || tte === 0 || Number.isNaN(tte)) {
                  savedStats = { ...savedStats, timeToEvolveSeconds: digimonData.timeToEvolveSeconds };
                }
              }
            }
            
            const prevLogCount = (savedStats.activityLogs || []).length;
            const digimonSnapshot = buildDigimonLogSnapshot(
              savedName,
              evolutionDataForSlot,
              dataMap,
              digimonDataVer1,
              adaptedV1,
              adaptedV2
            );
            savedStats = repairCareMistakeLedger(
              applyLazyUpdate(savedStats, lastSavedAt, sleepSchedule, maxEnergy, {
                digimonSnapshot,
              }),
              savedStats.activityLogs || []
            ).nextStats;
            // 과거 재구성 시 추가된 로그를 서브컬렉션에 반영
            const newLogs = (savedStats.activityLogs || []).slice(prevLogCount);
            newLogs.forEach((log) => {
              if (log?.type) appendLogToSubcollection(log).catch(() => {});
            });

            // proteinCount 필드 제거 (마이그레이션)
            if (savedStats.proteinCount !== undefined) {
              delete savedStats.proteinCount;
            }
            
            // 스프라이트 값 동기화 확인 (데이터 일관성 보장, 버전별 데이터 맵 사용)
            if (dataMap && savedName && dataMap[savedName]) {
              const expectedSprite = dataMap[savedName].sprite;
              if (expectedSprite !== undefined && savedStats.sprite !== expectedSprite) {
                console.warn("[loadSlot] 스프라이트 불일치 감지 및 수정:", {
                  selectedDigimon: savedName,
                  savedSprite: savedStats.sprite,
                  expectedSprite: expectedSprite,
                });
                savedStats.sprite = expectedSprite;
              }
            }
            
            setSelectedDigimon(savedName);
            setDigimonStats({ ...savedStats, selectedDigimon: savedName });
            
            // deathReason 복원
            if (savedStats.deathReason) {
              setDeathReason(savedStats.deathReason);
            }
            
            // 로드 직후에는 Firestore 쓰기 하지 않음 (Lazy Update는 메모리만 반영, 다음 액션 시 saveStats에서 저장)
            // updatedAt이 불필요하게 자주 바뀌는 것과 비용 절감을 위해 제거
          }
        } else {
          // 슬롯 문서 없음 (잘못된 slotId 등) — v1 기본값
          const fallbackDataMap = adaptedV1 || digimonDataVer1;
          const ns = initializeStats("Digitama", {}, fallbackDataMap);
          setSelectedDigimon("Digitama");
          setDigimonStats(ns);
          setSlotName(`슬롯${slotId}`);
          // 새 슬롯이면 배경화면 설정도 기본값으로 설정
          if (setBackgroundSettings) {
            setBackgroundSettings(DEFAULT_BACKGROUND_SETTINGS);
          }
        }
      } catch (error) {
        console.error("슬롯 로드 오류:", error);
        setError(error);
        const fallbackDataMap = adaptedV1 || digimonDataVer1;
        const ns = initializeStats("Digitama", {}, fallbackDataMap);
        setSelectedDigimon("Digitama");
        setDigimonStats(ns);
      } finally {
        setIsLoadingSlot(false);
        setIsLoading(false);
      }
    };

    loadSlot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId, currentUser, isFirebaseAvailable, navigate]);

  /**
   * 배경화면 설정 저장 함수 (참조 안정화: useCallback으로 1초마다 리렌더 시 불필요한 저장 방지)
   * @param {Object} newBackgroundSettings - 새로운 배경화면 설정
   */
  const saveBackgroundSettings = useCallback(async (newBackgroundSettings) => {
    if (!slotId) return;

    if (slotId && currentUser && isFirebaseAvailable) {
      try {
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        await updateDoc(slotRef, {
          backgroundSettings: newBackgroundSettings,
          updatedAt: new Date(),
        });
        console.log('[saveBackgroundSettings] Firebase 저장 완료');
      } catch (error) {
        console.error("배경화면 설정 저장 오류:", error);
        setError(error);
      }
    } else {
      console.error("Firebase 로그인이 필요합니다.");
      setError(new Error("Firebase 로그인이 필요합니다."));
    }
  }, [slotId, currentUser, isFirebaseAvailable]);

  /**
   * 활동 로그 한 건을 서브컬렉션 logs에만 추가 (방안 A: 전면 서브컬렉션)
   * @param {{ type: string, text: string, timestamp?: number }} logEntry
   */
  const appendLogToSubcollection = useCallback(
    async (logEntry) => {
      if (!slotId || !currentUser || !isFirebaseAvailable || !shouldPersistActivityLog(logEntry)) {
        return;
      }
      try {
        const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
        const logsRef = collection(slotRef, "logs");
        await addDoc(logsRef, {
          type: logEntry.type,
          text: logEntry.text ?? "",
          timestamp: logEntry.timestamp ?? Date.now(),
          ...(logEntry.digimonId ? { digimonId: logEntry.digimonId } : {}),
          ...(logEntry.digimonName ? { digimonName: logEntry.digimonName } : {}),
        });
      } catch (error) {
        console.error("[appendLogToSubcollection] 오류:", error);
      }
    },
    [slotId, currentUser, isFirebaseAvailable]
  );

  /**
   * 배틀 로그 한 건을 서브컬렉션 battleLogs에만 추가 (활동 로그와 동일 패턴)
   * @param {{ timestamp?: number, mode: string, text: string, win?: boolean, enemyName?: string, injury?: boolean }} entry
   */
  const appendBattleLogToSubcollection = useCallback(
    async (entry) => {
      if (!slotId || !currentUser || !isFirebaseAvailable || !entry?.mode) return;
      try {
        const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
        const battleLogsRef = collection(slotRef, "battleLogs");
        await addDoc(battleLogsRef, {
          timestamp: entry.timestamp ?? Date.now(),
          mode: entry.mode,
          text: entry.text ?? "",
          ...(typeof entry.win === "boolean" && { win: entry.win }),
          ...(entry.enemyName != null && entry.enemyName !== "" && { enemyName: entry.enemyName }),
          ...(typeof entry.injury === "boolean" && { injury: entry.injury }),
          ...(entry.digimonId ? { digimonId: entry.digimonId } : {}),
          ...(entry.digimonName ? { digimonName: entry.digimonName } : {}),
        });
      } catch (error) {
        console.error("[appendBattleLogToSubcollection] 오류:", error);
      }
    },
    [slotId, currentUser, isFirebaseAvailable]
  );

  return {
    saveStats,
    applyLazyUpdate: applyLazyUpdateForAction,
    saveBackgroundSettings,
    appendLogToSubcollection,
    appendBattleLogToSubcollection,
    isLoading,
    error,
  };
}
