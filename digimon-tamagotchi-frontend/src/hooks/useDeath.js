// src/hooks/useDeath.js
// Game.jsx의 죽음(Death) 로직을 분리한 Custom Hook

import { initializeStats } from "../data/stats";

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
    // 배고픔/힘이 0이고 12시간 경과 시 사망
    if (stats.fullness === 0 && stats.lastHungerZeroAt) {
      const elapsed = (Date.now() - stats.lastHungerZeroAt) / 1000;
      if (elapsed >= 43200) { // 12시간 = 43200초
        return { isDead: true, reason: 'STARVATION (굶주림)' };
      }
    }
    if (stats.strength === 0 && stats.lastStrengthZeroAt) {
      const elapsed = (Date.now() - stats.lastStrengthZeroAt) / 1000;
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
      const elapsedSinceInjury = Date.now() - injuredTime;
      if (elapsedSinceInjury >= 21600000) { // 6시간 = 21600000ms
        return { isDead: true, reason: 'INJURY NEGLECT (부상 방치: 6시간)' };
      }
    }
    
    // 수명 다함 (기본 사망 조건)
    if (stats.isDead) {
      return { isDead: true, reason: 'OLD AGE (수명 다함)' };
    }
    
    return { isDead: false, reason: null };
  }

  return {
    confirmDeath,
    checkDeathCondition,
  };
}


