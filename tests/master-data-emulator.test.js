"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  restoreMasterData,
  saveMasterData,
} = require("../digimon-tamagotchi-frontend/api/_lib/masterDataService");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "d2tamarefact";

function overrides(name) {
  return {
    ver1: { Koromon: { name } },
    ver2: {},
    ver3: {},
    ver4: {},
    ver5: {},
  };
}

function saveInput({ requestId, expectedRevision, name }) {
  return {
    requestId,
    expectedRevision,
    actionType: "save_row",
    note: `이름 변경: ${name}`,
    versionLabel: "Ver.1",
    targetDigimonId: "Koromon",
    overrides: overrides(name),
  };
}

test("마스터 데이터 Admin transaction은 revision·멱등성·복원을 원자적으로 보장한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  process.env.FIREBASE_PROJECT_ID = PROJECT_ID;
  const app = initializeApp({ projectId: PROJECT_ID }, `master-data-${Date.now()}`);
  const db = getFirestore(app);
  const activeRef = db.doc("game_settings/digimon_master_data");
  const snapshotsRef = activeRef.collection("snapshots");
  const decodedToken = { uid: "operator-1", name: "운영자" };
  const firstNow = new Date("2026-08-09T03:00:00.000Z");

  t.after(async () => {
    await db.recursiveDelete(activeRef);
    await deleteApp(app);
  });

  await activeRef.set({ ver1Overrides: {} });
  const firstInput = saveInput({
    requestId: "save-1",
    expectedRevision: 0,
    name: "코로몬 A",
  });
  const first = await saveMasterData({
    decodedToken,
    input: firstInput,
    deps: { db, now: firstNow },
  });

  assert.equal(first.revisionBefore, 0);
  assert.equal(first.revisionAfter, 1);
  assert.equal((await activeRef.get()).data().revision, 1);
  assert.equal((await snapshotsRef.get()).size, 1);

  const retried = await saveMasterData({
    decodedToken,
    input: firstInput,
    deps: { db, now: new Date("2026-08-09T03:01:00.000Z") },
  });
  assert.deepEqual(retried, first);
  assert.equal((await activeRef.get()).data().revision, 1);
  assert.equal((await snapshotsRef.get()).size, 1);

  await assert.rejects(
    saveMasterData({
      decodedToken,
      input: { ...firstInput, note: "같은 키의 다른 요청" },
      deps: { db },
    }),
    (error) => error.code === "IDEMPOTENCY_KEY_REUSED" && error.status === 409
  );
  await assert.rejects(
    saveMasterData({
      decodedToken,
      input: saveInput({
        requestId: "stale-save",
        expectedRevision: 0,
        name: "코로몬 stale",
      }),
      deps: { db },
    }),
    (error) =>
      error.code === "MASTER_DATA_REVISION_CONFLICT" &&
      error.details.currentRevision === 1
  );

  const second = await saveMasterData({
    decodedToken,
    input: saveInput({
      requestId: "save-2",
      expectedRevision: 1,
      name: "코로몬 B",
    }),
    deps: { db, now: new Date("2026-08-09T03:02:00.000Z") },
  });
  assert.equal(second.revisionAfter, 2);

  const restored = await restoreMasterData({
    decodedToken,
    input: {
      requestId: "restore-1",
      expectedRevision: 2,
      snapshotId: first.snapshotId,
      note: "첫 상태 복원",
    },
    deps: { db, now: new Date("2026-08-09T03:03:00.000Z") },
  });
  const restoredActive = (await activeRef.get()).data();
  assert.equal(restored.revisionAfter, 3);
  assert.equal(restoredActive.revision, 3);
  assert.equal(restoredActive.ver1Overrides.Koromon.name, "코로몬 A");
  assert.equal((await snapshotsRef.get()).size, 3);

  const beforeFailure = (await activeRef.get()).data();
  await assert.rejects(
    saveMasterData({
      decodedToken,
      input: saveInput({
        requestId: "forced-failure",
        expectedRevision: 3,
        name: "저장되면 안 됨",
      }),
      deps: {
        db,
        runTransaction: (callback) =>
          db.runTransaction(async (transaction) => {
            await callback(transaction);
            throw new Error("forced-transaction-failure");
          }),
      },
    }),
    /forced-transaction-failure/
  );
  const afterFailure = (await activeRef.get()).data();
  assert.deepEqual(afterFailure, beforeFailure);
  assert.equal((await snapshotsRef.get()).size, 3);
});
