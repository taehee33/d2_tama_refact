"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { runMigration } = require("../scripts/migrateJogressRoomsToGhostV3");

test("legacy waiting·expired·paired를 Ghost v3로 옮기고 활성 방 3개 제한과 백업을 보존한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "d2tamarefact" }, `jogress-migration-${Date.now()}`);
  const db = getFirestore(app);
  const now = new Date("2026-08-04T03:00:00.000Z");
  t.after(async () => {
    for (const name of ["jogress_rooms", "jogress_room_owners", "jogress_room_registrations", "jogress_room_v3_migration_backups"]) await db.recursiveDelete(db.collection(name));
    await deleteApp(app);
  });
  const base = { hostUid: "owner", hostSlotId: 1, hostDigimonId: "BanchoLeomon", hostSlotVersion: "Ver.3" };
  await Promise.all([
    db.doc("jogress_rooms/waiting-a").set({ ...base, status: "waiting", createdAt: new Date("2026-08-01T00:00:00Z") }),
    db.doc("jogress_rooms/waiting-b").set({ ...base, status: "waiting", createdAt: new Date("2026-08-02T00:00:00Z") }),
    db.doc("jogress_rooms/waiting-c").set({ ...base, status: "waiting", createdAt: new Date("2026-08-03T00:00:00Z") }),
    db.doc("jogress_rooms/expired-new").set({ ...base, status: "expired", createdAt: new Date("2026-08-04T00:00:00Z") }),
    db.doc("jogress_rooms/paired-old").set({ ...base, status: "paired", guestUid: "guest", createdAt: new Date("2026-07-01T00:00:00Z") }),
  ]);
  const options = { apply: false, rollback: false, projectId: "d2tamarefact", projectExplicit: true, confirmProjectId: null, allowApplicationDefault: true, roomIds: [] };
  const dryRun = await runMigration(options, { db, now });
  assert.deepEqual(dryRun.totals, { target: 5, waiting: 3, restored: 0, completed: 1, excluded: 1, active: 3 });
  const applied = await runMigration({ ...options, apply: true, confirmProjectId: "d2tamarefact" }, { db, now });
  assert.equal(applied.totals.active, 3);
  const owner = (await db.doc("jogress_room_owners/owner").get()).data();
  assert.deepEqual(owner.activeRoomIds.sort(), ["waiting-a", "waiting-b", "waiting-c"]);
  assert.equal((await db.doc("jogress_rooms/paired-old").get()).data().completionMode, "ghostFallback");
  assert.equal((await db.doc("jogress_rooms/expired-new").get()).data().status, "expired");
  assert.equal((await db.doc("jogress_room_v3_migration_backups/waiting-a").get()).exists, true);

  await runMigration({
    ...options,
    rollback: true,
    roomIds: ["waiting-a"],
    confirmProjectId: "d2tamarefact",
  }, { db, now: new Date("2026-08-04T04:00:00.000Z") });
  const restoredWaiting = (await db.doc("jogress_rooms/waiting-a").get()).data();
  assert.equal(restoredWaiting.schemaVersion, undefined);
  assert.equal(restoredWaiting.status, "waiting");

  await db.doc("jogress_rooms/rollback-expired").set({
    ...base,
    hostUid: "rollback-owner",
    status: "expired",
    createdAt: new Date("2026-08-04T04:30:00.000Z"),
  });
  await runMigration({
    ...options,
    apply: true,
    confirmProjectId: "d2tamarefact",
  }, { db, now: new Date("2026-08-04T05:00:00.000Z") });
  assert.equal((await db.doc("jogress_rooms/rollback-expired").get()).data().status, "waiting");
  const rollbackReport = await runMigration({
    ...options,
    rollback: true,
    roomIds: ["rollback-expired"],
    confirmProjectId: "d2tamarefact",
  }, { db, now: new Date("2026-08-04T06:00:00.000Z") });
  const restoredExpired = (await db.doc("jogress_rooms/rollback-expired").get()).data();
  const ownerAfterRollback = (await db.doc("jogress_room_owners/rollback-owner").get()).data();
  const staleRegistration = await db.collection("jogress_room_registrations")
    .where("roomId", "==", "rollback-expired")
    .get();
  assert.equal(restoredExpired.status, "expired");
  assert.equal(ownerAfterRollback.activeRoomIds.includes("rollback-expired"), false);
  assert.equal(staleRegistration.empty, true);
  assert.equal(rollbackReport.totals.active, 0);
  assert.equal(rollbackReport.totals.excluded, 1);
  assert.equal(rollbackReport.totals.restored, 0);
});
