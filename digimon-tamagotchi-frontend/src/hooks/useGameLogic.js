// src/hooks/useGameLogic.js
// 수면 상태 계산 유틸리티 및 진화 조건 체크 유틸리티

/**
 * 수면 상태를 계산한다.
 * @param {Object} params
 * @param {{start:number,end:number}} params.sleepSchedule - 수면 스케줄 (시 단위)
 * @param {boolean} params.isLightsOn - 조명 상태
 * @param {number|Date|string|null} params.wakeUntil - 강제 기상 유지 만료 시간
 * @param {Date} [params.now] - 현재 시간 (테스트용)
 * @returns {'AWAKE'|'TIRED'|'SLEEPING'}
 */
export function getSleepStatus({ sleepSchedule, isLightsOn, wakeUntil, now = new Date() }) {
  const hour = now.getHours();
  const { start = 22, end = 6 } = sleepSchedule || { start: 22, end: 6 };

  const wakeOverride = wakeUntil ? new Date(wakeUntil).getTime() > now.getTime() : false;

  const isSleepTime = (() => {
    if (start === end) return false;
    if (start < end) return hour >= start && hour < end;
    // 자정 넘김 케이스 (예: 22시~08시)
    return hour >= start || hour < end;
  })();

  // 깨어있기로 설정된 시간이 남아 있으면 무조건 AWAKE
  if (wakeOverride) return "AWAKE";
  if (!isSleepTime) return "AWAKE";

  // 수면 시간인 경우
  if (isLightsOn) return "TIRED";
  return "SLEEPING";
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
 * @returns {Array} 업데이트된 로그 배열
 */
export function addActivityLog(currentLogs = [], type, text) {
  const logs = initializeActivityLogs(currentLogs);
  const newLog = {
    type,
    text,
    timestamp: Date.now(),
  };
  
  // 최대 100개까지만 유지 (오래된 것부터 삭제)
  const maxLogs = 100;
  const updatedLogs = [...logs, newLog];
  if (updatedLogs.length > maxLogs) {
    return updatedLogs.slice(-maxLogs);
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
export function checkCalls(stats, isLightsOn, sleepSchedule, now = new Date()) {
  let updatedStats = { ...stats };
  
  // callStatus 초기화
  if (!updatedStats.callStatus) {
    updatedStats.callStatus = {
      hunger: { isActive: false, startedAt: null },
      strength: { isActive: false, startedAt: null },
      sleep: { isActive: false, startedAt: null }
    };
  }

  const callStatus = updatedStats.callStatus;

  // Hunger 호출 트리거
  if (updatedStats.fullness === 0 && !callStatus.hunger.isActive) {
    callStatus.hunger.isActive = true;
    callStatus.hunger.startedAt = now.getTime();
  }

  // Strength 호출 트리거
  if (updatedStats.strength === 0 && !callStatus.strength.isActive) {
    callStatus.strength.isActive = true;
    callStatus.strength.startedAt = now.getTime();
  }

  // Sleep 호출 트리거 (수면 시간이고 불이 켜져있을 때)
  const hour = now.getHours();
  const { start = 22, end = 6 } = sleepSchedule || { start: 22, end: 6 };
  const isSleepTime = (() => {
    if (start === end) return false;
    if (start < end) return hour >= start && hour < end;
    return hour >= start || hour < end;
  })();

  if (isSleepTime && isLightsOn && !callStatus.sleep.isActive) {
    callStatus.sleep.isActive = true;
    callStatus.sleep.startedAt = now.getTime();
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
      hunger: { isActive: false, startedAt: null },
      strength: { isActive: false, startedAt: null },
      sleep: { isActive: false, startedAt: null }
    };
  }

  if (updatedStats.callStatus[callType]) {
    updatedStats.callStatus[callType].isActive = false;
    updatedStats.callStatus[callType].startedAt = null;
  }

  return updatedStats;
}

/**
 * 호출 타임아웃을 체크하고 careMistakes를 증가시킨다.
 * @param {Object} stats - 현재 디지몬 스탯
 * @param {Date} now - 현재 시간
 * @returns {Object} 업데이트된 스탯
 */
export function checkCallTimeouts(stats, now = new Date()) {
  let updatedStats = { ...stats };
  
  if (!updatedStats.callStatus) {
    return updatedStats;
  }

  const callStatus = updatedStats.callStatus;
  const HUNGER_CALL_TIMEOUT = 10 * 60 * 1000; // 10분
  const STRENGTH_CALL_TIMEOUT = 10 * 60 * 1000; // 10분
  const SLEEP_CALL_TIMEOUT = 60 * 60 * 1000; // 60분

  // Hunger 호출 타임아웃 체크
  if (callStatus.hunger.isActive && callStatus.hunger.startedAt) {
    const startedAt = typeof callStatus.hunger.startedAt === 'number'
      ? callStatus.hunger.startedAt
      : new Date(callStatus.hunger.startedAt).getTime();
    const elapsed = now.getTime() - startedAt;
    
    if (elapsed > HUNGER_CALL_TIMEOUT) {
      updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
      callStatus.hunger.isActive = false;
      callStatus.hunger.startedAt = null;
    }
  }

  // Strength 호출 타임아웃 체크
  if (callStatus.strength.isActive && callStatus.strength.startedAt) {
    const startedAt = typeof callStatus.strength.startedAt === 'number'
      ? callStatus.strength.startedAt
      : new Date(callStatus.strength.startedAt).getTime();
    const elapsed = now.getTime() - startedAt;
    
    if (elapsed > STRENGTH_CALL_TIMEOUT) {
      updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
      callStatus.strength.isActive = false;
      callStatus.strength.startedAt = null;
    }
  }

  // Sleep 호출 타임아웃 체크
  if (callStatus.sleep.isActive && callStatus.sleep.startedAt) {
    const startedAt = typeof callStatus.sleep.startedAt === 'number'
      ? callStatus.sleep.startedAt
      : new Date(callStatus.sleep.startedAt).getTime();
    const elapsed = now.getTime() - startedAt;
    
    if (elapsed > SLEEP_CALL_TIMEOUT) {
      updatedStats.careMistakes = (updatedStats.careMistakes || 0) + 1;
      callStatus.sleep.isActive = false;
      callStatus.sleep.startedAt = null;
    }
  }

  return updatedStats;
}


