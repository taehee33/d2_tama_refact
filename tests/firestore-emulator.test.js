"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "d2tamarefact";

function createRuntimeStats(overrides = {}) {
  return {
    isDead: false,
    birthTime: Date.parse("2026-06-20T00:00:00.000Z"),
    lifespanSeconds: 0,
    timeToEvolveSeconds: 999999,
    hungerTimer: 60,
    hungerCountdown: 3600,
    fullness: 5,
    strengthTimer: 60,
    strengthCountdown: 3600,
    strength: 5,
    poopTimer: 120,
    poopCountdown: 7200,
    poopCount: 6,
    maxEnergy: 20,
    sleepSchedule: { start: 23, end: 7, startMinute: 0, endMinute: 0 },
    callStatus: {
      hunger: { isActive: false, startedAt: null, isLogged: false },
      strength: { isActive: false, startedAt: null, isLogged: false },
      sleep: { isActive: false, startedAt: null, isLogged: false },
    },
    careMistakes: 0,
    careMistakeLedger: [],
    injuries: 0,
    isInjured: false,
    activityLogs: [],
    isFrozen: false,
    ...overrides,
  };
}

test("Firestore Emulator에서 revision과 eventId가 원자적·멱등적으로 동작한다", async (t) => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, "Firebase Emulator를 통해 실행해야 합니다.");
  process.env.FIREBASE_PROJECT_ID = PROJECT_ID;
  const app = initializeApp({ projectId: PROJECT_ID }, `emulator-${Date.now()}`);
  const db = getFirestore(app);
  const now = Date.parse("2026-06-21T13:00:00.000Z");
  const slotRef = db.doc("users/emulator-user/slots/slot1");

  t.after(async () => {
    await db.recursiveDelete(db.collection("users"));
    await db.recursiveDelete(db.collection("notification_deliveries"));
    await deleteApp(app);
  });

  await db.doc("users/emulator-user").set({ displayName: "테이머" });
  await slotRef.set({
    revision: 0,
    selectedDigimon: "Agumon",
    isLightsOn: true,
    lastSavedAt: now,
    digimonStats: createRuntimeStats(),
  });

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(slotRef);
    assert.equal(snapshot.data().revision, 0);
    transaction.update(slotRef, { revision: 1 });
  });
  await assert.rejects(
    db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(slotRef);
      const baseRevision = 0;
      if (snapshot.data().revision !== baseRevision) throw new Error("revision-conflict");
      transaction.update(slotRef, { revision: baseRevision + 1 });
    }),
    /revision-conflict/
  );

  const eventRef = slotRef.collection("logs").doc("event-fixed");
  await eventRef.set({ eventId: "event-fixed", type: "TRAIN" });
  await eventRef.set({ eventId: "event-fixed", type: "TRAIN" });
  assert.equal((await slotRef.collection("logs").get()).size, 1);

});
