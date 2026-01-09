// src/data/v1/adapter.js
// 새 데이터 구조를 옛날 구조로 변환하는 호환성 어댑터

/**
 * 새 데이터 구조를 옛날 구조로 변환
 * 옛날 코드와의 호환성을 위해 필드명을 매핑합니다.
 * 
 * @param {Object} newData - 새 데이터 구조 (digimons.js)
 * @returns {Object} 옛날 데이터 구조 (digimondata_digitalmonstercolor25th_ver1.js 형식)
 */
export function adaptNewDataToOldFormat(newData) {
  if (!newData) return null;

  const adapted = {
    sprite: newData.sprite || 0,
    evolutionStage: newData.stage || "Digitama",
    timeToEvolveSeconds: newData.evolutionCriteria?.timeToEvolveSeconds || 0,
    hungerTimer: newData.stats?.hungerCycle || 0,
    strengthTimer: newData.stats?.strengthCycle || 0,
    poopTimer: newData.stats?.poopCycle || 0,
    maxOverfeed: newData.stats?.maxOverfeed || 0,
    minWeight: newData.stats?.minWeight || 0,
    maxStamina: newData.stats?.maxEnergy || 0,
  };

  // 디버깅: 어댑터가 호출되는지 확인
  if (process.env.NODE_ENV === 'development') {
    console.log('[Adapter] 변환된 데이터:', adapted);
  }

  return adapted;
}

/**
 * 새 데이터 맵 전체를 옛날 형식으로 변환
 * 
 * @param {Object} newDataMap - 새 데이터 맵 (digimonDataVer1 from digimons.js)
 * @returns {Object} 옛날 형식의 데이터 맵
 */
export function adaptDataMapToOldFormat(newDataMap) {
  // null이나 undefined 체크
  if (!newDataMap || typeof newDataMap !== 'object') {
    console.error('[Adapter] adaptDataMapToOldFormat: newDataMap이 유효하지 않습니다.', newDataMap);
    return {};
  }

  const adaptedMap = {};

  for (const [key, value] of Object.entries(newDataMap)) {
    adaptedMap[key] = adaptNewDataToOldFormat(value);
  }

  // 디버깅: 어댑터가 호출되고 새 데이터가 사용되는지 확인
  if (process.env.NODE_ENV === 'development') {
    console.log('[Adapter] 새 데이터 맵 변환 완료');
    console.log('[Adapter] 변환된 맵의 키:', Object.keys(adaptedMap));
    console.log('[Adapter] 예시 - Digitama:', adaptedMap['Digitama']);
    console.log('[Adapter] 예시 - Botamon:', adaptedMap['Botamon']);
  }

  return adaptedMap;
}

