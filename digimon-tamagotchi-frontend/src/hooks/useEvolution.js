// src/hooks/useEvolution.js
// Game.jsx의 진화(Evolution) 로직을 분리한 Custom Hook

import { writeBatch, doc } from "firebase/firestore";
import { db } from "../firebase";
import { checkEvolution } from "../logic/evolution/checker";
import { getJogressResult } from "../logic/evolution/jogress";
import { initializeStats } from "../data/stats";
import { addActivityLog } from "./useGameLogic";
import { updateEncyclopedia } from "./useEncyclopedia";

/**
 * useEvolution Hook
 * 진화 관련 로직을 담당하는 Custom Hook
 * 
 * @param {Object} params - 초기화 파라미터
 * @param {Object} params.digimonStats - 현재 디지몬 스탯
 * @param {Function} params.setDigimonStats - 스탯 업데이트 함수
 * @param {Function} params.setSelectedDigimon - 선택된 디지몬 설정 함수
 * @param {Function} params.setSelectedDigimonAndSave - 선택된 디지몬 저장 함수
 * @param {Function} params.setDigimonStatsAndSave - 스탯 저장 함수
 * @param {Function} params.applyLazyUpdateBeforeAction - Lazy Update 적용 함수
 * @param {Function} params.setActivityLogs - Activity Logs 설정 함수
 * @param {Array} params.activityLogs - 현재 Activity Logs
 * @param {string} params.selectedDigimon - 현재 선택된 디지몬
 * @param {boolean} params.developerMode - 개발자 모드 여부
 * @param {boolean} params.ignoreEvolutionTime - 모든 진화 조건 무시 (개발자 옵션, 체크 시 첫 번째 진화 대상으로 바로 진화)
 * @param {Function} params.setIsEvolving - 진화 중 플래그 설정 함수
 * @param {Function} params.setEvolutionStage - 진화 단계 설정 함수
 * @param {Function} params.setEvolvedDigimonName - 진화된 디지몬 이름 설정 함수
 * @param {Object} params.digimonDataVer1 - 디지몬 데이터 (구버전)
 * @param {Object} params.newDigimonDataVer1 - 디지몬 데이터 (신버전)
 * @param {string} params.version - 슬롯 버전 ("Ver.1" | "Ver.2" 등, 도감 관리용)
 * @returns {Object} evolve, checkEvolutionReady, isEvolving, evolutionStage, evolvedDigimonName
 */
export function useEvolution({
  digimonStats,
  setDigimonStats,
  setSelectedDigimon,
  setSelectedDigimonAndSave,
  setDigimonStatsAndSave,
  applyLazyUpdateBeforeAction,
  setActivityLogs,
  activityLogs,
  appendLogToSubcollection,
  selectedDigimon,
  developerMode,
  ignoreEvolutionTime = false,
  setIsEvolving,
  setEvolutionStage,
  setEvolvedDigimonName,
  digimonDataVer1,
  newDigimonDataVer1,
  slotId,
  currentUser,
  toggleModal,
  version = "Ver.1", // 슬롯 버전 (도감 관리용)
}) {
  /**
   * 진화 버튼 클릭 핸들러 - 확인 모달 열기
   */
  function handleEvolutionButton() {
    // 진화 확인 모달 열기
    if (toggleModal) {
      toggleModal('evolutionConfirm', true);
    }
  }

  /**
   * 실제 진화 진행 함수
   */
  async function proceedEvolution() {
    // 모달 닫기
    if (toggleModal) {
      toggleModal('evolutionConfirm', false);
    }

    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    setDigimonStats(updatedStats);
    
    if (updatedStats.isDead && !developerMode) {
      return;
    }
    
    // 현재 디지몬 데이터 가져오기 (새 데이터 구조 사용 - evolutionCriteria 포함)
    // selectedDigimon이 없으면 evolutionStage를 통해 찾기
    const digimonName = selectedDigimon || (updatedStats.evolutionStage ? 
      Object.keys(newDigimonDataVer1).find(key => newDigimonDataVer1[key]?.stage === updatedStats.evolutionStage) : 
      "Digitama");
    
    const currentDigimonData = newDigimonDataVer1[digimonName];
    if (!currentDigimonData) {
      console.error(`No data for ${digimonName} in newDigimonDataVer1!`);
      console.error('Available keys:', Object.keys(newDigimonDataVer1));
      console.error('selectedDigimon:', selectedDigimon);
      console.error('evolutionStage:', updatedStats.evolutionStage);
      return;
    }
    
    // '모든 진화 조건 무시' 옵션: 조건 검사 없이 첫 번째 진화 대상으로 진화
    if (ignoreEvolutionTime) {
      const evolutions = currentDigimonData.evolutions || [];
      const firstOption = evolutions.find((e) => !e.jogress);
      const targetId = firstOption ? (firstOption.targetId || firstOption.targetName) : null;
      if (!targetId) {
        alert("진화 가능한 형태가 없습니다.");
        return;
      }
      const targetData = newDigimonDataVer1[targetId];
      const evolvedName = targetData?.name || targetData?.id || targetId;
      setEvolvedDigimonName(evolvedName);
      if (developerMode) {
        setEvolutionStage('complete');
        await evolve(targetId);
      } else {
        if (typeof setIsEvolving === 'function') setIsEvolving(true);
        setEvolutionStage('shaking');
        setTimeout(() => {
          setEvolutionStage('flashing');
          setTimeout(() => {
            setEvolutionStage('complete');
            setTimeout(async () => {
              await evolve(targetId);
              if (typeof setIsEvolving === 'function') setIsEvolving(false);
            }, 500);
          }, 2000);
        }, 2000);
      }
      return;
    }
    
    // 개발자 모드: 시간 조건만 0으로 두고 나머지 조건은 판정
    const statsForCheck = developerMode
      ? { ...updatedStats, timeToEvolveSeconds: 0 }
      : updatedStats;
    const evolutionResult = checkEvolution(statsForCheck, currentDigimonData, digimonName, newDigimonDataVer1);
    
    if (evolutionResult.success) {
      const targetId = evolutionResult.targetId;
      const targetData = newDigimonDataVer1[targetId];
      const evolvedName = targetData?.name || targetData?.id || targetId;
      setEvolvedDigimonName(evolvedName);
      if (developerMode) {
        setEvolutionStage('complete');
        await evolve(targetId);
      } else {
        if (typeof setIsEvolving === 'function') setIsEvolving(true);
        setEvolutionStage('shaking');
        setTimeout(() => {
          setEvolutionStage('flashing');
          setTimeout(() => {
            setEvolutionStage('complete');
            setTimeout(async () => {
              await evolve(targetId);
              if (typeof setIsEvolving === 'function') setIsEvolving(false);
            }, 500);
          }, 2000);
        }, 2000);
      }
    } else if (evolutionResult.reason === "NOT_READY") {
      const remainingSeconds = evolutionResult.remainingTime;
      const mm = Math.floor(remainingSeconds / 60);
      const ss = Math.floor(remainingSeconds % 60);
      alert(`아직 진화할 준비가 안 됐어!\n\n남은 시간: ${mm}분 ${ss}초`);
    } else if (evolutionResult.reason === "CONDITIONS_UNMET") {
      const detailsText = evolutionResult.details
        .map(d => `• ${d.target}: ${d.missing}`)
        .join("\n");
      alert(`진화 조건을 만족하지 못했어!\n\n[부족한 조건]\n${detailsText}`);
    }
  }

  /**
   * 진화 대상 ID를 데이터 맵에 있는 키로 보정 (대소문자/오타 대응)
   * @param {string} targetId - 진화 대상 ID (예: skullmamon)
   * @param {Object} dataMap - 디지몬 데이터 맵 (슬롯 버전에 맞는 데이터)
   * @returns {string|null} 실제 키 또는 null
   */
  function resolveEvolutionTargetKey(targetId, dataMap) {
    if (!targetId || !dataMap || typeof dataMap !== "object") return null;
    if (dataMap[targetId]) return targetId;
    const lower = targetId.toLowerCase();
    const found = Object.keys(dataMap).find((k) => k.toLowerCase() === lower);
    if (found) return found;
    const byId = Object.entries(dataMap).find(([, v]) => (v && v.id && String(v.id).toLowerCase() === lower));
    return byId ? byId[0] : null;
  }

  /**
   * 진화 실행 함수
   * @param {string} newName - 진화할 디지몬 이름 (ID)
   */
  async function evolve(newName) {
    const resolvedKey = resolveEvolutionTargetKey(newName, digimonDataVer1) || newName;
    if (!digimonDataVer1[resolvedKey]) {
      const fallback = version === "Ver.2" ? "DigitamaV2" : "Digitama";
      console.error(`No data for ${newName} (resolved: ${resolvedKey}) in slot data! fallback => ${fallback}`);
      newName = fallback;
    } else {
      newName = resolvedKey;
    }
    const currentStats = await applyLazyUpdateBeforeAction();
    const old = { ...currentStats };
    
    // 진화 시 스탯 리셋 (매뉴얼 규칙)
    // careMistakes, overfeeds, battlesForEvolution, proteinOverdose, injuries 등은 initializeStats에서 리셋됨
    // 하지만 여기서 명시적으로 리셋하여 확실히 함
    
    // 새 디지몬 데이터 가져오기 (minWeight, maxEnergy 확인용)
    const newDigimonData = digimonDataVer1[newName] || {};
    // minWeight는 stats.minWeight 또는 직접 minWeight로 저장될 수 있음
    const minWeight = newDigimonData.stats?.minWeight || newDigimonData.minWeight || 0;
    // maxEnergy는 stats.maxEnergy 또는 maxStamina로 저장될 수 있음 (0도 유효한 값이므로 ?? 사용)
    const maxEnergy = newDigimonData.stats?.maxEnergy ?? newDigimonData.stats?.maxStamina ?? newDigimonData.maxEnergy ?? newDigimonData.maxStamina ?? 0;
    
    const resetStats = {
      ...old,
      careMistakes: 0,
      overfeeds: 0,
      proteinOverdose: 0,
      injuries: 0,
      trainings: 0,
      sleepDisturbances: 0,
      strength: 0, // 진화 시 strength 리셋
      effort: 0, // 진화 시 effort 리셋
      energy: maxEnergy, // 진화 시 energy를 최대값으로 설정
      weight: minWeight, // 진화 시 weight를 새 디지몬의 minWeight로 리셋
      // 현재 디지몬 배틀 값 리셋 (총 토탈은 유지)
      battles: 0,
      battlesWon: 0,
      battlesLost: 0,
      winRate: 0,
      // 총 토탈 배틀 값은 유지 (이미 old에 포함되어 있음)
    };
    
    const nx = initializeStats(newName, resetStats, digimonDataVer1);
    
    // 스프라이트 값 강제 동기화 (데이터 일관성 보장)
    // digimonStats.sprite가 잘못된 값일 수 있으므로 digimonDataVer1에서 직접 가져오기
    if (newDigimonData?.sprite !== undefined) {
      nx.sprite = newDigimonData.sprite;
      console.log("[evolve] 스프라이트 동기화:", {
        digimon: newName,
        sprite: newDigimonData.sprite,
      });
    }
    
    const existingLogs = currentStats.activityLogs || activityLogs || [];
    const newDigimonName = newDigimonData.name || newName;
    const updatedLogs = addActivityLog(existingLogs, "EVOLUTION", `Evolution: Evolved to ${newDigimonName}!`);
    if (appendLogToSubcollection) await appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
    const nxWithLogs = { ...nx, activityLogs: updatedLogs };
    await setDigimonStatsAndSave(nxWithLogs, updatedLogs);
    await setSelectedDigimonAndSave(newName);
    
    // ✅ 도감 업데이트: 진화 전 디지몬 기록 (Digitama·DigitamaV2 포함 — 진화 시 도감 연동)
    if (selectedDigimon) {
      await updateEncyclopedia(
        selectedDigimon,
        old, // 진화 전 스탯
        'evolution',
        currentUser,
        version // 버전 전달 (Ver.2 별도 관리)
      );
    }
    
    // ✅ 도감 업데이트: 진화 후 디지몬 발견 처리 (계정별 통합, 버전별 관리)
    if (newName && newName !== "Digitama" && newName !== "DigitamaV2") {
      await updateEncyclopedia(
        newName,
        nxWithLogs, // 진화 후 스탯
        'discovery',
        currentUser,
        version // 버전 전달 (Ver.2 별도 관리)
      );
    }
  }

  /**
   * 로컬 조그레스 실행: 현재 슬롯 진화 + 파트너 슬롯 사망 처리 (Firestore writeBatch)
   * @param {Object} partnerSlot - 파트너 슬롯 객체 { id, selectedDigimon, digimonStats, version, ... }
   */
  async function proceedJogressLocal(partnerSlot) {
    if (!partnerSlot || partnerSlot.id == null) return;
    if (!currentUser?.uid || !slotId || !db) {
      alert("조그레스에는 로그인이 필요합니다.");
      return;
    }
    // 현재 슬롯 버전 기준으로 조그레스 결과 판정 (Ver.1↔Ver.2 크로스 조그레스 가능)
    const result = getJogressResult(
      selectedDigimon,
      partnerSlot.selectedDigimon,
      newDigimonDataVer1
    );
    if (!result.success) {
      alert(result.reason || "조그레스할 수 있는 조합이 아닙니다.");
      return;
    }

    const targetId = resolveEvolutionTargetKey(result.targetId, digimonDataVer1) || result.targetId;
    if (!digimonDataVer1[targetId]) {
      alert("진화 대상 디지몬 데이터를 찾을 수 없습니다.");
      return;
    }

    if (toggleModal) toggleModal("jogressPartnerSlot", false);
    if (typeof setIsEvolving === "function") setIsEvolving(true);

    try {
      const currentStats = await applyLazyUpdateBeforeAction();
      const old = { ...currentStats };
      const newDigimonData = digimonDataVer1[targetId] || {};
      const minWeight = newDigimonData.stats?.minWeight ?? newDigimonData.minWeight ?? 0;
      const maxEnergy = newDigimonData.stats?.maxEnergy ?? newDigimonData.stats?.maxStamina ?? newDigimonData.maxEnergy ?? newDigimonData.maxStamina ?? 0;

      const resetStats = {
        ...old,
        careMistakes: 0,
        overfeeds: 0,
        proteinOverdose: 0,
        injuries: 0,
        trainings: 0,
        sleepDisturbances: 0,
        strength: 0,
        effort: 0,
        energy: maxEnergy,
        weight: minWeight,
        battles: 0,
        battlesWon: 0,
        battlesLost: 0,
        winRate: 0,
      };
      const nx = initializeStats(targetId, resetStats, digimonDataVer1);
      if (newDigimonData?.sprite !== undefined) nx.sprite = newDigimonData.sprite;

      const existingLogs = currentStats.activityLogs || activityLogs || [];
      const newDigimonName = newDigimonData.name || targetId;
      const updatedLogs = addActivityLog(
        existingLogs,
        "EVOLUTION",
        `조그레스 진화(로컬): ${newDigimonName}!`
      );
      const nxWithLogs = { ...nx, activityLogs: updatedLogs };

      const now = new Date();
      const slotARef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
      const slotBRef = doc(db, "users", currentUser.uid, "slots", `slot${partnerSlot.id}`);
      const { activityLogs: _dropA, battleLogs: _dropB, ...statsAForDb } = nxWithLogs;
      const partnerStats = partnerSlot.digimonStats || {};
      const { activityLogs: _dropP1, battleLogs: _dropP2, ...partnerRest } = partnerStats;
      const partnerStatsForDb = {
        ...partnerRest,
        isDead: true,
        deathReason: "JOGRESS_PARTNER (조그레스 파트너)",
      };

      const batch = writeBatch(db);
      batch.update(slotARef, {
        selectedDigimon: targetId,
        digimonStats: statsAForDb,
        updatedAt: now,
      });
      batch.update(slotBRef, {
        digimonStats: partnerStatsForDb,
        updatedAt: now,
      });
      await batch.commit();

      setDigimonStats(nxWithLogs);
      setSelectedDigimon(targetId);
      const newLogEntry = updatedLogs[updatedLogs.length - 1];
      if (appendLogToSubcollection && newLogEntry) {
        await appendLogToSubcollection(newLogEntry).catch(() => {});
      }

      if (selectedDigimon) {
        await updateEncyclopedia(selectedDigimon, old, "evolution", currentUser, version);
      }
      if (targetId && targetId !== "Digitama" && targetId !== "DigitamaV2") {
        await updateEncyclopedia(targetId, nxWithLogs, "discovery", currentUser, version);
      }

      if (setEvolvedDigimonName) setEvolvedDigimonName(newDigimonName);
      if (setEvolutionStage) setEvolutionStage("complete");
    } catch (err) {
      console.error("[proceedJogressLocal] 오류:", err);
      alert("조그레스 처리 중 오류가 발생했습니다.");
    } finally {
      if (typeof setIsEvolving === "function") setIsEvolving(false);
    }
  }

  /**
   * 진화 준비 상태 확인
   * @returns {boolean} 진화 가능 여부
   */
  function checkEvolutionReady() {
    if (digimonStats.isDead && !developerMode) return false;
    // 실제 진화 조건 체크는 handleEvolutionButton에서 수행
    return true;
  }

  return {
    evolve,
    handleEvolutionButton,
    proceedEvolution,
    proceedJogressLocal,
    checkEvolutionReady,
  };
}

