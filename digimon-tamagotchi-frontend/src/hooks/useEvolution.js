// src/hooks/useEvolution.js
// Game.jsx의 진화(Evolution) 로직을 분리한 Custom Hook

import { useState } from "react";
import { checkEvolution } from "../logic/evolution/checker";
import { initializeStats } from "../data/stats";
import { addActivityLog } from "./useGameLogic";

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
 * @param {Function} params.setIsEvolving - 진화 중 플래그 설정 함수
 * @param {Function} params.setEvolutionStage - 진화 단계 설정 함수
 * @param {Function} params.setEvolvedDigimonName - 진화된 디지몬 이름 설정 함수
 * @param {Object} params.digimonDataVer1 - 디지몬 데이터 (구버전)
 * @param {Object} params.newDigimonDataVer1 - 디지몬 데이터 (신버전)
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
  selectedDigimon,
  developerMode,
  setIsEvolving,
  setEvolutionStage,
  setEvolvedDigimonName,
  digimonDataVer1,
  newDigimonDataVer1,
}) {
  /**
   * 진화 버튼 클릭 핸들러
   */
  async function handleEvolutionButton() {
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    setDigimonStats(updatedStats);
    
    if (updatedStats.isDead && !developerMode) return;
    
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
    
    if (developerMode) {
      // 개발자 모드: 시간 조건만 무시하고 다른 조건은 체크
      // 시간 조건을 임시로 0으로 설정하여 체크
      const statsForCheck = {
        ...updatedStats,
        timeToEvolveSeconds: 0, // 시간 조건만 무시
      };
      const evolutionResult = checkEvolution(statsForCheck, currentDigimonData, digimonName, newDigimonDataVer1);
      
      if (evolutionResult.success) {
        const targetId = evolutionResult.targetId;
        const targetData = newDigimonDataVer1[targetId];
        const evolvedName = targetData?.name || targetData?.id || targetId;
        setEvolvedDigimonName(evolvedName);
        setEvolutionStage('complete');
        await evolve(targetId);
      } else {
        alert(`진화 조건을 만족하지 못했습니다!\n\n${evolutionResult.details?.map(d => `${d.target}: ${d.missing}`).join('\n') || evolutionResult.reason}`);
      }
      return;
    }
    
    // 매뉴얼 기반 진화 판정 (상세 결과 객체 반환)
    // Data-Driven 방식: digimons.js의 evolutions 배열을 직접 사용
    const evolutionResult = checkEvolution(updatedStats, currentDigimonData, digimonName, newDigimonDataVer1);
    
    if (evolutionResult.success) {
      // 진화 성공 - 애니메이션 시작
      const targetId = evolutionResult.targetId;
      // targetName 찾기 (Fallback 처리) - 새 데이터 사용
      const targetData = newDigimonDataVer1[targetId];
      const targetName = targetData?.name || targetData?.id || targetId;
      
      // 진화 애니메이션 시작
      if (typeof setIsEvolving === 'function') {
        setIsEvolving(true);
      }
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
            await evolve(targetId);
            if (typeof setIsEvolving === 'function') {
              setIsEvolving(false);
            }
            // evolutionStage는 'complete'로 유지하여 확인 버튼을 눌러야만 닫히도록 함
          }, 500);
        }, 2000);
      }, 2000);
    } else if (evolutionResult.reason === "NOT_READY") {
      // 시간 부족
      const remainingSeconds = evolutionResult.remainingTime;
      const mm = Math.floor(remainingSeconds / 60);
      const ss = Math.floor(remainingSeconds % 60);
      alert(`아직 진화할 준비가 안 됐어!\n\n남은 시간: ${mm}분 ${ss}초`);
    } else if (evolutionResult.reason === "CONDITIONS_UNMET") {
      // 조건 부족
      const detailsText = evolutionResult.details
        .map(d => `• ${d.target}: ${d.missing}`)
        .join("\n");
      alert(`진화 조건을 만족하지 못했어!\n\n[부족한 조건]\n${detailsText}`);
    }
  }

  /**
   * 진화 실행 함수
   * @param {string} newName - 진화할 디지몬 이름 (ID)
   */
  async function evolve(newName) {
    if (!digimonDataVer1[newName]) {
      console.error(`No data for ${newName} in digimonDataVer1! fallback => Digitama`);
      newName = "Digitama";
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
    // maxEnergy는 stats.maxEnergy 또는 maxStamina로 저장될 수 있음
    const maxEnergy = newDigimonData.stats?.maxEnergy || newDigimonData.stats?.maxStamina || newDigimonData.maxEnergy || newDigimonData.maxStamina || 100;
    
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
    // 진화 시 activityLogs 계승 (초기화하지 않음)
    const existingLogs = currentStats.activityLogs || activityLogs || [];
    const newDigimonName = newDigimonData.name || newName;
    const updatedLogs = addActivityLog(existingLogs, 'EVOLUTION', `Evolution: Evolved to ${newDigimonName}!`);
    // activityLogs를 계승한 상태로 저장
    const nxWithLogs = { ...nx, activityLogs: updatedLogs };
    await setDigimonStatsAndSave(nxWithLogs, updatedLogs);
    await setSelectedDigimonAndSave(newName);
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
    checkEvolutionReady,
  };
}

