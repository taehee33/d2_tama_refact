"use strict";

const crypto = require("node:crypto");
const { ArenaError } = require("./arenaErrors");
const {
  adaptDataMapToOldFormat,
  applyLazyUpdate,
  getDigimonDataMapByVersion,
  initializeStats,
  normalizeDigimonVersionLabel,
  resolveOnlineJogressPair,
} = require("../_generated/gameProjection.cjs");
const { createCombatIdentityId, normalizeSlotId } = require("./arenaDomain");

const JOGRESS_ROOM_SCHEMA_VERSION = 3;
const JOGRESS_ROOM_LIMIT = 3;
const ACTIVE_JOGRESS_STATUSES = new Set(["waiting", "paired"]);

class JogressError extends ArenaError {
  constructor(code, message, details = null, status = 400, options = {}) {
    super(code, message, details, status, options);
    this.name = "ArenaError";
  }
}

function createJogressRegistrationKey({ ownerUid, sourceIdentityId }) {
  return crypto
    .createHash("sha256")
    .update(`jogress-registration-v1\0${ownerUid}\0${sourceIdentityId}`, "utf8")
    .digest("base64url");
}

function createLegacyGhostRegistrationKey(roomId) {
  return crypto
    .createHash("sha256")
    .update(`jogress-legacy-ghost-v1\0${roomId}`, "utf8")
    .digest("base64url");
}

function normalizeRevision(value) {
  const revision = Number(value ?? 0);
  return Number.isInteger(revision) && revision >= 0 ? revision : 0;
}

function assertExpectedRevision(slot, expectedRevision) {
  const actualRevision = normalizeRevision(slot?.revision);
  const expected = Number(expectedRevision);
  if (!Number.isInteger(expected) || expected !== actualRevision) {
    throw new JogressError(
      "JOGRESS_STATE_CONFLICT",
      "슬롯이 다른 기기에서 변경되었습니다. 최신 상태를 다시 불러와 주세요.",
      { expectedRevision: expectedRevision ?? null, actualRevision },
      409,
      { retryable: true }
    );
  }
  return actualRevision;
}

function getSlotSourceIdentity(uid, slot) {
  if (
    !slot ||
    typeof slot.digimonInstanceId !== "string" ||
    !slot.digimonInstanceId.trim() ||
    !Number.isInteger(slot.combatRevision) ||
    slot.combatRevision < 1
  ) {
    throw new JogressError(
      "JOGRESS_STATE_CONFLICT",
      "현재 슬롯의 형태 Identity를 갱신한 뒤 다시 시도해 주세요.",
      null,
      409,
      { retryable: true }
    );
  }
  return {
    digimonInstanceId: slot.digimonInstanceId.trim(),
    combatRevision: slot.combatRevision,
    sourceIdentityId: createCombatIdentityId({
      ownerUid: uid,
      digimonInstanceId: slot.digimonInstanceId,
      combatRevision: slot.combatRevision,
    }),
  };
}

function assertUsableJogressSlot(uid, slotSnapshot) {
  if (!slotSnapshot?.exists) {
    throw new JogressError("JOGRESS_ROOM_NOT_FOUND", "슬롯을 찾을 수 없습니다.", null, 404);
  }
  const slot = slotSnapshot.data() || {};
  if (slot.digimonStats?.isDead === true) {
    throw new JogressError("JOGRESS_PAIR_INVALID", "사망한 디지몬은 조그레스할 수 없습니다.", null, 422);
  }
  const version = normalizeDigimonVersionLabel(slot.version || "Ver.1");
  const dataMap = getDigimonDataMapByVersion(version);
  const entry = dataMap?.[slot.selectedDigimon];
  if (!entry) {
    throw new JogressError("JOGRESS_PAIR_INVALID", "현재 디지몬 데이터를 찾을 수 없습니다.", null, 422);
  }
  const identity = getSlotSourceIdentity(uid, slot);
  return { slot, version, dataMap, entry, identity };
}

function isRoomSourceCurrent(room, uid, slot) {
  if (!room?.hostSourceIdentityId || !slot || room.hostUid !== uid || slot.digimonStats?.isDead === true) return false;
  try {
    return getSlotSourceIdentity(uid, slot).sourceIdentityId === room.hostSourceIdentityId;
  } catch (_error) {
    return false;
  }
}

function buildHostSnapshot({ slot, slotId, version, entry, identity, now }) {
  return {
    slotId: Number(slotId),
    digimonId: slot.selectedDigimon,
    version,
    name: entry?.name || slot.selectedDigimon,
    nickname: slot.digimonNickname || null,
    stage: entry?.stage || null,
    sprite: entry?.sprite ?? null,
    spriteBasePath: entry?.spriteBasePath || null,
    digimonInstanceId: identity?.digimonInstanceId || null,
    combatRevision: Number.isInteger(identity?.combatRevision) ? identity.combatRevision : null,
    sourceIdentityId: identity?.sourceIdentityId || null,
    registeredAt: now || null,
  };
}

function getRoomHostSnapshot(room = {}) {
  const snapshot = room.hostSnapshot || {};
  return {
    slotId: snapshot.slotId ?? room.hostSlotId ?? null,
    digimonId: snapshot.digimonId || room.hostDigimonId || null,
    version: normalizeDigimonVersionLabel(snapshot.version || room.hostSlotVersion || "Ver.1"),
    name: snapshot.name || room.hostDigimonName || null,
    nickname: snapshot.nickname ?? room.hostDigimonNickname ?? null,
    stage: snapshot.stage || null,
    sprite: snapshot.sprite ?? null,
    spriteBasePath: snapshot.spriteBasePath || null,
    digimonInstanceId: snapshot.digimonInstanceId || room.hostDigimonInstanceId || null,
    combatRevision: Number.isInteger(snapshot.combatRevision)
      ? snapshot.combatRevision
      : (Number.isInteger(room.hostCombatRevision) ? room.hostCombatRevision : null),
    sourceIdentityId: snapshot.sourceIdentityId || room.hostSourceIdentityId || null,
    registeredAt: snapshot.registeredAt || room.createdAt || null,
  };
}

function classifyRoomLink(room, hostSlot) {
  if (!room?.hostSourceIdentityId) return "ghost";
  return isRoomSourceCurrent(room, room.hostUid, hostSlot) ? "live" : "ghost";
}

function mergeTargetMap(version, rawMap, targetId) {
  const adaptedMap = adaptDataMapToOldFormat(rawMap);
  const rawEntry = rawMap?.[targetId] || {};
  const adaptedEntry = adaptedMap?.[targetId] || {};
  return {
    ...adaptedMap,
    [targetId]: {
      ...rawEntry,
      ...adaptedEntry,
      stats: { ...(rawEntry.stats || {}), ...(adaptedEntry.stats || {}) },
      version,
    },
  };
}

function sanitizeStats(stats = {}) {
  const {
    activityLogs: _activityLogs,
    battleLogs: _battleLogs,
    selectedDigimon: _selectedDigimon,
    lastSavedAt: _lastSavedAt,
    isLightsOn: _isLightsOn,
    wakeUntil: _wakeUntil,
    dailySleepMistake: _dailySleepMistake,
    ...cleaned
  } = stats || {};
  const cleanValue = (value) => {
    if (Array.isArray(value)) return value.map(cleanValue).filter((item) => item !== undefined);
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, nested]) => nested !== undefined)
          .map(([key, nested]) => [key, cleanValue(nested)])
      );
    }
    return value;
  };
  return cleanValue(cleaned);
}

function buildJogressEvolutionOutcome({ slot, version, targetId, rawMap, nowMs }) {
  const sourceAdapted = adaptDataMapToOldFormat(rawMap)?.[slot.selectedDigimon] || {};
  const projectedStats = applyLazyUpdate(
    slot.digimonStats || {},
    slot.lastSavedAt,
    sourceAdapted.stats?.sleepSchedule || null,
    sourceAdapted.maxEnergy ?? null,
    { nowMs }
  );
  const targetMap = mergeTargetMap(version, rawMap, targetId);
  const targetEntry = targetMap[targetId] || {};
  const resetStats = {
    ...projectedStats,
    careMistakes: 0,
    overfeeds: 0,
    proteinOverdose: 0,
    trainings: 0,
    sleepDisturbances: 0,
    strength: 0,
    effort: 0,
    energy: targetEntry.maxEnergy ?? targetEntry.stats?.maxEnergy ?? 0,
    weight: targetEntry.minWeight ?? targetEntry.stats?.minWeight ?? 0,
    battles: 0,
    battlesWon: 0,
    battlesLost: 0,
    winRate: 0,
  };
  const nextStats = initializeStats(targetId, resetStats, targetMap);
  if (targetEntry.sprite !== undefined) nextStats.sprite = targetEntry.sprite;
  nextStats.isDead = false;
  delete nextStats.deathReason;
  return {
    selectedDigimon: targetId,
    digimonStats: sanitizeStats(nextStats),
    revision: normalizeRevision(slot.revision) + 1,
    combatRevision: slot.combatRevision + 1,
    resultName: rawMap?.[targetId]?.name || targetId,
  };
}

function buildEvolutionLog({ eventId, sourceId, targetId, resultName, nowMs }) {
  return {
    eventId,
    type: "EVOLUTION",
    text: `조그레스 진화(온라인): ${resultName}!`,
    timestamp: nowMs,
    snapshot: { sourceDigimonId: sourceId, selectedDigimon: targetId },
  };
}

function buildEncyclopediaEntry(existing = {}, stats = {}, eventType, nowMs) {
  const history = Array.isArray(existing.history) ? existing.history : [];
  const bestStats = existing.bestStats || {};
  return {
    ...existing,
    isDiscovered: true,
    firstDiscoveredAt: existing.firstDiscoveredAt || nowMs,
    raisedCount: Number(existing.raisedCount || 0) + 1,
    lastRaisedAt: nowMs,
    bestStats: {
      maxAge: Math.max(Number(bestStats.maxAge || 0), Number(stats.age || 0)),
      maxWinRate: Math.max(Number(bestStats.maxWinRate || 0), Number(stats.winRate || 0)),
      maxWeight: Math.max(Number(bestStats.maxWeight || 0), Number(stats.weight || 0)),
      maxLifespan: Math.max(Number(bestStats.maxLifespan || 0), Number(stats.lifespanSeconds || 0)),
      totalBattles: Math.max(Number(bestStats.totalBattles || 0), Number(stats.totalBattles || 0)),
      totalBattlesWon: Math.max(Number(bestStats.totalBattlesWon || 0), Number(stats.totalBattlesWon || 0)),
    },
    history: [
      {
        date: nowMs,
        result: eventType === "evolution" ? `진화: ${stats.evolutionStage || "조그레스"}` : "발견",
        finalStats: {
          age: Number(stats.age || 0),
          winRate: Number(stats.winRate || 0),
          weight: Number(stats.weight || 0),
          lifespanSeconds: Number(stats.lifespanSeconds || 0),
        },
      },
      ...history,
    ].slice(0, 5),
  };
}

module.exports = {
  ACTIVE_JOGRESS_STATUSES,
  JOGRESS_ROOM_LIMIT,
  JOGRESS_ROOM_SCHEMA_VERSION,
  JogressError,
  assertExpectedRevision,
  assertUsableJogressSlot,
  buildEncyclopediaEntry,
  buildEvolutionLog,
  buildHostSnapshot,
  buildJogressEvolutionOutcome,
  classifyRoomLink,
  createLegacyGhostRegistrationKey,
  createJogressRegistrationKey,
  getRoomHostSnapshot,
  getSlotSourceIdentity,
  isRoomSourceCurrent,
  normalizeRevision,
  normalizeSlotId,
  resolveOnlineJogressPair,
};
