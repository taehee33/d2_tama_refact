// src/logic/encyclopediaMaster.js
// 도감 완성(마스터) 판정용 순수 함수

/**
 * 해당 버전 도감에 필요한 디지몬 ID 목록 (EncyclopediaModal과 동일 규칙)
 * - Ohakadamon 제외
 * - Ver.1: CresGarurumon 제외
 * - Ver.2: BlitzGreymonV2 제외
 * @param {Object} v1Map - Ver.1 디지몬 데이터 맵 (id -> { stage, ... })
 * @param {Object} v2Map - Ver.2 디지몬 데이터 맵
 * @param {string} version - "Ver.1" | "Ver.2"
 * @returns {string[]} 필요한 디지몬 ID 배열
 */
export function getRequiredDigimonIds(v1Map, v2Map, version) {
  const dataMap = version === "Ver.2" ? v2Map : v1Map;
  return Object.keys(dataMap || {}).filter((key) => {
    const digimon = dataMap[key];
    if (!digimon || digimon.stage === "Ohakadamon") return false;
    if (version === "Ver.1" && key === "CresGarurumon") return false;
    if (version === "Ver.2" && key === "BlitzGreymonV2") return false;
    return true;
  });
}

/**
 * 해당 버전 도감이 “전원 발견” 완성인지 여부
 * @param {Object} versionData - encyclopedia[version] (id -> { isDiscovered, ... })
 * @param {string[]} requiredIds - 해당 버전에 필요한 디지몬 ID 목록
 * @returns {boolean}
 */
export function isVersionComplete(versionData, requiredIds) {
  if (!versionData || !Array.isArray(requiredIds) || requiredIds.length === 0)
    return false;
  return requiredIds.every(
    (id) => versionData[id] && versionData[id].isDiscovered === true
  );
}
