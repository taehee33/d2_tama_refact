"use strict";

const crypto = require("node:crypto");
const { ArenaError } = require("./arenaErrors");
const { createCanonicalRequestHash, normalizeSlotId } = require("./arenaDomain");

const REALTIME_ARENA_SCHEMA_VERSION = 1;
const REALTIME_ARENA_CLIENT_SCHEMA_VERSION = 1;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/;

function assertOnlyKeys(input, allowedKeys) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ArenaError("ARENA_INVALID_REQUEST", "요청 본문이 올바르지 않습니다.");
  const unknown = Object.keys(input).filter((key) => !allowedKeys.includes(key));
  if (unknown.length) throw new ArenaError("ARENA_INVALID_REQUEST", "허용되지 않은 요청 필드가 있습니다.", { fields: unknown });
}

function normalizeRequestId(value) {
  const requestId = typeof value === "string" ? value.trim() : "";
  if (!REQUEST_ID_PATTERN.test(requestId)) throw new ArenaError("ARENA_INVALID_REQUEST", "requestId 값이 올바르지 않습니다.");
  return requestId;
}

function normalizeBattleId(value) {
  const battleId = typeof value === "string" ? value.trim() : "";
  if (!/^rtb_[A-Za-z0-9_-]{32,80}$/.test(battleId)) throw new ArenaError("ARENA_INVALID_REQUEST", "battleId 값이 올바르지 않습니다.");
  return battleId;
}

function createRealtimeBattleId({ hostUid, requestId }) {
  const hash = crypto.createHash("sha256").update(`realtime-arena-v1\0${hostUid}\0${normalizeRequestId(requestId)}`, "utf8").digest("base64url");
  return `rtb_${hash}`;
}

function createRequestHash(value) {
  return createCanonicalRequestHash({ schemaVersion: REALTIME_ARENA_SCHEMA_VERSION, ...value });
}

function timestampToIso(value) {
  if (!value) return null;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serializeBattle(battle) {
  if (!battle) return null;
  return {
    ...battle,
    createdAt: timestampToIso(battle.createdAt),
    updatedAt: timestampToIso(battle.updatedAt),
    startedAt: timestampToIso(battle.startedAt),
    finishedAt: timestampToIso(battle.finishedAt),
    expiresAt: timestampToIso(battle.expiresAt),
    deadlineAt: timestampToIso(battle.deadlineAt),
    resolvedRounds: (battle.resolvedRounds || []).map((round) => ({ ...round, resolvedAt: timestampToIso(round.resolvedAt) })),
  };
}

function getRole(battle, uid) {
  if (battle?.hostUid === uid) return "host";
  if (battle?.guestUid === uid) return "guest";
  return null;
}

function assertParticipant(battle, uid) {
  const role = getRole(battle, uid);
  if (!role) throw new ArenaError("ARENA_REALTIME_FORBIDDEN", "이 실시간 배틀의 참가자가 아닙니다.");
  return role;
}

function buildParticipantSnapshot(projected, rules) {
  const { slot, digimon, power, powerDetails } = projected;
  const stage = digimon.stage;
  if (!rules.eligibleStages.includes(stage)) throw new ArenaError("ARENA_REALTIME_STAGE_INELIGIBLE", "이 단계의 디지몬은 실시간 배틀에 참가할 수 없습니다.");
  return {
    public: {
      version: slot.version || "Ver.1",
      digimonId: slot.selectedDigimon,
      digimonName: digimon.name || slot.selectedDigimon,
      stage,
      attribute: digimon.stats?.type || digimon.attribute || "Free",
      sourcePower: power,
      maxHp: Number(rules.hpByStage[stage]),
      baseAttack: Number(rules.baseAttackByStage[stage]),
      spriteBasePath: typeof digimon.spriteBasePath === "string" ? digimon.spriteBasePath : "",
      sprite: Number(digimon.sprite || 0),
      attackSprite: Number(digimon.stats?.attackSprite ?? digimon.attackSprite ?? digimon.sprite ?? 0),
    },
    secret: {
      digimonInstanceId: slot.digimonInstanceId || null,
      combatRevision: Number.isInteger(slot.combatRevision) ? slot.combatRevision : null,
      powerBreakdown: powerDetails,
    },
  };
}

module.exports = {
  REALTIME_ARENA_CLIENT_SCHEMA_VERSION,
  REALTIME_ARENA_SCHEMA_VERSION,
  assertOnlyKeys,
  assertParticipant,
  buildParticipantSnapshot,
  createRealtimeBattleId,
  createRequestHash,
  getRole,
  normalizeBattleId,
  normalizeRequestId,
  normalizeSlotId,
  serializeBattle,
  timestampToIso,
};
