"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { advanceArenaSeason, commitArenaBattle } = require("../digimon-tamagotchi-frontend/api/_lib/arenaBattleService");
const { registerArenaGhost } = require("../digimon-tamagotchi-frontend/api/_lib/arenaGhostHandlers");
const { runArchiveJobs, runMirrorJobs } = require("../digimon-tamagotchi-frontend/api/_lib/arenaJobs");

function stats(overrides = {}) {
  return {
    isDead: false,
    birthTime: Date.parse("2026-07-19T00:00:00.000Z"),
    lifespanSeconds: 0,
    timeToEvolveSeconds: 999999,
    hungerTimer: 60,
    hungerCountdown: 3600,
    fullness: 5,
    strengthTimer: 60,
    strengthCountdown: 3600,
    strength: 5,
    effort: 2,
    poopTimer: 120,
    poopCountdown: 7200,
    poopCount: 0,
    weight: 20,
    maxEnergy: 20,
    energy: 20,
    battles: 0,
    battlesWon: 0,
    battlesLost: 0,
    totalBattles: 0,
    totalBattlesWon: 0,
    totalBattlesLost: 0,
    sleepSchedule: { start: 23, end: 7, startMinute: 0, endMinute: 0 },
    callStatus: {
      hunger: { isActive: false, startedAt: null, isLogged: false },
      strength: { isActive: false, startedAt: null, isLogged: false },
      sleep: { isActive: false, startedAt: null, isLogged: false },
    },
    activityLogs: [],
    battleLogs: [],
    ...overrides,
  };
}

function slot(life, now) {
  return {
    arenaIdentitySchemaVersion: 1,
    digimonInstanceId: life,
    combatRevision: 1,
    selectedDigimon: "Agumon",
    version: "Ver.1",
    lastSavedAt: now.getTime(),
    persistenceRevision: 3,
    digimonStats: stats({ birthTime: now.getTime() }),
  };
}

test("서버 배틀 transaction과 두 outbox worker가 멱등·정확히 한 번 경계를 지킨다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const projectId = process.env.FIREBASE_PROJECT_ID || "d2tamarefact";
  const app = initializeApp({ projectId }, `arena-battle-${Date.now()}`);
  const db = getFirestore(app);
  const attackerUid = "battle-attacker";
  const defenderUid = "battle-defender";
  const now = new Date();

  t.after(async () => {
    for (const collection of [
      "arena_archive_outbox", "arena_mirror_outbox", "arena_battle_logs", "arena_battles",
      "arena_season_records", "arena_combat_records", "arena_ghost_registrations",
      "arena_ghost_owners", "arena_ghosts", "users",
    ]) await db.recursiveDelete(db.collection(collection));
    await db.doc("game_settings/arena_config").delete().catch(() => {});
    await deleteApp(app);
  });

  await db.doc("game_settings/arena_config").set({
    mode: "active", currentSeasonId: 12, minArenaClientSchemaVersion: 2,
  });
  await db.doc(`users/${attackerUid}/slots/slot1`).set(slot("attacker-life", now));
  await db.doc(`users/${defenderUid}/slots/slot1`).set(slot("defender-life", now));
  const registered = await registerArenaGhost({
    uid: defenderUid,
    slotId: "1",
    deps: {
      db,
      runTransaction: (callback) => db.runTransaction(callback),
      requestReceivedAt: now,
      randomUUID: () => "defender-ghost",
    },
  });
  const defenderGhostId = registered.ghost.ghostId;
  const input = { requestId: "request-same", attackerSlotId: "1", defenderGhostId };
  const deps = {
    db,
    runTransaction: (callback) => db.runTransaction(callback),
    requestReceivedAt: now,
    seed: "fixed-seed",
    calculateBattle: () => ({ winner: "attacker", replay: [{ round: 1, actor: "attacker", hit: true }] }),
  };
  const duplicate = await Promise.all([
    commitArenaBattle({ uid: attackerUid, input, deps }),
    commitArenaBattle({ uid: attackerUid, input, deps }),
  ]);
  assert.deepEqual(duplicate[0], duplicate[1]);
  const battleId = duplicate[0].battle.battleId;
  const attackerSlot = (await db.doc(`users/${attackerUid}/slots/slot1`).get()).data();
  assert.equal(attackerSlot.persistenceRevision, 4);
  assert.equal(attackerSlot.digimonStats.weight, 16);
  assert.equal(attackerSlot.digimonStats.energy, 19);
  assert.equal(attackerSlot.digimonStats.battles, 1);
  assert.equal(attackerSlot.digimonStats.battleLogs[0].battleId, battleId);
  const defenderGhost = (await db.doc(`arena_ghosts/${defenderGhostId}`).get()).data();
  assert.deepEqual(defenderGhost.ownDefenseRecord, { wins: 0, losses: 1 });
  assert.equal(defenderGhost.formRecordMirror.defenseLosses, 1);
  const attackerSeason = (await db.collection("arena_season_records").where("ownerUid", "==", attackerUid).get()).docs[0].data();
  const defenderSeason = (await db.collection("arena_season_records").where("ownerUid", "==", defenderUid).get()).docs[0].data();
  assert.equal(attackerSeason.attackWins, 1);
  assert.equal(defenderSeason.defenseLosses, 1);
  assert.equal((await db.doc(`arena_archive_outbox/${battleId}`).get()).data().status, "pending");
  await assert.rejects(
    commitArenaBattle({ uid: attackerUid, input: { ...input, defenderGhostId: "ghost_different" }, deps }),
    (error) => error.code === "ARENA_IDEMPOTENCY_CONFLICT"
  );

  let archiveAttempts = 0;
  const firstArchiveDueAt = (await db.doc(`arena_archive_outbox/${battleId}`).get()).data().nextAttemptAt.toDate();
  const failedArchive = await runArchiveJobs({ deps: {
    db, now: new Date(firstArchiveDueAt.getTime() + 1),
    archiveWriter: async () => { archiveAttempts += 1; throw new Error("supabase unavailable"); },
  }});
  assert.equal(failedArchive.results[0].status, "pending");
  const retryAt = (await db.doc(`arena_archive_outbox/${battleId}`).get()).data().nextAttemptAt.toDate();
  const recovered = await runArchiveJobs({ deps: {
    db, now: new Date(retryAt.getTime() + 1), archiveWriter: async () => { archiveAttempts += 1; },
  }});
  assert.equal(recovered.results[0].status, "ready");
  assert.equal(archiveAttempts, 2);
  const readyJob = (await db.doc(`arena_archive_outbox/${battleId}`).get()).data();
  assert.equal(readyJob.payload, null);
  assert.equal((await db.doc(`arena_battle_logs/${battleId}`).get()).data().archiveStatus, "ready");

  const mirrorBattleId = "battle_mirror_job";
  await db.doc(`arena_ghosts/${defenderGhostId}`).update({ pendingMirrorCount: 1 });
  await db.doc(`arena_mirror_outbox/${mirrorBattleId}`).set({
    schemaVersion: 1, battleId: mirrorBattleId, ownerUid: defenderUid,
    ghostId: defenderGhostId, targetCombatIdentityId: defenderGhost.sourceCombatIdentityId,
    recordDelta: { defenseWins: 1, defenseLosses: 0 }, status: "pending", attempts: 0,
    nextAttemptAt: now, projectionEvidenceAtBattle: {}, createdAt: now, updatedAt: now,
  });
  const jobs = [(await db.doc(`arena_mirror_outbox/${mirrorBattleId}`).get())];
  const mirrorResults = await Promise.all([
    runMirrorJobs({ deps: { db, now, jobs, projector: async () => ({ status: "linked" }) } }),
    runMirrorJobs({ deps: { db, now, jobs, projector: async () => ({ status: "linked" }) } }),
  ]);
  assert.equal(mirrorResults.flatMap((result) => result.results).filter((result) => result.status === "applied").length, 1);
  const finalGhost = (await db.doc(`arena_ghosts/${defenderGhostId}`).get()).data();
  assert.equal(finalGhost.pendingMirrorCount, 0);
  assert.equal(finalGhost.formRecordMirror.defenseWins, 1);

  const seasonTransitions = await Promise.allSettled([
    advanceArenaSeason({ expectedSeasonId: 12, deps: { db, now } }),
    advanceArenaSeason({ expectedSeasonId: 12, deps: { db, now } }),
  ]);
  assert.equal(
    seasonTransitions.filter((result) => result.status === "fulfilled").length,
    1,
    seasonTransitions.map((result) => result.status === "rejected"
      ? `${result.reason?.code || "error"}:${result.reason?.message}`
      : "fulfilled").join(", ")
  );
  assert.equal((await db.doc("game_settings/arena_config").get()).data().currentSeasonId, 13);
  assert.equal((await db.doc(`arena_battles/${battleId}`).get()).data().seasonIdAtBattle, 12);
});
