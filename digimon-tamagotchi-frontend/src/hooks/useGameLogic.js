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
      missingConditions.push(`레벨: ${level} / ${requirements.minLevel} (부족 ❌)`);
      isAvailable = false;
    }
  }

  // 파워 체크
  if (requirements.minPower !== undefined) {
    const power = currentStats.power || currentStats.basePower || 0;
    if (power < requirements.minPower) {
      missingConditions.push(`파워: ${power} / ${requirements.minPower} (부족 ❌)`);
      isAvailable = false;
    }
  }

  // 승리 수 체크 (아레나)
  if (requirements.minWins !== undefined) {
    const wins = currentStats.battlesWon || 0;
    if (wins < requirements.minWins) {
      missingConditions.push(`승리: ${wins} / ${requirements.minWins} (부족 ❌)`);
      isAvailable = false;
    } else {
      missingConditions.push(`승리: ${wins} / ${requirements.minWins} (달성 ✅)`);
    }
  }

  // 케어 미스 체크
  if (requirements.maxMistakes !== undefined) {
    const mistakes = currentStats.careMistakes || 0;
    if (mistakes > requirements.maxMistakes) {
      missingConditions.push(`케어 미스: ${mistakes} / ${requirements.maxMistakes} (초과 ❌)`);
      isAvailable = false;
    } else {
      missingConditions.push(`케어 미스: ${mistakes} / ${requirements.maxMistakes} (달성 ✅)`);
    }
  }

  // 훈련 횟수 체크
  if (requirements.minTrainings !== undefined) {
    const trainings = currentStats.trainings || currentStats.trainingCount || 0;
    if (trainings < requirements.minTrainings) {
      missingConditions.push(`훈련: ${trainings} / ${requirements.minTrainings} (부족 ❌)`);
      isAvailable = false;
    } else {
      missingConditions.push(`훈련: ${trainings} / ${requirements.minTrainings} (달성 ✅)`);
    }
  }

  if (requirements.maxTrainings !== undefined) {
    const trainings = currentStats.trainings || currentStats.trainingCount || 0;
    if (trainings > requirements.maxTrainings) {
      missingConditions.push(`훈련: ${trainings} / ${requirements.maxTrainings} (초과 ❌)`);
      isAvailable = false;
    }
  }

  // 오버피드 체크
  if (requirements.minOverfeeds !== undefined) {
    const overfeeds = currentStats.overfeeds || 0;
    if (overfeeds < requirements.minOverfeeds) {
      missingConditions.push(`오버피드: ${overfeeds} / ${requirements.minOverfeeds} (부족 ❌)`);
      isAvailable = false;
    } else {
      missingConditions.push(`오버피드: ${overfeeds} / ${requirements.minOverfeeds} (달성 ✅)`);
    }
  }

  if (requirements.maxOverfeeds !== undefined) {
    const overfeeds = currentStats.overfeeds || 0;
    if (overfeeds > requirements.maxOverfeeds) {
      missingConditions.push(`오버피드: ${overfeeds} / ${requirements.maxOverfeeds} (초과 ❌)`);
      isAvailable = false;
    }
  }

  // 수면 방해 체크
  if (requirements.minSleepDisturbances !== undefined) {
    const disturbances = currentStats.sleepDisturbances || 0;
    if (disturbances < requirements.minSleepDisturbances) {
      missingConditions.push(`수면 방해: ${disturbances} / ${requirements.minSleepDisturbances} (부족 ❌)`);
      isAvailable = false;
    } else {
      missingConditions.push(`수면 방해: ${disturbances} / ${requirements.minSleepDisturbances} (달성 ✅)`);
    }
  }

  if (requirements.maxSleepDisturbances !== undefined) {
    const disturbances = currentStats.sleepDisturbances || 0;
    if (disturbances > requirements.maxSleepDisturbances) {
      missingConditions.push(`수면 방해: ${disturbances} / ${requirements.maxSleepDisturbances} (초과 ❌)`);
      isAvailable = false;
    }
  }

  return {
    isAvailable,
    missingConditions,
  };
}

export default getSleepStatus;


