// src/data/v1/adapter.js
// 새 데이터 구조를 옛날 구조로 변환하는 호환성 어댑터

function normalizeTimeString(value, fallback = null) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return fallback;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    return fallback;
  }

  const rawHour = Number.parseInt(match[1], 10);
  const rawMinute = Number.parseInt(match[2], 10);
  if (rawHour === 24 && rawMinute === 0) {
    return "24:00";
  }

  const hour = Math.max(0, Math.min(23, rawHour));
  const minute = Math.max(0, Math.min(59, rawMinute));

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function createSleepScheduleFromTimes(sleepTime, wakeTime) {
  const normalizedSleepTime = normalizeTimeString(sleepTime);
  const normalizedWakeTime = normalizeTimeString(wakeTime, "08:00");

  if (!normalizedSleepTime || !normalizedWakeTime) {
    return null;
  }

  const [rawStart, startMinute] = normalizedSleepTime.split(":").map(Number);
  const [rawEnd, endMinute] = normalizedWakeTime.split(":").map(Number);
  const start = rawStart === 24 ? 0 : rawStart;
  const end = rawEnd === 24 ? 0 : rawEnd;

  return {
    start,
    end,
    startMinute,
    endMinute,
    startTime: normalizedSleepTime,
    endTime: normalizedWakeTime,
  };
}

/**
 * 새 데이터 구조를 옛날 구조로 변환
 * 옛날 코드와의 호환성을 위해 필드명을 매핑합니다.
 *
 * @param {Object} newData - 새 데이터 구조 (digimons.js)
 * @returns {Object} 옛날 데이터 구조
 */
export function adaptNewDataToOldFormat(newData) {
  if (!newData) return null;

  const sleepTime = normalizeTimeString(newData.stats?.sleepTime);
  const wakeTime = normalizeTimeString(newData.stats?.wakeTime, "08:00");
  const sleepSchedule = createSleepScheduleFromTimes(sleepTime, wakeTime);

  const adapted = {
    sprite: newData.sprite || 0,
    evolutionStage: newData.stage || "Digitama",
    stage: newData.stage || "Digitama",
    timeToEvolveSeconds: newData.evolutionCriteria?.timeToEvolveSeconds || 0,
    hungerTimer: newData.stats?.hungerCycle || 0,
    strengthTimer: newData.stats?.strengthCycle || 0,
    poopTimer: newData.stats?.poopCycle || 0,
    maxOverfeed: newData.stats?.maxOverfeed || 0,
    minWeight: newData.stats?.minWeight || 0,
    maxStamina: newData.stats?.maxEnergy || 0,
    maxEnergy: newData.stats?.maxEnergy || 0,
    attackSprite: newData.stats?.attackSprite ?? newData.sprite ?? 0,
    altAttackSprite: newData.stats?.altAttackSprite ?? 65535,
    basePower: newData.stats?.basePower || 0,
    type: newData.stats?.type || null,
    sleepTime,
    wakeTime,
    sleepSchedule,
    // v2용: 스프라이트 이미지 기준 경로 (있으면 UI에서 사용)
    spriteBasePath: newData.spriteBasePath || null,
    stats: {
      sleepSchedule,
      maxEnergy: newData.stats?.maxEnergy ?? 0,
      attackSprite: newData.stats?.attackSprite ?? newData.sprite ?? 0,
      altAttackSprite: newData.stats?.altAttackSprite ?? 65535,
    },
  };

  if (process.env.NODE_ENV === "development") {
    console.log("[Adapter] 변환된 데이터:", adapted);
  }

  return adapted;
}

/**
 * 새 데이터 맵 전체를 옛날 형식으로 변환
 *
 * @param {Object} newDataMap - 새 데이터 맵
 * @returns {Object} 옛날 형식의 데이터 맵
 */
export function adaptDataMapToOldFormat(newDataMap) {
  if (!newDataMap || typeof newDataMap !== "object") {
    console.error(
      "[Adapter] adaptDataMapToOldFormat: newDataMap이 유효하지 않습니다.",
      newDataMap
    );
    return {};
  }

  const adaptedMap = {};

  for (const [key, value] of Object.entries(newDataMap)) {
    adaptedMap[key] = adaptNewDataToOldFormat(value);
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[Adapter] 새 데이터 맵 변환 완료");
    console.log("[Adapter] 변환된 맵의 키:", Object.keys(adaptedMap));
    console.log("[Adapter] 예시 - Digitama:", adaptedMap.Digitama);
    console.log("[Adapter] 예시 - Botamon:", adaptedMap.Botamon);
  }

  return adaptedMap;
}
