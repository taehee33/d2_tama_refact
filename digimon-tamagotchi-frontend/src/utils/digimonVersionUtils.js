import { digimonDataVer1 } from "../data/v1/digimons";
import { digimonDataVer2, V2_SPRITE_BASE } from "../data/v2modkor";
import { digimonDataVer3, V3_SPRITE_BASE } from "../data/v3";
import { digimonDataVer4, V4_SPRITE_BASE } from "../data/v4";
import { digimonDataVer5, V5_SPRITE_BASE } from "../data/v5";

const VERSION_CONFIGS = {
  "Ver.1": {
    key: "ver1",
    label: "Ver.1",
    starterId: "Digitama",
    deathFormIds: ["Ohakadamon1", "Ohakadamon2"],
    spriteBasePath: "/images",
    dataMap: digimonDataVer1,
  },
  "Ver.2": {
    key: "ver2",
    label: "Ver.2",
    starterId: "DigitamaV2",
    deathFormIds: ["Ohakadamon1V2", "Ohakadamon2V2"],
    spriteBasePath: V2_SPRITE_BASE,
    dataMap: digimonDataVer2,
  },
  "Ver.3": {
    key: "ver3",
    label: "Ver.3",
    starterId: "DigitamaV3",
    deathFormIds: ["Ohakadamon1V3", "Ohakadamon2V3"],
    spriteBasePath: V3_SPRITE_BASE,
    dataMap: digimonDataVer3,
  },
  "Ver.4": {
    key: "ver4",
    label: "Ver.4",
    starterId: "DigitamaV4",
    deathFormIds: ["Ohakadamon1V4", "Ohakadamon2V4"],
    spriteBasePath: V4_SPRITE_BASE,
    dataMap: digimonDataVer4,
  },
  "Ver.5": {
    key: "ver5",
    label: "Ver.5",
    starterId: "DigitamaV5",
    deathFormIds: ["Ohakadamon1V5", "Ohakadamon2V5"],
    spriteBasePath: V5_SPRITE_BASE,
    dataMap: digimonDataVer5,
  },
};

export const SUPPORTED_DIGIMON_VERSIONS = Object.freeze(
  Object.keys(VERSION_CONFIGS)
);

export const SUPPORTED_MASTER_DATA_VERSION_KEYS = Object.freeze(
  SUPPORTED_DIGIMON_VERSIONS.map((version) => VERSION_CONFIGS[version].key)
);

export const STARTER_DIGIMON_IDS = Object.freeze(
  SUPPORTED_DIGIMON_VERSIONS.map((version) => VERSION_CONFIGS[version].starterId)
);

export function normalizeDigimonVersionLabel(version = "Ver.1") {
  return VERSION_CONFIGS[version] ? version : "Ver.1";
}

export function getDigimonVersionConfig(version = "Ver.1") {
  return VERSION_CONFIGS[normalizeDigimonVersionLabel(version)];
}

export function getDigimonVersionKey(version = "Ver.1") {
  return getDigimonVersionConfig(version).key;
}

export function getDigimonVersionLabelByKey(versionKey = "ver1") {
  const entry = Object.values(VERSION_CONFIGS).find(
    (config) => config.key === versionKey
  );
  return entry?.label || "Ver.1";
}

export function getDigimonDataMapByVersion(version = "Ver.1") {
  return getDigimonVersionConfig(version).dataMap;
}

export function getStarterDigimonId(version = "Ver.1") {
  return getDigimonVersionConfig(version).starterId;
}

export function getStarterDigimonIdFromDataMap(dataMap = {}) {
  return (
    STARTER_DIGIMON_IDS.find((starterId) => dataMap?.[starterId]) || "Digitama"
  );
}

export function isStarterDigimonId(digimonId) {
  return STARTER_DIGIMON_IDS.includes(digimonId);
}

export function getDeathFormIds(version = "Ver.1") {
  return [...getDigimonVersionConfig(version).deathFormIds];
}

export function isDeathFormDigimonId(digimonId) {
  return SUPPORTED_DIGIMON_VERSIONS.some((version) =>
    VERSION_CONFIGS[version].deathFormIds.includes(digimonId)
  );
}

export function getSpriteBasePathByVersion(version = "Ver.1") {
  return getDigimonVersionConfig(version).spriteBasePath;
}

export function getDigimonVersionByDigimonId(digimonId) {
  if (!digimonId) {
    return "Ver.1";
  }

  const matchedVersion = SUPPORTED_DIGIMON_VERSIONS.find((version) =>
    Boolean(getDigimonDataMapByVersion(version)?.[digimonId])
  );

  return matchedVersion || "Ver.1";
}

export function getDigimonEntryByVersion(version = "Ver.1", digimonId) {
  if (!digimonId) {
    return null;
  }

  return getDigimonDataMapByVersion(version)?.[digimonId] || null;
}

export function getDigimonDataMapsByPreference(version = "Ver.1") {
  const normalizedVersion = normalizeDigimonVersionLabel(version);

  return [
    getDigimonDataMapByVersion(normalizedVersion),
    ...SUPPORTED_DIGIMON_VERSIONS.filter(
      (label) => label !== normalizedVersion
    ).map((label) => getDigimonDataMapByVersion(label)),
  ].filter(Boolean);
}

export function findDigimonEntryAcrossVersions(
  digimonId,
  preferredVersion = "Ver.1"
) {
  if (!digimonId) {
    return null;
  }

  return (
    getDigimonDataMapsByPreference(preferredVersion)
      .map((dataMap) => {
        if (!dataMap) {
          return null;
        }

        if (dataMap[digimonId]) {
          return dataMap[digimonId];
        }

        return (
          Object.values(dataMap).find((entry) => entry?.id === digimonId) || null
        );
      })
      .find(Boolean) || null
  );
}
