// src/utils/masterDataUtils.js
// 디지몬 마스터 데이터 전역 저장/비교/가져오기 유틸리티

import { digimonDataVer1 } from "../data/v1/digimons";
import { digimonDataVer2 } from "../data/v2modkor";

export const MASTER_DATA_DOC_PATH = {
  collection: "game_settings",
  documentId: "digimon_master_data",
  snapshotSubcollection: "snapshots",
};

export const MASTER_DATA_VERSION_KEY_MAP = {
  "Ver.1": "ver1",
  "Ver.2": "ver2",
};

const MASTER_DATA_VERSION_LABEL_MAP = {
  ver1: "Ver.1",
  ver2: "Ver.2",
};

export const MASTER_DATA_EDITABLE_FIELDS = [
  "name",
  "stage",
  "sprite",
  "spriteBasePath",
  "attackSprite",
  "altAttackSprite",
  "sleepHour",
  "sleepMin",
  "wakeHour",
  "wakeMin",
  "hungerCycle",
  "strengthCycle",
  "poopCycle",
  "healDoses",
  "maxOverfeed",
  "minWeight",
  "maxEnergy",
  "basePower",
  "type",
  "timeToEvolveSeconds",
];

export const MASTER_IMPORT_HEADERS = [
  "id",
  "name",
  "stage",
  "sprite",
  "spriteBasePath",
  "attackSprite",
  "altAttackSprite",
  "sleepHour",
  "sleepMin",
  "wakeHour",
  "wakeMin",
  "hungerCycle",
  "strengthCycle",
  "poopCycle",
  "healDoses",
  "maxOverfeed",
  "minWeight",
  "maxEnergy",
  "basePower",
  "type",
  "timeToEvolveSeconds",
];

const DEFAULT_WAKE_TIME = "08:00";
const DEFAULT_ALT_ATTACK_SPRITE = 65535;
const MASTER_DATA_CACHE_KEY = "d2_tamagotchi_master_data_overrides";

const ORIGINAL_MASTER_DATA = {
  ver1: deepClonePlain(digimonDataVer1),
  ver2: deepClonePlain(digimonDataVer2),
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function deepClonePlain(value) {
  if (Array.isArray(value)) {
    return value.map((item) => deepClonePlain(item));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce((acc, [key, nestedValue]) => {
      acc[key] = deepClonePlain(nestedValue);
      return acc;
    }, {});
  }

  return value;
}

function areEqual(a, b) {
  if (a === b) {
    return true;
  }

  if (a === null && b === undefined) {
    return true;
  }

  if (a === undefined && b === null) {
    return true;
  }

  return false;
}

function mergeDeep(baseValue, overrideValue) {
  if (overrideValue === undefined) {
    return deepClonePlain(baseValue);
  }

  if (Array.isArray(overrideValue)) {
    return deepClonePlain(overrideValue);
  }

  if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
    const merged = deepClonePlain(baseValue);

    Object.entries(overrideValue).forEach(([key, value]) => {
      merged[key] = mergeDeep(baseValue?.[key], value);
    });

    return merged;
  }

  return deepClonePlain(overrideValue);
}

function replaceObjectInPlace(target, source) {
  Object.keys(target).forEach((key) => {
    delete target[key];
  });

  Object.entries(source).forEach(([key, value]) => {
    target[key] = deepClonePlain(value);
  });

  return target;
}

function getMutableMasterDataMap(versionKey) {
  return versionKey === "ver2" ? digimonDataVer2 : digimonDataVer1;
}

function parseInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNullableInteger(value, fallback = null) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getMasterDataVersionKey(versionLabel = "Ver.1") {
  return MASTER_DATA_VERSION_KEY_MAP[versionLabel] || "ver1";
}

export function getMasterDataVersionLabel(versionKey = "ver1") {
  return MASTER_DATA_VERSION_LABEL_MAP[versionKey] || "Ver.1";
}

export function getCurrentMasterDataMap(versionLabel = "Ver.1") {
  return getMasterDataVersionKey(versionLabel) === "ver2"
    ? digimonDataVer2
    : digimonDataVer1;
}

export function getOriginalMasterDataMap(versionLabel = "Ver.1") {
  return ORIGINAL_MASTER_DATA[getMasterDataVersionKey(versionLabel)];
}

export function normalizeMasterDataOverrides(rawOverrides = {}) {
  const ver1 = rawOverrides.ver1Overrides || rawOverrides.ver1 || {};
  const ver2 = rawOverrides.ver2Overrides || rawOverrides.ver2 || {};

  return {
    ver1: isPlainObject(ver1) ? deepClonePlain(ver1) : {},
    ver2: isPlainObject(ver2) ? deepClonePlain(ver2) : {},
  };
}

export function readCachedMasterDataOverrides() {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ver1: {}, ver2: {} };
  }

  try {
    const raw = window.localStorage.getItem(MASTER_DATA_CACHE_KEY);
    if (!raw) {
      return { ver1: {}, ver2: {} };
    }

    return normalizeMasterDataOverrides(JSON.parse(raw));
  } catch (error) {
    console.warn("[masterDataUtils] 캐시된 마스터 데이터 로드 실패:", error);
    return { ver1: {}, ver2: {} };
  }
}

export function writeCachedMasterDataOverrides(overrides = {}) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    const normalized = normalizeMasterDataOverrides(overrides);
    window.localStorage.setItem(MASTER_DATA_CACHE_KEY, JSON.stringify(normalized));
  } catch (error) {
    console.warn("[masterDataUtils] 캐시된 마스터 데이터 저장 실패:", error);
  }
}

export function applyMasterDataOverrides(overrides = {}) {
  const normalized = normalizeMasterDataOverrides(overrides);

  ["ver1", "ver2"].forEach((versionKey) => {
    const originalMap = ORIGINAL_MASTER_DATA[versionKey];
    const mergedMap = deepClonePlain(originalMap);
    const versionOverrides = normalized[versionKey] || {};

    Object.entries(versionOverrides).forEach(([digimonId, overrideValue]) => {
      if (!mergedMap[digimonId]) {
        return;
      }

      mergedMap[digimonId] = mergeDeep(mergedMap[digimonId], overrideValue);
    });

    replaceObjectInPlace(getMutableMasterDataMap(versionKey), mergedMap);
  });

  return normalized;
}

function normalizeTimeComponent(value) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  return String(parsed);
}

function normalizeMinuteString(value) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  return String(parsed).padStart(2, "0");
}

export function normalizeTimeString(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    return trimmed;
  }

  const hour = Math.max(0, Math.min(23, Number.parseInt(match[1], 10)));
  const minute = Math.max(0, Math.min(59, Number.parseInt(match[2], 10)));

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function splitTimeString(value) {
  const normalized = normalizeTimeString(value);

  if (!normalized) {
    return { hour: "", minute: "" };
  }

  const [hour, minute] = normalized.split(":");
  return {
    hour: String(Number.parseInt(hour, 10)),
    minute,
  };
}

export function buildTimeString(hourValue, minuteValue) {
  const hour = normalizeTimeComponent(hourValue);
  const minute = normalizeMinuteString(minuteValue);

  if (hour === "" || minute === "") {
    return null;
  }

  const clampedHour = Math.max(0, Math.min(23, Number.parseInt(hour, 10)));
  const clampedMinute = Math.max(0, Math.min(59, Number.parseInt(minute, 10)));

  return `${String(clampedHour).padStart(2, "0")}:${String(clampedMinute).padStart(2, "0")}`;
}

function getDigimonWakeTime(digimon) {
  if (!digimon?.stats?.sleepTime) {
    return null;
  }

  return normalizeTimeString(digimon?.stats?.wakeTime) || DEFAULT_WAKE_TIME;
}

export function createSleepScheduleFromTimes(sleepTime, wakeTime) {
  const normalizedSleepTime = normalizeTimeString(sleepTime);
  const normalizedWakeTime = normalizeTimeString(wakeTime);

  if (!normalizedSleepTime || !normalizedWakeTime) {
    return null;
  }

  const [startHour, startMinute] = normalizedSleepTime.split(":").map(Number);
  const [endHour, endMinute] = normalizedWakeTime.split(":").map(Number);

  return {
    start: startHour,
    end: endHour,
    startMinute,
    endMinute,
    startTime: normalizedSleepTime,
    endTime: normalizedWakeTime,
  };
}

function getNormalizedDigimonData(digimonId, versionLabel = "Ver.1", source = "current") {
  const dataMap =
    source === "original"
      ? getOriginalMasterDataMap(versionLabel)
      : getCurrentMasterDataMap(versionLabel);
  const digimon = dataMap?.[digimonId];

  if (!digimon) {
    return null;
  }

  const sleepParts = splitTimeString(digimon?.stats?.sleepTime);
  const wakeParts = splitTimeString(getDigimonWakeTime(digimon));

  return {
    id: digimon?.id || digimonId,
    name: digimon?.name || digimonId,
    stage: digimon?.stage || "",
    sprite: String(digimon?.sprite ?? 0),
    spriteBasePath: digimon?.spriteBasePath || "",
    attackSprite:
      digimon?.stats?.attackSprite === null ||
      digimon?.stats?.attackSprite === undefined
        ? ""
        : String(digimon.stats.attackSprite),
    altAttackSprite: String(
      digimon?.stats?.altAttackSprite ?? DEFAULT_ALT_ATTACK_SPRITE
    ),
    sleepHour: sleepParts.hour,
    sleepMin: sleepParts.minute,
    wakeHour: wakeParts.hour,
    wakeMin: wakeParts.minute,
    hungerCycle: String(digimon?.stats?.hungerCycle ?? 0),
    strengthCycle: String(digimon?.stats?.strengthCycle ?? 0),
    poopCycle: String(digimon?.stats?.poopCycle ?? 0),
    healDoses: String(digimon?.stats?.healDoses ?? 0),
    maxOverfeed: String(digimon?.stats?.maxOverfeed ?? 0),
    minWeight: String(digimon?.stats?.minWeight ?? 0),
    maxEnergy: String(digimon?.stats?.maxEnergy ?? 0),
    basePower: String(digimon?.stats?.basePower ?? 0),
    type: digimon?.stats?.type || "",
    timeToEvolveSeconds: String(
      digimon?.evolutionCriteria?.timeToEvolveSeconds ?? 0
    ),
  };
}

export function buildMasterRowDraft(digimonId, versionLabel = "Ver.1", source = "current") {
  return getNormalizedDigimonData(digimonId, versionLabel, source);
}

function buildFullDigimonCandidateFromDraft(draft, versionLabel = "Ver.1") {
  const originalData = getOriginalMasterDataMap(versionLabel)?.[draft?.id] || {};
  const sleepTime = buildTimeString(draft?.sleepHour, draft?.sleepMin);
  const wakeTime = buildTimeString(draft?.wakeHour, draft?.wakeMin);

  return {
    name: String(draft?.name || originalData?.name || draft?.id || "").trim(),
    stage: String(draft?.stage || originalData?.stage || "").trim(),
    sprite: parseInteger(draft?.sprite, originalData?.sprite ?? 0),
    ...(draft?.spriteBasePath || originalData?.spriteBasePath
      ? {
          spriteBasePath:
            String(draft?.spriteBasePath || "").trim() ||
            originalData?.spriteBasePath ||
            "",
        }
      : {}),
    stats: {
      hungerCycle: parseInteger(
        draft?.hungerCycle,
        originalData?.stats?.hungerCycle ?? 0
      ),
      strengthCycle: parseInteger(
        draft?.strengthCycle,
        originalData?.stats?.strengthCycle ?? 0
      ),
      poopCycle: parseInteger(
        draft?.poopCycle,
        originalData?.stats?.poopCycle ?? 0
      ),
      maxOverfeed: parseInteger(
        draft?.maxOverfeed,
        originalData?.stats?.maxOverfeed ?? 0
      ),
      maxEnergy: parseInteger(
        draft?.maxEnergy,
        originalData?.stats?.maxEnergy ?? 0
      ),
      minWeight: parseInteger(
        draft?.minWeight,
        originalData?.stats?.minWeight ?? 0
      ),
      healDoses: parseInteger(
        draft?.healDoses,
        originalData?.stats?.healDoses ?? 0
      ),
      basePower: parseInteger(
        draft?.basePower,
        originalData?.stats?.basePower ?? 0
      ),
      type:
        String(draft?.type || "").trim() ||
        originalData?.stats?.type ||
        null,
      sleepTime,
      wakeTime,
      attackSprite: parseNullableInteger(
        draft?.attackSprite,
        originalData?.stats?.attackSprite ?? null
      ),
      altAttackSprite: parseNullableInteger(
        draft?.altAttackSprite,
        originalData?.stats?.altAttackSprite ?? DEFAULT_ALT_ATTACK_SPRITE
      ),
    },
    evolutionCriteria: {
      timeToEvolveSeconds: parseInteger(
        draft?.timeToEvolveSeconds,
        originalData?.evolutionCriteria?.timeToEvolveSeconds ?? 0
      ),
    },
  };
}

function buildMinimalOverride(baseValue, candidateValue) {
  if (isPlainObject(baseValue) && isPlainObject(candidateValue)) {
    const result = {};

    Object.entries(candidateValue).forEach(([key, value]) => {
      const diff = buildMinimalOverride(baseValue?.[key], value);
      if (diff !== undefined) {
        result[key] = diff;
      }
    });

    return Object.keys(result).length ? result : undefined;
  }

  if (Array.isArray(candidateValue)) {
    return JSON.stringify(baseValue) === JSON.stringify(candidateValue)
      ? undefined
      : deepClonePlain(candidateValue);
  }

  return areEqual(baseValue, candidateValue)
    ? undefined
    : deepClonePlain(candidateValue);
}

export function buildMasterRowOverrideFromDraft(draft, versionLabel = "Ver.1") {
  const baseData = getOriginalMasterDataMap(versionLabel)?.[draft?.id];

  if (!baseData) {
    return null;
  }

  const fullCandidate = buildFullDigimonCandidateFromDraft(draft, versionLabel);
  return buildMinimalOverride(baseData, fullCandidate) || null;
}

export function getChangedFieldKeysBetweenDrafts(baseDraft, currentDraft) {
  if (!baseDraft || !currentDraft) {
    return [];
  }

  return MASTER_DATA_EDITABLE_FIELDS.filter(
    (field) => !areEqual(baseDraft?.[field], currentDraft?.[field])
  );
}

export function getMasterRowComparison(digimonId, versionLabel = "Ver.1") {
  const baseDraft = buildMasterRowDraft(digimonId, versionLabel, "original");
  const currentDraft = buildMasterRowDraft(digimonId, versionLabel, "current");

  return {
    baseDraft,
    currentDraft,
    changedFieldKeys: getChangedFieldKeysBetweenDrafts(baseDraft, currentDraft),
  };
}

export function buildMasterTableRows(versionLabel = "Ver.1") {
  const dataMap = getCurrentMasterDataMap(versionLabel);
  const stageCodeMap = {
    "Baby I": 0,
    "Baby II": 1,
    Child: 2,
    Adult: 3,
    Perfect: 4,
    Ultimate: 5,
    "Super Ultimate": 6,
    Digitama: -1,
    Ohakadamon: 99,
  };
  const attributeCodeMap = {
    Free: 0,
    Data: 1,
    Virus: 2,
    Vaccine: 3,
  };

  return Object.entries(dataMap).map(([digimonId, digimon], index) => {
    const { changedFieldKeys } = getMasterRowComparison(digimonId, versionLabel);
    const wakeTime = getDigimonWakeTime(digimon);
    const sleepParts = splitTimeString(digimon?.stats?.sleepTime);
    const wakeParts = splitTimeString(wakeTime);
    const altAttackSprite =
      digimon?.stats?.altAttackSprite ?? DEFAULT_ALT_ATTACK_SPRITE;

    return {
      order: index,
      id: digimonId,
      displayId: index,
      name: digimon?.name || digimonId,
      stage: digimon?.stage || "",
      stageCode: stageCodeMap[digimon?.stage] ?? -1,
      sprite: digimon?.sprite ?? 0,
      spriteSrc: getDigimonSpriteSrc(digimon),
      attackSprite: digimon?.stats?.attackSprite ?? digimon?.sprite ?? 0,
      attackSpriteSrc: getDigimonAttackSpriteSrc(digimon),
      altAttackSprite,
      altAttackSpriteSrc:
        altAttackSprite === DEFAULT_ALT_ATTACK_SPRITE
          ? null
          : `/images/${altAttackSprite}.png`,
      hungerCycle: digimon?.stats?.hungerCycle ?? 0,
      strengthCycle: digimon?.stats?.strengthCycle ?? 0,
      poopCycle: digimon?.stats?.poopCycle ?? 0,
      maxOverfeed: digimon?.stats?.maxOverfeed ?? 0,
      maxEnergy: digimon?.stats?.maxEnergy ?? 0,
      minWeight: digimon?.stats?.minWeight ?? 0,
      healDoses: digimon?.stats?.healDoses ?? 0,
      basePower: digimon?.stats?.basePower ?? 0,
      type: digimon?.stats?.type || "",
      attributeCode: attributeCodeMap[digimon?.stats?.type] ?? 0,
      sleepTime: normalizeTimeString(digimon?.stats?.sleepTime) || "",
      sleepHour: sleepParts.hour || "",
      sleepMin: sleepParts.minute || "",
      wakeTime: wakeTime || "",
      wakeHour: wakeParts.hour || "",
      wakeMin: wakeParts.minute || "",
      timeToEvolveSeconds:
        digimon?.evolutionCriteria?.timeToEvolveSeconds ?? 0,
      timeToEvolveMinutes: Math.floor(
        (digimon?.evolutionCriteria?.timeToEvolveSeconds ?? 0) / 60
      ),
      changedFieldCount: changedFieldKeys.length,
    };
  });
}

export function getDigimonSpriteSrc(digimon) {
  const spriteBasePath = digimon?.spriteBasePath || "/images";
  const sprite = digimon?.sprite ?? 0;
  return `${spriteBasePath}/${sprite}.png`;
}

export function getDigimonAttackSpriteSrc(digimon) {
  const attackSprite = digimon?.stats?.attackSprite ?? digimon?.sprite ?? 0;
  return `/images/${attackSprite}.png`;
}

export function getMasterDataSnapshotForSync(versionLabel = "Ver.1", digimonId) {
  const digimon = getCurrentMasterDataMap(versionLabel)?.[digimonId];
  const wakeTime = getDigimonWakeTime(digimon);

  if (!digimon) {
    return null;
  }

  return {
    digimonId,
    versionLabel,
    sprite: digimon?.sprite ?? 0,
    hungerTimer: digimon?.stats?.hungerCycle ?? 0,
    strengthTimer: digimon?.stats?.strengthCycle ?? 0,
    poopTimer: digimon?.stats?.poopCycle ?? 0,
    maxOverfeed: digimon?.stats?.maxOverfeed ?? 0,
    minWeight: digimon?.stats?.minWeight ?? 0,
    maxEnergy: digimon?.stats?.maxEnergy ?? 0,
    basePower: digimon?.stats?.basePower ?? 0,
    attackSprite: digimon?.stats?.attackSprite ?? digimon?.sprite ?? 0,
    altAttackSprite:
      digimon?.stats?.altAttackSprite ?? DEFAULT_ALT_ATTACK_SPRITE,
    type: digimon?.stats?.type ?? null,
    sleepTime: normalizeTimeString(digimon?.stats?.sleepTime) ?? null,
    wakeTime: wakeTime ?? null,
    sleepSchedule: createSleepScheduleFromTimes(digimon?.stats?.sleepTime, wakeTime),
    timeToEvolveSeconds:
      digimon?.evolutionCriteria?.timeToEvolveSeconds ?? 0,
  };
}

export function formatMasterTimestamp(value) {
  if (!value) {
    return "기록 없음";
  }

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : value instanceof Date
      ? value
      : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "기록 없음";
  }

  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export function formatDraftTime(hour, minute) {
  const built = buildTimeString(hour, minute);
  return built || "미설정";
}

export function getChangedDigimonIdsBetweenOverrides(beforeOverrides, afterOverrides) {
  const normalizedBefore = normalizeMasterDataOverrides(beforeOverrides);
  const normalizedAfter = normalizeMasterDataOverrides(afterOverrides);

  const buildChangedIds = (versionKey) => {
    const beforeIds = Object.keys(normalizedBefore[versionKey] || {});
    const afterIds = Object.keys(normalizedAfter[versionKey] || {});
    const allIds = Array.from(new Set([...beforeIds, ...afterIds]));

    return allIds.filter((digimonId) => {
      const beforeValue = normalizedBefore[versionKey]?.[digimonId];
      const afterValue = normalizedAfter[versionKey]?.[digimonId];
      return JSON.stringify(beforeValue || null) !== JSON.stringify(afterValue || null);
    });
  };

  const ver1Ids = buildChangedIds("ver1");
  const ver2Ids = buildChangedIds("ver2");

  return {
    ver1: ver1Ids,
    ver2: ver2Ids,
    totalCount: ver1Ids.length + ver2Ids.length,
  };
}

export function getChangedFieldSummaryForDigimon(versionLabel, digimonId) {
  const { changedFieldKeys } = getMasterRowComparison(digimonId, versionLabel);
  return changedFieldKeys;
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((item) => item.trim());
}

function normalizeImportedRow(rawRow, versionLabel = "Ver.1") {
  const digimonId = rawRow.id || rawRow.digimonId || rawRow.ID;
  if (!digimonId) {
    return null;
  }

  const baseDraft = buildMasterRowDraft(digimonId, versionLabel, "current");
  if (!baseDraft) {
    return null;
  }

  const imported = { ...rawRow };

  if (imported.sleepTime && (imported.sleepHour === undefined || imported.sleepMin === undefined)) {
    const parts = splitTimeString(imported.sleepTime);
    imported.sleepHour = parts.hour;
    imported.sleepMin = parts.minute;
  }

  if (imported.wakeTime && (imported.wakeHour === undefined || imported.wakeMin === undefined)) {
    const parts = splitTimeString(imported.wakeTime);
    imported.wakeHour = parts.hour;
    imported.wakeMin = parts.minute;
  }

  const nextDraft = { ...baseDraft };

  Object.entries(imported).forEach(([key, value]) => {
    if (key === "evoTime") {
      nextDraft.timeToEvolveSeconds = String(value);
      return;
    }

    if (key === "power") {
      nextDraft.basePower = String(value);
      return;
    }

    if (key === "healAmount") {
      nextDraft.healDoses = String(value);
      return;
    }

    if (key in nextDraft) {
      nextDraft[key] = value === null || value === undefined ? "" : String(value);
    }
  });

  nextDraft.id = digimonId;
  return nextDraft;
}

export function parseMasterDataImportText(text, format = "json", versionLabel = "Ver.1") {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return [];
  }

  let rawRows = [];

  if (format === "csv") {
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return [];
    }

    const headers = parseCsvLine(lines[0]);
    rawRows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      return headers.reduce((acc, header, index) => {
        acc[header] = values[index] ?? "";
        return acc;
      }, {});
    });
  } else {
    const parsed = JSON.parse(trimmed);

    if (Array.isArray(parsed)) {
      rawRows = parsed;
    } else if (Array.isArray(parsed?.rows)) {
      rawRows = parsed.rows;
    } else if (isPlainObject(parsed)) {
      rawRows = Object.entries(parsed).map(([id, value]) => ({
        id,
        ...(isPlainObject(value) ? value : {}),
      }));
    }
  }

  return rawRows
    .map((row) => normalizeImportedRow(row, versionLabel))
    .filter(Boolean);
}

export function formatSnapshotAction(actionType) {
  switch (actionType) {
    case "save_row":
      return "행 저장";
    case "import_rows":
      return "일괄 가져오기";
    case "reset_row":
      return "행 기본 복원";
    case "reset_all":
      return "전체 기본 복원";
    case "restore_snapshot":
      return "스냅샷 되돌리기";
    default:
      return "저장";
  }
}
