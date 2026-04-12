// src/hooks/useGameActions.js
// Game.jsx의 비즈니스 로직을 분리한 Custom Hook

import { MAX_ACTIVITY_LOGS } from "../constants/activityLogs";
import {
  resetCallStatus,
  hasDuplicateSleepDisturbanceLog,
  createSleepDisturbanceLog,
  getSleepStatus,
  isSleepStatusSleeping,
  isSleepStatusDisturbanceSensitive,
} from "./useGameLogic";
import { feedMeat, willRefuseMeat } from "../logic/food/meat";
import { feedProtein, willRefuseProtein } from "../logic/food/protein";
import { doVer1Training } from "../logic/training";
import { calculateInjuryChance } from "../logic/battle/calculator";
import { serverTimestamp } from "firebase/firestore";
import { clearPoopOverflowState } from "../data/stats";
import { completeArenaBattle } from "../utils/arenaApi";
import { buildDigimonLogSnapshot } from "../utils/digimonLogSnapshot";
import {
  normalizeSleepSchedule,
  shiftSleepScheduleByHours,
} from "../utils/sleepUtils";
import { resolveTamerNamePriority } from "../utils/tamerNameUtils";

/**
 * 수면 스케줄 가져오기 (야행성 모드 반영)
 */
function getSleepSchedule(digimonData, name, digimonStats = null) {
  const data = digimonData[name] || {};
  const baseSchedule = normalizeSleepSchedule(data.sleepSchedule || { start: 22, end: 6 });
  
  // 야행성 모드 확인
  const isNocturnal = digimonStats?.isNocturnal || false;
  
  if (!isNocturnal) return baseSchedule;
  
  // 야행성 모드: 시작 시간과 종료 시간을 3시간 뒤로 미룸 (24시간제 계산)
  return shiftSleepScheduleByHours(baseSchedule, 3);
}

/** 배틀 로그 최대 보관 개수 */
const MAX_BATTLE_LOGS = 100;

/**
 * 배틀 로그 한 건 추가 (배틀 기록 전용 배열에만 저장, activityLogs에는 넣지 않음)
 * @param {Array} prevBattleLogs - 기존 battleLogs
 * @param {Object} entry - { timestamp, mode: 'sparring'|'arena'|'quest'|'skip', text, win?, enemyName?, injury?, digimonId?, digimonName? }
 * @returns {Array} 최대 100개 유지
 */
function appendBattleLog(prevBattleLogs, entry) {
  const list = Array.isArray(prevBattleLogs) ? prevBattleLogs : [];
  return [{ ...entry, timestamp: entry.timestamp || Date.now() }, ...list].slice(0, MAX_BATTLE_LOGS);
}

function cloneStatsForCallStatusReset(stats = {}, callType) {
  if (!stats.callStatus) {
    return { ...stats };
  }

  return {
    ...stats,
    callStatus: {
      ...stats.callStatus,
      [callType]: stats.callStatus[callType]
        ? { ...stats.callStatus[callType] }
        : stats.callStatus[callType],
    },
  };
}

export function buildActivityLogCommitState({
  prevStats = {},
  nextStats = {},
  entry,
} = {}) {
  const updatedLogs = [entry, ...(prevStats.activityLogs || [])].slice(0, MAX_ACTIVITY_LOGS);

  return {
    updatedLogs,
    statsWithLogs: {
      ...nextStats,
      activityLogs: updatedLogs,
    },
  };
}

export function buildFeedLogText({
  type,
  isRefused = false,
  eatResult = {},
  beforeStats = {},
  updatedStats = {},
} = {}) {
  const oldFullness = beforeStats.fullness || 0;
  const oldWeight = beforeStats.weight || 0;
  const oldStrength = beforeStats.strength || 0;
  const oldEnergy = beforeStats.energy || 0;
  const oldOverfeeds = beforeStats.overfeeds || 0;

  const newFullness = updatedStats.fullness || 0;
  const newWeight = updatedStats.weight || 0;
  const newStrength = updatedStats.strength || 0;
  const newEnergy = updatedStats.energy || 0;
  const newOverfeeds = updatedStats.overfeeds || 0;

  const weightDelta = newWeight - oldWeight;
  const fullnessDelta = newFullness - oldFullness;
  const strengthDelta = newStrength - oldStrength;
  const energyDelta = newEnergy - oldEnergy;

  if (type === "meat") {
    if (eatResult.isOverfeed) {
      return `Overfeed! (거절 상태, Overfeed ${oldOverfeeds}→${newOverfeeds})`;
    }

    if (isRefused) {
      return "Feed: Refused (고기 거절, Overfeed 증가 없음)";
    }

    return `Feed: Meat (Wt +${weightDelta}g, Hun +${fullnessDelta}) => (Wt ${oldWeight}→${newWeight}g, Hun ${oldFullness}→${newFullness})`;
  }

  const strengthChanged = strengthDelta > 0;
  const strengthText = strengthChanged ? `, Str +${strengthDelta}` : "";
  const strengthResultText = `, Str ${oldStrength}→${newStrength}`;

  if (eatResult.energyRestored) {
    const energyText = energyDelta > 0 ? `, En +${energyDelta}` : "";
    const energyResultText = energyDelta > 0 ? `, En ${oldEnergy}→${newEnergy}` : "";
    return `Feed: Protein (Wt +${weightDelta}g${strengthText}${energyText}) - Protein Bonus! (En +1, Overdose +1) => (Wt ${oldWeight}→${newWeight}g${strengthResultText}${energyResultText})`;
  }

  return `Feed: Protein (Wt +${weightDelta}g${strengthText}) => (Wt ${oldWeight}→${newWeight}g${strengthResultText})`;
}

export function buildTrainingLogText({
  result = {},
  beforeStats = {},
  finalStats = {},
} = {}) {
  const beforeW = beforeStats.weight ?? 0;
  const beforeS = beforeStats.strength ?? 0;
  const beforeE = beforeStats.energy ?? 0;
  const beforeT = beforeStats.trainings ?? 0;
  const afterW = finalStats.weight ?? 0;
  const afterS = finalStats.strength ?? 0;
  const afterE = finalStats.energy ?? 0;
  const afterT = finalStats.trainings ?? 0;

  return result.isSuccess
    ? `훈련 성공! 힘 ${beforeS}→${afterS}, 무게 ${beforeW}→${afterW}g, 에너지 ${beforeE}→${afterE}, 훈련횟수 ${beforeT}→${afterT}`
    : `훈련 실패. 힘 ${beforeS}→${afterS}, 무게 ${beforeW}→${afterW}g, 에너지 ${beforeE}→${afterE}, 훈련횟수 ${beforeT}→${afterT}`;
}

export function buildTrainingOutcome({
  baseStats = {},
  trainingResult = {},
} = {}) {
  let finalStats = trainingResult.updatedStats || baseStats;

  if ((finalStats.strength || 0) > 0) {
    finalStats = resetCallStatus(
      cloneStatsForCallStatusReset(finalStats, "strength"),
      "strength"
    );
  }

  return {
    finalStats,
    logText: buildTrainingLogText({
      result: trainingResult,
      beforeStats: baseStats,
      finalStats,
    }),
  };
}

export function buildFeedOutcome({
  type,
  baseStats = {},
  isRefused = false,
} = {}) {
  let eatResult;
  let updatedStats;

  if (isRefused && type === "meat") {
    updatedStats = baseStats;
    eatResult = {
      updatedStats,
      fullnessIncreased: false,
      canEatMore: false,
      isOverfeed: false,
    };
  } else if (type === "meat") {
    const wasRefusing = willRefuseMeat(baseStats);
    eatResult = feedMeat(baseStats, wasRefusing && !isRefused);
    updatedStats = eatResult.updatedStats;
  } else {
    eatResult = feedProtein(baseStats);
    updatedStats = eatResult.updatedStats;
  }

  if ((updatedStats.fullness || 0) > 0) {
    updatedStats = resetCallStatus(cloneStatsForCallStatusReset(updatedStats, "hunger"), "hunger");
  }

  if (type === "protein" && (updatedStats.strength || 0) > 0) {
    updatedStats = resetCallStatus(
      cloneStatsForCallStatusReset(updatedStats, "strength"),
      "strength"
    );
  }

  return {
    eatResult,
    updatedStats,
    logText: buildFeedLogText({
      type,
      isRefused,
      eatResult,
      beforeStats: baseStats,
      updatedStats,
    }),
  };
}

export function buildCleanOutcome({
  prevStats = {},
  now = new Date(),
} = {}) {
  const oldPoopCount = prevStats.poopCount || 0;
  const updatedStats = clearPoopOverflowState(prevStats, now);

  return {
    updatedStats,
    logText: `Cleaned Poop (Full flush, ${oldPoopCount} → 0)`,
  };
}

export function buildSleepDisturbanceCommitState({
  prevStats = {},
  nextStats = {},
  reason,
  timestamp = Date.now(),
} = {}) {
  const entry = createSleepDisturbanceLog(reason, timestamp);
  const activityCommitState = buildActivityLogCommitState({
    prevStats,
    nextStats,
    entry,
  });

  return {
    entry,
    ...activityCommitState,
  };
}

export function buildTrainingSkipOutcome({
  reason,
  baseStats = {},
  timestamp = Date.now(),
} = {}) {
  const weight = baseStats.weight ?? 0;
  const energy = baseStats.energy ?? 0;

  if (reason === "underweight") {
    return {
      entry: {
        type: "TRAIN",
        text: `훈련 건너뜀(사유: 체중 부족). 무게: ${weight}g`,
        timestamp,
      },
      alertMessage: "⚠️ 체중이 너무 낮습니다!\n먹이로 체중을 늘려 주세요.",
    };
  }

  return {
    entry: {
      type: "TRAIN",
      text: `훈련 건너뜀(사유: 에너지 부족). 에너지: ${energy}, 무게: ${weight}g`,
      timestamp,
    },
    alertMessage: "⚠️ 에너지가 부족합니다!\n잠을 재워 에너지를 회복해 주세요.",
  };
}

export function buildBattleLogEntry({
  mode,
  text,
  win,
  enemyName,
  injury,
  timestamp = Date.now(),
  digimonSnapshot = {},
} = {}) {
  return {
    mode,
    text,
    ...(typeof win === "boolean" ? { win } : {}),
    ...(enemyName ? { enemyName } : {}),
    ...(typeof injury === "boolean" ? { injury } : {}),
    timestamp,
    ...(digimonSnapshot || {}),
  };
}

export function buildBattleLogCommitState({
  prevStats = {},
  nextStats = {},
  entry,
} = {}) {
  const updatedBattleLogs = appendBattleLog(prevStats.battleLogs, entry);
  return {
    updatedBattleLogs,
    statsWithBattleLogs: {
      ...nextStats,
      battleLogs: updatedBattleLogs,
    },
  };
}

export function buildBattleCommitPlan({
  prevStats = {},
  nextStats = {},
  mode,
  text,
  win,
  enemyName,
  injury,
  timestamp = Date.now(),
  digimonSnapshot = {},
} = {}) {
  const entry = buildBattleLogEntry({
    mode,
    text,
    win,
    enemyName,
    injury,
    timestamp,
    digimonSnapshot,
  });
  const battleCommitState = buildBattleLogCommitState({
    prevStats,
    nextStats,
    entry,
  });

  return {
    entry,
    ...battleCommitState,
  };
}

export function buildBattleCostStats(baseStats = {}) {
  const oldWeight = baseStats.weight || 0;
  const oldEnergy = baseStats.energy || 0;
  const battleStats = {
    ...baseStats,
    weight: Math.max(0, oldWeight - 4),
    energy: Math.max(0, oldEnergy - 1),
  };

  return {
    battleStats,
    weightDelta: (battleStats.weight || 0) - oldWeight,
    energyDelta: (battleStats.energy || 0) - oldEnergy,
  };
}

export function buildRecordedBattleStats(battleStats = {}, win = false) {
  const newBattles = (battleStats.battles || 0) + 1;
  const newBattlesWon = (battleStats.battlesWon || 0) + (win ? 1 : 0);
  const newBattlesLost = (battleStats.battlesLost || 0) + (win ? 0 : 1);
  const newWinRate = newBattles > 0 ? Math.round((newBattlesWon / newBattles) * 100) : 0;

  const newTotalBattles = (battleStats.totalBattles || 0) + 1;
  const newTotalBattlesWon = (battleStats.totalBattlesWon || 0) + (win ? 1 : 0);
  const newTotalBattlesLost = (battleStats.totalBattlesLost || 0) + (win ? 0 : 1);
  const newTotalWinRate =
    newTotalBattles > 0 ? Math.round((newTotalBattlesWon / newTotalBattles) * 100) : 0;

  return {
    ...battleStats,
    battles: newBattles,
    battlesWon: newBattlesWon,
    battlesLost: newBattlesLost,
    winRate: newWinRate,
    totalBattles: newTotalBattles,
    totalBattlesWon: newTotalBattlesWon,
    totalBattlesLost: newTotalBattlesLost,
    totalWinRate: newTotalWinRate,
  };
}

export function applyBattleInjuryOutcome({
  finalStats = {},
  win = false,
  proteinOverdose = 0,
  randomValue = Math.random(),
  nowMs = Date.now(),
} = {}) {
  const injuryChance = calculateInjuryChance(win, proteinOverdose);
  const isInjured = randomValue * 100 < injuryChance;

  if (!isInjured) {
    return {
      finalStats,
      isInjured: false,
      injuryChance,
    };
  }

  return {
    finalStats: {
      ...finalStats,
      isInjured: true,
      injuredAt: nowMs,
      injuryFrozenDurationMs: 0,
      injuries: (finalStats.injuries || 0) + 1,
      healedDosesCurrent: 0,
      injuryReason: "battle",
    },
    isInjured: true,
    injuryChance,
  };
}

export function buildArenaBattleLocalOutcome({
  battleStats = {},
  win = false,
  opponentName = "Unknown",
  weightDelta = 0,
  energyDelta = 0,
} = {}) {
  return {
    finalStats: buildRecordedBattleStats(battleStats, win),
    enemyName: opponentName,
    text: win
      ? `Arena: Won vs ${opponentName} (Rank UP) (Wt ${weightDelta}g, En ${energyDelta})`
      : `Arena: Lost vs ${opponentName} (Wt ${weightDelta}g, En ${energyDelta})`,
  };
}

export function buildQuestBattleOutcome({
  battleStats = {},
  win = false,
  enemyName = "Unknown Enemy",
  weightDelta = 0,
  energyDelta = 0,
  isAreaClear = false,
  proteinOverdose = 0,
  randomValue = Math.random(),
  nowMs = Date.now(),
} = {}) {
  const recordedStats = buildRecordedBattleStats(battleStats, win);
  const injuryResult = applyBattleInjuryOutcome({
    finalStats: recordedStats,
    win,
    proteinOverdose,
    randomValue,
    nowMs,
  });
  const finalStats = injuryResult.finalStats;
  const isInjured = injuryResult.isInjured;

  let text = win
    ? isAreaClear
      ? `Quest: Defeated ${enemyName} (Stage Clear) (Wt ${weightDelta}g, En ${energyDelta})`
      : `Quest: Defeated ${enemyName} (Wt ${weightDelta}g, En ${energyDelta})`
    : `Quest: Defeated by ${enemyName} (Wt ${weightDelta}g, En ${energyDelta})`;

  if (isInjured) {
    text += " - Battle: Injured! (Chance hit)";
  }

  return {
    finalStats,
    enemyName,
    isInjured,
    text,
  };
}

export function buildArenaBattleArchiveWrite({
  archiveId,
  currentUser,
  tamerName = null,
  slotId,
  slotName,
  arenaChallenger,
  enemyEntryId,
  myArenaEntryId,
  battleResult,
  currentSeasonId,
  userDigimonName,
  enemyDigimonName,
}) {
  const attackerName = resolveTamerNamePriority({
    tamerName,
    currentUser,
    extraFallbacks: [slotName, `슬롯${slotId}`],
  });
  const defenderName = arenaChallenger.tamerName || arenaChallenger.trainerName || "Unknown";
  const replayLogs = Array.isArray(battleResult.logs) ? battleResult.logs : [];
  const winnerUid = battleResult.win ? currentUser.uid : arenaChallenger.userId;
  const logSummary = battleResult.win
    ? `${attackerName}'s ${userDigimonName} defeated ${defenderName}'s ${enemyDigimonName}`
    : `${defenderName}'s ${enemyDigimonName} defeated ${attackerName}'s ${userDigimonName}`;

  return {
    replayLogs,
    firestoreLogData: {
      archiveId,
      attackerId: currentUser.uid,
      attackerName,
      attackerDigimonName: userDigimonName,
      defenderId: arenaChallenger.userId,
      defenderName,
      defenderDigimonName: enemyDigimonName,
      defenderEntryId: enemyEntryId,
      myEntryId: myArenaEntryId,
      winnerId: winnerUid,
      timestamp: serverTimestamp(),
      logSummary,
    },
    archivePayload: {
      id: archiveId,
      userUid: currentUser.uid,
      attackerUid: currentUser.uid,
      attackerName,
      attackerDigimonName: userDigimonName,
      defenderUid: arenaChallenger.userId,
      defenderName,
      defenderDigimonName: enemyDigimonName,
      myEntryId: myArenaEntryId,
      defenderEntryId: enemyEntryId,
      winnerUid,
      summary: logSummary,
      replayLogs,
      payload: {
        slotId,
        currentSeasonId,
        battleType: "arena",
        result: {
          win: Boolean(battleResult.win),
          logs: replayLogs,
        },
      },
    },
  };
}

function getActionSleepState({
  digimonStats,
  selectedDigimon,
  digimonData,
  isLightsOn,
  wakeUntil,
  now = new Date(),
}) {
  const sleepSchedule = getSleepSchedule(digimonData, selectedDigimon, digimonStats);
  const sleepStatus = getSleepStatus({
    sleepSchedule,
    isLightsOn,
    wakeUntil,
    fastSleepStart: digimonStats.fastSleepStart || null,
    napUntil: digimonStats.napUntil || null,
    now,
  });

  return {
    sleepSchedule,
    sleepStatus,
    isSleepingLike: isSleepStatusSleeping(sleepStatus),
    shouldCountSleepDisturbance: isSleepStatusDisturbanceSensitive(sleepStatus),
  };
}

export function resolveActionSleepInteractionPlan({
  digimonStats = {},
  activityLogs = [],
  selectedDigimon,
  digimonData,
  isLightsOn,
  wakeUntil,
  now = new Date(),
} = {}) {
  const actionSleepState = getActionSleepState({
    digimonStats,
    selectedDigimon,
    digimonData,
    isLightsOn,
    wakeUntil,
    now,
  });

  const timestamp = now instanceof Date ? now.getTime() : Date.now();
  const hasDuplicateSleepDisturbance =
    actionSleepState.isSleepingLike &&
    hasDuplicateSleepDisturbanceLog(activityLogs, timestamp);

  return {
    actionSleepState,
    timestamp,
    hasDuplicateSleepDisturbance,
    shouldWakeForInteraction:
      actionSleepState.isSleepingLike && !hasDuplicateSleepDisturbance,
  };
}

/**
 * 수면 중 인터랙션 시 10분 깨우기 + 수면방해 카운트
 * 순수 함수로 동작하여 업데이트된 스탯을 반환합니다.
 * 저장은 호출하는 쪽에서 통합하여 처리합니다.
 * 
 * @param {Object} digimonStats - 디지몬 스탯
 * @param {Function} setWakeUntil - wakeUntil 설정 함수
 * @param {Function} setDigimonStatsAndSave - 스탯 저장 함수 (사용하지 않음, 호환성을 위해 유지)
 * @param {boolean} isSleepTime - 정규 수면 시간 여부
 * @param {Function} onSleepDisturbance - 수면 방해 콜백
 * @returns {Object} 업데이트된 디지몬 스탯 (sleepDisturbances가 증가된 상태)
 */
export function wakeForInteraction(
  digimonStats,
  setWakeUntil,
  setDigimonStatsAndSave,
  shouldCountSleepDisturbance = false,
  onSleepDisturbance = null
) {
  const until = Date.now() + 10 * 60 * 1000; // 10분
  setWakeUntil(until);
  
  const updated = {
    ...digimonStats,
    wakeUntil: until,
    sleepDisturbances: shouldCountSleepDisturbance
      ? (digimonStats.sleepDisturbances || 0) + 1
      : (digimonStats.sleepDisturbances || 0),
  };
  
  // 저장은 호출하는 쪽에서 통합하여 처리하도록 변경 (중복 저장 방지)
  // setDigimonStatsAndSave(updated);
  
  // 수면 방해 콜백 호출 (낮잠 중이 아닐 때만)
  if (onSleepDisturbance && shouldCountSleepDisturbance) {
    onSleepDisturbance();
  }
  
  // 업데이트된 스탯 반환 (호출하는 쪽에서 사용)
  return updated;
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
  appendLogToSubcollection,
  appendBattleLogToSubcollection,
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
  battleType,
  setShowBattleScreen,
  setBattleType,
  setSparringEnemySlot,
  arenaChallenger,
  arenaEnemyId,
  myArenaEntryId,
  onSleepDisturbance = null, // 수면 방해 콜백
  setArenaChallenger,
  setArenaEnemyId,
  setMyArenaEntryId,
  setShowArenaScreen,
  currentSeasonId,
  currentQuestArea,
  setCurrentQuestArea,
  setCurrentQuestRound,
  toggleModal, // 과식 확인 모달용
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

  const commitSleepDisturbanceLog = ({ nextStats, reason, timestamp }) => {
    setDigimonStats((prevStats) => {
      if (hasDuplicateSleepDisturbanceLog(prevStats.activityLogs || [], timestamp)) {
        return prevStats;
      }

      const sleepDisturbanceCommitState = buildSleepDisturbanceCommitState({
        prevStats,
        nextStats,
        reason,
        timestamp,
      });
      if (appendLogToSubcollection) {
        appendLogToSubcollection(sleepDisturbanceCommitState.entry).catch(() => {});
      }
      setDigimonStatsAndSave(
        sleepDisturbanceCommitState.statsWithLogs,
        sleepDisturbanceCommitState.updatedLogs
      ).catch((error) => {
        console.error("수면 방해 로그 저장 오류:", error);
      });
      return sleepDisturbanceCommitState.statsWithLogs;
    });
  };

  const commitBattleLog = ({
    prevStats,
    nextStats,
    mode,
    text,
    win,
    enemyName,
    injury,
    timestamp = Date.now(),
    digimonSnapshot = {},
    errorMessage = "배틀 로그 저장 오류:",
  }) => {
    const battleCommitPlan = buildBattleCommitPlan({
      prevStats,
      nextStats,
      mode,
      text,
      win,
      enemyName,
      injury,
      timestamp,
      digimonSnapshot,
    });
    if (appendBattleLogToSubcollection) {
      appendBattleLogToSubcollection(battleCommitPlan.entry).catch(() => {});
    }
    setDigimonStatsAndSave(battleCommitPlan.statsWithBattleLogs).catch((error) => {
      console.error(errorMessage, error);
    });
    return battleCommitPlan.statsWithBattleLogs;
  };
  
  /**
   * 먹이 주기 핸들러
   */
  const handleFeed = async (type) => {
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    if(updatedStats.isDead) return;
    
    // 수면방해는 handleMenuClick에서 처리됨 (메뉴 클릭 시점)
    
    // 업데이트된 스탯으로 작업
    setDigimonStats(updatedStats);
    
    // 매뉴얼 기반 거부 체크
    if(type==="meat"){
      if(willRefuseMeat(updatedStats)){
        // 거절 상태: 과식 확인 팝업 표시
        toggleModal('overfeedConfirm', true);
        // 팝업에서 선택한 후 처리하기 위해 상태 저장
        setFeedType(type);
        setDigimonStats(updatedStats);
        return;
      }
    } else {
      if(willRefuseProtein(updatedStats)){
        setCurrentAnimation("foodRejectRefuse");
        setShowFood(false);
        setFeedStep(0);
        // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
        setDigimonStats((prevStats) => {
          const proteinOverdose = updatedStats.proteinOverdose || 0;
          const newLog = {
            type: "FEED",
            text: proteinOverdose >= 7 ? "Feed: Refused (Protein Overdose max reached: 7/7)" : "Feed: Refused",
            timestamp: Date.now(),
          };
          const activityCommitState = buildActivityLogCommitState({
            prevStats,
            nextStats: updatedStats,
            entry: newLog,
          });
          if (appendLogToSubcollection) appendLogToSubcollection(newLog).catch(() => {});
          setDigimonStatsAndSave(
            activityCommitState.statsWithLogs,
            activityCommitState.updatedLogs
          ).catch((error) => {
            console.error("먹이 거부 로그 저장 오류:", error);
          });
          return activityCommitState.statsWithLogs;
        });
        setTimeout(()=> setCurrentAnimation("idle"),2000);
        return;
      }
    }
    setFeedType(type);
    // 모바일에서 애니메이션이 확실히 보이도록 애니메이션을 먼저 설정
    setCurrentAnimation("eat");
    setShowFood(true);
    setFeedStep(0);
    // requestAnimationFrame을 사용하여 다음 프레임에서 애니메이션 시작 (모바일 최적화)
    requestAnimationFrame(() => {
      eatCycle(0, type);
    });
  };

  /**
   * 먹이 주기 사이클 (애니메이션)
   * 첫 번째 프레임에서 스탯을 즉시 증가시킴
   * @param {number} step - 현재 프레임
   * @param {string} type - "meat" | "protein"
   * @param {boolean} isRefused - 거절 상태 여부 (고기 거절 시 true)
   */
  const eatCycle = async (step, type, isRefused = false) => {
    const frameCount = (type==="protein"?3:4);
    
    // 첫 번째 프레임에서 스탯 즉시 업데이트 (실제 액션 수행 시점)
    if (step === 0) {
      // 최신 스탯 가져오기
      const currentStats = await applyLazyUpdateBeforeAction();
      
      // 수면 중 먹이 시도 시 수면 방해 처리 (실제 액션 수행 시점)
      const sleepInteractionPlan = resolveActionSleepInteractionPlan({
        digimonStats: currentStats,
        activityLogs: currentStats.activityLogs || [],
        selectedDigimon,
        digimonData,
        isLightsOn,
        wakeUntil,
      });

      let statsAfterWake = currentStats;
      if (sleepInteractionPlan.shouldWakeForInteraction) {
        statsAfterWake = wakeForInteraction(
          currentStats,
          setWakeUntil,
          setDigimonStatsAndSave,
          sleepInteractionPlan.actionSleepState.shouldCountSleepDisturbance,
          onSleepDisturbance
        );
        const actionType = type === "meat" ? "고기" : "프로틴";
        commitSleepDisturbanceLog({
          nextStats: statsAfterWake,
          reason: `먹이 주기 - ${actionType}`,
          timestamp: sleepInteractionPlan.timestamp,
        });
      }
      const baseStats = sleepInteractionPlan.actionSleepState.isSleepingLike
        ? statsAfterWake
        : currentStats;

      const feedOutcome = buildFeedOutcome({
        type,
        baseStats,
        isRefused,
      });
      const eatResult = feedOutcome.eatResult;
      const updatedStats = feedOutcome.updatedStats;

      // 디버깅: 오버피드 관련 변수 추적
      if (type === "meat") {
        console.log("[eatCycle] 오버피드 변수 추적:", {
          oldFullness: baseStats.fullness || 0,
          newFullness: updatedStats.fullness || 0,
          oldOverfeeds: baseStats.overfeeds || 0,
          newOverfeeds: updatedStats.overfeeds || 0,
          isOverfeed: eatResult.isOverfeed,
          maxFullness: 5 + (baseStats.maxOverfeed || 0),
        });
      }

      const logText = feedOutcome.logText;
      setDigimonStats((prevStats) => {
        const newLog = { type: "FEED", text: logText, timestamp: Date.now() };
        const activityCommitState = buildActivityLogCommitState({
          prevStats,
          nextStats: updatedStats,
          entry: newLog,
        });
        if (appendLogToSubcollection) appendLogToSubcollection(newLog).catch(() => {});
        setDigimonStatsAndSave(
          activityCommitState.statsWithLogs,
          activityCommitState.updatedLogs
        ).catch((error) => {
          console.error("먹이 로그 저장 오류:", error);
        });
        return activityCommitState.statsWithLogs;
      });
    }
    
    // 거절 상태일 때는 4프레임 애니메이션 (각 500ms, 총 2초)
    if (isRefused) {
      // 거절 애니메이션: 4프레임 (각 500ms)
      if (step >= 4) {
        // 애니메이션 종료
        setCurrentAnimation("idle");
        setShowFood(false);
        setFeedStep(0);
        return;
      }
      // 거절 애니메이션 진행
      setCurrentAnimation("foodRejectRefuse");
      setFeedStep(step);
      setTimeout(() => eatCycle(step + 1, type, isRefused), 500);
      return;
    }
    
    // 애니메이션 종료 처리
    if(step>=frameCount){
      setCurrentAnimation("idle");
      setShowFood(false);
      return;
    }
    
    // 애니메이션 진행
    setCurrentAnimation("eat");
    setFeedStep(step);
    setTimeout(()=> eatCycle(step+1, type, isRefused),500);
  };

  /**
   * 훈련 결과 핸들러
   */
  const handleTrainResult = async (userSelections) => {
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    
    // 수면 중 훈련 시도 시 수면 방해 처리 (실제 액션 수행 시점)
    const sleepInteractionPlan = resolveActionSleepInteractionPlan({
      digimonStats: updatedStats,
      activityLogs: updatedStats.activityLogs || [],
      selectedDigimon,
      digimonData,
      isLightsOn,
      wakeUntil,
    });

    let statsAfterWake = updatedStats;
    if (sleepInteractionPlan.shouldWakeForInteraction) {
      statsAfterWake = wakeForInteraction(
        updatedStats,
        setWakeUntil,
        setDigimonStatsAndSave,
        sleepInteractionPlan.actionSleepState.shouldCountSleepDisturbance,
        onSleepDisturbance
      );
      commitSleepDisturbanceLog({
        nextStats: statsAfterWake,
        reason: "훈련",
        timestamp: sleepInteractionPlan.timestamp,
      });
    }
    const baseStats = sleepInteractionPlan.actionSleepState.isSleepingLike
      ? statsAfterWake
      : updatedStats;
    setDigimonStats(baseStats);
    
    // Weight 체크: Weight가 0 이하면 훈련 불가
    if ((baseStats.weight || 0) <= 0) {
      const trainingSkipOutcome = buildTrainingSkipOutcome({
        reason: "underweight",
        baseStats,
      });
      setDigimonStats((prevStats) => {
        const activityCommitState = buildActivityLogCommitState({
          prevStats,
          nextStats: baseStats,
          entry: trainingSkipOutcome.entry,
        });
        if (appendLogToSubcollection) {
          appendLogToSubcollection(trainingSkipOutcome.entry).catch(() => {});
        }
        setDigimonStatsAndSave(
          activityCommitState.statsWithLogs,
          activityCommitState.updatedLogs
        ).catch((error) => {
          console.error("체중 부족 로그 저장 오류:", error);
        });
        return activityCommitState.statsWithLogs;
      });
      alert(trainingSkipOutcome.alertMessage);
      return null; // null 반환하여 TrainPopup에서 처리할 수 있도록
    }
    
    // 에너지 부족 체크
    if ((baseStats.energy || 0) <= 0) {
      const trainingSkipOutcome = buildTrainingSkipOutcome({
        reason: "lowEnergy",
        baseStats,
      });
      setDigimonStats((prevStats) => {
        const activityCommitState = buildActivityLogCommitState({
          prevStats,
          nextStats: baseStats,
          entry: trainingSkipOutcome.entry,
        });
        if (appendLogToSubcollection) {
          appendLogToSubcollection(trainingSkipOutcome.entry).catch(() => {});
        }
        setDigimonStatsAndSave(
          activityCommitState.statsWithLogs,
          activityCommitState.updatedLogs
        ).catch((error) => {
          console.error("에너지 부족 로그 저장 오류:", error);
        });
        return activityCommitState.statsWithLogs;
      });
      alert(trainingSkipOutcome.alertMessage);
      return null; // null 반환하여 TrainPopup에서 처리할 수 있도록
    }
    
    // userSelections: 길이5의 "U"/"D" 배열
    // doVer1Training -> stats 업데이트
    const result = doVer1Training(baseStats, userSelections);
    const trainingOutcome = buildTrainingOutcome({
      baseStats,
      trainingResult: result,
    });
    const finalStats = trainingOutcome.finalStats;
    const trainLogText = trainingOutcome.logText;

    setDigimonStats((prev) => {
      const newLog = {
        text: trainLogText,
        type: "TRAIN",
        timestamp: Date.now(),
      };
      const activityCommitState = buildActivityLogCommitState({
        prevStats: prev,
        nextStats: finalStats,
        entry: newLog,
      });
      if (appendLogToSubcollection) appendLogToSubcollection(newLog).catch(() => {});
      setDigimonStatsAndSave(
        activityCommitState.statsWithLogs,
        activityCommitState.updatedLogs
      ).catch((error) => {
        console.error("훈련 결과 저장 오류:", error);
      });
      return activityCommitState.statsWithLogs;
    });
    
    // 주의: 여기서 addActivityLog()를 또 부르지 마세요! 위에서 했으니까요.
    
    // 훈련 결과 반환 (TrainPopup에서 사용)
    return result;
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
    
    // 수면 중 청소 시도 시 수면 방해 처리 (실제 액션 수행 시점)
    // cleanCycle 완료 시점(step > 3)에 처리하므로 여기서는 처리하지 않음
    // cleanCycle 내부에서 처리
    
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
      
      // 통합 업데이트: setDigimonStats 함수형 업데이트로 로그와 스탯을 한 번에 처리
      setDigimonStats((prevStats) => {
        const cleanOutcome = buildCleanOutcome({
          prevStats,
          now: new Date(),
        });
        const newLog = { type: "CLEAN", text: cleanOutcome.logText, timestamp: Date.now() };
        const activityCommitState = buildActivityLogCommitState({
          prevStats,
          nextStats: cleanOutcome.updatedStats,
          entry: newLog,
        });
        if (appendLogToSubcollection) appendLogToSubcollection(newLog).catch(() => {});
        setDigimonStatsAndSave(
          activityCommitState.statsWithLogs,
          activityCommitState.updatedLogs
        ).catch((error) => {
          console.error("청소 상태 저장 오류:", error);
        });
        return activityCommitState.statsWithLogs;
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
    const currentDigimonSnapshot = buildDigimonLogSnapshot(selectedDigimon, digimonData);

    // Sparring 모드는 배틀 횟수에 반영하지 않고 로그만 남김
    if (battleType === 'sparring') {
      const updatedStats = await applyLazyUpdateBeforeAction();
      const { battleStats, weightDelta, energyDelta } = buildBattleCostStats(updatedStats);
      
      const sparringText = `Sparring: Practice Match (No Record) (Wt ${weightDelta}g, En ${energyDelta})`;
      const timestamp = Date.now();
      setDigimonStats((prevStats) => {
        return commitBattleLog({
          prevStats,
          nextStats: battleStats,
          mode: "sparring",
          text: sparringText,
          win: battleResult.win,
          timestamp,
          digimonSnapshot: currentDigimonSnapshot,
          errorMessage: "스파링 로그 저장 오류:",
        });
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

      // 디버깅: myArenaEntryId 확인
      console.log("🔍 [Arena Battle Complete] 디버깅 정보:", {
        myArenaEntryId,
        enemyEntryId,
        battleResult: battleResult.win ? "WIN" : "LOSS",
        currentSlotId: slotId,
        currentUser: currentUser.uid
      });

      if (!myArenaEntryId) {
        console.warn("⚠️ 내 엔트리 ID가 없습니다! 현재 슬롯과 매칭되는 엔트리를 찾을 수 없습니다.");
        alert("⚠️ 경고: 내 엔트리 ID를 찾을 수 없어 내 승패 기록이 업데이트되지 않을 수 있습니다.\n\n현재 슬롯이 아레나에 등록되어 있는지 확인해주세요.");
      }

      try {
        if (!myArenaEntryId) {
          throw new Error("현재 슬롯의 아레나 등록 정보를 찾지 못해 승패를 저장할 수 없습니다.");
        }

        const remoteBattleResult = await completeArenaBattle(currentUser, {
          myEntryId: myArenaEntryId,
          defenderEntryId: enemyEntryId,
          currentSeasonId: Number(currentSeasonId) || 0,
          battleResult: {
            win: Boolean(battleResult.win),
            logs: Array.isArray(battleResult.logs) ? battleResult.logs : [],
          },
        });

        console.log("✅ Arena battle result saved:", remoteBattleResult);
      } catch (error) {
        console.error("❌ DB Update Failed:", error);
        console.error("오류 상세:", {
          message: error.message,
          challengerId: enemyEntryId,
          myArenaEntryId,
        });
        alert(`❌ 배틀 결과 저장 실패:\n${error.message || error.code || "알 수 없는 오류"}`);
      }

      // Arena 모드: 로컬 스탯 업데이트 (배틀 기록 + Activity Log)
      const updatedStats = await applyLazyUpdateBeforeAction();
      const { battleStats, weightDelta, energyDelta } = buildBattleCostStats(updatedStats);
      const tamerName = arenaChallenger.tamerName || arenaChallenger.trainerName || "Unknown";
      const arenaOutcome = buildArenaBattleLocalOutcome({
        battleStats,
        win: battleResult.win,
        opponentName: tamerName,
        weightDelta,
        energyDelta,
      });
      const timestamp = Date.now();
      setDigimonStats((prevStats) => {
        return commitBattleLog({
          prevStats,
          nextStats: arenaOutcome.finalStats,
          mode: "arena",
          text: arenaOutcome.text,
          win: battleResult.win,
          enemyName: arenaOutcome.enemyName,
          timestamp,
          digimonSnapshot: currentDigimonSnapshot,
          errorMessage: "아레나 로그 저장 오류:",
        });
      });
      
      console.log("✅ [Arena] 로컬 배틀 스탯 업데이트 완료:", {
        battles: arenaOutcome.finalStats.battles,
        battlesWon: arenaOutcome.finalStats.battlesWon,
        battlesLost: arenaOutcome.finalStats.battlesLost,
        winRate: arenaOutcome.finalStats.winRate,
        totalBattles: arenaOutcome.finalStats.totalBattles,
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
      const timestamp = Date.now();
      setDigimonStats((prevStats) => {
        return commitBattleLog({
          prevStats,
          nextStats: updatedStats,
          mode: "skip",
          text: "Battle: Skipped (Not enough Energy)",
          timestamp,
          digimonSnapshot: currentDigimonSnapshot,
          errorMessage: "에너지 부족 배틀 로그 저장 오류:",
        });
      });
      alert("⚠️ 에너지가 부족합니다!\n💤 Sleep to restore Energy!");
      setShowBattleScreen(false);
      setBattleType(null);
      return;
    }
    
    // 수면 중 배틀 시도 시 수면 방해 처리 (실제 액션 수행 시점)
    const sleepInteractionPlan = resolveActionSleepInteractionPlan({
      digimonStats: updatedStats,
      activityLogs: updatedStats.activityLogs || [],
      selectedDigimon,
      digimonData,
      isLightsOn,
      wakeUntil,
    });

    let statsAfterWake = updatedStats;
    if (sleepInteractionPlan.shouldWakeForInteraction) {
      statsAfterWake = wakeForInteraction(
        updatedStats,
        setWakeUntil,
        setDigimonStatsAndSave,
        sleepInteractionPlan.actionSleepState.shouldCountSleepDisturbance,
        onSleepDisturbance
      );
      const battleTypeText =
        battleType === "quest"
          ? "퀘스트"
          : battleType === "sparring"
            ? "스파링"
            : battleType === "arena"
              ? "아레나"
              : "배틀";
      commitSleepDisturbanceLog({
        nextStats: statsAfterWake,
        reason: `배틀 - ${battleTypeText}`,
        timestamp: sleepInteractionPlan.timestamp,
      });
    }

    const baseStats = sleepInteractionPlan.actionSleepState.isSleepingLike
      ? statsAfterWake
      : updatedStats;
    const { battleStats, weightDelta, energyDelta } = buildBattleCostStats(baseStats);
    
    const enemyName = battleResult.enemyName || battleResult.enemy?.name || currentQuestArea?.name || 'Unknown Enemy';
    
    if (battleResult.win) {
      const questOutcome = buildQuestBattleOutcome({
        battleStats,
        win: true,
        enemyName,
        weightDelta,
        energyDelta,
        isAreaClear: battleResult.isAreaClear,
        proteinOverdose: battleStats.proteinOverdose || 0,
      });
      const timestamp = Date.now();
      setDigimonStats((prevStats) => {
        return commitBattleLog({
          prevStats,
          nextStats: questOutcome.finalStats,
          mode: "quest",
          text: questOutcome.text,
          win: true,
          enemyName: questOutcome.enemyName,
          injury: questOutcome.isInjured,
          timestamp,
          digimonSnapshot: currentDigimonSnapshot,
          errorMessage: "퀘스트 승리 로그 저장 오류:",
        });
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
      const questOutcome = buildQuestBattleOutcome({
        battleStats,
        win: false,
        enemyName,
        weightDelta,
        energyDelta,
        proteinOverdose: battleStats.proteinOverdose || 0,
      });
      const timestamp = Date.now();
      setDigimonStats((prevStats) => {
        return commitBattleLog({
          prevStats,
          nextStats: questOutcome.finalStats,
          mode: "quest",
          text: questOutcome.text,
          win: false,
          enemyName: questOutcome.enemyName,
          injury: questOutcome.isInjured,
          timestamp,
          digimonSnapshot: currentDigimonSnapshot,
          errorMessage: "퀘스트 패배 로그 저장 오류:",
        });
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
