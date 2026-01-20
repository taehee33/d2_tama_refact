// src/logic/stats/stats.js
// Digital Monster Color 매뉴얼 기반 스탯 관리 로직

import { defaultStats } from "../../data/v1/defaultStats";

/**
 * 디지몬 스탯 초기화
 * @param {string} digiName - 디지몬 이름
 * @param {Object} oldStats - 기존 스탯 (진화 시 이어받을 값)
 * @param {Object} dataMap - 디지몬 데이터 맵
 * @returns {Object} 초기화된 스탯
 */
export function initializeStats(digiName, oldStats = {}, dataMap = {}) {
  if (!dataMap[digiName]) {
    console.error(`initializeStats: [${digiName}] not found in dataMap!`);
    digiName = "Digitama"; // fallback
  }
  const custom = dataMap[digiName] || {};

  let merged = { ...defaultStats, ...custom };

  // 기존 이어받기 (나이, 수명)
  // weight는 진화 시 minWeight로 리셋되므로, resetStats에서 이미 설정된 값을 사용
  merged.age = oldStats.age || merged.age;
  merged.weight = oldStats.weight !== undefined ? oldStats.weight : merged.weight;
  merged.lifespanSeconds = oldStats.lifespanSeconds || merged.lifespanSeconds;

  // strength, effort는 진화 시 리셋 (resetStats에서 0으로 설정됨)
  // merged.strength, merged.effort는 defaultStats에서 가져온 기본값 사용 (보통 0)

  // trainings는 새 디지몬 생성(진화) 시 무조건 0
  merged.trainings = 0;
  merged.overfeeds = 0;
  merged.sleepDisturbances = 0;
  merged.battlesForEvolution = 0;
  merged.careMistakes = 0; // 진화 시 리셋
  merged.proteinOverdose = 0; // 진화 시 리셋
  merged.injuries = 0; // 진화 시 리셋

  // 타이머 계산
  merged.hungerCountdown = merged.hungerTimer * 60;
  merged.strengthCountdown = merged.strengthTimer * 60;

  // poop 관련
  merged.poopCount = oldStats.poopCount !== undefined ? oldStats.poopCount : 0;
  merged.poopTimer = merged.poopTimer || 0;
  
  // poopCountdown 초기화: poopTimer가 변경되었거나 poopCountdown이 잘못된 값이면 초기화
  const oldPoopTimer = oldStats.poopTimer || 0;
  const newPoopTimer = merged.poopTimer || 0;
  const maxValidCountdown = newPoopTimer * 60; // 최대 유효한 countdown 값
  
  if (oldStats.poopCountdown !== undefined) {
    // poopTimer가 변경되었거나 poopCountdown이 잘못된 값이면 초기화
    if (oldPoopTimer !== newPoopTimer || 
        oldStats.poopCountdown < 0 || 
        oldStats.poopCountdown > maxValidCountdown ||
        isNaN(oldStats.poopCountdown)) {
      merged.poopCountdown = maxValidCountdown;
    } else {
      merged.poopCountdown = oldStats.poopCountdown;
    }
  } else {
    merged.poopCountdown = maxValidCountdown;
  }

  merged.lastMaxPoopTime = oldStats.lastMaxPoopTime || null;

  // 진화 시 Energy를 최대값으로 설정 (안전장치)
  // useEvolution.js에서 이미 maxEnergy로 설정하지만, 다른 경로를 통한 진화를 대비
  // oldStats.energy가 명시적으로 설정되어 있으면 그 값을 사용 (useEvolution.js에서 maxEnergy로 설정됨)
  // oldStats.energy가 없거나 0이면 maxEnergy로 설정
  if (oldStats && oldStats.energy !== undefined && oldStats.energy > 0) {
    merged.energy = oldStats.energy;
  } else {
    // oldStats.energy가 없거나 0이면 maxEnergy로 설정
    // maxEnergy가 0일 수도 있으므로 ?? (nullish coalescing) 사용
    const calculatedMaxEnergy = merged.maxEnergy ?? merged.maxStamina ?? 0;
    merged.energy = calculatedMaxEnergy;
  }

  return merged;
}

/**
 * 수명 업데이트 (1초 경과 처리)
 * 매뉴얼의 Status 섹션 규칙 반영
 * @param {Object} stats - 현재 스탯
 * @param {number} deltaSec - 경과 시간 (초)
 * @param {boolean} isSleeping - 수면 중 여부 (수면 중에는 poopCountdown 감소하지 않음)
 * @returns {Object} 업데이트된 스탯
 */
export function updateLifespan(stats, deltaSec = 1, isSleeping = false) {
  if (stats.isDead) return stats;

  const s = { ...stats };
  s.lifespanSeconds += deltaSec;
  s.timeToEvolveSeconds = Math.max(0, s.timeToEvolveSeconds - deltaSec);

  // 배고픔/힘 감소 로직은 handleHungerTick, handleStrengthTick으로 이동
  // 이 함수는 lifespanSeconds, timeToEvolveSeconds, poop만 처리

  // 똥 생성 (poopCycle에 따라) - 수면 중에는 타이머 감소하지 않음
  if (s.poopTimer > 0 && !isSleeping) {
    s.poopCountdown -= deltaSec;
    if (s.poopCountdown <= 0) {
      if (s.poopCount < 8) {
        s.poopCount++;
        s.poopCountdown = s.poopTimer * 60;

        // 8개가 되면 lastMaxPoopTime 기록
        if (s.poopCount === 8 && !s.lastMaxPoopTime) {
          s.lastMaxPoopTime = Date.now();
        }
      } else {
        // 이미 8개 이상
        if (!s.lastMaxPoopTime) {
          s.lastMaxPoopTime = Date.now();
        } else {
          // 8시간(28800초) 지났다면 부상 (careMistakes 아님)
          const e = (Date.now() - s.lastMaxPoopTime) / 1000;
          if (e >= 28800) {
            // 부상 처리 (injuries 증가, 부상 시간 기록)
            s.injuries++;
            s.injuredAt = Date.now();
            s.lastMaxPoopTime = Date.now(); // 다시 리셋
          }
        }
        s.poopCountdown = s.poopTimer * 60;
      }
    }
  }

  return s;
}

/**
 * 나이 업데이트 (자정 경과 확인)
 * 마지막으로 age가 증가한 날짜를 추적하여 하루에 한 번만 증가하도록 함
 * @param {Object} stats - 현재 스탯
 * @returns {Object} 업데이트된 스탯
 */
export function updateAge(stats) {
  const now = new Date();
  const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // 자정(00:00)이고, 오늘 아직 age가 증가하지 않았으면 증가
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    const lastAgeUpdateDate = stats.lastAgeUpdateDate 
      ? new Date(stats.lastAgeUpdateDate)
      : null;
    
    // 마지막 증가 날짜가 없거나 오늘이 아니면 age 증가
    if (!lastAgeUpdateDate || lastAgeUpdateDate.getTime() !== currentDate.getTime()) {
      return { 
        ...stats, 
        age: (stats.age || 0) + 1,
        lastAgeUpdateDate: currentDate.getTime()
      };
    }
  }
  
  return stats;
}

/**
 * Lazy Update용 나이 업데이트
 * 마지막 저장 시간부터 현재까지의 모든 자정을 체크하여 age 증가
 * @param {Object} stats - 현재 스탯
 * @param {Date} lastSaved - 마지막 저장 시간
 * @param {Date} now - 현재 시간
 * @returns {Object} 업데이트된 스탯
 */
export function updateAgeWithLazyUpdate(stats, lastSaved, now) {
  let updatedStats = { ...stats };
  const lastAgeUpdateDate = updatedStats.lastAgeUpdateDate 
    ? new Date(updatedStats.lastAgeUpdateDate)
    : null;
  
  // 마지막 저장 시간의 다음 자정부터 현재까지의 모든 자정 체크
  let checkTime = new Date(lastSaved);
  checkTime.setHours(0);
  checkTime.setMinutes(0);
  checkTime.setSeconds(0);
  checkTime.setMilliseconds(0);
  
  // 마지막 저장 시간이 자정 이후라면 다음 날 자정으로 이동
  if (lastSaved.getHours() > 0 || lastSaved.getMinutes() > 0 || lastSaved.getSeconds() > 0) {
    checkTime.setDate(checkTime.getDate() + 1);
  }
  
  // 현재 시간까지의 모든 자정 체크
  while (checkTime.getTime() <= now.getTime()) {
    const checkDate = new Date(checkTime.getFullYear(), checkTime.getMonth(), checkTime.getDate());
    
    // 마지막 증가 날짜가 없거나 체크하는 날짜가 마지막 증가 날짜보다 이후면 age 증가
    if (!lastAgeUpdateDate || checkDate.getTime() > lastAgeUpdateDate.getTime()) {
      updatedStats.age = (updatedStats.age || 0) + 1;
      updatedStats.lastAgeUpdateDate = checkDate.getTime();
    }
    
    // 다음 날 자정으로 이동
    checkTime.setDate(checkTime.getDate() + 1);
  }
  
  return updatedStats;
}

/**
 * Lazy Update: 마지막 저장 시간부터 현재까지 경과한 시간을 계산하여
 * 스탯(배고픔, 수명 등)을 한 번에 차감
 * 
 * @param {Object} stats - 현재 디지몬 스탯
 * @param {Date|number|string} lastSavedAt - 마지막 저장 시간
 * @returns {Object} 업데이트된 스탯
 */
export function applyLazyUpdate(stats, lastSavedAt, sleepSchedule = null, maxEnergy = null) {
  if (!lastSavedAt) {
    return { ...stats, lastSavedAt: new Date() };
  }

  // 마지막 저장 시간을 Date 객체로 변환
  let lastSaved;
  if (lastSavedAt instanceof Date) {
    lastSaved = lastSavedAt;
  } else if (typeof lastSavedAt === "number") {
    lastSaved = new Date(lastSavedAt);
  } else if (typeof lastSavedAt === "string") {
    lastSaved = new Date(lastSavedAt);
  } else if (lastSavedAt.toDate) {
    // Firestore Timestamp인 경우
    lastSaved = lastSavedAt.toDate();
  } else {
    return { ...stats, lastSavedAt: new Date() };
  }

  const now = new Date();
  const elapsedSeconds = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);

  if (elapsedSeconds <= 0) {
    return { ...stats, lastSavedAt: now };
  }

  if (stats.isDead) {
    return { ...stats, lastSavedAt: now };
  }

  // 경과 시간만큼 한 번에 업데이트
  let updatedStats = { ...stats };

  updatedStats.lifespanSeconds += elapsedSeconds;
  updatedStats.timeToEvolveSeconds = Math.max(
    0,
    updatedStats.timeToEvolveSeconds - elapsedSeconds
  );

  // 배고픔 감소 처리
  if (updatedStats.hungerTimer > 0) {
    updatedStats.hungerCountdown -= elapsedSeconds;

    while (updatedStats.hungerCountdown <= 0) {
      updatedStats.fullness = Math.max(0, (updatedStats.fullness || 0) - 1);
      updatedStats.hungerCountdown += updatedStats.hungerTimer * 60;

      if (updatedStats.fullness === 0 && !updatedStats.lastHungerZeroAt) {
        const timeToZero =
          lastSaved.getTime() + (elapsedSeconds - updatedStats.hungerCountdown) * 1000;
        updatedStats.lastHungerZeroAt = timeToZero;
      }
    }
  }

  // 힘 감소 처리
  if (updatedStats.strengthTimer > 0) {
    updatedStats.strengthCountdown -= elapsedSeconds;

    while (updatedStats.strengthCountdown <= 0) {
      // strength -1 (최소 0)
      updatedStats.strength = Math.max(0, updatedStats.strength - 1);
      updatedStats.strengthCountdown += updatedStats.strengthTimer * 60;

      if (updatedStats.strength === 0 && !updatedStats.lastStrengthZeroAt) {
        const timeToZero =
          lastSaved.getTime() +
          (elapsedSeconds - updatedStats.strengthCountdown) * 1000;
        updatedStats.lastStrengthZeroAt = timeToZero;
      }
    }
  }

  // 배변 처리
  if (updatedStats.poopTimer > 0) {
    const maxValidCountdown = updatedStats.poopTimer * 60;
    
    // poopCountdown 초기화 체크 (undefined, null, NaN, 음수, 또는 잘못된 값)
    if (updatedStats.poopCountdown === undefined || 
        updatedStats.poopCountdown === null || 
        isNaN(updatedStats.poopCountdown) || 
        updatedStats.poopCountdown < 0 ||
        updatedStats.poopCountdown > maxValidCountdown) {
      // 초기화: poopTimer * 60 (초 단위)
      updatedStats.poopCountdown = maxValidCountdown;
    }
    
    updatedStats.poopCountdown -= elapsedSeconds;

    while (updatedStats.poopCountdown <= 0) {
      if (updatedStats.poopCount < 8) {
        updatedStats.poopCount++;
        updatedStats.poopCountdown += updatedStats.poopTimer * 60;

        if (updatedStats.poopCount === 8 && !updatedStats.lastMaxPoopTime) {
          const timeToMax =
            lastSaved.getTime() + (elapsedSeconds - updatedStats.poopCountdown) * 1000;
          updatedStats.lastMaxPoopTime = timeToMax;
        }
      } else {
        if (!updatedStats.lastMaxPoopTime) {
          const timeToMax =
            lastSaved.getTime() + (elapsedSeconds - updatedStats.poopCountdown) * 1000;
          updatedStats.lastMaxPoopTime = timeToMax;
        } else {
          const lastMaxTime =
            typeof updatedStats.lastMaxPoopTime === "number"
              ? updatedStats.lastMaxPoopTime
              : new Date(updatedStats.lastMaxPoopTime).getTime();
          const elapsedSinceMax = (now.getTime() - lastMaxTime) / 1000;

          if (elapsedSinceMax >= 28800) {
            updatedStats.injuries++;
            updatedStats.injuredAt = now.getTime();
            updatedStats.lastMaxPoopTime = now.getTime();
          }
        }
        updatedStats.poopCountdown += updatedStats.poopTimer * 60;
      }
    }
  }

  // 배고픔/힘이 0이고 12시간 경과 시 사망
  if (updatedStats.fullness === 0 && updatedStats.lastHungerZeroAt) {
    const hungerZeroTime =
      typeof updatedStats.lastHungerZeroAt === "number"
        ? updatedStats.lastHungerZeroAt
        : new Date(updatedStats.lastHungerZeroAt).getTime();
    const elapsedSinceZero = (now.getTime() - hungerZeroTime) / 1000;

    if (elapsedSinceZero >= 43200) {
      updatedStats.isDead = true;
    }
  } else if (updatedStats.fullness > 0) {
    updatedStats.lastHungerZeroAt = null;
  }

  if (updatedStats.strength === 0 && updatedStats.lastStrengthZeroAt) {
    const strengthZeroTime =
      typeof updatedStats.lastStrengthZeroAt === "number"
        ? updatedStats.lastStrengthZeroAt
        : new Date(updatedStats.lastStrengthZeroAt).getTime();
    const elapsedSinceZero = (now.getTime() - strengthZeroTime) / 1000;

    if (elapsedSinceZero >= 43200) {
      updatedStats.isDead = true;
    }
  } else if (updatedStats.strength > 0) {
    updatedStats.lastStrengthZeroAt = null;
  }

  // Energy 회복 처리
  if (sleepSchedule && maxEnergy) {
    const currentHour = now.getHours();
    const lastHour = lastSaved.getHours();
    
    const { start = 22, end = 6 } = sleepSchedule;
    
    // 기상 시간 체크: 수면 시간이 끝나고 기상 시간이 되면 maxEnergy까지 회복
    const isWakeTime = (() => {
      if (start === end) return false;
      
      // 마지막 저장 시간이 수면 시간 내에 있었는지 확인
      const wasInSleepTime = (() => {
        if (start < end) {
          return lastHour >= start && lastHour < end;
        } else {
          // 자정 넘김 케이스 (예: 22시~08시)
          return lastHour >= start || lastHour < end;
        }
      })();
      
      // 현재 시간이 기상 시간(end 시) 이후인지 확인
      const isNowWakeTime = (() => {
        if (start < end) {
          // 예: 22시~06시 -> 06시 이상이고 수면 시간 전이면 기상
          return currentHour >= end && currentHour < start;
        } else {
          // 자정 넘김 케이스 (예: 22시~08시)
          // 08시 이상이거나, 자정을 넘어서 08시에 도달한 경우
          return currentHour >= end || (lastHour >= start && currentHour < start);
        }
      })();
      
      // 마지막 저장 시간이 수면 시간 내에 있었고, 현재는 기상 시간이면 기상으로 판단
      // 단, 오늘 이미 기상 회복을 했는지 확인
      if (wasInSleepTime && isNowWakeTime) {
        const lastRecoveryTime = updatedStats.lastEnergyRecoveryAt 
          ? (typeof updatedStats.lastEnergyRecoveryAt === "number" 
              ? updatedStats.lastEnergyRecoveryAt 
              : new Date(updatedStats.lastEnergyRecoveryAt).getTime())
          : 0;
        
        // 오늘 기상 시간 계산
        const todayWakeTime = new Date(now);
        todayWakeTime.setHours(end, 0, 0, 0);
        // 자정을 넘긴 경우 전날로 설정
        if (start > end && currentHour < start) {
          todayWakeTime.setDate(todayWakeTime.getDate() - 1);
        }
        
        // 오늘 기상 시간 이후에 회복한 적이 없으면 기상 회복
        if (lastRecoveryTime < todayWakeTime.getTime()) {
          return true;
        }
      }
      
      return false;
    })();
    
    if (isWakeTime) {
      // 기상 시간: maxEnergy까지 회복
      updatedStats.energy = maxEnergy;
      updatedStats.lastEnergyRecoveryAt = now.getTime();
    } else {
      // 정각(00분) 또는 30분마다 +1 회복
      const lastRecoveryTime = updatedStats.lastEnergyRecoveryAt 
        ? (typeof updatedStats.lastEnergyRecoveryAt === "number" 
            ? updatedStats.lastEnergyRecoveryAt 
            : new Date(updatedStats.lastEnergyRecoveryAt).getTime())
        : lastSaved.getTime();
      
      // 마지막 저장 시간부터 현재 시간까지의 모든 정각/30분 체크
      let checkTime = new Date(Math.max(lastRecoveryTime, lastSaved.getTime()));
      checkTime.setSeconds(0);
      checkTime.setMilliseconds(0);
      
      // 다음 정각/30분으로 이동
      if (checkTime.getMinutes() !== 0 && checkTime.getMinutes() !== 30) {
        if (checkTime.getMinutes() < 30) {
          checkTime.setMinutes(30);
        } else {
          checkTime.setMinutes(0);
          checkTime.setHours(checkTime.getHours() + 1);
        }
      }
      
      // 정각(00분) 또는 30분마다 Energy +1
      while (checkTime.getTime() <= now.getTime()) {
        const currentEnergy = updatedStats.energy || 0;
        if (currentEnergy < maxEnergy) {
          updatedStats.energy = Math.min(maxEnergy, currentEnergy + 1);
          updatedStats.lastEnergyRecoveryAt = checkTime.getTime();
        }
        
        // 다음 정각/30분으로 이동
        if (checkTime.getMinutes() === 0) {
          checkTime.setMinutes(30);
        } else {
          checkTime.setMinutes(0);
          checkTime.setHours(checkTime.getHours() + 1);
        }
      }
    }
  }

  // 나이 업데이트: 마지막 저장 시간부터 현재까지의 모든 자정 체크
  updatedStats = updateAgeWithLazyUpdate(updatedStats, lastSaved, now);

  updatedStats.lastSavedAt = now;

  return updatedStats;
}

/**
 * 에너지 회복 처리 (실시간 타이머용)
 * @param {Object} stats - 현재 스탯
 * @param {Object} sleepSchedule - 수면 스케줄 { start, end }
 * @param {number} maxEnergy - 최대 에너지
 * @param {Date} now - 현재 시간 (기본값: new Date())
 * @returns {Object} 업데이트된 스탯
 */
export function handleEnergyRecovery(stats, sleepSchedule = null, maxEnergy = null, now = new Date()) {
  if (!maxEnergy || stats.isDead) {
    return stats;
  }

  const updatedStats = { ...stats };
  const currentHour = now.getHours();
  
  if (sleepSchedule && maxEnergy) {
    const { start = 22, end = 6 } = sleepSchedule;
    
    // 기상 시간 체크: 수면 시간이 끝나고 기상 시간이 되면 maxEnergy까지 회복
    const isWakeTime = (() => {
      if (start === end) return false;
      
      // 현재 시간이 기상 시간(end 시)인지 확인
      const isNowWakeTime = (() => {
        if (start < end) {
          // 예: 22시~06시 -> 06시 이상이고 수면 시간 전이면 기상
          return currentHour >= end && currentHour < start;
        } else {
          // 자정 넘김 케이스 (예: 22시~08시)
          return currentHour >= end || currentHour < start;
        }
      })();
      
      if (isNowWakeTime) {
        const lastRecoveryTime = updatedStats.lastEnergyRecoveryAt 
          ? (typeof updatedStats.lastEnergyRecoveryAt === "number" 
              ? updatedStats.lastEnergyRecoveryAt 
              : new Date(updatedStats.lastEnergyRecoveryAt).getTime())
          : 0;
        
        // 오늘 기상 시간 계산
        const todayWakeTime = new Date(now);
        todayWakeTime.setHours(end, 0, 0, 0);
        // 자정을 넘긴 경우 전날로 설정
        if (start > end && currentHour < start) {
          todayWakeTime.setDate(todayWakeTime.getDate() - 1);
        }
        
        // 오늘 기상 시간 이후에 회복한 적이 없으면 기상 회복
        if (lastRecoveryTime < todayWakeTime.getTime()) {
          return true;
        }
      }
      
      return false;
    })();
    
    if (isWakeTime) {
      // 기상 시간: maxEnergy까지 회복
      updatedStats.energy = maxEnergy;
      updatedStats.lastEnergyRecoveryAt = now.getTime();
    } else {
      // 정각(00분) 또는 30분마다 +1 회복
      const lastRecoveryTime = updatedStats.lastEnergyRecoveryAt 
        ? (typeof updatedStats.lastEnergyRecoveryAt === "number" 
            ? updatedStats.lastEnergyRecoveryAt 
            : new Date(updatedStats.lastEnergyRecoveryAt).getTime())
        : 0;
      
      // 마지막 회복 시간부터 현재 시간까지의 모든 정각/30분 체크
      // 실시간 타이머에서는 최근 1시간 내의 회복만 체크 (성능 최적화)
      let checkTime = new Date(Math.max(lastRecoveryTime, now.getTime() - 60 * 60 * 1000));
      checkTime.setSeconds(0);
      checkTime.setMilliseconds(0);
      
      // 다음 정각/30분으로 이동
      if (checkTime.getMinutes() !== 0 && checkTime.getMinutes() !== 30) {
        if (checkTime.getMinutes() < 30) {
          checkTime.setMinutes(30);
        } else {
          checkTime.setMinutes(0);
          checkTime.setHours(checkTime.getHours() + 1);
        }
      }
      
      // 정각(00분) 또는 30분마다 Energy +1
      // 실시간 타이머에서는 한 번에 하나씩만 회복 (중복 방지)
      if (checkTime.getTime() <= now.getTime()) {
        const currentEnergy = updatedStats.energy || 0;
        if (currentEnergy < maxEnergy) {
          // 마지막 회복 시간이 현재 체크 시간보다 이전이면 회복
          if (lastRecoveryTime < checkTime.getTime()) {
            updatedStats.energy = Math.min(maxEnergy, currentEnergy + 1);
            updatedStats.lastEnergyRecoveryAt = checkTime.getTime();
          }
        }
      }
    }
  }
  
  return updatedStats;
}

