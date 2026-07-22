"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { createSeasonRecordId } = require("../digimon-tamagotchi-frontend/api/_lib/arenaDomain");
const { deleteArenaGhost } = require("../digimon-tamagotchi-frontend/api/_lib/arenaGhostHandlers");
const { runMigration } = require("../scripts/migrateArenaGhosts");

function entry(ownerUid, wins, losses, snapshot = {}) {
  return {
    userId: ownerUid,
    tamerName: `테이머-${ownerUid}`,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    digimonSnapshot: {
      digimonId: "Agumon",
      digimonName: "아구몬",
      slotVersion: "Ver.1",
      stage: "Child",
      sprite: 240,
      attackSprite: 4,
      stats: { power: 40, type: "Vaccine", age: 3, weight: 20 },
      ...snapshot,
    },
    record: {
      wins,
      losses,
      seasonWins: wins,
      seasonLosses: losses,
      seasonId: 12,
    },
  };
}

function options(projectId, overrides = {}) {
  return {
    apply: false,
    limit: Number.POSITIVE_INFINITY,
    projectId,
    projectExplicit: true,
    confirmProjectId: null,
    reportPath: null,
    resumeAfter: null,
    allowApplicationDefault: false,
    ...overrides,
  };
}

test("legacy Ghost migration이 dry-run·resume·원형 보존·재실행 멱등성을 지킨다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const projectId = `${process.env.FIREBASE_PROJECT_ID || "d2tamarefact"}-migration`;
  const app = initializeApp({ projectId }, `arena-migration-${Date.now()}`);
  const db = getFirestore(app);
  const now = new Date("2026-07-22T00:00:00.000Z");
  const ids = ["legacy-a", "legacy-b", "legacy-c", "legacy-d"];

  t.after(async () => {
    for (const collection of ["arena_season_records", "arena_ghost_owners", "arena_ghosts", "arena_battle_logs", "arena_entries"]) {
      await db.recursiveDelete(db.collection(collection));
    }
    await db.doc("game_settings/arena_config").delete().catch(() => {});
    await deleteApp(app);
  });

  await db.doc("game_settings/arena_config").set({ mode: "active", currentSeasonId: 12 });
  await db.doc("arena_entries/legacy-a").set(entry("owner-1", 3, 1));
  await db.doc("arena_entries/legacy-b").set(entry("owner-1", 2, 4));
  await db.doc("arena_entries/legacy-c").set(entry("owner-1", 1, 0));
  await db.doc("arena_entries/legacy-d").set(entry("owner-1", 5, 2, {
    digimonId: null,
    digimonName: "지원되지 않음",
    stats: null,
  }));
  await db.doc("arena_battle_logs/legacy-log").set({
    myEntryId: "legacy-a",
    defenderEntryId: "legacy-d",
  });

  const firstPage = await runMigration(options(projectId, { limit: 2 }), { db, now });
  assert.deepEqual(firstPage.processedEntryIds, ["legacy-a", "legacy-b"]);
  const secondPage = await runMigration(options(projectId, { resumeAfter: firstPage.nextResumeAfter }), { db, now });
  assert.deepEqual(secondPage.processedEntryIds, ["legacy-c", "legacy-d"]);
  assert.equal((await db.collection("arena_ghosts").get()).size, 0);
  assert.equal((await db.collection("arena_season_records").get()).size, 0);
  assert.equal(firstPage.writesPerformed + secondPage.writesPerformed, 0);

  const applyOptions = options(projectId, {
    apply: true,
    confirmProjectId: projectId,
  });
  const applied = await runMigration(applyOptions, { db, now });
  assert.equal(applied.created, 3);
  assert.equal(applied.disabled, 1);
  assert.equal(applied.errors, 0);
  assert.equal(applied.originalDeletes, 0);
  assert.equal(applied.accountingValid, true);
  assert.equal(applied.overCapacityOwners[0].count, 4);
  assert.equal(applied.legacyLogReferences.resolvableReferenceCount, 2);
  assert.equal((await db.collection("arena_entries").get()).size, 4);
  const ghostSnapshots = await Promise.all(ids.map((id) => db.doc(`arena_ghosts/${id}`).get()));
  assert.deepEqual(ghostSnapshots.map((snapshot) => snapshot.id), ids);
  assert.equal(ghostSnapshots[3].data().status, "disabled");
  assert.equal(ghostSnapshots[0].data().sourceCombatIdentityId, null);
  assert.equal(ghostSnapshots[0].data().snapshot.combatPowerAtCapture, 30);
  assert.equal(ghostSnapshots[0].data().legacyRecord.breakdownKnown, false);
  const owner = (await db.doc("arena_ghost_owners/owner-1").get()).data();
  assert.deepEqual(owner.ghostIds, ids);

  const seasonId = createSeasonRecordId({ seasonId: 12, ownerUid: "owner-1" });
  const season = (await db.doc(`arena_season_records/${seasonId}`).get()).data();
  assert.equal(season.legacyUnclassifiedWins, 11);
  assert.equal(season.legacyUnclassifiedLosses, 7);
  assert.equal(season.attackWins, 0);
  assert.equal(season.defenseWins, 0);

  const rerun = await runMigration(applyOptions, { db, now: new Date(now.getTime() + 1000) });
  assert.equal(rerun.created, 0);
  assert.equal(rerun.disabled, 0);
  assert.equal(rerun.skipped, 4);
  assert.equal(rerun.seasonRecordsChanged, 0);
  assert.equal(rerun.seasonRecordsSkipped, 1);
  assert.equal(rerun.writesPerformed, 0);
  assert.equal((await db.collection("arena_entries").get()).size, 4);

  await db.doc("arena_ghosts/legacy-a").update({
    "snapshot.combatPowerAtCapture": 0,
    "migration.schemaVersion": 1,
    "migration.powerProjectionVersion": 0,
  });
  const repairDryRun = await runMigration(options(projectId), { db, now: new Date(now.getTime() + 1500) });
  assert.equal(repairDryRun.correctedGhostsPlanned, 1);
  assert.equal(repairDryRun.powerMismatchesPlanned, 1);
  assert.deepEqual(repairDryRun.ghostPowerCorrections, [{
    ghostId: "legacy-a",
    gameVersion: "Ver.1",
    digimonId: "Agumon",
    previousPower: 0,
    correctedPower: 30,
  }]);
  const repaired = await runMigration(applyOptions, { db, now: new Date(now.getTime() + 1600) });
  assert.equal(repaired.correctedGhostsApplied, 1);
  assert.equal(repaired.powerMismatchesApplied, 1);
  assert.equal(repaired.writesPerformed, 1);
  assert.equal((await db.doc("arena_ghosts/legacy-a").get()).data().snapshot.combatPowerAtCapture, 30);

  const postApplyDryRun = await runMigration(options(projectId), { db, now: new Date(now.getTime() + 2000) });
  assert.equal(postApplyDryRun.created, 0);
  assert.equal(postApplyDryRun.disabled, 0);
  assert.equal(postApplyDryRun.skipped, 4);
  assert.equal(postApplyDryRun.seasonRecordsChanged, 0);
  assert.equal(postApplyDryRun.seasonRecordsSkipped, 1);
  assert.equal(postApplyDryRun.writesPerformed, 0);

  const deleted = await deleteArenaGhost({
    uid: "owner-1",
    ghostId: "legacy-d",
    deps: { db, now, runTransaction: (callback) => db.runTransaction(callback) },
  });
  assert.equal(deleted.deletedGhostId, "legacy-d");
  assert.equal((await db.doc("arena_ghosts/legacy-d").get()).exists, false);
  assert.equal((await db.doc("arena_entries/legacy-d").get()).exists, true);
  assert.equal((await db.doc("arena_battle_logs/legacy-log").get()).exists, true);
});
