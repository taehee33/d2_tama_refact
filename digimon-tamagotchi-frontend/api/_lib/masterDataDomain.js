"use strict";

const crypto = require("node:crypto");
const { getDigimonDataMapByVersion } = require("../_generated/gameProjection.cjs");

const MASTER_DATA_VERSION_CONFIGS = Object.freeze([
  Object.freeze({ key: "ver1", label: "Ver.1" }),
  Object.freeze({ key: "ver2", label: "Ver.2" }),
  Object.freeze({ key: "ver3", label: "Ver.3" }),
  Object.freeze({ key: "ver4", label: "Ver.4" }),
  Object.freeze({ key: "ver5", label: "Ver.5" }),
]);
const MASTER_DATA_VERSION_KEYS = Object.freeze(
  MASTER_DATA_VERSION_CONFIGS.map((entry) => entry.key)
);
const MASTER_DATA_ACTION_TYPES = Object.freeze([
  "save_row",
  "import_rows",
  "reset_row",
  "reset_all",
]);
const MAX_MASTER_DATA_REQUEST_BYTES = 350_000;
const MAX_MASTER_DATA_SNAPSHOT_BYTES = 900_000;
const MAX_NOTE_LENGTH = 500;
const MAX_REQUEST_ID_LENGTH = 120;

const TOP_LEVEL_RULES = Object.freeze({
  name: { kind: "string", minLength: 1, maxLength: 80 },
  stage: { kind: "string", minLength: 1, maxLength: 40 },
  sprite: { kind: "integer", minimum: 0, maximum: 100_000 },
  spriteBasePath: { kind: "string", minLength: 0, maxLength: 180 },
});
const STATS_RULES = Object.freeze({
  hungerCycle: { kind: "integer", minimum: 0, maximum: 100_000 },
  strengthCycle: { kind: "integer", minimum: 0, maximum: 100_000 },
  poopCycle: { kind: "integer", minimum: 0, maximum: 100_000 },
  healDoses: { kind: "integer", minimum: 0, maximum: 100_000 },
  maxOverfeed: { kind: "integer", minimum: 0, maximum: 100_000 },
  minWeight: { kind: "integer", minimum: 0, maximum: 100_000 },
  maxEnergy: { kind: "integer", minimum: 0, maximum: 100_000 },
  basePower: { kind: "integer", minimum: 0, maximum: 100_000 },
  attackSprite: {
    kind: "nullableInteger",
    minimum: 0,
    maximum: 100_000,
  },
  altAttackSprite: {
    kind: "nullableInteger",
    minimum: 0,
    maximum: 100_000,
  },
  sleepTime: { kind: "nullableTime" },
  wakeTime: { kind: "nullableTime" },
  type: { kind: "enum", values: ["Free", "Data", "Virus", "Vaccine"] },
});
const EVOLUTION_RULES = Object.freeze({
  timeToEvolveSeconds: {
    kind: "integer",
    minimum: 0,
    maximum: 315_360_000,
  },
});

class MasterDataError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message || "마스터 데이터 요청을 처리하지 못했습니다.");
    this.name = "MasterDataError";
    this.code = code || "MASTER_DATA_INVALID_REQUEST";
    this.status = status;
    this.details = details;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function normalizeRequiredString(value, fieldName, maxLength) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength) {
    throw new MasterDataError(
      "MASTER_DATA_INVALID_REQUEST",
      `${fieldName} 값이 올바르지 않습니다.`
    );
  }
  return normalized;
}

function normalizeOptionalString(value, fieldName, maxLength) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength) {
    throw new MasterDataError(
      "MASTER_DATA_INVALID_REQUEST",
      `${fieldName} 값이 올바르지 않습니다.`
    );
  }
  return normalized;
}

function normalizeExpectedRevision(value) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new MasterDataError(
      "MASTER_DATA_INVALID_REQUEST",
      "expectedRevision 값이 올바르지 않습니다."
    );
  }
  return value;
}

function normalizeCanonicalValue(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeCanonicalValue);
  }
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) {
          result[key] = normalizeCanonicalValue(value[key]);
        }
        return result;
      }, {});
  }
  return value;
}

function sha256Base64Url(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("base64url");
}

function createCanonicalHash(value) {
  return sha256Base64Url(JSON.stringify(normalizeCanonicalValue(value)));
}

function createMasterDataSnapshotId({ operatorUid, action, requestId }) {
  const uid = normalizeRequiredString(operatorUid, "operatorUid", 160);
  const normalizedAction = normalizeRequiredString(action, "action", 80);
  const normalizedRequestId = normalizeRequiredString(
    requestId,
    "requestId",
    MAX_REQUEST_ID_LENGTH
  );
  return `master_${sha256Base64Url(
    `master-data-receipt-v1\0${uid}\0${normalizedAction}\0${normalizedRequestId}`
  )}`;
}

function normalizeRuleValue(value, rule, fieldPath) {
  if (rule.kind === "string") {
    if (typeof value !== "string") {
      throw new MasterDataError(
        "MASTER_DATA_INVALID_REQUEST",
        `${fieldPath} 값은 문자열이어야 합니다.`
      );
    }
    const normalized = value.trim();
    if (
      normalized.length < rule.minLength ||
      normalized.length > rule.maxLength
    ) {
      throw new MasterDataError(
        "MASTER_DATA_INVALID_REQUEST",
        `${fieldPath} 문자열 길이가 올바르지 않습니다.`
      );
    }
    return normalized;
  }

  if (rule.kind === "integer" || rule.kind === "nullableInteger") {
    if (rule.kind === "nullableInteger" && value === null) {
      return null;
    }
    if (
      !Number.isInteger(value) ||
      value < rule.minimum ||
      value > rule.maximum
    ) {
      throw new MasterDataError(
        "MASTER_DATA_INVALID_REQUEST",
        `${fieldPath} 숫자 범위가 올바르지 않습니다.`
      );
    }
    return value;
  }

  if (rule.kind === "nullableTime") {
    if (value === null) {
      return null;
    }
    if (
      typeof value !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ) {
      throw new MasterDataError(
        "MASTER_DATA_INVALID_REQUEST",
        `${fieldPath} 시간 형식이 올바르지 않습니다.`
      );
    }
    return value;
  }

  if (rule.kind === "enum") {
    if (!rule.values.includes(value)) {
      throw new MasterDataError(
        "MASTER_DATA_INVALID_REQUEST",
        `${fieldPath} 값이 허용 목록에 없습니다.`
      );
    }
    return value;
  }

  throw new MasterDataError(
    "MASTER_DATA_INVALID_REQUEST",
    `${fieldPath} 검증 규칙을 찾을 수 없습니다.`
  );
}

function normalizeAllowedObject(value, rules, fieldPath) {
  if (!isPlainObject(value)) {
    throw new MasterDataError(
      "MASTER_DATA_INVALID_REQUEST",
      `${fieldPath} 값은 객체여야 합니다.`
    );
  }

  const unknownKeys = Object.keys(value).filter((key) => !rules[key]);
  if (unknownKeys.length) {
    throw new MasterDataError(
      "MASTER_DATA_FIELD_NOT_ALLOWED",
      `${fieldPath}에 허용되지 않은 필드가 있습니다.`,
      400,
      { fields: unknownKeys.sort() }
    );
  }

  return Object.keys(rules).reduce((result, key) => {
    if (value[key] !== undefined) {
      result[key] = normalizeRuleValue(value[key], rules[key], `${fieldPath}.${key}`);
    }
    return result;
  }, {});
}

function normalizeDigimonOverride(value, fieldPath) {
  if (!isPlainObject(value)) {
    throw new MasterDataError(
      "MASTER_DATA_INVALID_REQUEST",
      `${fieldPath} 값은 객체여야 합니다.`
    );
  }
  const allowedTopLevel = new Set([
    ...Object.keys(TOP_LEVEL_RULES),
    "stats",
    "evolutionCriteria",
  ]);
  const unknownKeys = Object.keys(value).filter((key) => !allowedTopLevel.has(key));
  if (unknownKeys.length) {
    throw new MasterDataError(
      "MASTER_DATA_FIELD_NOT_ALLOWED",
      `${fieldPath}에 허용되지 않은 필드가 있습니다.`,
      400,
      { fields: unknownKeys.sort() }
    );
  }

  const normalized = normalizeAllowedObject(
    Object.keys(TOP_LEVEL_RULES).reduce((result, key) => {
      if (value[key] !== undefined) result[key] = value[key];
      return result;
    }, {}),
    TOP_LEVEL_RULES,
    fieldPath
  );

  if (value.stats !== undefined) {
    const stats = normalizeAllowedObject(value.stats, STATS_RULES, `${fieldPath}.stats`);
    if (Object.keys(stats).length) normalized.stats = stats;
  }
  if (value.evolutionCriteria !== undefined) {
    const criteria = normalizeAllowedObject(
      value.evolutionCriteria,
      EVOLUTION_RULES,
      `${fieldPath}.evolutionCriteria`
    );
    if (Object.keys(criteria).length) normalized.evolutionCriteria = criteria;
  }
  return normalized;
}

function normalizeMasterDataOverrides(value) {
  if (!isPlainObject(value)) {
    throw new MasterDataError(
      "MASTER_DATA_INVALID_REQUEST",
      "overrides 값은 객체여야 합니다."
    );
  }
  const unknownVersions = Object.keys(value).filter(
    (key) => !MASTER_DATA_VERSION_KEYS.includes(key)
  );
  if (unknownVersions.length) {
    throw new MasterDataError(
      "MASTER_DATA_VERSION_NOT_ALLOWED",
      "지원하지 않는 마스터 데이터 버전이 있습니다.",
      400,
      { versions: unknownVersions.sort() }
    );
  }

  return MASTER_DATA_VERSION_CONFIGS.reduce((result, config) => {
    const versionValue = value[config.key] || {};
    if (!isPlainObject(versionValue)) {
      throw new MasterDataError(
        "MASTER_DATA_INVALID_REQUEST",
        `${config.key} overrides 값은 객체여야 합니다.`
      );
    }
    const baseMap = getDigimonDataMapByVersion(config.label) || {};
    result[config.key] = Object.keys(versionValue)
      .sort()
      .reduce((versionResult, digimonId) => {
        if (!baseMap[digimonId]) {
          throw new MasterDataError(
            "MASTER_DATA_DIGIMON_NOT_FOUND",
            `${config.label}에서 ${digimonId} 디지몬을 찾을 수 없습니다.`,
            400
          );
        }
        const normalized = normalizeDigimonOverride(
          versionValue[digimonId],
          `${config.key}.${digimonId}`
        );
        if (Object.keys(normalized).length) {
          versionResult[digimonId] = normalized;
        }
        return versionResult;
      }, {});
    return result;
  }, {});
}

function getVersionConfigByLabel(versionLabel) {
  return MASTER_DATA_VERSION_CONFIGS.find((entry) => entry.label === versionLabel) || null;
}

function normalizeActionMetadata({ actionType, versionLabel, targetDigimonId }) {
  if (!MASTER_DATA_ACTION_TYPES.includes(actionType)) {
    throw new MasterDataError(
      "MASTER_DATA_INVALID_REQUEST",
      "actionType 값이 올바르지 않습니다."
    );
  }
  const normalizedVersionLabel = normalizeOptionalString(
    versionLabel,
    "versionLabel",
    20
  );
  const normalizedTargetId = normalizeOptionalString(
    targetDigimonId,
    "targetDigimonId",
    120
  );
  const config = normalizedVersionLabel
    ? getVersionConfigByLabel(normalizedVersionLabel)
    : null;

  if (normalizedVersionLabel && !config) {
    throw new MasterDataError(
      "MASTER_DATA_VERSION_NOT_ALLOWED",
      "지원하지 않는 versionLabel입니다."
    );
  }
  if (["save_row", "reset_row"].includes(actionType)) {
    if (!config || !normalizedTargetId) {
      throw new MasterDataError(
        "MASTER_DATA_INVALID_REQUEST",
        `${actionType}에는 versionLabel과 targetDigimonId가 필요합니다.`
      );
    }
    if (!getDigimonDataMapByVersion(config.label)?.[normalizedTargetId]) {
      throw new MasterDataError(
        "MASTER_DATA_DIGIMON_NOT_FOUND",
        `${config.label}에서 ${normalizedTargetId} 디지몬을 찾을 수 없습니다.`
      );
    }
  }
  if (actionType === "import_rows" && (!config || normalizedTargetId)) {
    throw new MasterDataError(
      "MASTER_DATA_INVALID_REQUEST",
      "import_rows에는 versionLabel만 지정해야 합니다."
    );
  }
  if (actionType === "reset_all" && (normalizedVersionLabel || normalizedTargetId)) {
    throw new MasterDataError(
      "MASTER_DATA_INVALID_REQUEST",
      "reset_all에는 버전이나 디지몬 ID를 지정할 수 없습니다."
    );
  }
  return {
    actionType,
    versionLabel: normalizedVersionLabel,
    versionKey: config?.key || null,
    targetDigimonId: normalizedTargetId,
  };
}

function normalizeMasterDataSaveRequest(input = {}) {
  if (!isPlainObject(input) || jsonBytes(input) > MAX_MASTER_DATA_REQUEST_BYTES) {
    throw new MasterDataError(
      "MASTER_DATA_PAYLOAD_TOO_LARGE",
      "마스터 데이터 요청 크기가 허용 범위를 초과했습니다.",
      413
    );
  }
  const allowedKeys = new Set([
    "requestId",
    "expectedRevision",
    "actionType",
    "note",
    "versionLabel",
    "targetDigimonId",
    "overrides",
  ]);
  const unknownKeys = Object.keys(input).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length) {
    throw new MasterDataError(
      "MASTER_DATA_FIELD_NOT_ALLOWED",
      "저장 요청에 허용되지 않은 필드가 있습니다.",
      400,
      { fields: unknownKeys.sort() }
    );
  }
  const metadata = normalizeActionMetadata(input);
  return {
    requestId: normalizeRequiredString(
      input.requestId,
      "requestId",
      MAX_REQUEST_ID_LENGTH
    ),
    expectedRevision: normalizeExpectedRevision(input.expectedRevision),
    ...metadata,
    note: normalizeOptionalString(input.note, "note", MAX_NOTE_LENGTH),
    overrides: normalizeMasterDataOverrides(input.overrides),
  };
}

function normalizeMasterDataRestoreRequest(input = {}) {
  if (!isPlainObject(input) || jsonBytes(input) > 20_000) {
    throw new MasterDataError(
      "MASTER_DATA_PAYLOAD_TOO_LARGE",
      "마스터 데이터 복원 요청 크기가 허용 범위를 초과했습니다.",
      413
    );
  }
  const allowedKeys = new Set([
    "requestId",
    "expectedRevision",
    "snapshotId",
    "note",
  ]);
  const unknownKeys = Object.keys(input).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length) {
    throw new MasterDataError(
      "MASTER_DATA_FIELD_NOT_ALLOWED",
      "복원 요청에 허용되지 않은 필드가 있습니다.",
      400,
      { fields: unknownKeys.sort() }
    );
  }
  const snapshotId = normalizeRequiredString(input.snapshotId, "snapshotId", 180);
  if (snapshotId === "." || snapshotId === ".." || snapshotId.includes("/")) {
    throw new MasterDataError(
      "MASTER_DATA_INVALID_REQUEST",
      "snapshotId 값이 올바르지 않습니다."
    );
  }
  return {
    requestId: normalizeRequiredString(
      input.requestId,
      "requestId",
      MAX_REQUEST_ID_LENGTH
    ),
    expectedRevision: normalizeExpectedRevision(input.expectedRevision),
    snapshotId,
    note: normalizeOptionalString(input.note, "note", MAX_NOTE_LENGTH),
  };
}

function normalizeStoredOverrides(documentData = {}) {
  const projected = MASTER_DATA_VERSION_KEYS.reduce((result, versionKey) => {
    result[versionKey] = documentData?.[`${versionKey}Overrides`] || {};
    return result;
  }, {});
  return normalizeMasterDataOverrides(projected);
}

function getChangedDigimonIdsBetweenOverrides(beforeOverrides, afterOverrides) {
  const buildChangedIds = (versionKey) => {
    const beforeIds = Object.keys(beforeOverrides[versionKey] || {});
    const afterIds = Object.keys(afterOverrides[versionKey] || {});
    return [...new Set([...beforeIds, ...afterIds])]
      .sort()
      .filter(
        (digimonId) =>
          createCanonicalHash(beforeOverrides[versionKey]?.[digimonId] ?? null) !==
          createCanonicalHash(afterOverrides[versionKey]?.[digimonId] ?? null)
      );
  };
  const summary = MASTER_DATA_VERSION_KEYS.reduce((result, versionKey) => {
    result[versionKey] = buildChangedIds(versionKey);
    return result;
  }, {});
  return {
    ...summary,
    totalCount: MASTER_DATA_VERSION_KEYS.reduce(
      (total, versionKey) => total + summary[versionKey].length,
      0
    ),
  };
}

function assertSaveChangeScope(request, changeSummary) {
  if (changeSummary.totalCount === 0) {
    throw new MasterDataError(
      "MASTER_DATA_NO_CHANGES",
      "저장할 마스터 데이터 변경사항이 없습니다.",
      409
    );
  }
  if (["save_row", "reset_row"].includes(request.actionType)) {
    const changedIds = changeSummary[request.versionKey] || [];
    if (
      changeSummary.totalCount !== 1 ||
      changedIds[0] !== request.targetDigimonId
    ) {
      throw new MasterDataError(
        "MASTER_DATA_CHANGE_SCOPE_MISMATCH",
        `${request.actionType} 변경 범위가 대상 디지몬과 일치하지 않습니다.`,
        400
      );
    }
  }
  if (request.actionType === "import_rows") {
    const outsideCount = MASTER_DATA_VERSION_KEYS.filter(
      (key) => key !== request.versionKey
    ).reduce((total, key) => total + changeSummary[key].length, 0);
    if (outsideCount > 0) {
      throw new MasterDataError(
        "MASTER_DATA_CHANGE_SCOPE_MISMATCH",
        "import_rows는 지정한 버전만 변경할 수 있습니다.",
        400
      );
    }
  }
  if (
    request.actionType === "reset_all" &&
    MASTER_DATA_VERSION_KEYS.some(
      (key) => Object.keys(request.overrides[key] || {}).length > 0
    )
  ) {
    throw new MasterDataError(
      "MASTER_DATA_CHANGE_SCOPE_MISMATCH",
      "reset_all 결과에는 override가 남아 있을 수 없습니다.",
      400
    );
  }
}

function createSaveRequestFingerprint(request) {
  return createCanonicalHash({
    contractVersion: 1,
    action: "master-data-save",
    request,
  });
}

function createRestoreRequestFingerprint(request) {
  return createCanonicalHash({
    contractVersion: 1,
    action: "master-data-restore",
    request,
  });
}

module.exports = {
  MAX_MASTER_DATA_SNAPSHOT_BYTES,
  MASTER_DATA_VERSION_CONFIGS,
  MASTER_DATA_VERSION_KEYS,
  MasterDataError,
  assertSaveChangeScope,
  createCanonicalHash,
  createMasterDataSnapshotId,
  createRestoreRequestFingerprint,
  createSaveRequestFingerprint,
  getChangedDigimonIdsBetweenOverrides,
  isPlainObject,
  jsonBytes,
  normalizeMasterDataOverrides,
  normalizeMasterDataRestoreRequest,
  normalizeMasterDataSaveRequest,
  normalizeStoredOverrides,
};
