// src/hooks/useDeath.js
// Game.jsx의 죽음(Death) 로직을 분리한 Custom Hook

import { initializeStats } from "../data/stats";
import { updateEncyclopedia } from "./useEncyclopedia";

/**
 * 냉장고 시간을 제외한 경과 시간 계산
 * @param {number} startTime - 시작 시간 (timestamp)
 * @param {number} endTime - 종료 시간 (timestamp, 기본값: 현재 시간)
 * @param {number|null} frozenAt - 냉장고에 넣은 시간 (timestamp)
 * @param {number|null} takeOutAt - 냉장고에서 꺼낸 시간 (timestamp)
 * @returns {number} 냉장고 시간을 제외한 경과 시간 (밀리초)
 */
function getElapsedTimeExcludingFridge(startTime, endTime = Date.now(), frozenAt = null, takeOutAt = null) {
  if (!frozenAt) {
    // 냉장고에 넣은 적이 없으면 일반 경과 시간 반환
    return endTime - startTime;
  }
  
  const frozenTime = typeof frozenAt === 'number' ? frozenAt : new Date(frozenAt).getTime();
  const takeOutTime = takeOutAt ? (typeof takeOutAt === 'number' ? takeOutAt : new Date(takeOutAt).getTime()) : endTime;
  
  // 냉장고에 넣은 시간이 시작 시간보다 이전이면 무시
  if (frozenTime < startTime) {
    return endTime - startTime;
  }
  
  // 냉장고에 넣은 시간이 종료 시간보다 이후면 무시
  if (frozenTime >= endTime) {
    return endTime - startTime;
  }
  
  // 냉장고에 넣은 시간부터 꺼낸 시간(또는 현재)까지의 시간을 제외
  const frozenDuration = takeOutTime - frozenTime;
  const totalElapsed = endTime - startTime;
  
  // 냉장고 시간을 제외한 경과 시간 반환
  return Math.max(0, totalElapsed - frozenDuration);
}

/**
 * useDeath Hook
 * 죽음/환생 관련 로직을 담당하는 Custom Hook
 * 
 * @param {Object} params - 초기화 파라미터
 * @param {Object} params.digimonStats - 현재 디지몬 스탯
 * @param {Function} params.setDigimonStatsAndSave - 스탯 저장 함수
 * @param {Function} params.setSelectedDigimonAndSave - 선택된 디지몬 저장 함수
 * @param {Function} params.applyLazyUpdateBeforeAction - Lazy Update 적용 함수
 * @param {Function} params.toggleModal - 모달 토글 함수
 * @param {Function} params.setHasSeenDeathPopup - 사망 팝업 표시 여부 설정 함수
 * @param {Object} params.digimonDataVer1 - 디지몬 데이터
 * @param {Array} params.perfectStages - Perfect 단계 목록
 * @param {string} params.version - 슬롯 버전 ("Ver.1" | "Ver.2" 등, 도감 관리용)
 * @returns {Object} confirmDeath, checkDeathCondition
 */
export function useDeath({
  digimonStats,
  setDigimonStatsAndSave,
  setSelectedDigimonAndSave,
  applyLazyUpdateBeforeAction,
  toggleModal,
  setHasSeenDeathPopup,
  digimonDataVer1,
  perfectStages,
  selectedDigimon,
  slotId,
  currentUser,
  version = "Ver.1", // 슬롯 버전 (도감 관리용)
}) {
  /**
   * 사망 확정 함수 (환생 처리)
   */
  async function confirmDeath() {
    // 최신 스탯 가져오기
    const currentStats = await applyLazyUpdateBeforeAction();
    
    let ohaka = "Ohakadamon1";
    if (perfectStages.includes(currentStats.evolutionStage)) {
      ohaka = "Ohakadamon2";
    }
    if (!digimonDataVer1[ohaka]) {
      console.error(`No data for ${ohaka} in digimonDataVer1!? fallback => Digitama`);
      ohaka = "Digitama";
    }
    const old = { ...currentStats };
    const nx = initializeStats(ohaka, old, digimonDataVer1);
    
    // ✅ 도감 업데이트: 사망 전 디지몬 기록 (계정별 통합, 버전별 관리)
    if (selectedDigimon && selectedDigimon !== "Digitama") {
      await updateEncyclopedia(
        selectedDigimon,
        old, // 사망 전 스탯
        'death',
        currentUser,
        version // 버전 전달 (Ver.2 별도 관리)
      );
    }
    
    await setDigimonStatsAndSave(nx);
    await setSelectedDigimonAndSave(ohaka);
    toggleModal('deathModal', false);
    setHasSeenDeathPopup(false); // 사망 팝업 플래그 초기화
  }

  /**
   * 사망 조건 확인
   * @param {Object} stats - 확인할 스탯
   * @returns {Object} 사망 여부 및 사유
   */
  function checkDeathCondition(stats) {
    // 냉장고 상태에서는 사망하지 않음
    if (stats.isFrozen) {
      return { isDead: false, reason: null };
    }
    
    // 배고픔/힘이 0이고 12시간 경과 시 사망
    if (stats.fullness === 0 && stats.lastHungerZeroAt) {
      const hungerZeroTime = typeof stats.lastHungerZeroAt === 'number'
        ? stats.lastHungerZeroAt
        : new Date(stats.lastHungerZeroAt).getTime();
      // 냉장고 시간을 제외한 경과 시간 계산
      const elapsedMs = getElapsedTimeExcludingFridge(
        hungerZeroTime,
        Date.now(),
        stats.frozenAt,
        stats.takeOutAt
      );
      const elapsed = elapsedMs / 1000;
      if (elapsed >= 43200) { // 12시간 = 43200초
        return { isDead: true, reason: 'STARVATION (굶주림)' };
      }
    }
    if (stats.strength === 0 && stats.lastStrengthZeroAt) {
      const strengthZeroTime = typeof stats.lastStrengthZeroAt === 'number'
        ? stats.lastStrengthZeroAt
        : new Date(stats.lastStrengthZeroAt).getTime();
      // 냉장고 시간을 제외한 경과 시간 계산
      const elapsedMs = getElapsedTimeExcludingFridge(
        strengthZeroTime,
        Date.now(),
        stats.frozenAt,
        stats.takeOutAt
      );
      const elapsed = elapsedMs / 1000;
      if (elapsed >= 43200) {
        return { isDead: true, reason: 'EXHAUSTION (힘 소진)' };
      }
    }
    
    // 부상 과다 사망 체크: injuries >= 15
    if ((stats.injuries || 0) >= 15) {
      return { isDead: true, reason: 'INJURY OVERLOAD (부상 과다: 15회)' };
    }
    
    // 부상 방치 사망 체크: 6시간 이상 치료하지 않음
    if (stats.isInjured && stats.injuredAt) {
      const injuredTime = typeof stats.injuredAt === 'number'
        ? stats.injuredAt
        : new Date(stats.injuredAt).getTime();
      // 냉장고 시간을 제외한 경과 시간 계산
      const elapsedSinceInjury = getElapsedTimeExcludingFridge(
        injuredTime,
        Date.now(),
        stats.frozenAt,
        stats.takeOutAt
      );
      if (elapsedSinceInjury >= 21600000) { // 6시간 = 21600000ms
        return { isDead: true, reason: 'INJURY NEGLECT (부상 방치: 6시간)' };
      }
    }
    
    // 수명으로 인한 사망 제거됨
    // 이미 isDead가 true인 경우 다른 사망 원인을 찾지 못했을 때 fallback
    if (stats.isDead) {
      // 다른 사망 원인을 찾지 못한 경우, reason은 null로 반환
      return { isDead: true, reason: null };
    }
    
    return { isDead: false, reason: null };
  }

  return {
    confirmDeath,
    checkDeathCondition,
  };
}



