// src/hooks/useFridge.js
// 냉장고(냉동수면) 기능 관리 Hook

import { addActivityLog } from "./useGameLogic";
import { toTimestamp } from "../utils/fridgeTime";

const HUNGER_CALL_TIMEOUT_MS = 10 * 60 * 1000;
const STRENGTH_CALL_TIMEOUT_MS = 10 * 60 * 1000;

function shiftCallWindow(entry, deadline, frozenDurationMs, timeoutMs) {
  const safeEntry = entry || { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false };
  const startedAt = toTimestamp(safeEntry.startedAt);
  const deadlineAt = toTimestamp(deadline);

  if (safeEntry.isLogged || (startedAt == null && deadlineAt == null)) {
    return {
      entry: {
        ...safeEntry,
        isActive: false,
      },
      deadline: deadlineAt ?? null,
    };
  }

  const nextStartedAt =
    startedAt != null
      ? startedAt + frozenDurationMs
      : Math.max(0, (deadlineAt ?? Date.now()) - timeoutMs) + frozenDurationMs;
  const nextDeadline = (deadlineAt != null ? deadlineAt : nextStartedAt + timeoutMs) + frozenDurationMs;

  return {
    entry: {
      ...safeEntry,
      isActive: false,
      startedAt: nextStartedAt,
      sleepStartAt: null,
    },
    deadline: nextDeadline,
  };
}

export function buildPutInFridgeCommitState(currentStats, nowMs = Date.now()) {
  return {
    ...currentStats,
    isFrozen: true,
    frozenAt: nowMs,
    callStatus: {
      hunger: {
        ...(currentStats.callStatus?.hunger || {}),
        isActive: false,
        sleepStartAt: null,
      },
      strength: {
        ...(currentStats.callStatus?.strength || {}),
        isActive: false,
        sleepStartAt: null,
      },
      sleep: {
        ...(currentStats.callStatus?.sleep || {}),
        isActive: false,
        startedAt: null,
        isLogged: false,
      },
    },
  };
}

export function formatFridgeDurationText(frozenDurationSeconds) {
  if (frozenDurationSeconds < 60) {
    return `${frozenDurationSeconds}초`;
  }

  if (frozenDurationSeconds < 3600) {
    return `${Math.floor(frozenDurationSeconds / 60)}분`;
  }

  const hours = Math.floor(frozenDurationSeconds / 3600);
  const minutes = Math.floor((frozenDurationSeconds % 3600) / 60);
  return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

export function buildTakeOutFridgeCommitState(currentStats, nowMs = Date.now()) {
  const frozenTime = toTimestamp(currentStats.frozenAt) ?? nowMs;
  const frozenDuration = Math.max(0, nowMs - frozenTime);
  const frozenDurationSeconds = Math.floor(frozenDuration / 1000);

  const nextHungerZeroFrozenDurationMs =
    currentStats.fullness === 0 && currentStats.lastHungerZeroAt
      ? (currentStats.hungerZeroFrozenDurationMs || 0) + frozenDuration
      : (currentStats.hungerZeroFrozenDurationMs || 0);
  const nextStrengthZeroFrozenDurationMs =
    currentStats.strength === 0 && currentStats.lastStrengthZeroAt
      ? (currentStats.strengthZeroFrozenDurationMs || 0) + frozenDuration
      : (currentStats.strengthZeroFrozenDurationMs || 0);
  const nextInjuryFrozenDurationMs =
    currentStats.isInjured && currentStats.injuredAt
      ? (currentStats.injuryFrozenDurationMs || 0) + frozenDuration
      : (currentStats.injuryFrozenDurationMs || 0);
  const nextPoopPenaltyFrozenDurationMs =
    currentStats.poopCount >= 8 && currentStats.lastPoopPenaltyAt
      ? (currentStats.poopPenaltyFrozenDurationMs || 0) + frozenDuration
      : (currentStats.poopPenaltyFrozenDurationMs || 0);

  const hungerWindow = shiftCallWindow(
    currentStats.callStatus?.hunger,
    currentStats.hungerMistakeDeadline,
    frozenDuration,
    HUNGER_CALL_TIMEOUT_MS
  );
  const strengthWindow = shiftCallWindow(
    currentStats.callStatus?.strength,
    currentStats.strengthMistakeDeadline,
    frozenDuration,
    STRENGTH_CALL_TIMEOUT_MS
  );

  return {
    frozenDuration,
    frozenDurationSeconds,
    updatedStats: {
      ...currentStats,
      isFrozen: false,
      frozenAt: null,
      takeOutAt: nowMs,
      lastSavedAt: new Date(nowMs),
      lastHungerZeroAt: currentStats.lastHungerZeroAt,
      lastStrengthZeroAt: currentStats.lastStrengthZeroAt,
      hungerZeroFrozenDurationMs: nextHungerZeroFrozenDurationMs,
      strengthZeroFrozenDurationMs: nextStrengthZeroFrozenDurationMs,
      injuryFrozenDurationMs: nextInjuryFrozenDurationMs,
      poopPenaltyFrozenDurationMs: nextPoopPenaltyFrozenDurationMs,
      hungerMistakeDeadline: hungerWindow.deadline,
      strengthMistakeDeadline: strengthWindow.deadline,
      callStatus: {
        hunger: hungerWindow.entry,
        strength: strengthWindow.entry,
        sleep: {
          ...(currentStats.callStatus?.sleep || {}),
          isActive: false,
          startedAt: null,
          isLogged: false,
        },
      },
    },
  };
}

export function buildTakeOutFridgeLogText(frozenDurationSeconds, message) {
  return `냉장고에서 꺼냈습니다. (${formatFridgeDurationText(
    frozenDurationSeconds
  )} 동안 보관) - ${message}`;
}

/**
 * useFridge Hook
 * 냉장고에 넣기/꺼내기 로직을 담당하는 Custom Hook
 * 
 * @param {Object} params - 초기화 파라미터
 * @param {Object} params.digimonStats - 현재 디지몬 스탯
 * @param {Function} params.setDigimonStatsAndSave - 스탯 저장 함수
 * @param {Function} params.applyLazyUpdateBeforeAction - Lazy Update 적용 함수
 * @param {Function} params.setActivityLogs - Activity Logs 설정 함수
 * @param {Array} params.activityLogs - Activity Logs 배열
 * @param {Function} [params.appendLogToSubcollection] - Firestore logs 서브컬렉션에 로그 추가
 * @returns {Object} putInFridge, takeOutFromFridge
 */
export function useFridge({
  digimonStats,
  setDigimonStatsAndSave,
  applyLazyUpdateBeforeAction,
  setActivityLogs,
  activityLogs,
  appendLogToSubcollection,
}) {
  /**
   * 냉장고에 넣기
   */
  async function putInFridge() {
    const currentStats = await applyLazyUpdateBeforeAction();
    
    if (currentStats.isDead) {
      alert("사망한 디지몬은 냉장고에 넣을 수 없습니다.");
      return;
    }
    
    if (currentStats.isFrozen) {
      alert("이미 냉장고에 보관되어 있습니다.");
      return;
    }
    
    const updatedStats = buildPutInFridgeCommitState(currentStats);
    
    const updatedLogs = addActivityLog(
      activityLogs || [],
      "FRIDGE",
      "냉장고에 보관했습니다. 시간이 멈춥니다."
    );
    if (appendLogToSubcollection) await appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
    await setDigimonStatsAndSave(updatedStats, updatedLogs);
  }
  
  /**
   * 냉장고에서 꺼내기
   */
  async function takeOutFromFridge() {
    const currentStats = await applyLazyUpdateBeforeAction();
    
    if (!currentStats.isFrozen) {
      return;
    }
    
    const { frozenDurationSeconds, updatedStats } =
      buildTakeOutFridgeCommitState(currentStats);
    
    // 냉장고 전용 대사
    const messages = [
      "추웠어!",
      "잘 잤다!",
      "냉장고에서 나왔어!",
      "시간이 다시 흐르기 시작했어!",
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    const updatedLogs = addActivityLog(
      activityLogs || [],
      "FRIDGE",
      buildTakeOutFridgeLogText(frozenDurationSeconds, randomMessage)
    );
    if (appendLogToSubcollection) await appendLogToSubcollection(updatedLogs[updatedLogs.length - 1]).catch(() => {});
    await setDigimonStatsAndSave(updatedStats, updatedLogs);
  }
  
  return {
    putInFridge,
    takeOutFromFridge,
  };
}
