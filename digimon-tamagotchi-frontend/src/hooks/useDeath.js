// src/hooks/useDeath.js
// Game.jsx의 죽음(Death) 로직을 분리한 Custom Hook

import { initializeStats } from "../data/stats";
import { updateEncyclopedia } from "./useEncyclopedia";
import { addActivityLog } from "./useGameLogic";
import { evaluateDeathConditions } from "../logic/stats/death";
import { buildDigimonLogSnapshot } from "../utils/digimonLogSnapshot";
import {
  getDeathFormIds,
  getStarterDigimonId,
  isStarterDigimonId,
} from "../utils/digimonVersionUtils";

export function resolveDeathReincarnationDigimonId({
  currentStats,
  perfectStages = [],
  version = "Ver.1",
  slotRuntimeDataMap,
}) {
  const isPerfect = perfectStages.includes(currentStats?.evolutionStage);
  const [defaultDeathForm, perfectDeathForm] = getDeathFormIds(version);
  const preferredDeathForm = isPerfect ? perfectDeathForm : defaultDeathForm;

  if (slotRuntimeDataMap?.[preferredDeathForm]) {
    return preferredDeathForm;
  }

  return getStarterDigimonId(version);
}

export function buildDeathReincarnationState({
  currentStats,
  reincarnationDigimonId,
  slotRuntimeDataMap,
}) {
  const previousStats = { ...currentStats };
  const nextStats = initializeStats(
    reincarnationDigimonId,
    previousStats,
    slotRuntimeDataMap
  );
  const reincarnationLogs = addActivityLog(
    nextStats.activityLogs || previousStats.activityLogs || [],
    "REINCARNATION",
    `Reincarnation: Transformed to ${reincarnationDigimonId} (death form)`,
    buildDigimonLogSnapshot(reincarnationDigimonId, slotRuntimeDataMap)
  );

  return {
    previousStats,
    nextStats,
    reincarnationLogs,
    committedStats: {
      ...nextStats,
      activityLogs: reincarnationLogs,
      selectedDigimon: reincarnationDigimonId,
    },
  };
}

export function shouldRecordDeathEncyclopedia(selectedDigimon) {
  return Boolean(selectedDigimon && !isStarterDigimonId(selectedDigimon));
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
 * @param {Object} params.digimonDataVer1 - 현재 슬롯의 런타임 데이터 맵
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
  const slotRuntimeDataMap = digimonDataVer1;

  /**
   * 사망 확정 함수 (환생 처리)
   */
  async function confirmDeath() {
    // 최신 스탯 가져오기
    const currentStats = await applyLazyUpdateBeforeAction();
    
    const reincarnationDigimonId = resolveDeathReincarnationDigimonId({
      currentStats,
      perfectStages,
      version,
      slotRuntimeDataMap,
    });

    if (!slotRuntimeDataMap?.[reincarnationDigimonId]) {
      console.error(
        `No data for ${reincarnationDigimonId} in digimonDataVer1!? fallback => starter`
      );
    }

    const {
      previousStats,
      reincarnationLogs,
      committedStats,
    } = buildDeathReincarnationState({
      currentStats,
      reincarnationDigimonId,
      slotRuntimeDataMap,
    });

    if (appendLogToSubcollection) await appendLogToSubcollection(reincarnationLogs[reincarnationLogs.length - 1]).catch(() => {});
    
    // ✅ 도감 업데이트: 사망 전 디지몬 기록 (계정별 통합, 버전별 관리)
    if (shouldRecordDeathEncyclopedia(selectedDigimon)) {
      await updateEncyclopedia(
        selectedDigimon,
        previousStats, // 사망 전 스탯
        'death',
        currentUser,
        version // 버전 전달 (Ver.2 별도 관리)
      );
    }
    
    await setDigimonStatsAndSave(committedStats, reincarnationLogs);
    await setSelectedDigimonAndSave(reincarnationDigimonId);
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
