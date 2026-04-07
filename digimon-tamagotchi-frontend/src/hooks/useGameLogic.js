// src/hooks/useGameLogic.js
// 수면 상태 계산 유틸리티 및 진화 조건 체크 유틸리티

import { isTimeWithinSleepSchedule, normalizeSleepSchedule } from "../utils/sleepUtils";
import {
  appendCareMistakeEntry,
  getCareMistakeEventIdFromLog,
  getCareMistakeReasonKeyFromText,
} from "../logic/stats/careMistakeLedger";
import { MAX_ACTIVITY_LOGS } from "../constants/activityLogs";

/**
 * Firestore Timestamp를 안전하게 변환하는 유틸 함수
 * @param {any} val - 변환할 값 (number, Date, Firestore Timestamp, string 등)
 * @returns {number|null} - timestamp (milliseconds) 또는 null
 */
function ensureTimestamp(val) {
  if (!val) return null;
  if (typeof val === 'number') return val;
  // Firestore Timestamp 객체 처리
  if (val && typeof val === 'object' && 'seconds' in val) {
    return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
  }
  // Date 객체나 문자열 처리
  const date = new Date(val);
  return isNaN(date.getTime()) ? null : date.getTime();
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

/**
 * 수면 상태를 계산한다.
 * @param {Object} params
 * @param {{start:number,end:number}} params.sleepSchedule - 수면 스케줄 (시 단위)
 * @param {boolean} params.isLightsOn - 조명 상태
 * @param {number|Date|string|null} params.wakeUntil - 강제 기상 유지 만료 시간
 * @param {number|null} params.fastSleepStart - 빠른 잠들기 시작 시간 (timestamp)
 * @param {number|null} params.napUntil - 낮잠 종료 시간 (timestamp)
 * @param {Date} [params.now] - 현재 시간 (테스트용)
 * @returns {'AWAKE'|'TIRED'|'SLEEPING'}
 */
export function getSleepStatus({ sleepSchedule, isLightsOn, wakeUntil, fastSleepStart = null, napUntil = null, now = new Date() }) {
  const normalizedSleepSchedule = normalizeSleepSchedule(sleepSchedule || { start: 22, end: 6 });
  const nowMs = now.getTime();

  const wakeOverride = wakeUntil ? new Date(wakeUntil).getTime() > nowMs : false;
  const isSleepTime = isTimeWithinSleepSchedule(normalizedSleepSchedule, now);

  const isNapTime = napUntil ? napUntil > nowMs : false; // 낮잠 시간 체크

  // 불이 켜져 있으면 무조건 깨어있거나 피곤한 상태
  if (isLightsOn) {
    // 수면 방해 중이면 AWAKE (불이 켜져 있어도 수면 방해 중에는 깨어있음)
    if (wakeOverride) return "AWAKE";
    // 수면 시간이면 TIRED
    return isSleepTime ? "TIRED" : "AWAKE";
  }

  // 불이 꺼져 있는 경우
  if (!isLightsOn) {
    // A. 수면 시간 혹은 낮잠 시간인 경우
    if (isSleepTime || isNapTime) {
      // fastSleepStart가 완료되었으면 wakeUntil보다 우선순위가 높음 (즉시 잠듦)
      if (fastSleepStart) {
        const elapsed = nowMs - fastSleepStart;
        if (elapsed >= 15 * 1000) {
          return "SLEEPING"; // 15초 경과 시 wakeUntil과 관계없이 잠듦
        }
        // 15초 전까지는 wakeUntil이 있으면 깨어있음
        if (wakeOverride) return "AWAKE";
        return "AWAKE"; // 15초 전까지는 깨어있음
      }
      
      // fastSleepStart가 없으면 기존 로직대로
      if (wakeOverride) return "AWAKE"; // 방해 중이면 깨어있음
      
      return "SLEEPING";
    }

    // B. 수면 시간이 아니지만 불을 끈 경우 (낮잠 진입 시도)
    if (fastSleepStart) {
      const elapsed = nowMs - fastSleepStart;
      if (elapsed >= 15 * 1000) {
        // 15초 경과 → 낮잠 시작 (napUntil이 설정되어 있어야 함)
        // napUntil이 있으면 SLEEPING, 없으면 AWAKE
        return napUntil && napUntil > nowMs ? "SLEEPING" : "AWAKE";
      }
      return "AWAKE"; // 15초 전까지는 깨어있음
    }
  }

  return "AWAKE";
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
/** 케어미스 로그 중복 여부: 같은 사유 + 같은 발생 시각의 동일 이벤트면 true */
function hasDuplicateCareMistakeLog(logs, type, text, timestampMs) {
  if (type !== 'CAREMISTAKE' || !logs.length) return false;
  const ts = timestampMs !== undefined ? timestampMs : Date.now();
  const nextEventId = `${getCareMistakeReasonKeyFromText(text || '')}:${ts}`;
  return logs.some((log) => {
    if (log.type !== type) return false;
    return getCareMistakeEventIdFromLog(log) === nextEventId;
  });
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
  // 케어미스 이력 멱등성: 동일 사유 로그가 15분 이내에 있으면 추가하지 않음 (실시간·과거 재구성 중복 방지)
  if (hasDuplicateCareMistakeLog(logs, type, text, ts)) {
    return logs;
  }
  const newLog = { type, text, timestamp: ts, ...extraFields };

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
 * @returns {Object} 업데이트된 스탯
 */
export function checkCalls(stats, isLightsOn, sleepSchedule, now = new Date(), isActuallySleeping = false) {
  let updatedStats = { ...stats };
  
  const emptyCallEntry = () => ({ isActive: false, startedAt: null, sleepStartAt: null, isLogged: false });

  // 냉장고 상태에서는 호출을 무시
  if (updatedStats.isFrozen) {
    if (!updatedStats.callStatus) {
      updatedStats.callStatus = {
        hunger: emptyCallEntry(),
        strength: emptyCallEntry(),
        sleep: { isActive: false, startedAt: null }
      };
    } else {
      updatedStats.callStatus = {
        hunger: { ...updatedStats.callStatus.hunger, isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
        strength: { ...updatedStats.callStatus.strength, isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
        sleep: { ...updatedStats.callStatus.sleep, isActive: false, startedAt: null }
      };
    }
    return updatedStats;
  }

  if (!updatedStats.callStatus) {
    updatedStats.callStatus = {
      hunger: emptyCallEntry(),
      strength: emptyCallEntry(),
      sleep: { isActive: false, startedAt: null }
    };
  }
  // 기존 객체 유지 시 isLogged 보존 (DB에서 로드된 값)
  if (updatedStats.callStatus.hunger && updatedStats.callStatus.hunger.isLogged === undefined) {
    updatedStats.callStatus.hunger.isLogged = false;
  }
  if (updatedStats.callStatus.strength && updatedStats.callStatus.strength.isLogged === undefined) {
    updatedStats.callStatus.strength.isLogged = false;
  }

  const callStatus = updatedStats.callStatus;

  const HUNGER_CALL_TIMEOUT_MS = 10 * 60 * 1000;
  const STRENGTH_CALL_TIMEOUT_MS = 10 * 60 * 1000;

  // Hunger 호출 트리거
  if (updatedStats.fullness === 0) {
    const existingStartedAt = ensureTimestamp(callStatus.hunger.startedAt);
    const existingHungerZeroAt = ensureTimestamp(updatedStats.lastHungerZeroAt);
    const alreadyHandled = callStatus.hunger.isLogged === true;

    if (alreadyHandled) {
      callStatus.hunger.isActive = false;
      callStatus.hunger.startedAt = null;
      callStatus.hunger.sleepStartAt = null;
      updatedStats.hungerMistakeDeadline = null;
    } else if (existingHungerZeroAt && !existingStartedAt) {
      callStatus.hunger.isActive = true;
      callStatus.hunger.isLogged = false;
      callStatus.hunger.startedAt = existingHungerZeroAt;
      callStatus.hunger.sleepStartAt = isActuallySleeping ? now.getTime() : null;
      if (!updatedStats.hungerMistakeDeadline) {
        updatedStats.hungerMistakeDeadline = existingHungerZeroAt + HUNGER_CALL_TIMEOUT_MS;
      }
    } else if (existingHungerZeroAt && existingStartedAt) {
      callStatus.hunger.isActive = true;
      callStatus.hunger.startedAt = existingStartedAt;
      const hungerElapsed = now.getTime() - existingStartedAt;
      if (hungerElapsed < HUNGER_CALL_TIMEOUT_MS) {
        callStatus.hunger.isLogged = false;
      }
      const existingSleepStartAt = ensureTimestamp(callStatus.hunger.sleepStartAt);
      if (isActuallySleeping && !existingSleepStartAt) {
        callStatus.hunger.sleepStartAt = now.getTime();
      } else if (!isActuallySleeping && existingSleepStartAt) {
        callStatus.hunger.sleepStartAt = null;
      }
      if (!updatedStats.hungerMistakeDeadline) {
        updatedStats.hungerMistakeDeadline = existingHungerZeroAt + HUNGER_CALL_TIMEOUT_MS;
      }
    } else {
      callStatus.hunger.isActive = false;
      callStatus.hunger.startedAt = null;
      callStatus.hunger.sleepStartAt = null;
      updatedStats.hungerMistakeDeadline = null;
    }
  } else {
    callStatus.hunger.isActive = false;
    callStatus.hunger.startedAt = null;
    callStatus.hunger.sleepStartAt = null;
    callStatus.hunger.isLogged = false; // 호출 해제 시 다음 호출에서 다시 로그 가능
    updatedStats.lastHungerZeroAt = null;
    updatedStats.hungerMistakeDeadline = null;
  }

  // Strength 호출 트리거
  if (updatedStats.strength === 0) {
    const existingStartedAt = ensureTimestamp(callStatus.strength.startedAt);
    const existingStrengthZeroAt = ensureTimestamp(updatedStats.lastStrengthZeroAt);
    const alreadyHandled = callStatus.strength.isLogged === true;

    if (alreadyHandled) {
      callStatus.strength.isActive = false;
      callStatus.strength.startedAt = null;
      callStatus.strength.sleepStartAt = null;
      updatedStats.strengthMistakeDeadline = null;
    } else if (existingStrengthZeroAt && !existingStartedAt) {
      callStatus.strength.isActive = true;
      callStatus.strength.isLogged = false;
      callStatus.strength.startedAt = existingStrengthZeroAt;
      callStatus.strength.sleepStartAt = isActuallySleeping ? now.getTime() : null;
      if (!updatedStats.strengthMistakeDeadline) {
        updatedStats.strengthMistakeDeadline = existingStrengthZeroAt + STRENGTH_CALL_TIMEOUT_MS;
      }
    } else if (existingStrengthZeroAt && existingStartedAt) {
      callStatus.strength.isActive = true;
      callStatus.strength.startedAt = existingStartedAt;
      const strengthElapsed = now.getTime() - existingStartedAt;
      if (strengthElapsed < STRENGTH_CALL_TIMEOUT_MS) {
        callStatus.strength.isLogged = false;
      }
      const existingSleepStartAt = ensureTimestamp(callStatus.strength.sleepStartAt);
      if (isActuallySleeping && !existingSleepStartAt) {
        callStatus.strength.sleepStartAt = now.getTime();
      } else if (!isActuallySleeping && existingSleepStartAt) {
        callStatus.strength.sleepStartAt = null;
      }
      if (!updatedStats.strengthMistakeDeadline) {
        updatedStats.strengthMistakeDeadline = existingStrengthZeroAt + STRENGTH_CALL_TIMEOUT_MS;
      }
    } else {
      callStatus.strength.isActive = false;
      callStatus.strength.startedAt = null;
      callStatus.strength.sleepStartAt = null;
      updatedStats.strengthMistakeDeadline = null;
    }
  } else {
    callStatus.strength.isActive = false;
    callStatus.strength.startedAt = null;
    callStatus.strength.sleepStartAt = null;
    callStatus.strength.isLogged = false;
    updatedStats.lastStrengthZeroAt = null;
    updatedStats.strengthMistakeDeadline = null;
  }

  // Sleep 호출 트리거 (수면 시간이고 불이 켜져있을 때)
  // ⚠️ 중요: 실제로 잠들었을 때는 수면 호출 비활성화
  if (isActuallySleeping) {
    // 실제로 잠들었으면 수면 호출 비활성화
    callStatus.sleep.isActive = false;
    callStatus.sleep.startedAt = null;
  } else {
    // 잠들지 않았을 때만 수면 호출 체크
    const isSleepTime = isTimeWithinSleepSchedule(
      normalizeSleepSchedule(sleepSchedule || { start: 22, end: 6 }),
      now
    );

    if (isSleepTime && isLightsOn && !callStatus.sleep.isActive) {
      callStatus.sleep.isActive = true;
      callStatus.sleep.startedAt = now.getTime();
    } else if (!isSleepTime || !isLightsOn) {
      // 수면 시간이 아니거나 불이 꺼져있으면 수면 호출 비활성화
      callStatus.sleep.isActive = false;
      callStatus.sleep.startedAt = null;
    }
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
    if (callType === 'hunger' || callType === 'strength') {
      updatedStats.callStatus[callType].isLogged = false;
    }
    if (callType === 'hunger') {
      updatedStats.lastHungerZeroAt = null;
    } else if (callType === 'strength') {
      updatedStats.lastStrengthZeroAt = null;
    }
  }

  return updatedStats;
}

/**
 * 호출 타임아웃을 체크한다.
 * 배고픔/힘 호출은 careMistakes를 증가시키지만, Sleep Call은 경고 전용으로 유지한다.
 * @param {Object} stats - 현재 디지몬 스탯
 * @param {Date} now - 현재 시간
 * @returns {Object} 업데이트된 스탯
 */
export function checkCallTimeouts(stats, now = new Date(), isActuallySleeping = false) {
  if (!stats || !stats.callStatus) {
    return stats;
  }

  // 냉장고 상태에서는 호출 타임아웃을 무시 (케어 실수 발생하지 않음)
  if (stats.isFrozen) {
    return stats;
  }

  // 깊은 복사를 통해 새로운 객체 생성 (리액트 불변성 보장)
  const updatedStats = {
    ...stats,
    callStatus: {
      ...stats.callStatus,
      hunger: { ...stats.callStatus.hunger },
      strength: { ...stats.callStatus.strength },
      sleep: { ...stats.callStatus.sleep }
    }
  };

  const callStatus = updatedStats.callStatus;
  const HUNGER_CALL_TIMEOUT = 10 * 60 * 1000; // 10분
  const STRENGTH_CALL_TIMEOUT = 10 * 60 * 1000; // 10분
  const SLEEP_CALL_TIMEOUT = 60 * 60 * 1000; // 60분

  const nowMs = now.getTime();
  let hasChanged = false; // 변경 여부 추적

  // ⭐ 핵심: Timestamp Pushing - 잠자는 중이라면 타임아웃 시간을 현재로 동기화해서 "일시정지" 시킴
  if (isActuallySleeping) {
    if (callStatus.hunger.isActive && callStatus.hunger.startedAt) {
      callStatus.hunger.startedAt = nowMs;
      updatedStats.hungerMistakeDeadline = nowMs + HUNGER_CALL_TIMEOUT;
      hasChanged = true;
    }
    if (callStatus.strength.isActive && callStatus.strength.startedAt) {
      callStatus.strength.startedAt = nowMs;
      updatedStats.strengthMistakeDeadline = nowMs + STRENGTH_CALL_TIMEOUT;
      hasChanged = true;
    }
    return updatedStats;
  }

  // --- 기존 타임아웃 체크 로직 (깨어있을 때만 작동) ---
  
  // Hunger 호출 타임아웃: 이미 로그 남겼으면 카운트/로그 중복 방지 (isLogged)
  const hungerStartedAt = ensureTimestamp(callStatus.hunger.startedAt);
  if (hungerStartedAt) {
    const elapsed = nowMs - hungerStartedAt;
    const alreadyLogged = callStatus.hunger.isLogged === true;
    if (elapsed > HUNGER_CALL_TIMEOUT && !alreadyLogged) {
      const timeoutOccurredAt = hungerStartedAt + HUNGER_CALL_TIMEOUT;
      const { nextStats } = appendCareMistakeEntry(updatedStats, {
        occurredAt: timeoutOccurredAt,
        reasonKey: "hunger_call",
        text: `케어미스(사유: 배고픔 콜 10분 무시): ${(updatedStats.careMistakes || 0)} → ${(updatedStats.careMistakes || 0) + 1}`,
        source: "realtime",
      });
      updatedStats.careMistakes = nextStats.careMistakes;
      updatedStats.careMistakeLedger = nextStats.careMistakeLedger;
      callStatus.hunger.isActive = false;
      callStatus.hunger.startedAt = null;
      callStatus.hunger.sleepStartAt = null;
      callStatus.hunger.isLogged = true; // 로그 한 번만 남기도록
      updatedStats.hungerMistakeDeadline = null;
      hasChanged = true;
      console.log("🔥 실시간 Hunger 케어미스 발생! careMistakes:", updatedStats.careMistakes);
    } else if (elapsed > HUNGER_CALL_TIMEOUT && alreadyLogged) {
      // 이미 로그됨: 상태만 정리 (카운트/로그 중복 없음)
      callStatus.hunger.isActive = false;
      callStatus.hunger.startedAt = null;
      callStatus.hunger.sleepStartAt = null;
      updatedStats.hungerMistakeDeadline = null;
      hasChanged = true;
    }
  }

  const strengthStartedAt = ensureTimestamp(callStatus.strength.startedAt);
  if (strengthStartedAt) {
    const elapsed = nowMs - strengthStartedAt;
    const alreadyLogged = callStatus.strength.isLogged === true;
    if (elapsed > STRENGTH_CALL_TIMEOUT && !alreadyLogged) {
      const timeoutOccurredAt = strengthStartedAt + STRENGTH_CALL_TIMEOUT;
      const { nextStats } = appendCareMistakeEntry(updatedStats, {
        occurredAt: timeoutOccurredAt,
        reasonKey: "strength_call",
        text: `케어미스(사유: 힘 콜 10분 무시): ${(updatedStats.careMistakes || 0)} → ${(updatedStats.careMistakes || 0) + 1}`,
        source: "realtime",
      });
      updatedStats.careMistakes = nextStats.careMistakes;
      updatedStats.careMistakeLedger = nextStats.careMistakeLedger;
      callStatus.strength.isActive = false;
      callStatus.strength.startedAt = null;
      callStatus.strength.sleepStartAt = null;
      callStatus.strength.isLogged = true;
      updatedStats.strengthMistakeDeadline = null;
      hasChanged = true;
      console.log("🔥 실시간 Strength 케어미스 발생! careMistakes:", updatedStats.careMistakes);
    } else if (elapsed > STRENGTH_CALL_TIMEOUT && alreadyLogged) {
      callStatus.strength.isActive = false;
      callStatus.strength.startedAt = null;
      callStatus.strength.sleepStartAt = null;
      updatedStats.strengthMistakeDeadline = null;
      hasChanged = true;
    }
  }

  // Sleep 호출은 경고 전용 상태로 유지한다.
  // 수면 시간에 불을 켜둔 상태가 계속되면 callStatus.sleep은 checkCalls가 유지하고,
  // 더 이상 careMistakes를 올리거나 호출을 강제로 닫지 않는다.
  const sleepStartedAt = ensureTimestamp(callStatus.sleep.startedAt);
  if (sleepStartedAt && nowMs - sleepStartedAt > SLEEP_CALL_TIMEOUT) {
    return hasChanged ? updatedStats : stats;
  }

  // 변경되었을 때만 새 객체 반환, 아니면 기존 객체 그대로 반환 (리액트 최적화)
  return hasChanged ? updatedStats : stats;
}
