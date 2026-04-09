import {
  SUPPORTED_DIGIMON_VERSIONS,
  getDigimonDataMapByVersion,
} from "./digimonVersionUtils";

function normalizeJogressMeta(jogressOrPartner) {
  if (!jogressOrPartner) {
    return {
      partner: "",
      partnerName: "",
      partnerVersion: "",
    };
  }

  if (typeof jogressOrPartner === "string") {
    return {
      partner: jogressOrPartner,
      partnerName: "",
      partnerVersion: "",
    };
  }

  return {
    partner: jogressOrPartner.partner || "",
    partnerName: jogressOrPartner.partnerName || "",
    partnerVersion: jogressOrPartner.partnerVersion || "",
  };
}

function stripCrossVersionSuffix(id) {
  if (typeof id !== "string") {
    return "";
  }

  return id.replace(/V1$/i, "").replace(/V2$/i, "");
}

function findDigimonEntryInMap(digimonId, dataMap) {
  if (!digimonId || !dataMap || typeof dataMap !== "object") {
    return null;
  }

  if (dataMap[digimonId]) {
    return dataMap[digimonId];
  }

  const baseId = stripCrossVersionSuffix(digimonId);
  if (dataMap[baseId]) {
    return dataMap[baseId];
  }

  if (dataMap[`${baseId}V1`]) {
    return dataMap[`${baseId}V1`];
  }

  if (dataMap[`${baseId}V2`]) {
    return dataMap[`${baseId}V2`];
  }

  return (
    Object.values(dataMap).find(
      (entry) => stripCrossVersionSuffix(entry?.id) === baseId
    ) || null
  );
}

function getSupportedDigimonMaps(extraMaps = []) {
  return [
    ...extraMaps,
    ...SUPPORTED_DIGIMON_VERSIONS.map((version) =>
      getDigimonDataMapByVersion(version)
    ),
  ].filter(Boolean);
}

export function isJogressPartnerSupportedInApp(
  jogressOrPartner,
  extraMaps = []
) {
  const meta = normalizeJogressMeta(jogressOrPartner);
  if (!meta.partner) {
    return false;
  }

  return getSupportedDigimonMaps(extraMaps).some((dataMap) =>
    Boolean(findDigimonEntryInMap(meta.partner, dataMap))
  );
}

export function getJogressPartnerDisplayName(
  jogressOrPartner,
  slotVersion = "Ver.1",
  extraMaps = []
) {
  const meta = normalizeJogressMeta(jogressOrPartner);
  if (!meta.partner) {
    return "";
  }

  if (meta.partnerName) {
    const hasVersionSuffix =
      meta.partnerVersion &&
      meta.partnerName.toLowerCase().includes(meta.partnerVersion.toLowerCase());

    return hasVersionSuffix || !meta.partnerVersion
      ? meta.partnerName
      : `${meta.partnerName} ${meta.partnerVersion}`;
  }

  if (meta.partnerVersion) {
    const partnerMap = getDigimonDataMapByVersion(meta.partnerVersion);
    const partnerEntry = findDigimonEntryInMap(meta.partner, partnerMap);
    const baseName = partnerEntry?.name || partnerEntry?.id;

    if (baseName) {
      return baseName.toLowerCase().includes(meta.partnerVersion.toLowerCase())
        ? baseName
        : `${baseName} ${meta.partnerVersion}`;
    }
  }

  if (!meta.partnerVersion && /V[12]$/i.test(meta.partner)) {
    const suffixVersion = /V2$/i.test(meta.partner) ? "Ver.2" : "Ver.1";
    const suffixMap = getDigimonDataMapByVersion(suffixVersion);
    const suffixEntry = findDigimonEntryInMap(meta.partner, suffixMap);
    const baseName = suffixEntry?.name || suffixEntry?.id;

    if (baseName) {
      return baseName.toLowerCase().includes(suffixVersion.toLowerCase())
        ? baseName
        : `${baseName} ${suffixVersion}`;
    }
  }

  const supportedEntry = getSupportedDigimonMaps(extraMaps)
    .map((dataMap) => findDigimonEntryInMap(meta.partner, dataMap))
    .find(Boolean);

  return supportedEntry?.name || supportedEntry?.id || meta.partner;
}

export function getJogressSupportMessage(jogressOrPartner, extraMaps = []) {
  const meta = normalizeJogressMeta(jogressOrPartner);

  if (isJogressPartnerSupportedInApp(meta, extraMaps)) {
    const normalizedPartnerVersion = meta.partnerVersion || "";
    if (normalizedPartnerVersion === "Ver.1" || normalizedPartnerVersion === "Ver.2") {
      return "현재 앱에서 조그레스 진화로 진행할 수 있습니다.";
    }

    return "현재 앱에서 로컬 조그레스로 진행할 수 있습니다. 온라인 조그레스는 Ver.1/Ver.2만 지원합니다.";
  }

  if (meta.partnerVersion) {
    return `조그레스 진화 정보입니다. 현재 앱에 ${meta.partnerVersion} 파트너가 추가되면 실제 조그레스를 진행할 수 있습니다.`;
  }

  return "조그레스 진화 정보입니다. 현재 앱에서는 이 파트너 조합을 바로 사용할 수 없습니다.";
}
