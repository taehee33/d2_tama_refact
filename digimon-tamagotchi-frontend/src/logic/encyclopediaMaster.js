// src/logic/encyclopediaMaster.js
// 도감 완성(마스터) 판정용 순수 함수

import { getDigimonDataMapByVersion } from "../utils/digimonVersionUtils";

const EXCLUDED_DIGIMON_IDS_BY_VERSION = {
  "Ver.1": new Set(["CresGarurumon"]),
  "Ver.2": new Set(["BlitzGreymonV2"]),
};

/**
 * 해당 버전 도감에 필요한 디지몬 ID 목록 (EncyclopediaModal과 동일 규칙)
 * - Ohakadamon 제외
 * - Ver.1: CresGarurumon 제외
 * - Ver.2: BlitzGreymonV2 제외
 * @param {Object|string} v1MapOrVersion - Ver.1 디지몬 데이터 맵 또는 버전 라벨
 * @param {Object} [v2Map] - Ver.2 디지몬 데이터 맵
 * @param {string} [versionArg] - "Ver.1" | "Ver.2" | "Ver.3"
 * @returns {string[]} 필요한 디지몬 ID 배열
 */
export function getRequiredDigimonIds(v1MapOrVersion, v2Map, versionArg) {
  const version =
    typeof versionArg === "string"
      ? versionArg
      : typeof v1MapOrVersion === "string"
        ? v1MapOrVersion
        : "Ver.1";
  const excludedIds = EXCLUDED_DIGIMON_IDS_BY_VERSION[version] || new Set();
  const dataMap =
    typeof versionArg === "string"
      ? version === "Ver.1"
        ? v1MapOrVersion
        : version === "Ver.2"
          ? v2Map
          : getDigimonDataMapByVersion(version)
      : getDigimonDataMapByVersion(version);

  return Object.keys(dataMap || {}).filter((key) => {
    const digimon = dataMap[key];
    if (!digimon || digimon.stage === "Ohakadamon") return false;
    if (excludedIds.has(key)) return false;
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
