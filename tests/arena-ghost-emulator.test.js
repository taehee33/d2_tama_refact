"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  deleteArenaGhost,
  registerArenaGhost,
} = require("../digimon-tamagotchi-frontend/api/_lib/arenaGhostHandlers");

function createRuntimeStats(overrides = {}) {
  return {
    isDead: false,
    birthTime: Date.parse("2026-07-18T00:00:00.000Z"),
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
    maxEnergy: 20,
    energy: 20,
    sleepSchedule: { start: 23, end: 7, startMinute: 0, endMinute: 0 },
    callStatus: {
      hunger: { isActive: false, startedAt: null, isLogged: false },
      strength: { isActive: false, startedAt: null, isLogged: false },
      sleep: { isActive: false, startedAt: null, isLogged: false },
    },
    activityLogs: [],
    ...overrides,
  };
}

test("Ghost 등록 transaction이 중복 identity와 최대 3개 경쟁을 직렬화한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const projectId = process.env.FIREBASE_PROJECT_ID || "d2tamarefact";
  const app = initializeApp({ projectId }, `arena-ghost-${Date.now()}`);
  const db = getFirestore(app);
  const uid = "ghost-owner";
  const requestReceivedAt = new Date();
  let nextId = 0;
  const deps = {
    db,
    runTransaction: (callback) => db.runTransaction(callback),
    requestReceivedAt,
    randomUUID: () => `id-${++nextId}`,
  };

  t.after(async () => {
    await db.recursiveDelete(db.collection("arena_ghosts"));
    await db.recursiveDelete(db.collection("arena_ghost_owners"));
    await db.recursiveDelete(db.collection("arena_ghost_registrations"));
    await db.recursiveDelete(db.collection("arena_combat_records"));
    await db.recursiveDelete(db.collection("users"));
    await db.doc("game_settings/arena_config").delete().catch(() => {});
    await deleteApp(app);
  });

  await db.doc("game_settings/arena_config").set({ mode: "active" });
  for (let index = 1; index <= 5; index += 1) {
    await db.doc(`users/${uid}/slots/slot${index}`).set({
      arenaIdentitySchemaVersion: 1,
      digimonInstanceId: `life-${index}`,
      combatRevision: 1,
      selectedDigimon: "Agumon",
      version: "Ver.1",
      lastSavedAt: requestReceivedAt.getTime(),
      digimonStats: createRuntimeStats({ birthTime: requestReceivedAt.getTime() }),
    });
  }

  const duplicateResults = await Promise.allSettled([
    registerArenaGhost({ uid, slotId: "1", deps }),
    registerArenaGhost({ uid, slotId: "slot1", deps }),
  ]);
  assert.equal(duplicateResults.filter((result) => result.status === "fulfilled").length, 1);
  const duplicateFailure = duplicateResults.find((result) => result.status === "rejected");
  assert.equal(duplicateFailure.reason.code, "ARENA_GHOST_ALREADY_REGISTERED");

  const capacityResults = await Promise.allSettled(
    [2, 3, 4, 5].map((slotId) => registerArenaGhost({ uid, slotId, deps }))
  );
  assert.equal(capacityResults.filter((result) => result.status === "fulfilled").length, 2);
  assert.equal(
    capacityResults.filter(
      (result) => result.status === "rejected" && result.reason.code === "ARENA_GHOST_LIMIT_REACHED"
    ).length,
    2
  );
  const owner = (await db.doc(`arena_ghost_owners/${uid}`).get()).data();
  assert.equal(owner.ghostIds.length, 3);

  const firstGhostId = owner.ghostIds[0];
  const ghostRef = db.doc(`arena_ghosts/${firstGhostId}`);
  const capturedSnapshot = (await ghostRef.get()).data().snapshot;
  await db.doc(`users/${uid}/slots/slot1`).update({
    selectedDigimon: "Greymon",
    combatRevision: 2,
  });
  assert.deepEqual((await ghostRef.get()).data().snapshot, capturedSnapshot);

  await ghostRef.update({ pendingMirrorCount: 1 });
  await assert.rejects(
    deleteArenaGhost({ uid, ghostId: firstGhostId, deps: { ...deps, now: requestReceivedAt } }),
    (error) => error.code === "ARENA_GHOST_SYNC_PENDING"
  );
  await ghostRef.update({ pendingMirrorCount: 0 });
  const deleted = await deleteArenaGhost({
    uid,
    ghostId: firstGhostId,
    deps: { ...deps, now: requestReceivedAt },
  });
  assert.equal(deleted.deletedGhostId, firstGhostId);
  assert.equal((await ghostRef.get()).exists, false);
});
