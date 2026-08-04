// src/logic/evolution/jogress.js
// 조그레스 진화 결과 판정 (순수 함수)

import {
  getDigimonDataMapByVersion,
  normalizeDigimonVersionLabel,
  SUPPORTED_DIGIMON_VERSIONS,
} from "../../utils/digimonVersionUtils";

/**
 * Ver.1 / Ver.2 동일 캐릭터 매칭용: ID에서 V1·V2 접미사 제거해 베이스 ID로 통일
 * (v1 슬롯은 "BlitzGreymon", v2 데이터는 partner "BlitzGreymonV1" 등 혼용되므로 둘 다 정규화)
 * @param {string} id - 디지몬 ID (예: CresGarurumonV2, BlitzGreymonV1, BlitzGreymon)
 * @returns {string} 베이스 ID (예: CresGarurumon, BlitzGreymon)
 */
function baseJogressId(id) {
  if (typeof id !== "string") return "";
  return id.replace(/V2$/i, "").replace(/V1$/i, "");
}

function resolveDigimonKey(dataMap, digimonId) {
  if (!dataMap || !digimonId) return null;
  if (dataMap[digimonId]) return digimonId;

  const normalizedId = String(digimonId).toLowerCase();
  const exactIdEntry = Object.entries(dataMap).find(([key, entry]) =>
    key.toLowerCase() === normalizedId ||
    String(entry?.id || "").toLowerCase() === normalizedId
  );
  if (exactIdEntry) return exactIdEntry[0];

  const baseId = baseJogressId(digimonId);
  const legacyEntry = Object.entries(dataMap).find(([key, entry]) =>
    baseJogressId(key) === baseId || baseJogressId(entry?.id) === baseId
  );
  return legacyEntry?.[0] || null;
}

function isLegacyJogressVersion(version) {
  return version === "Ver.1" || version === "Ver.2";
}

function isPartnerVersionCompatible(partnerVersion, expectedVersion, sourceVersion) {
  if (partnerVersion) {
    return normalizeDigimonVersionLabel(partnerVersion) === expectedVersion;
  }

  return isLegacyJogressVersion(sourceVersion) && isLegacyJogressVersion(expectedVersion);
}

function findJogressEvolution({
  sourceEntry,
  sourceVersion,
  partnerVersion,
  partnerDigimonId,
}) {
  const partnerBaseId = baseJogressId(partnerDigimonId);
  return (sourceEntry?.evolutions || []).find((evolution) => {
    if (!evolution?.jogress) return false;
    const configuredPartnerId = evolution.jogress.partner;
    const matchesPartner =
      configuredPartnerId === partnerDigimonId ||
      baseJogressId(configuredPartnerId) === partnerBaseId;
    return matchesPartner && isPartnerVersionCompatible(
      evolution.jogress.partnerVersion,
      partnerVersion,
      sourceVersion
    );
  });
}

/**
 * 온라인 조그레스 양쪽 참가자의 버전별 결과를 계산한다.
 * @param {Object} pair
 * @param {string} pair.hostVersion
 * @param {string} pair.hostDigimonId
 * @param {string} pair.guestVersion
 * @param {string} pair.guestDigimonId
 * @param {Object} [options]
 * @param {Function} [options.getDataMapByVersion]
 * @returns {Object}
 */
export function resolveOnlineJogressPair(
  pair,
  options = {}
) {
  const {
    hostVersion,
    hostDigimonId,
    guestVersion,
    guestDigimonId,
  } = pair || {};
  const { getDataMapByVersion = getDigimonDataMapByVersion } = options;
  if (!hostDigimonId || !guestDigimonId) {
    return { success: false, reason: "조그레스 참가자 정보가 올바르지 않습니다." };
  }

  const normalizedHostVersion = normalizeDigimonVersionLabel(hostVersion);
  const normalizedGuestVersion = normalizeDigimonVersionLabel(guestVersion);
  if (
    !SUPPORTED_DIGIMON_VERSIONS.includes(hostVersion) ||
    !SUPPORTED_DIGIMON_VERSIONS.includes(guestVersion)
  ) {
    return { success: false, reason: "지원하지 않는 디지몬 버전입니다." };
  }

  const hostMap = getDataMapByVersion(normalizedHostVersion);
  const guestMap = getDataMapByVersion(normalizedGuestVersion);
  const hostSourceId = resolveDigimonKey(hostMap, hostDigimonId);
  const guestSourceId = resolveDigimonKey(guestMap, guestDigimonId);
  const hostEntry = hostSourceId ? hostMap?.[hostSourceId] : null;
  const guestEntry = guestSourceId ? guestMap?.[guestSourceId] : null;
  if (!hostEntry || !guestEntry) {
    return { success: false, reason: "조그레스 참가 디지몬 데이터를 찾을 수 없습니다." };
  }

  const hostEvolution = findJogressEvolution({
    sourceEntry: hostEntry,
    sourceVersion: normalizedHostVersion,
    partnerVersion: normalizedGuestVersion,
    partnerDigimonId: guestSourceId,
  });
  const guestEvolution = findJogressEvolution({
    sourceEntry: guestEntry,
    sourceVersion: normalizedGuestVersion,
    partnerVersion: normalizedHostVersion,
    partnerDigimonId: hostSourceId,
  });
  if (!hostEvolution || !guestEvolution) {
    return { success: false, reason: "조그레스할 수 있는 버전 또는 디지몬 조합이 아닙니다." };
  }

  const hostTargetId = resolveDigimonKey(
    hostMap,
    hostEvolution.targetId || hostEvolution.targetName
  );
  const guestTargetId = resolveDigimonKey(
    guestMap,
    guestEvolution.targetId || guestEvolution.targetName
  );
  if (!hostTargetId || !guestTargetId) {
    return { success: false, reason: "조그레스 결과 디지몬 데이터를 찾을 수 없습니다." };
  }
  if (baseJogressId(hostTargetId) !== baseJogressId(guestTargetId)) {
    return { success: false, reason: "양쪽 버전의 조그레스 결과가 일치하지 않습니다." };
  }

  return {
    success: true,
    hostVersion: normalizedHostVersion,
    guestVersion: normalizedGuestVersion,
    hostMap,
    guestMap,
    hostSourceId,
    guestSourceId,
    hostTargetId,
    guestTargetId,
    hostEntry,
    guestEntry,
    hostTargetEntry: hostMap[hostTargetId],
    guestTargetEntry: guestMap[guestTargetId],
  };
}

/**
 * 두 디지몬이 조그레스 가능한지 확인하고, **현재 슬롯** 기준 결과 디지몬 ID를 반환한다.
 * Ver.1 블리츠그레이몬 + Ver.2 크레스가루루몬처럼 버전이 달라도, 파트너 이름이 같으면 조그레스 가능.
 *
 * @param {string} currentDigimonId - 현재 슬롯 디지몬 ID (진화하는 쪽)
 * @param {string} partnerDigimonId - 파트너 슬롯 디지몬 ID (사망 처리되는 쪽)
 * @param {Object} currentSlotDataMap - 현재 슬롯 버전의 디지몬 데이터 맵 (evolutions·jogress 포함)
 * @returns {{ success: boolean, targetId?: string, reason?: string }}
 */
export function getJogressResult(currentDigimonId, partnerDigimonId, currentSlotDataMap = {}) {
  if (!currentDigimonId || !partnerDigimonId || !currentSlotDataMap || typeof currentSlotDataMap !== "object") {
    return { success: false, reason: "잘못된 입력입니다." };
  }

  // 호스트 ID가 BlitzGreymonV1 등이어도 v1 맵 키는 BlitzGreymon일 수 있으므로 베이스 ID로 폴백
  let dataA = currentSlotDataMap[currentDigimonId];
  if (!dataA) {
    const baseId = baseJogressId(currentDigimonId);
    dataA = currentSlotDataMap[baseId] || currentSlotDataMap[baseId + "V1"] || currentSlotDataMap[baseId + "V2"];
  }
  if (!dataA) {
    return { success: false, reason: "조그레스할 수 있는 조합이 아닙니다." };
  }

  const partnerBase = baseJogressId(partnerDigimonId);

  // 현재 슬롯 디지몬의 진화 옵션 중, 파트너가 일치하는 조그레스가 있는지 (정확 일치 또는 V2 제거 후 일치)
  const evolutionsA = dataA.evolutions || [];
  for (const evo of evolutionsA) {
    if (!evo.jogress) continue;
    const p = evo.jogress.partner;
    const match = p === partnerDigimonId || baseJogressId(p) === partnerBase;
    if (match) {
      const targetId = evo.targetId || evo.targetName;
      if (targetId) {
        return { success: true, targetId };
      }
    }
  }

  return { success: false, reason: "조그레스할 수 있는 조합이 아닙니다." };
}
