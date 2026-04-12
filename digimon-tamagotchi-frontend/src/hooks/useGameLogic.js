// src/hooks/useGameLogic.js
// 수면 상태 계산 유틸리티 및 진화 조건 체크 유틸리티

import { isTimeWithinSleepSchedule, normalizeSleepSchedule } from "../utils/sleepUtils";
import {
  appendCareMistakeEntry,
} from "../logic/stats/careMistakeLedger";
import { MAX_ACTIVITY_LOGS } from "../constants/activityLogs";
import { buildActivityLogEventId } from "../utils/activityLogEventId";
import { toEpochMs } from "../utils/time";

const FALLING_ASLEEP_DELAY_MS = 15 * 1000;
const HUNGER_CALL_TIMEOUT_MS = 10 * 60 * 1000;
const STRENGTH_CALL_TIMEOUT_MS = 10 * 60 * 1000;
const SLEEP_LIGHT_WARNING_TIMEOUT_MS = 30 * 60 * 1000;
const SLEEP_STATUS = {
  AWAKE: "AWAKE",
  FALLING_ASLEEP: "FALLING_ASLEEP",
  NAPPING: "NAPPING",
  SLEEPING: "SLEEPING",
  SLEEPING_LIGHT_ON: "SLEEPING_LIGHT_ON",
  AWAKE_INTERRUPTED: "AWAKE_INTERRUPTED",
};

/**
 * Firestore Timestamp를 안전하게 변환하는 유틸 함수
 * @param {any} val - 변환할 값 (number, Date, Firestore Timestamp, string 등)
 * @returns {number|null} - timestamp (milliseconds) 또는 null
 */
function ensureTimestamp(val) {
  return toEpochMs(val);
}

/**
 * 수면 방해 로그 여부를 판별한다.
 * 신규 타입(SLEEP_DISTURBANCE)과 기존 CARE_MISTAKE 기반 로그를 모두 인식한다.
 * @param {Object} log
 * @returns {boolean}
 */
export function isSleepDisturbanceLog(log) {
  if (!log) return false;
  if (log.type === 'SLEEP_DISTURBANCE') return true;
  const text = (log.text || '').trim();
  if (!text.includes('수면 방해')) return false;
  return log.type === 'CARE_MISTAKE' || log.type === 'CAREMISTAKE';
}

/**
 * 수면 방해 로그 객체를 생성한다.
 * @param {string} reason
 * @param {number} [timestampMs]
 * @returns {{type: string, text: string, timestamp: number}}
 */
export function createSleepDisturbanceLog(reason, timestampMs = Date.now()) {
  return {
    type: 'SLEEP_DISTURBANCE',
    text: `수면 방해(사유: ${reason}): 10분 동안 깨어있음`,
    timestamp: timestampMs,
  };
}

export function isSleepStatusSleeping(status) {
  return (
    status === SLEEP_STATUS.NAPPING ||
    status === SLEEP_STATUS.SLEEPING ||
    status === SLEEP_STATUS.SLEEPING_LIGHT_ON
  );
}

export function isSleepStatusDisturbanceSensitive(status) {
  return status === SLEEP_STATUS.SLEEPING || status === SLEEP_STATUS.SLEEPING_LIGHT_ON;
}

export function isSleepStatusInterrupted(status) {
  return status === SLEEP_STATUS.AWAKE_INTERRUPTED;
}

function normalizeSleepStatusValue(status) {
  if (status === "TIRED" || status === "SLEEPY") {
    return SLEEP_STATUS.SLEEPING_LIGHT_ON;
  }

  return status || SLEEP_STATUS.AWAKE;
}

function createEmptyNeedCallEntry() {
  return { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false };
}

export function buildInitialCallStatus(callStatus = {}) {
  return {
    hunger: {
      ...createEmptyNeedCallEntry(),
      ...(callStatus.hunger || {}),
    },
    strength: {
      ...createEmptyNeedCallEntry(),
      ...(callStatus.strength || {}),
    },
    sleep: {
      isActive: false,
      startedAt: null,
      isLogged: false,
      ...(callStatus.sleep || {}),
    },
  };
}

export function resolveNeedCallState({
  currentValue,
  entry,
  fallbackStartedAt,
  deadline,
  nowMs,
  isSleepingLike,
  timeoutMs,
}) {
  const nextEntry = {
    ...createEmptyNeedCallEntry(),
    ...(entry || {}),
  };
  let nextDeadline = ensureTimestamp(deadline);
  const referenceStartedAt =
    ensureTimestamp(nextEntry.startedAt) ?? ensureTimestamp(fallbackStartedAt);

  if (currentValue !== 0) {
    return {
      entry: {
        ...nextEntry,
        isActive: false,
        startedAt: null,
        sleepStartAt: null,
        isLogged: false,
      },
      deadline: null,
      shouldClearResolvedMeta: true,
    };
  }

  if (nextEntry.isLogged === true) {
    return {
      entry: {
        ...nextEntry,
        isActive: false,
        startedAt: null,
        sleepStartAt: null,
      },
      deadline: null,
      shouldClearResolvedMeta: false,
    };
  }

  if (referenceStartedAt == null) {
    return {
      entry: {
        ...nextEntry,
        isActive: false,
        startedAt: null,
        sleepStartAt: null,
      },
      deadline: null,
      shouldClearResolvedMeta: false,
    };
  }

  nextEntry.isActive = true;
  nextEntry.isLogged = false;
  nextEntry.startedAt = referenceStartedAt;

  if (isSleepingLike) {
    if (nextEntry.sleepStartAt == null) {
      nextEntry.sleepStartAt = nowMs;
    }
    return {
      entry: nextEntry,
      deadline: nextDeadline ?? referenceStartedAt + timeoutMs,
      shouldClearResolvedMeta: false,
    };
  }

  const sleepStartAt = ensureTimestamp(nextEntry.sleepStartAt);
  if (sleepStartAt != null) {
    const sleptMs = Math.max(0, nowMs - sleepStartAt);
    if (sleptMs > 0) {
      nextEntry.startedAt = referenceStartedAt + sleptMs;
      nextDeadline =
        nextDeadline != null ? nextDeadline + sleptMs : nextEntry.startedAt + timeoutMs;
    } else if (nextDeadline == null) {
      nextDeadline = referenceStartedAt + timeoutMs;
    }
    nextEntry.sleepStartAt = null;
  } else if (nextDeadline == null) {
    nextDeadline = referenceStartedAt + timeoutMs;
  }

  return {
    entry: nextEntry,
    deadline: nextDeadline,
    shouldClearResolvedMeta: false,
  };
}

export function resolveNeedCallTimeout({
  stats,
  callType,
  nowMs,
  timeoutMs,
  isSleepingLike,
  deadlineKey,
  reasonKey,
  reasonText,
}) {
  const entry = stats.callStatus?.[callType];
  const startedAt = ensureTimestamp(entry?.startedAt);

  if (isSleepingLike || startedAt == null) {
    return { nextStats: stats, hasChanged: false, triggeredMistake: false };
  }

  const elapsed = nowMs - startedAt;
  if (elapsed <= timeoutMs) {
    return { nextStats: stats, hasChanged: false, triggeredMistake: false };
  }

  if (entry?.isLogged === true) {
    return {
      nextStats: {
        ...stats,
        callStatus: {
          ...stats.callStatus,
          [callType]: {
            ...stats.callStatus[callType],
            isActive: false,
            startedAt: null,
            sleepStartAt: null,
          },
        },
        [deadlineKey]: null,
      },
      hasChanged: true,
      triggeredMistake: false,
    };
  }

  const timeoutOccurredAt = startedAt + timeoutMs;
  const { nextStats: mistakeStats } = appendCareMistakeEntry(stats, {
    occurredAt: timeoutOccurredAt,
    reasonKey,
    text: reasonText(stats.careMistakes || 0),
    source: "realtime",
  });

  return {
    nextStats: {
      ...mistakeStats,
      callStatus: {
        ...mistakeStats.callStatus,
        [callType]: {
          ...mistakeStats.callStatus[callType],
          isActive: false,
          startedAt: null,
          sleepStartAt: null,
          isLogged: true,
        },
      },
      [deadlineKey]: null,
    },
    hasChanged: true,
    triggeredMistake: true,
  };
}

/**
 * 수면 상태를 계산한다.
 * @param {Object} params
 * @param {{start:number,end:number}} params.sleepSchedule - 수면 스케줄 (시 단위)
 * @param {boolean} params.isLightsOn - 조명 상태
 * @param {number|Date|string|null} params.wakeUntil - 강제 기상 유지 만료 시간
 * @param {number|null} params.fastSleepStart - 빠른 잠들기 시작 시간 (timestamp)
 * @param {number|null} params.napUntil - 낮잠 종료 시간 (timestamp)
 * @param {Date} [params.now] - 현재 시간 (테스트용)
 * @returns {'AWAKE'|'FALLING_ASLEEP'|'NAPPING'|'SLEEPING'|'SLEEPING_LIGHT_ON'|'AWAKE_INTERRUPTED'}
 */
export function getSleepStatus({ sleepSchedule, isLightsOn, wakeUntil, fastSleepStart = null, napUntil = null, now = new Date() }) {
  const normalizedSleepSchedule = normalizeSleepSchedule(sleepSchedule || { start: 22, end: 6 });
  const nowMs = now.getTime();

  const wakeUntilMs = ensureTimestamp(wakeUntil);
  const wakeOverride = wakeUntilMs != null && wakeUntilMs > nowMs;
  const isSleepTime = isTimeWithinSleepSchedule(normalizedSleepSchedule, now);
  const napUntilMs = ensureTimestamp(napUntil);
  const isNapTime = napUntilMs != null && napUntilMs > nowMs;
  const fastSleepStartMs = ensureTimestamp(fastSleepStart);
  const isFallingAsleep =
    fastSleepStartMs != null && nowMs - fastSleepStartMs < FALLING_ASLEEP_DELAY_MS;

  if (wakeOverride) {
    return SLEEP_STATUS.AWAKE_INTERRUPTED;
  }

  if (isSleepTime) {
    if (isLightsOn) {
      return SLEEP_STATUS.SLEEPING_LIGHT_ON;
    }

    if (isFallingAsleep) {
      return SLEEP_STATUS.FALLING_ASLEEP;
    }

    return SLEEP_STATUS.SLEEPING;
  }

  if (isNapTime) {
    if (isLightsOn) {
      return SLEEP_STATUS.AWAKE;
    }

    if (isFallingAsleep) {
      return SLEEP_STATUS.FALLING_ASLEEP;
    }

    return SLEEP_STATUS.NAPPING;
  }

  if (!isLightsOn && isFallingAsleep) {
    return SLEEP_STATUS.FALLING_ASLEEP;
  }

  return SLEEP_STATUS.AWAKE;
}

/**
 * 진화 조건을 체크하고 부족한 조건을 반환한다.
 * @param {Object} currentStats - 현재 디지몬 스탯
 * @param {Object} requirements - 진화 조건 객체
 * @param {number} [requirements.minLevel] - 최소 레벨
 * @param {number} [requirements.minPower] - 최소 파워
 * @param {number} [requirements.minWins] - 최소 승리 수 (아레나)
 * @param {number} [requirements.maxMistakes] - 최대 케어 미스 허용치
 * @param {number} [requirements.minTrainings] - 최소 훈련 횟수
 * @param {number} [requirements.maxTrainings] - 최대 훈련 횟수
 * @param {number} [requirements.minOverfeeds] - 최소 오버피드
 * @param {number} [requirements.maxOverfeeds] - 최대 오버피드
 * @param {number} [requirements.minSleepDisturbances] - 최소 수면 방해
 * @param {number} [requirements.maxSleepDisturbances] - 최대 수면 방해
 * @param {number} [requirements.timeToEvolveSeconds] - 진화까지 남은 시간 (초)
 * @returns {{isAvailable: boolean, missingConditions: Array<string>}}
 */
export function checkEvolutionAvailability(currentStats, requirements) {
  const missingConditions = [];
  let isAvailable = true;

  // 시간 체크
  if (requirements.timeToEvolveSeconds !== undefined) {
    if (currentStats.timeToEvolveSeconds > 0) {
      const remainingSeconds = currentStats.timeToEvolveSeconds;
      const d = Math.floor(remainingSeconds / 86400);
      const r = remainingSeconds % 86400;
      const h = Math.floor(r / 3600);
      const m = Math.floor((r % 3600) / 60);
      const s = r % 60;
      missingConditions.push(`시간: ${d} day, ${h} hour, ${m} min, ${s} sec 남음`);
      isAvailable = false;
    }
  }

  // 레벨 체크 (age 또는 다른 지표로 대체 가능)
  if (requirements.minLevel !== undefined) {
    const level = currentStats.age || 0;
    if (level < requirements.minLevel) {
      missingConditions.push(`레벨: ${level} (현재) >= ${requirements.minLevel} (진화기준) (부족 ❌)`);
      isAvailable = false;
    } else {
      missingConditions.push(`레벨: ${level} (현재) >= ${requirements.minLevel} (진화기준) (달성 ✅)`);
    }
  }

  // 파워 체크
  if (requirements.minPower !== undefined) {
    const power = currentStats.power || currentStats.basePower || 0;
    if (power < requirements.minPower) {
      missingConditions.push(`파워: ${power} (현재) >= ${requirements.minPower} (진화기준) (부족 ❌)`);
      isAvailable = false;
    } else {
      missingConditions.push(`파워: ${power} (현재) >= ${requirements.minPower} (진화기준) (달성 ✅)`);
    }
  }

  // 승리 수 체크 (아레나)
  if (requirements.minWins !== undefined) {
    const wins = currentStats.battlesWon || 0;
    if (wins < requirements.minWins) {
      missingConditions.push(`승리: ${wins} (현재) >= ${requirements.minWins} (진화기준) (부족 ❌)`);
      isAvailable = false;
    } else {
      missingConditions.push(`승리: ${wins} (현재) >= ${requirements.minWins} (진화기준) (달성 ✅)`);
    }
  }

  // 케어 미스 체크 (min과 max를 한 줄로 통합)
  if (requirements.minMistakes !== undefined || requirements.maxMistakes !== undefined) {
    const mistakes = currentStats.careMistakes || 0;
    const min = requirements.minMistakes;
    const max = requirements.maxMistakes;
    let isMet = true;
    let rangeText = '';
    
    if (min !== undefined && max !== undefined) {
      rangeText = `${min}~${max}`;
      if (mistakes < min || mistakes > max) {
        isMet = false;
        isAvailable = false;
      }
    } else if (min !== undefined) {
      rangeText = `${min}+`;
      if (mistakes < min) {
        isMet = false;
        isAvailable = false;
      }
    } else if (max !== undefined) {
      rangeText = `~${max}`;
      if (mistakes > max) {
        isMet = false;
        isAvailable = false;
      }
    }
    
    missingConditions.push(
      `케어 미스: ${mistakes} (현재) / ${rangeText} (진화기준) ${isMet ? '(달성 ✅)' : '(부족 ❌)'}`
    );
  }

  // 훈련 횟수 체크 (min과 max를 한 줄로 통합)
  if (requirements.minTrainings !== undefined || requirements.maxTrainings !== undefined) {
    const trainings = currentStats.trainings || 0;
    const min = requirements.minTrainings;
    const max = requirements.maxTrainings;
    let isMet = true;
    let rangeText = '';
    
    if (min !== undefined && max !== undefined) {
      rangeText = `${min}~${max}`;
      if (trainings < min || trainings > max) {
        isMet = false;
        isAvailable = false;
      }
    } else if (min !== undefined) {
      rangeText = `${min}+`;
      if (trainings < min) {
        isMet = false;
        isAvailable = false;
      }
    } else if (max !== undefined) {
      rangeText = `~${max}`;
      if (trainings > max) {
        isMet = false;
        isAvailable = false;
      }
    }
    
    missingConditions.push(
      `훈련: ${trainings} (현재) / ${rangeText} (진화기준) ${isMet ? '(달성 ✅)' : '(부족 ❌)'}`
    );
  }

  // 오버피드 체크 (min과 max를 한 줄로 통합)
  if (requirements.minOverfeeds !== undefined || requirements.maxOverfeeds !== undefined) {
    const overfeeds = currentStats.overfeeds || 0;
    const min = requirements.minOverfeeds;
    const max = requirements.maxOverfeeds;
    let isMet = true;
    let rangeText = '';
    
    if (min !== undefined && max !== undefined) {
      rangeText = `${min}~${max}`;
      if (overfeeds < min || overfeeds > max) {
        isMet = false;
        isAvailable = false;
      }
    } else if (min !== undefined) {
      rangeText = `${min}+`;
      if (overfeeds < min) {
        isMet = false;
        isAvailable = false;
      }
    } else if (max !== undefined) {
      rangeText = `~${max}`;
      if (overfeeds > max) {
        isMet = false;
        isAvailable = false;
      }
    }
    
    missingConditions.push(
      `오버피드: ${overfeeds} (현재) / ${rangeText} (진화기준) ${isMet ? '(달성 ✅)' : '(부족 ❌)'}`
    );
  }

  // 수면 방해 체크 (min과 max를 한 줄로 통합)
  if (requirements.minSleepDisturbances !== undefined || requirements.maxSleepDisturbances !== undefined) {
    const disturbances = currentStats.sleepDisturbances || 0;
    const min = requirements.minSleepDisturbances;
    const max = requirements.maxSleepDisturbances;
    let isMet = true;
    let rangeText = '';
    
    if (min !== undefined && max !== undefined) {
      rangeText = `${min}~${max}`;
      if (disturbances < min || disturbances > max) {
        isMet = false;
        isAvailable = false;
      }
    } else if (min !== undefined) {
      rangeText = `${min}+`;
      if (disturbances < min) {
        isMet = false;
        isAvailable = false;
      }
    } else if (max !== undefined) {
      rangeText = `~${max}`;
      if (disturbances > max) {
        isMet = false;
        isAvailable = false;
      }
    }
    
    missingConditions.push(
      `수면 방해: ${disturbances} (현재) / ${rangeText} (진화기준) ${isMet ? '(달성 ✅)' : '(부족 ❌)'}`
    );
  }

  // 배틀 체크 (현재 디지몬 값만 사용)
  if (requirements.minBattles !== undefined || requirements.maxBattles !== undefined) {
    const currentBattles = (currentStats.battlesWon || 0) + (currentStats.battlesLost || 0);
    const min = requirements.minBattles;
    const max = requirements.maxBattles;
    let isMet = true;
    let rangeText = '';
    
    if (min !== undefined && max !== undefined) {
      rangeText = `${min}~${max}`;
      if (currentBattles < min || currentBattles > max) {
        isMet = false;
        isAvailable = false;
      }
    } else if (min !== undefined) {
      rangeText = `${min}+`;
      if (currentBattles < min) {
        isMet = false;
        isAvailable = false;
      }
    } else if (max !== undefined) {
      rangeText = `~${max}`;
      if (currentBattles > max) {
        isMet = false;
        isAvailable = false;
      }
    }
    
    missingConditions.push(
      `배틀: ${currentBattles} (현재 디지몬) / ${rangeText} (진화기준) ${isMet ? '(달성 ✅)' : '(부족 ❌)'}`
    );
  }

  // 승률 체크 (현재 디지몬 값만 사용)
  if (requirements.minWinRatio !== undefined || requirements.maxWinRatio !== undefined) {
    const currentBattles = (currentStats.battlesWon || 0) + (currentStats.battlesLost || 0);
    if (currentBattles === 0) {
      missingConditions.push(`승률: 배틀을 하지 않았습니다 (부족 ❌)`);
      isAvailable = false;
    } else {
      const winRatio = ((currentStats.battlesWon || 0) / currentBattles) * 100;
      const min = requirements.minWinRatio;
      const max = requirements.maxWinRatio;
      let isMet = true;
      let rangeText = '';
      
      if (min !== undefined && max !== undefined) {
        rangeText = `${min}~${max}%`;
        if (winRatio < min || winRatio > max) {
          isMet = false;
          isAvailable = false;
        }
      } else if (min !== undefined) {
        rangeText = `${min}+%`;
        if (winRatio < min) {
          isMet = false;
          isAvailable = false;
        }
      } else if (max !== undefined) {
        rangeText = `~${max}%`;
        if (winRatio > max) {
          isMet = false;
          isAvailable = false;
        }
      }
      
      missingConditions.push(
        `승률: ${winRatio.toFixed(1)}% (현재 디지몬) / ${rangeText} (진화기준) ${isMet ? '(달성 ✅)' : '(부족 ❌)'}`
      );
    }
  }

  return {
    isAvailable,
    missingConditions,
  };
}

/**
 * Activity Logs 관련 유틸리티 함수
 */

/**
 * Activity Logs 배열을 초기화합니다.
 * @param {Array} existingLogs - 기존 로그 배열 (없으면 빈 배열)
 * @returns {Array} 초기화된 로그 배열
 */
export function initializeActivityLogs(existingLogs = []) {
  return Array.isArray(existingLogs) ? existingLogs : [];
}

/**
 * Activity Log를 추가합니다.
 * @param {Array} currentLogs - 현재 로그 배열
 * @param {string} type - 로그 타입 ('FEED', 'TRAIN', 'BATTLE', 'CLEAN', 'CAREMISTAKE', etc.)
 * @param {string} text - 로그 텍스트
 * @param {number} [timestampMs] - 로그 시각(ms). 생략 시 Date.now() 사용. applyLazyUpdate와 동일 시각을 쓰면 중복 로그 방지됨.
 * @returns {Array} 업데이트된 로그 배열
 */
/** eventId가 계산되는 로그는 같은 사건이면 다시 추가하지 않는다. */
function hasDuplicateActivityLogEvent(logs, nextLog) {
  if (!logs.length) return false;

  const nextEventId = buildActivityLogEventId(nextLog);
  if (!nextEventId) return false;

  return logs.some((log) => buildActivityLogEventId(log) === nextEventId);
}

/** 수면 방해 로그 중복 여부: 같은 강제 기상 사건(기본 10분) 안에 이미 기록된 수면 방해 로그가 있으면 true */
export function hasDuplicateSleepDisturbanceLog(activityLogs, timestampMs, windowMs = 10 * 60 * 1000) {
  const logs = Array.isArray(activityLogs) ? activityLogs : [];
  if (!logs.length) return false;
  const t = timestampMs !== undefined ? timestampMs : Date.now();
  const minT = t - windowMs;
  const maxT = t + windowMs;
  return logs.some((log) => {
    if (!isSleepDisturbanceLog(log)) return false;
    const logT = typeof log.timestamp === 'number' ? log.timestamp : (log.timestamp?.seconds != null ? log.timestamp.seconds * 1000 : null);
    if (logT == null) return false;
    return logT >= minT && logT <= maxT;
  });
}

export function addActivityLog(currentLogs = [], type, text, timestampMs) {
  const logs = initializeActivityLogs(currentLogs);
  const isOptionsObject =
    timestampMs != null &&
    typeof timestampMs === "object" &&
    !Array.isArray(timestampMs);
  const extraFields = isOptionsObject ? { ...timestampMs } : {};
  const ts =
    typeof timestampMs === "number"
      ? timestampMs
      : (isOptionsObject && typeof timestampMs.timestamp === "number"
          ? timestampMs.timestamp
          : Date.now());
  delete extraFields.timestamp;
  const baseLog = { type, text, timestamp: ts, ...extraFields };
  const eventId = buildActivityLogEventId(baseLog);

  if (hasDuplicateActivityLogEvent(logs, baseLog)) {
    return logs;
  }
  const newLog = eventId ? { ...baseLog, eventId } : baseLog;

  const updatedLogs = [...logs, newLog];
  if (updatedLogs.length > MAX_ACTIVITY_LOGS) {
    return updatedLogs.slice(-MAX_ACTIVITY_LOGS);
  }
  return updatedLogs;
}

export default getSleepStatus;

/**
 * 호출(Call) 상태를 체크하고 필요시 활성화한다.
 * @param {Object} stats - 현재 디지몬 스탯
 * @param {boolean} isLightsOn - 조명 상태
 * @param {Object} sleepSchedule - 수면 스케줄
 * @param {Date} now - 현재 시간
 * @param {'AWAKE'|'FALLING_ASLEEP'|'NAPPING'|'SLEEPING'|'SLEEPING_LIGHT_ON'|'AWAKE_INTERRUPTED'} sleepStatus
 * @returns {Object} 업데이트된 스탯
 */
export function checkCalls(
  stats,
  isLightsOn,
  sleepSchedule,
  now = new Date(),
  sleepStatus = SLEEP_STATUS.AWAKE
) {
  void isLightsOn;
  void sleepSchedule;
  let updatedStats = {
    ...stats,
    callStatus: buildInitialCallStatus(stats.callStatus),
  };
  const normalizedSleepStatus = normalizeSleepStatusValue(sleepStatus);
  const isSleepingLike = isSleepStatusSleeping(normalizedSleepStatus);
  const isSleepLightWarning = normalizedSleepStatus === SLEEP_STATUS.SLEEPING_LIGHT_ON;

  // 냉장고 상태에서는 호출을 무시
  if (updatedStats.isFrozen) {
    updatedStats.callStatus = {
      hunger: { ...updatedStats.callStatus.hunger, isActive: false },
      strength: { ...updatedStats.callStatus.strength, isActive: false },
      sleep: {
        ...updatedStats.callStatus.sleep,
        isActive: false,
        startedAt: null,
        isLogged: false,
      },
    };
    return updatedStats;
  }

  let callStatus = updatedStats.callStatus;

  const nowMs = now.getTime();
  const hungerCallState = resolveNeedCallState({
    currentValue: updatedStats.fullness,
    entry: callStatus.hunger,
    fallbackStartedAt: updatedStats.lastHungerZeroAt,
    deadline: updatedStats.hungerMistakeDeadline,
    nowMs,
    isSleepingLike,
    timeoutMs: HUNGER_CALL_TIMEOUT_MS,
  });
  callStatus.hunger = hungerCallState.entry;
  updatedStats.hungerMistakeDeadline = hungerCallState.deadline;
  if (hungerCallState.shouldClearResolvedMeta) {
    updatedStats.lastHungerZeroAt = null;
    updatedStats.hungerZeroFrozenDurationMs = 0;
  }

  const strengthCallState = resolveNeedCallState({
    currentValue: updatedStats.strength,
    entry: callStatus.strength,
    fallbackStartedAt: updatedStats.lastStrengthZeroAt,
    deadline: updatedStats.strengthMistakeDeadline,
    nowMs,
    isSleepingLike,
    timeoutMs: STRENGTH_CALL_TIMEOUT_MS,
  });
  callStatus.strength = strengthCallState.entry;
  updatedStats.strengthMistakeDeadline = strengthCallState.deadline;
  if (strengthCallState.shouldClearResolvedMeta) {
    updatedStats.lastStrengthZeroAt = null;
    updatedStats.strengthZeroFrozenDurationMs = 0;
  }

  if (isSleepLightWarning) {
    callStatus.sleep.isActive = true;
    callStatus.sleep.startedAt =
      ensureTimestamp(callStatus.sleep.startedAt) ??
      ensureTimestamp(updatedStats.sleepLightOnStart);
    if (callStatus.sleep.isLogged === undefined) {
      callStatus.sleep.isLogged = false;
    }
  } else {
    callStatus.sleep.isActive = false;
    callStatus.sleep.startedAt = null;
    callStatus.sleep.isLogged = false;
  }

  return updatedStats;
}

/**
 * 호출 상태를 리셋한다.
 * @param {Object} stats - 현재 디지몬 스탯
 * @param {string} callType - 'hunger' | 'strength' | 'sleep'
 * @returns {Object} 업데이트된 스탯
 */
export function resetCallStatus(stats, callType) {
  const updatedStats = { ...stats };
  
  if (!updatedStats.callStatus) {
    updatedStats.callStatus = {
      hunger: { isActive: false, startedAt: null, isLogged: false },
      strength: { isActive: false, startedAt: null, isLogged: false },
      sleep: { isActive: false, startedAt: null }
    };
  }

  if (updatedStats.callStatus[callType]) {
    updatedStats.callStatus[callType].isActive = false;
    updatedStats.callStatus[callType].startedAt = null;
    if (
      callType === 'hunger' ||
      callType === 'strength' ||
      callType === 'sleep'
    ) {
      updatedStats.callStatus[callType].isLogged = false;
    }
    if (callType === 'hunger') {
      updatedStats.lastHungerZeroAt = null;
      updatedStats.hungerZeroFrozenDurationMs = 0;
    } else if (callType === 'strength') {
      updatedStats.lastStrengthZeroAt = null;
      updatedStats.strengthZeroFrozenDurationMs = 0;
    }
  }

  return updatedStats;
}

/**
 * 호출 타임아웃을 체크한다.
 * 배고픔/힘 호출은 careMistakes를 증가시키고, 수면 조명 경고는 같은 사건마다 30분 경과 시 1회만 케어미스를 증가시킨다.
 * @param {Object} stats - 현재 디지몬 스탯
 * @param {Date} now - 현재 시간
 * @param {'AWAKE'|'FALLING_ASLEEP'|'NAPPING'|'SLEEPING'|'SLEEPING_LIGHT_ON'|'AWAKE_INTERRUPTED'} sleepStatus
 * @returns {Object} 업데이트된 스탯
 */
export function checkCallTimeouts(
  stats,
  now = new Date(),
  sleepStatus = SLEEP_STATUS.AWAKE
) {
  if (!stats || !stats.callStatus) {
    return stats;
  }

  // 냉장고 상태에서는 호출 타임아웃을 무시 (케어 실수 발생하지 않음)
  if (stats.isFrozen) {
    return stats;
  }

  // 깊은 복사를 통해 새로운 객체 생성 (리액트 불변성 보장)
  let updatedStats = {
    ...stats,
    callStatus: {
      ...stats.callStatus,
      hunger: { ...stats.callStatus.hunger },
      strength: { ...stats.callStatus.strength },
      sleep: { ...stats.callStatus.sleep }
    }
  };

  let callStatus = updatedStats.callStatus;
  const nowMs = now.getTime();
  let hasChanged = false; // 변경 여부 추적
  const normalizedSleepStatus = normalizeSleepStatusValue(sleepStatus);
  const isSleepingLike = isSleepStatusSleeping(normalizedSleepStatus);
  const isSleepLightWarning = normalizedSleepStatus === SLEEP_STATUS.SLEEPING_LIGHT_ON;

  // --- 기존 타임아웃 체크 로직 (깨어있을 때만 작동) ---
  const hungerTimeoutResult = resolveNeedCallTimeout({
    stats: updatedStats,
    callType: "hunger",
    nowMs,
    timeoutMs: HUNGER_CALL_TIMEOUT_MS,
    isSleepingLike,
    deadlineKey: "hungerMistakeDeadline",
    reasonKey: "hunger_call",
    reasonText: (careMistakes) =>
      `케어미스(사유: 배고픔 콜 10분 무시): ${careMistakes} → ${careMistakes + 1}`,
  });
  updatedStats = hungerTimeoutResult.nextStats;
  hasChanged = hasChanged || hungerTimeoutResult.hasChanged;
  if (hungerTimeoutResult.triggeredMistake) {
    console.log("🔥 실시간 Hunger 케어미스 발생! careMistakes:", updatedStats.careMistakes);
  }

  const strengthTimeoutResult = resolveNeedCallTimeout({
    stats: updatedStats,
    callType: "strength",
    nowMs,
    timeoutMs: STRENGTH_CALL_TIMEOUT_MS,
    isSleepingLike,
    deadlineKey: "strengthMistakeDeadline",
    reasonKey: "strength_call",
    reasonText: (careMistakes) =>
      `케어미스(사유: 힘 콜 10분 무시): ${careMistakes} → ${careMistakes + 1}`,
  });
  updatedStats = strengthTimeoutResult.nextStats;
  hasChanged = hasChanged || strengthTimeoutResult.hasChanged;
  if (strengthTimeoutResult.triggeredMistake) {
    console.log("🔥 실시간 Strength 케어미스 발생! careMistakes:", updatedStats.careMistakes);
  }
  callStatus = updatedStats.callStatus;

  // 수면 조명 경고는 실제 수면 중에만 동작하며, 30분 경과 시 케어미스를 1회 올린다.
  const sleepStartedAt = ensureTimestamp(callStatus.sleep.startedAt);
  if (sleepStartedAt && isSleepLightWarning) {
    const elapsed = nowMs - sleepStartedAt;
    const alreadyLogged = callStatus.sleep.isLogged === true;
    if (elapsed > SLEEP_LIGHT_WARNING_TIMEOUT_MS && !alreadyLogged) {
      const timeoutOccurredAt = sleepStartedAt + SLEEP_LIGHT_WARNING_TIMEOUT_MS;
      const { nextStats } = appendCareMistakeEntry(updatedStats, {
        occurredAt: timeoutOccurredAt,
        reasonKey: "sleep_light_warning",
        text: `케어미스(사유: 수면 조명 경고 30분 방치): ${(updatedStats.careMistakes || 0)} → ${(updatedStats.careMistakes || 0) + 1}`,
        source: "realtime",
      });
      updatedStats.careMistakes = nextStats.careMistakes;
      updatedStats.careMistakeLedger = nextStats.careMistakeLedger;
      callStatus.sleep.isLogged = true;
      hasChanged = true;
      console.log("💡 실시간 수면 조명 케어미스 발생! careMistakes:", updatedStats.careMistakes);
    }
  }

  // 변경되었을 때만 새 객체 반환, 아니면 기존 객체 그대로 반환 (리액트 최적화)
  return hasChanged ? updatedStats : stats;
}
