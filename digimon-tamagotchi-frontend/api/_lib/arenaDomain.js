"use strict";

const crypto = require("node:crypto");
const { ArenaError } = require("./arenaErrors");

const ARENA_IDENTITY_SCHEMA_VERSION = 1;
const ARENA_GHOST_SCHEMA_VERSION = 2;
const ARENA_GHOST_SNAPSHOT_VERSION = 1;
const ARENA_BATTLE_RULES_VERSION = "arena-ghost-v1";
const ARENA_BATTLE_SCHEMA_VERSION = 1;
const ARENA_PROJECTION_VERSION = 1;
const RECORD_KEYS = Object.freeze([
  "attackWins",
  "attackLosses",
  "defenseWins",
  "defenseLosses",
]);

function normalizeRequiredString(value, fieldName, maxLength = 160) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength) {
    throw new ArenaError(
      "ARENA_INVALID_REQUEST",
      `${fieldName} 값이 올바르지 않습니다.`
    );
  }
  return normalized;
}

function normalizeCombatRevision(value) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 1) {
    throw new ArenaError("ARENA_INVALID_REQUEST", "combatRevision 값이 올바르지 않습니다.");
  }
  return normalized;
}

function normalizeSlotId(value) {
  const normalized = normalizeRequiredString(String(value ?? ""), "slotId", 40);
  const match = normalized.match(/^slot(\d+)$/i) || normalized.match(/^(\d+)$/);
  if (!match || Number(match[1]) < 1) {
    throw new ArenaError("ARENA_INVALID_REQUEST", "slotId 값이 올바르지 않습니다.");
  }
  return `slot${Number(match[1])}`;
}

function normalizeGhostId(value) {
  const normalized = normalizeRequiredString(value, "ghostId", 160);
  if (normalized === "." || normalized === ".." || normalized.includes("/")) {
    throw new ArenaError("ARENA_INVALID_REQUEST", "ghostId 값이 올바르지 않습니다.");
  }
  return normalized;
}

function assertArenaMutationEnabled(config = {}) {
  if (config.mode !== "active") {
    throw new ArenaError(
      "ARENA_MAINTENANCE",
      "아레나 점검 중입니다. 잠시 후 다시 시도해 주세요.",
      { retryAfterSeconds: 60 },
      null,
      { retryable: true }
    );
  }
}

function sha256Base64Url(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("base64url");
}

function createCombatIdentityId({ ownerUid, digimonInstanceId, combatRevision }) {
  const uid = normalizeRequiredString(ownerUid, "ownerUid");
  const instanceId = normalizeRequiredString(digimonInstanceId, "digimonInstanceId");
  const revision = normalizeCombatRevision(combatRevision);
  return sha256Base64Url(`arena-combat-v1\0${uid}\0${instanceId}\0${revision}`);
}

function createRegistrationKey({ ownerUid, combatIdentityId }) {
  const uid = normalizeRequiredString(ownerUid, "ownerUid");
  const identityId = normalizeRequiredString(combatIdentityId, "combatIdentityId");
  return sha256Base64Url(`arena-registration-v1\0${uid}\0${identityId}`);
}

function createBattleId({ attackerUid, requestId }) {
  const uid = normalizeRequiredString(attackerUid, "attackerUid");
  const id = normalizeRequiredString(requestId, "requestId", 120);
  return `battle_${sha256Base64Url(`arena-request-v1\0${uid}\0${id}`)}`;
}

function createBattleRequestHash({ attackerSlotId, defenderGhostId }) {
  return createCanonicalRequestHash({
    version: ARENA_BATTLE_SCHEMA_VERSION,
    attackerSlotId: normalizeSlotId(attackerSlotId),
    defenderGhostId: normalizeRequiredString(defenderGhostId, "defenderGhostId", 160),
  });
}

function createSeasonRecordId({ seasonId, ownerUid }) {
  const normalizedSeasonId = Number(seasonId);
  if (!Number.isInteger(normalizedSeasonId) || normalizedSeasonId < 1) {
    throw new ArenaError("ARENA_INVALID_REQUEST", "seasonId 값이 올바르지 않습니다.");
  }
  const uid = normalizeRequiredString(ownerUid, "ownerUid");
  return `${normalizedSeasonId}_${Buffer.from(uid, "utf8").toString("base64url")}`;
}

function normalizeCanonicalValue(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeCanonicalValue);
  }
  if (value && typeof value === "object") {
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

function createCanonicalRequestHash(value) {
  return sha256Base64Url(JSON.stringify(normalizeCanonicalValue(value)));
}

function assertArenaClientSchemaVersion({ requestVersion, minimumVersion = 1 } = {}) {
  const clientVersion = Number(requestVersion);
  const requiredVersion = Number(minimumVersion);
  if (!Number.isInteger(requiredVersion) || requiredVersion < 1) {
    throw new ArenaError("ARENA_INTERNAL_ERROR", "최소 아레나 client schema 설정이 올바르지 않습니다.");
  }
  if (!Number.isInteger(clientVersion) || clientVersion < requiredVersion) {
    throw new ArenaError(
      "ARENA_CLIENT_UPGRADE_REQUIRED",
      "새 아레나 시스템을 사용하려면 앱을 새로고침해 주세요.",
      { minimumVersion: requiredVersion }
    );
  }
  return clientVersion;
}

function createEmptyCombatRecord() {
  return {
    attackWins: 0,
    attackLosses: 0,
    defenseWins: 0,
    defenseLosses: 0,
  };
}

function normalizeRecordDelta(delta = {}) {
  return RECORD_KEYS.reduce((result, key) => {
    const value = Number(delta[key] || 0);
    if (!Number.isInteger(value) || value < 0 || value > 1) {
      throw new ArenaError("ARENA_INVALID_REQUEST", `${key} delta가 올바르지 않습니다.`);
    }
    result[key] = value;
    return result;
  }, {});
}

function applyRecordDelta(record = {}, delta = {}) {
  const normalizedDelta = normalizeRecordDelta(delta);
  return RECORD_KEYS.reduce((result, key) => {
    const currentValue = Number(record[key] || 0);
    if (!Number.isInteger(currentValue) || currentValue < 0) {
      throw new ArenaError("ARENA_COMBAT_IDENTITY_STALE", `${key} 전적이 손상되었습니다.`);
    }
    result[key] = currentValue + normalizedDelta[key];
    return result;
  }, {});
}

function normalizeBoundedNumber(value, fieldName, minimum, maximum) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < minimum || normalized > maximum) {
    throw new ArenaError("ARENA_INVALID_REQUEST", `${fieldName} 값이 올바르지 않습니다.`);
  }
  return normalized;
}

function buildGhostSnapshot({
  slot,
  digimon,
  combatPowerAtCapture,
  capturedAt,
} = {}) {
  const stats = slot?.digimonStats || {};
  const digimonId = normalizeRequiredString(slot?.selectedDigimon, "digimonId", 100);
  const dataId = typeof digimon?.id === "string" && digimon.id.trim() ? digimon.id.trim() : digimonId;
  if (dataId !== digimonId) {
    throw new ArenaError(
      "ARENA_COMBAT_IDENTITY_STALE",
      "슬롯과 디지몬 데이터의 형태가 일치하지 않습니다."
    );
  }

  const capturedDate = capturedAt instanceof Date ? capturedAt : new Date(capturedAt);
  if (Number.isNaN(capturedDate.getTime())) {
    throw new ArenaError("ARENA_INVALID_REQUEST", "capturedAt 값이 올바르지 않습니다.");
  }

  return {
    gameVersion: normalizeRequiredString(slot?.version || "Ver.1", "gameVersion", 20),
    digimonId,
    digimonName: normalizeRequiredString(digimon?.name || digimonId, "digimonName", 80),
    stage: normalizeRequiredString(digimon?.stage, "stage", 40),
    attribute: normalizeRequiredString(
      digimon?.stats?.type || digimon?.attribute || "Free",
      "attribute",
      20
    ),
    spriteBasePath:
      typeof digimon?.spriteBasePath === "string" ? digimon.spriteBasePath.slice(0, 180) : "",
    sprite: normalizeBoundedNumber(digimon?.sprite ?? 0, "sprite", 0, 100000),
    attackSprite: normalizeBoundedNumber(
      digimon?.stats?.attackSprite ?? digimon?.attackSprite ?? digimon?.sprite ?? 0,
      "attackSprite",
      0,
      100000
    ),
    combatPowerAtCapture: normalizeBoundedNumber(
      combatPowerAtCapture,
      "combatPowerAtCapture",
      0,
      100000
    ),
    ageAtCapture: normalizeBoundedNumber(stats.age ?? 0, "ageAtCapture", 0, 100000),
    weightAtCapture: normalizeBoundedNumber(stats.weight ?? 0, "weightAtCapture", 0, 100000),
    capturedAt: capturedDate,
  };
}

module.exports = {
  ARENA_BATTLE_SCHEMA_VERSION,
  ARENA_BATTLE_RULES_VERSION,
  ARENA_GHOST_SCHEMA_VERSION,
  ARENA_GHOST_SNAPSHOT_VERSION,
  ARENA_IDENTITY_SCHEMA_VERSION,
  ARENA_PROJECTION_VERSION,
  RECORD_KEYS,
  applyRecordDelta,
  assertArenaMutationEnabled,
  assertArenaClientSchemaVersion,
  buildGhostSnapshot,
  createCanonicalRequestHash,
  createBattleId,
  createBattleRequestHash,
  createCombatIdentityId,
  createEmptyCombatRecord,
  createRegistrationKey,
  createSeasonRecordId,
  normalizeRecordDelta,
  normalizeGhostId,
  normalizeSlotId,
  sha256Base64Url,
};
