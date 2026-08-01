"use strict";

const crypto = require("node:crypto");
const { ArenaError } = require("./arenaErrors");
const { getArenaFirestore } = require("./arenaTransactions");
const { projectRealtimeArenaSlot } = require("./realtimeArenaSlotProjection");
const {
  DEFAULT_REALTIME_ARENA_RULES_VERSION,
  createRealtimeArenaRulesSnapshot,
  selectRealtimeArenaCpuOpponent,
} = require("../_generated/gameProjection.cjs");
const {
  REALTIME_ARENA_SCHEMA_VERSION,
  buildParticipantSnapshot,
  createRealtimeBattleId,
  createRequestHash,
  normalizeRequestId,
  normalizeSlotId,
} = require("./realtimeArenaDomain");

const ACTIVE_LIFETIME_MS = 24 * 60 * 60 * 1000;

function getRunner(db, deps) {
  return deps.runTransaction || ((callback) => db.runTransaction(callback));
}

async function createRealtimeCpuBattle({ uid, slotId, requestId, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const now = deps.now || new Date();
  const cpuSeed = deps.cpuSeed || crypto.randomBytes(32).toString("hex");
  const battleSeed = deps.battleSeed || crypto.randomBytes(32).toString("hex");
  const canonicalSlotId = normalizeSlotId(slotId);
  const canonicalRequestId = normalizeRequestId(requestId);
  const battleId = createRealtimeBattleId({ hostUid: uid, requestId: canonicalRequestId });
  const requestHash = createRequestHash({ command: "create", mode: "cpu", slotId: canonicalSlotId });

  return getRunner(db, deps)(async (transaction) => {
    const publicRef = db.doc(`realtimeArenaBattles/${battleId}`);
    const secretRef = db.doc(`realtimeArenaBattleSecrets/${battleId}`);
    const slotRef = db.doc(`users/${uid}/slots/${canonicalSlotId}`);
    const [publicSnapshot, secretSnapshot, slotSnapshot] = await transaction.getAll(publicRef, secretRef, slotRef);
    if (publicSnapshot.exists) {
      const existingBattle = publicSnapshot.data();
      if (
        secretSnapshot.data()?.createRequestHash !== requestHash ||
        existingBattle?.hostUid !== uid ||
        existingBattle?.mode !== "cpu"
      ) {
        throw new ArenaError("ARENA_IDEMPOTENCY_CONFLICT", "같은 requestId가 다른 배틀 생성 요청에 사용되었습니다.");
      }
      return { battle: existingBattle, role: "host", replayed: true };
    }

    const rulesVersion = DEFAULT_REALTIME_ARENA_RULES_VERSION;
    const rulesSnapshot = createRealtimeArenaRulesSnapshot(rulesVersion);
    const rulesSnapshotHash = createRequestHash({ rulesVersion, rulesSnapshot });
    const projected = projectRealtimeArenaSlot(
      slotSnapshot,
      now,
      rulesSnapshot,
      { projectionAsOf: now, requireCombatIdentity: false },
      deps
    );
    const host = buildParticipantSnapshot(projected, rulesSnapshot);
    const cpu = selectRealtimeArenaCpuOpponent({ host: host.public, rules: rulesSnapshot, seed: cpuSeed });
    const nowTimestamp = new Date(now.getTime());
    const publicData = {
      schemaVersion: REALTIME_ARENA_SCHEMA_VERSION,
      battleId,
      mode: "cpu",
      status: "selecting",
      hostUid: uid,
      guestUid: null,
      listing: null,
      lobby: null,
      rulesVersion,
      rulesSnapshot,
      rulesSnapshotHash,
      participants: { host: host.public, guest: cpu },
      round: 1,
      maxRounds: rulesSnapshot.maxRounds,
      stateVersion: 1,
      selectionOpensAt: nowTimestamp,
      presentationEndsAt: null,
      deadlineAt: new Date(now.getTime() + rulesSnapshot.selectionWindowMs),
      currentHp: { host: host.public.maxHp, guest: cpu.maxHp },
      timeoutStreaks: { host: 0, guest: 0 },
      resolvedRounds: [],
      result: null,
      createdAt: nowTimestamp,
      updatedAt: nowTimestamp,
      startedAt: nowTimestamp,
      finishedAt: null,
      expiresAt: new Date(now.getTime() + ACTIVE_LIFETIME_MS),
    };
    const secretData = {
      schemaVersion: REALTIME_ARENA_SCHEMA_VERSION,
      battleId,
      secretVersion: 1,
      createRequestId: canonicalRequestId,
      createRequestHash: requestHash,
      cpuSeed,
      battleSeed,
      participants: {
        host: {
          uid,
          slotId: canonicalSlotId,
          ...host.secret,
          capturedAt: nowTimestamp,
        },
        guest: { kind: "cpu", version: cpu.version, digimonId: cpu.digimonId, capturedAt: nowTimestamp },
      },
      rulesVersion,
      rulesSnapshotHash,
      roundSecrets: {
        "1": { hostSubmission: null, guestSubmission: null, resolved: false, resolvedAt: null, resolutionType: null, resultHash: null },
      },
      latestCommandReceipts: { host: {}, guest: {} },
      createdAt: nowTimestamp,
      updatedAt: nowTimestamp,
    };
    transaction.create(publicRef, publicData);
    transaction.create(secretRef, secretData);
    return { battle: publicData, role: "host", replayed: false };
  });
}

module.exports = { createRealtimeCpuBattle };
