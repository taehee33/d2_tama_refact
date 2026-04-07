// src/hooks/useDeath.js
// Game.jsx의 죽음(Death) 로직을 분리한 Custom Hook

import { initializeStats } from "../data/stats";
import { updateEncyclopedia } from "./useEncyclopedia";
import { addActivityLog } from "./useGameLogic";
import { evaluateDeathConditions } from "../logic/stats/death";
import { buildDigimonLogSnapshot } from "../utils/digimonLogSnapshot";

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
  version = "Ver.1",
  appendLogToSubcollection,
}) {
  /**
   * 사망 확정 함수 (환생 처리)
   */
  async function confirmDeath() {
    // 최신 스탯 가져오기
    const currentStats = await applyLazyUpdateBeforeAction();
    
    // Ver.2는 Ohakadamon1V2/Ohakadamon2V2, Ver.1은 Ohakadamon1/Ohakadamon2 (공통 ID 사용 안 함)
    const isPerfect = perfectStages.includes(currentStats.evolutionStage);
    let ohaka = version === "Ver.2"
      ? (isPerfect ? "Ohakadamon2V2" : "Ohakadamon1V2")
      : (isPerfect ? "Ohakadamon2" : "Ohakadamon1");
    if (!digimonDataVer1[ohaka]) {
      console.error(`No data for ${ohaka} in digimonDataVer1!? fallback => Digitama`);
      ohaka = "Digitama";
    }
    const old = { ...currentStats };
    const nx = initializeStats(ohaka, old, digimonDataVer1);
    // 활동 로그: 오하카다몬(사망 폼)으로 환생 기록
    const reincarnationLogs = addActivityLog(
      nx.activityLogs || old.activityLogs || [],
      "REINCARNATION",
      `Reincarnation: Transformed to ${ohaka} (death form)`,
      buildDigimonLogSnapshot(ohaka, digimonDataVer1)
    );
    if (appendLogToSubcollection) await appendLogToSubcollection(reincarnationLogs[reincarnationLogs.length - 1]).catch(() => {});
    const nxWithLogs = { ...nx, activityLogs: reincarnationLogs, selectedDigimon: ohaka };
    
    // ✅ 도감 업데이트: 사망 전 디지몬 기록 (계정별 통합, 버전별 관리)
    if (selectedDigimon && selectedDigimon !== "Digitama" && selectedDigimon !== "DigitamaV2") {
      await updateEncyclopedia(
        selectedDigimon,
        old, // 사망 전 스탯
        'death',
        currentUser,
        version // 버전 전달 (Ver.2 별도 관리)
      );
    }
    
    await setDigimonStatsAndSave(nxWithLogs, reincarnationLogs);
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
    return evaluateDeathConditions(stats, Date.now());
  }

  return {
    confirmDeath,
    checkDeathCondition,
  };
}
