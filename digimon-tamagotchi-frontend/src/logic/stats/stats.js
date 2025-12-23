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

  // 기존 이어받기 (나이, 체중, 수명)
  merged.age = oldStats.age || merged.age;
  merged.weight = oldStats.weight || merged.weight;
  merged.lifespanSeconds = oldStats.lifespanSeconds || merged.lifespanSeconds;

  // strength, effort 이어받기
  merged.strength = oldStats.strength !== undefined ? oldStats.strength : merged.strength;
  merged.effort = oldStats.effort !== undefined ? oldStats.effort : merged.effort;

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
  merged.poopCountdown =
    oldStats.poopCountdown !== undefined
      ? oldStats.poopCountdown
      : merged.poopTimer * 60;

  merged.lastMaxPoopTime = oldStats.lastMaxPoopTime || null;

  return merged;
}

/**
 * 수명 업데이트 (1초 경과 처리)
 * 매뉴얼의 Status 섹션 규칙 반영
 * @param {Object} stats - 현재 스탯
 * @param {number} deltaSec - 경과 시간 (초)
 * @returns {Object} 업데이트된 스탯
 */
export function updateLifespan(stats, deltaSec = 1) {
  if (stats.isDead) return stats;

  const s = { ...stats };
  s.lifespanSeconds += deltaSec;
  s.timeToEvolveSeconds = Math.max(0, s.timeToEvolveSeconds - deltaSec);

  // 배고픔 감소 (hungerCycle에 따라)
  if (s.hungerTimer > 0) {
    s.hungerCountdown -= deltaSec;
    if (s.hungerCountdown <= 0) {
      s.hunger = Math.max(0, s.hunger - 1);
      s.hungerCountdown = s.hungerTimer * 60;
      if (s.hunger === 0 && !s.lastHungerZeroAt) {
        s.lastHungerZeroAt = Date.now();
      }
    }
  }

  // 힘 감소 (strengthCycle에 따라)
  if (s.strengthTimer > 0) {
    s.strengthCountdown -= deltaSec;
    if (s.strengthCountdown <= 0) {
      s.strength = Math.max(0, s.strength - 1);
      s.strengthCountdown = s.strengthTimer * 60;
      if (s.strength === 0 && !s.lastStrengthZeroAt) {
        s.lastStrengthZeroAt = Date.now();
      }
    }
  }

  // 배고픔/힘이 0이고 12시간 경과 시 사망
  if (s.hunger === 0 && s.lastHungerZeroAt) {
    const elapsed = (Date.now() - s.lastHungerZeroAt) / 1000;
    if (elapsed >= 43200) {
      // 12시간 = 43200초
      s.isDead = true;
    }
  }
  if (s.strength === 0 && s.lastStrengthZeroAt) {
    const elapsed = (Date.now() - s.lastStrengthZeroAt) / 1000;
    if (elapsed >= 43200) {
      s.isDead = true;
    }
  }

  // 똥 생성 (poopCycle에 따라)
  if (s.poopTimer > 0) {
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
 * @param {Object} stats - 현재 스탯
 * @returns {Object} 업데이트된 스탯
 */
export function updateAge(stats) {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    return { ...stats, age: stats.age + 1 };
  }
  return stats;
}

/**
 * Lazy Update: 마지막 저장 시간부터 현재까지 경과한 시간을 계산하여
 * 스탯(배고픔, 수명 등)을 한 번에 차감
 * 
 * @param {Object} stats - 현재 디지몬 스탯
 * @param {Date|number|string} lastSavedAt - 마지막 저장 시간
 * @returns {Object} 업데이트된 스탯
 */
export function applyLazyUpdate(stats, lastSavedAt) {
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
      updatedStats.hunger = Math.max(0, updatedStats.hunger - 1);
      updatedStats.hungerCountdown += updatedStats.hungerTimer * 60;

      if (updatedStats.hunger === 0 && !updatedStats.lastHungerZeroAt) {
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
  if (updatedStats.hunger === 0 && updatedStats.lastHungerZeroAt) {
    const hungerZeroTime =
      typeof updatedStats.lastHungerZeroAt === "number"
        ? updatedStats.lastHungerZeroAt
        : new Date(updatedStats.lastHungerZeroAt).getTime();
    const elapsedSinceZero = (now.getTime() - hungerZeroTime) / 1000;

    if (elapsedSinceZero >= 43200) {
      updatedStats.isDead = true;
    }
  } else if (updatedStats.hunger > 0) {
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

  // 나이 업데이트
  updatedStats = updateAge(updatedStats);

  updatedStats.lastSavedAt = now;

  return updatedStats;
}

