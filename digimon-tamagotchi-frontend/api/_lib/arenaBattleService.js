"use strict";

const crypto = require("node:crypto");
const {
  ARENA_BATTLE_RULES_VERSION,
  ARENA_BATTLE_SCHEMA_VERSION,
  ARENA_GHOST_SCHEMA_VERSION,
  ARENA_GHOST_SNAPSHOT_VERSION,
  ARENA_PROJECTION_VERSION,
  applyRecordDelta,
  assertArenaMutationEnabled,
  buildGhostSnapshot,
  createBattleId,
  createBattleRequestHash,
  createCanonicalRequestHash,
  createCombatIdentityId,
  createEmptyCombatRecord,
  createRegistrationKey,
  createSeasonRecordId,
  normalizeGhostId,
  normalizeSlotId,
} = require("./arenaDomain");
const { ArenaError } = require("./arenaErrors");
const { getArenaFirestore } = require("./arenaTransactions");
const { projectArenaSlot } = require("./arenaGhostHandlers");
const { calculateArenaBattle } = require("../_generated/gameProjection.cjs");

const ARENA_CONFIG_PATH = "game_settings/arena_config";
const MAX_REPLAY_BYTES = 128 * 1024;
const MAX_BATTLE_BYTES = 256 * 1024;
const MAX_LOCAL_BATTLE_LOGS = 50;

function asDate(value) {
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function snapshotUpdateMs(snapshot) {
  return asDate(snapshot?.updateTime)?.getTime() || 0;
}

function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function compactFirestoreValue(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map(compactFirestoreValue);
  }
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.entries(value).reduce((result, [key, item]) => {
      if (item !== undefined) result[key] = compactFirestoreValue(item);
      return result;
    }, {});
  }
  return value;
}

function canonicalizeBattleSnapshot(snapshot = {}) {
  const capturedAt = asDate(snapshot.capturedAt);
  return {
    ...snapshot,
    capturedAt: capturedAt ? capturedAt.toISOString() : null,
  };
}

function normalizeBattleRequest(input = {}) {
  const allowed = ["requestId", "attackerSlotId", "defenderGhostId"];
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    throw new ArenaError("ARENA_INVALID_REQUEST", "허용되지 않은 배틀 요청 필드가 있습니다.", {
      fields: unknown,
    });
  }
  const requestId = typeof input.requestId === "string" ? input.requestId.trim() : "";
  if (!requestId || requestId.length > 120) {
    throw new ArenaError("ARENA_INVALID_REQUEST", "배틀 요청 식별자를 확인해 주세요.");
  }
  return {
    requestId,
    attackerSlotId: normalizeSlotId(input.attackerSlotId),
    defenderGhostId: normalizeGhostId(input.defenderGhostId),
  };
}

function normalizeCombatRecord(data = {}) {
  return {
    attackWins: Number(data.attackWins || 0),
    attackLosses: Number(data.attackLosses || 0),
    defenseWins: Number(data.defenseWins || 0),
    defenseLosses: Number(data.defenseLosses || 0),
  };
}

function combatDelta(side, won) {
  return side === "attack"
    ? { attackWins: won ? 1 : 0, attackLosses: won ? 0 : 1 }
    : { defenseWins: won ? 1 : 0, defenseLosses: won ? 0 : 1 };
}

function applyCombatDocument(record, delta, metadata, now) {
  return {
    ...metadata,
    ...normalizeCombatRecord(record),
    ...applyRecordDelta(record, delta),
    updatedAt: now,
    ...(!record?.createdAt ? { createdAt: now } : { createdAt: record.createdAt }),
  };
}

function normalizeSeasonRecord(data = {}, { seasonId, ownerUid }) {
  const record = {
    schemaVersion: 1,
    seasonId,
    ownerUid,
    attackWins: Number(data.attackWins || 0),
    attackLosses: Number(data.attackLosses || 0),
    defenseWins: Number(data.defenseWins || 0),
    defenseLosses: Number(data.defenseLosses || 0),
    legacyUnclassifiedWins: Number(data.legacyUnclassifiedWins || 0),
    legacyUnclassifiedLosses: Number(data.legacyUnclassifiedLosses || 0),
  };
  record.wins = record.attackWins + record.defenseWins + record.legacyUnclassifiedWins;
  record.losses = record.attackLosses + record.defenseLosses + record.legacyUnclassifiedLosses;
  return record;
}

function applySeasonDelta(data, identity, delta, now) {
  const next = normalizeSeasonRecord(data, identity);
  for (const [key, value] of Object.entries(delta)) next[key] += Number(value || 0);
  next.wins = next.attackWins + next.defenseWins + next.legacyUnclassifiedWins;
  next.losses = next.attackLosses + next.defenseLosses + next.legacyUnclassifiedLosses;
  next.updatedAt = now;
  return next;
}

function updateSlotAfterArenaBattle({ slot, projectedStats, attackerWon, battleId, opponentName, now }) {
  const stats = compactFirestoreValue({ ...projectedStats });
  stats.weight = Math.max(0, Number(stats.weight || 0) - 4);
  stats.energy = Math.max(0, Number(stats.energy || 0) - 1);
  stats.battles = Number(stats.battles || 0) + 1;
  stats.battlesWon = Number(stats.battlesWon || 0) + (attackerWon ? 1 : 0);
  stats.battlesLost = Number(stats.battlesLost || 0) + (attackerWon ? 0 : 1);
  stats.totalBattles = Number(stats.totalBattles || 0) + 1;
  stats.totalBattlesWon = Number(stats.totalBattlesWon || 0) + (attackerWon ? 1 : 0);
  stats.totalBattlesLost = Number(stats.totalBattlesLost || 0) + (attackerWon ? 0 : 1);
  stats.winRate = Math.round((stats.battlesWon / stats.battles) * 100);
  stats.totalWinRate = Math.round((stats.totalBattlesWon / stats.totalBattles) * 100);
  const previousLogs = Array.isArray(stats.battleLogs) ? stats.battleLogs : [];
  stats.battleLogs = [...previousLogs, {
    mode: "arena",
    battleId,
    win: attackerWon,
    enemyName: opponentName,
    text: `아레나: ${opponentName} 상대 ${attackerWon ? "승리" : "패배"}`,
    timestamp: now.getTime(),
  }].slice(-MAX_LOCAL_BATTLE_LOGS);
  return {
    ...slot,
    digimonStats: stats,
    lastSavedAt: now.getTime(),
    persistenceRevision: Number(slot.persistenceRevision || 0) + 1,
    updatedAt: now,
  };
}

function resolveDefenderProjection({ ghost, sourceSnapshot, requestReceivedAt, projectSource }) {
  if (!ghost.sourceCombatIdentityId || !sourceSnapshot) return { status: "resolved", linked: false };
  if (!sourceSnapshot.exists) return { status: "resolved", linked: false, linkStatus: "source_missing" };
  if (projectSource) return projectSource(sourceSnapshot, requestReceivedAt, ghost);
  let projected;
  try {
    projected = projectArenaSlot(sourceSnapshot, requestReceivedAt);
  } catch (error) {
    if (error?.code === "ARENA_SLOT_DEAD" || error?.code === "ARENA_SLOT_STARTER") {
      return { status: "resolved", linked: false, linkStatus: error.code === "ARENA_SLOT_DEAD" ? "dead" : "starter" };
    }
    return { status: "terminal_error", code: error?.code || "CORRUPT_PROJECTION_INPUT" };
  }
  const source = projected.slot || {};
  if (
    source.digimonInstanceId !== ghost.sourceDigimonInstanceId ||
    source.combatRevision !== ghost.sourceCombatRevision ||
    source.selectedDigimon !== ghost.snapshot?.digimonId
  ) {
    return { status: "resolved", linked: false, linkStatus: "evolved" };
  }
  return {
    status: "resolved",
    linked: true,
    linkStatus: "linked",
    targetCombatIdentityId: ghost.sourceCombatIdentityId,
  };
}

function buildArchivePayload(responsePayload, context) {
  return {
    schemaVersion: 2,
    battleId: context.battleId,
    seasonIdAtBattle: context.seasonId,
    battleRulesVersion: ARENA_BATTLE_RULES_VERSION,
    attackerUid: context.attackerUid,
    defenderUid: context.defenderUid,
    responsePayload,
  };
}

async function commitArenaBattle({ uid, input, deps = {} }) {
  const normalized = normalizeBattleRequest(input);
  const db = deps.db || getArenaFirestore();
  const transact = deps.runTransaction || ((callback) => db.runTransaction(callback));
  const requestReceivedAt = deps.requestReceivedAt || new Date();
  const seed = deps.seed || crypto.randomBytes(32).toString("base64url");
  const requestHash = createBattleRequestHash(normalized);
  const battleId = createBattleId({ attackerUid: uid, requestId: normalized.requestId });

  return transact(async (transaction) => {
    const battleRef = db.doc(`arena_battles/${battleId}`);
    const battleSnapshot = await transaction.get(battleRef);
    if (battleSnapshot.exists) {
      const existing = battleSnapshot.data() || {};
      if (existing.requestHash !== requestHash) {
        throw new ArenaError("ARENA_IDEMPOTENCY_CONFLICT", "같은 requestId가 다른 배틀 요청에 사용되었습니다.");
      }
      return existing.responsePayload;
    }

    const configRef = db.doc(ARENA_CONFIG_PATH);
    const slotRef = db.doc(`users/${uid}/slots/${normalized.attackerSlotId}`);
    const defenderRef = db.doc(`arena_ghosts/${normalized.defenderGhostId}`);
    const ownerRef = db.doc(`arena_ghost_owners/${uid}`);
    const [configSnapshot, slotSnapshot, defenderSnapshot, ownerSnapshot] =
      await transaction.getAll(configRef, slotRef, defenderRef, ownerRef);
    const config = configSnapshot.exists ? configSnapshot.data() || {} : {};
    assertArenaMutationEnabled(config);
    const seasonId = Number(config.currentSeasonId);
    if (!Number.isInteger(seasonId) || seasonId < 1) {
      throw new ArenaError("ARENA_INTERNAL_ERROR", "현재 아레나 시즌 설정이 올바르지 않습니다.");
    }
    if (!defenderSnapshot.exists) throw new ArenaError("ARENA_GHOST_NOT_FOUND", "상대 Ghost를 찾을 수 없습니다.");
    const defender = defenderSnapshot.data() || {};
    if (defender.ownerUid === uid) throw new ArenaError("ARENA_FORBIDDEN", "자신의 Ghost와는 배틀할 수 없습니다.");
    if (
      defender.status !== "active" ||
      defender.schemaVersion !== ARENA_GHOST_SCHEMA_VERSION ||
      defender.snapshotVersion !== ARENA_GHOST_SNAPSHOT_VERSION
    ) {
      throw new ArenaError("ARENA_INVALID_REQUEST", "현재 배틀할 수 없는 Ghost입니다.", null, 422);
    }

    const ownerGhostIds = Array.isArray(ownerSnapshot.data?.()?.ghostIds)
      ? [...new Set(ownerSnapshot.data().ghostIds.filter((id) => typeof id === "string"))]
      : [];
    const ownerGhostRefs = ownerGhostIds.map((id) => db.doc(`arena_ghosts/${id}`));
    const sourceRef = defender.sourceSlotId && defender.sourceCombatIdentityId
      ? db.doc(`users/${defender.ownerUid}/slots/${defender.sourceSlotId}`)
      : null;
    const secondaryRefs = [...ownerGhostRefs, ...(sourceRef ? [sourceRef] : [])];
    const secondarySnapshots = secondaryRefs.length
      ? await transaction.getAll(...secondaryRefs)
      : [];
    const activeGhostCount = Math.min(3, secondarySnapshots
      .slice(0, ownerGhostRefs.length)
      .filter((snapshot) => snapshot.exists && snapshot.data()?.status === "active").length);
    const sourceSnapshot = sourceRef ? secondarySnapshots[secondarySnapshots.length - 1] : null;
    const projectionAsOf = new Date(Math.max(
      requestReceivedAt.getTime(),
      snapshotUpdateMs(slotSnapshot),
      snapshotUpdateMs(sourceSnapshot)
    ));
    const projectedAttacker = (deps.projectAttacker || projectArenaSlot)(slotSnapshot, projectionAsOf);
    const attackerIdentityId = createCombatIdentityId({
      ownerUid: uid,
      digimonInstanceId: projectedAttacker.slot.digimonInstanceId,
      combatRevision: projectedAttacker.slot.combatRevision,
    });
    const defenderProjection = resolveDefenderProjection({
      ghost: defender,
      sourceSnapshot,
      requestReceivedAt: projectionAsOf,
      projectSource: deps.projectDefenderSource,
    });
    if (defenderProjection.status === "terminal_error") {
      throw new ArenaError("ARENA_COMBAT_IDENTITY_STALE", "방어 Ghost 원본을 검증하지 못했습니다.");
    }
    if (!['resolved', 'deferred'].includes(defenderProjection.status)) {
      throw new ArenaError("ARENA_SOURCE_READ_UNAVAILABLE", "방어 Ghost 원본 projection을 처리하지 못했습니다.", null, null, { retryable: true });
    }

    const attackerRecordRef = db.doc(`arena_combat_records/${attackerIdentityId}`);
    const attackerRegistrationRef = db.doc(`arena_ghost_registrations/${createRegistrationKey({ ownerUid: uid, combatIdentityId: attackerIdentityId })}`);
    const attackerSeasonRef = db.doc(`arena_season_records/${createSeasonRecordId({ seasonId, ownerUid: uid })}`);
    const defenderSeasonRef = db.doc(`arena_season_records/${createSeasonRecordId({ seasonId, ownerUid: defender.ownerUid })}`);
    const defenderRecordRef = defenderProjection.status === "resolved" && defenderProjection.linked
      ? db.doc(`arena_combat_records/${defenderProjection.targetCombatIdentityId}`)
      : null;
    const recordRefs = [attackerRecordRef, attackerRegistrationRef, attackerSeasonRef, defenderSeasonRef, ...(defenderRecordRef ? [defenderRecordRef] : [])];
    const recordSnapshots = await transaction.getAll(...recordRefs);
    const [attackerRecordSnapshot, attackerRegistrationSnapshot, attackerSeasonSnapshot, defenderSeasonSnapshot, defenderRecordSnapshot] = recordSnapshots;
    const attackerRecord = attackerRecordSnapshot.exists ? attackerRecordSnapshot.data() || {} : {};
    if (attackerRecordSnapshot.exists && attackerRecord.digimonIdAtRevision !== projectedAttacker.slot.selectedDigimon) {
      throw new ArenaError("ARENA_COMBAT_IDENTITY_STALE", "공격 슬롯의 전투 identity가 현재 형태와 일치하지 않습니다.");
    }
    let linkedAttackerGhostSnapshot = null;
    if (attackerRegistrationSnapshot.exists) {
      const linkedId = attackerRegistrationSnapshot.data()?.ghostId;
      linkedAttackerGhostSnapshot = secondarySnapshots.find((snapshot) => snapshot.id === linkedId) || null;
      if (!linkedAttackerGhostSnapshot && linkedId) linkedAttackerGhostSnapshot = await transaction.get(db.doc(`arena_ghosts/${linkedId}`));
      const linkedGhost = linkedAttackerGhostSnapshot?.exists ? linkedAttackerGhostSnapshot.data() || {} : {};
      if (
        linkedGhost.sourceCombatIdentityId !== attackerIdentityId ||
        linkedGhost.ownerUid !== uid
      ) linkedAttackerGhostSnapshot = null;
    }

    const attackerSnapshot = canonicalizeBattleSnapshot(buildGhostSnapshot({
      slot: { ...projectedAttacker.slot, digimonStats: projectedAttacker.projectedStats },
      digimon: projectedAttacker.digimon,
      combatPowerAtCapture: projectedAttacker.power,
      capturedAt: projectionAsOf,
    }));
    const defenderGhostSnapshot = canonicalizeBattleSnapshot(defender.snapshot);
    const powerBreakdown = {
      attackerBase: projectedAttacker.power,
      attackerActiveGhostBonus: activeGhostCount,
      attackerEffective: projectedAttacker.power + activeGhostCount,
      defenderBase: Number(defender.snapshot.combatPowerAtCapture || 0),
      defenderGhostDefenseBonus: 1,
      defenderEffective: Number(defender.snapshot.combatPowerAtCapture || 0) + 1,
    };
    const engine = (deps.calculateBattle || calculateArenaBattle)({
      seed,
      attacker: { name: attackerSnapshot.digimonName, power: powerBreakdown.attackerEffective, attribute: attackerSnapshot.attribute },
      defender: { name: defender.snapshot.digimonName, power: powerBreakdown.defenderEffective, attribute: defender.snapshot.attribute },
      battleRulesVersion: ARENA_BATTLE_RULES_VERSION,
    });
    const attackerWon = engine.winner === "attacker";
    const occurredAt = projectionAsOf;
    const attackerDelta = combatDelta("attack", attackerWon);
    const defenderDelta = combatDelta("defense", !attackerWon);
    const nextSlot = updateSlotAfterArenaBattle({
      slot: projectedAttacker.slot,
      projectedStats: projectedAttacker.projectedStats,
      attackerWon,
      battleId,
      opponentName: defender.snapshot.digimonName,
      now: occurredAt,
    });
    const responsePayload = { battle: {
      battleId,
      requestId: normalized.requestId,
      attacker: attackerSnapshot,
      defenderGhost: { ghostId: defender.ghostId, snapshot: defenderGhostSnapshot },
      powerBreakdown,
      result: { winnerSide: engine.winner, attackerWon },
      replay: engine.replay,
      attackerSlotOutcome: {
        slotId: normalized.attackerSlotId,
        revision: nextSlot.persistenceRevision,
        digimonStats: nextSlot.digimonStats,
      },
      seasonIdAtBattle: seasonId,
      battleRulesVersionAtBattle: ARENA_BATTLE_RULES_VERSION,
      archive: { archiveId: battleId, status: "pending" },
    }};
    if (jsonBytes(responsePayload.battle.replay) > MAX_REPLAY_BYTES) {
      throw new ArenaError("ARENA_REPLAY_TOO_LARGE", "배틀 replay 크기가 허용 범위를 초과했습니다.");
    }
    const responseHash = createCanonicalRequestHash(responsePayload);
    const archivePayload = buildArchivePayload(responsePayload, { battleId, seasonId, attackerUid: uid, defenderUid: defender.ownerUid });
    const archivePayloadHash = createCanonicalRequestHash(archivePayload);
    const linkStatus = defenderProjection.status === "deferred" ? "deferred" : (defenderProjection.linkStatus || "unlinked");
    const battleDocument = {
      schemaVersion: ARENA_BATTLE_SCHEMA_VERSION, battleId, attackerUid: uid,
      defenderUid: defender.ownerUid, requestId: normalized.requestId, requestHash,
      attackerSlotId: normalized.attackerSlotId, defenderGhostId: defender.ghostId,
      attackerCombatIdentityId: attackerIdentityId,
      defenderSourceCombatIdentityId: defender.sourceCombatIdentityId || null,
      attackerSnapshot, defenderGhostSnapshot, powerBreakdown,
      result: responsePayload.battle.result, responsePayload, responseHash, rngSeed: seed,
      seasonIdAtBattle: seasonId, battleRulesVersionAtBattle: ARENA_BATTLE_RULES_VERSION,
      projectionVersionAtBattle: ARENA_PROJECTION_VERSION,
      recordTargetsAtBattle: {
        attackerCombatIdentityId: attackerIdentityId,
        defenderCombatIdentityId: defenderProjection.targetCombatIdentityId || null,
        attackerGhostId: linkedAttackerGhostSnapshot?.exists ? linkedAttackerGhostSnapshot.id : null,
      },
      requestReceivedAt, projectionAsOf, occurredAt, createdAt: occurredAt,
    };
    if (jsonBytes(battleDocument) > MAX_BATTLE_BYTES) {
      throw new ArenaError("ARENA_REPLAY_TOO_LARGE", "배틀 기록 크기가 허용 범위를 초과했습니다.");
    }

    transaction.set(slotRef, nextSlot);
    transaction.set(attackerRecordRef, applyCombatDocument(attackerRecord, attackerDelta, {
      schemaVersion: 1, ownerUid: uid, combatIdentityId: attackerIdentityId,
      digimonInstanceId: projectedAttacker.slot.digimonInstanceId,
      combatRevision: projectedAttacker.slot.combatRevision,
      digimonIdAtRevision: projectedAttacker.slot.selectedDigimon,
    }, occurredAt));
    if (linkedAttackerGhostSnapshot?.exists) {
      const linkedGhost = linkedAttackerGhostSnapshot.data() || {};
      transaction.update(linkedAttackerGhostSnapshot.ref, {
        formRecordMirror: applyRecordDelta(linkedGhost.formRecordMirror || createEmptyCombatRecord(), attackerDelta),
        updatedAt: occurredAt,
      });
    }
    transaction.update(defenderRef, {
      ownDefenseRecord: {
        wins: Number(defender.ownDefenseRecord?.wins || 0) + (!attackerWon ? 1 : 0),
        losses: Number(defender.ownDefenseRecord?.losses || 0) + (attackerWon ? 1 : 0),
      },
      pendingMirrorCount: Number(defender.pendingMirrorCount || 0) + (defenderProjection.status === "deferred" ? 1 : 0),
      updatedAt: occurredAt,
    });
    if (defenderRecordRef) {
      const defenderRecord = defenderRecordSnapshot?.exists ? defenderRecordSnapshot.data() || {} : {};
      transaction.set(defenderRecordRef, applyCombatDocument(defenderRecord, defenderDelta, {
        schemaVersion: 1, ownerUid: defender.ownerUid,
        combatIdentityId: defenderProjection.targetCombatIdentityId,
        digimonInstanceId: defender.sourceDigimonInstanceId,
        combatRevision: defender.sourceCombatRevision,
        digimonIdAtRevision: defender.snapshot.digimonId,
      }, occurredAt));
      transaction.update(defenderRef, {
        formRecordMirror: applyRecordDelta(defender.formRecordMirror || createEmptyCombatRecord(), defenderDelta),
      });
    }
    transaction.set(attackerSeasonRef, applySeasonDelta(attackerSeasonSnapshot.exists ? attackerSeasonSnapshot.data() : {}, { seasonId, ownerUid: uid }, attackerDelta, occurredAt));
    transaction.set(defenderSeasonRef, applySeasonDelta(defenderSeasonSnapshot.exists ? defenderSeasonSnapshot.data() : {}, { seasonId, ownerUid: defender.ownerUid }, defenderDelta, occurredAt));
    transaction.create(battleRef, battleDocument);
    transaction.create(db.doc(`arena_battle_logs/${battleId}`), {
      battleId, attackerId: uid, defenderId: defender.ownerUid,
      winnerId: attackerWon ? uid : defender.ownerUid, timestamp: occurredAt,
      attackerSlotId: normalized.attackerSlotId, attackerCombatIdentityId: attackerIdentityId,
      attackerParticipantKey: `combat:${attackerIdentityId}`,
      defenderGhostId: defender.ghostId, defenderParticipantKey: `ghost:${defender.ghostId}`,
      attackerSnapshot, defenderGhostSnapshot, powerBreakdown,
      linkStatusAtBattle: linkStatus, seasonIdAtBattle: seasonId,
      battleRulesVersionAtBattle: ARENA_BATTLE_RULES_VERSION,
      logSummary: `${attackerSnapshot.digimonName} vs ${defender.snapshot.digimonName}`,
      archiveId: battleId, archiveStatus: "pending",
    });
    if (defenderProjection.status === "deferred") {
      transaction.create(db.doc(`arena_mirror_outbox/${battleId}`), {
        schemaVersion: 1, battleId, ownerUid: defender.ownerUid, ghostId: defender.ghostId,
        targetCombatIdentityId: defenderProjection.targetCombatIdentityId || defender.sourceCombatIdentityId,
        targetSlotId: defender.sourceSlotId, recordDelta: defenderDelta,
        seasonIdAtBattle: seasonId, battleRulesVersionAtBattle: ARENA_BATTLE_RULES_VERSION,
        projectionVersionAtBattle: ARENA_PROJECTION_VERSION, battleOccurredAt: occurredAt,
        projectionEvidenceAtBattle: defenderProjection.evidence || {},
        status: "pending", attempts: 0, nextAttemptAt: occurredAt, lastAttemptAt: null,
        lastErrorCode: null, lastErrorMessage: null, createdAt: occurredAt, updatedAt: occurredAt,
      });
    }
    transaction.create(db.doc(`arena_archive_outbox/${battleId}`), {
      schemaVersion: 1, battleId, archiveId: battleId, payload: archivePayload,
      payloadHash: archivePayloadHash, status: "pending", attempts: 0,
      nextAttemptAt: occurredAt, leaseExpiresAt: null, lastErrorCode: null,
      createdAt: occurredAt, updatedAt: occurredAt,
    });
    return responsePayload;
  });
}

async function advanceArenaSeason({ expectedSeasonId, nextSeasonName = null, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const transact = deps.runTransaction || ((callback) => db.runTransaction(callback));
  const now = deps.now || new Date();
  return transact(async (transaction) => {
    const ref = db.doc(ARENA_CONFIG_PATH);
    const snapshot = await transaction.get(ref);
    const config = snapshot.exists ? snapshot.data() || {} : {};
    if (Number(config.currentSeasonId) !== Number(expectedSeasonId)) {
      throw new ArenaError("ARENA_IDEMPOTENCY_CONFLICT", "시즌이 이미 전환되었거나 예상 시즌과 다릅니다.");
    }
    const nextSeasonId = Number(expectedSeasonId) + 1;
    transaction.update(ref, {
      currentSeasonId: nextSeasonId,
      seasonName: nextSeasonName || `Season ${nextSeasonId}`,
      previousSeasonId: Number(expectedSeasonId),
      seasonStartedAt: now,
      updatedAt: now,
    });
    return { previousSeasonId: Number(expectedSeasonId), currentSeasonId: nextSeasonId };
  });
}

module.exports = {
  MAX_BATTLE_BYTES,
  MAX_REPLAY_BYTES,
  advanceArenaSeason,
  applySeasonDelta,
  commitArenaBattle,
  normalizeBattleRequest,
  normalizeSeasonRecord,
  resolveDefenderProjection,
  updateSlotAfterArenaBattle,
};
