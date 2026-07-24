"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  acknowledgeUrgentCareDeliveries,
  listPendingUrgentDeliveries,
  prepareUrgentCareNotifications,
} = require("../api/_lib/urgentCareNotifications");
const {
  commitWrites,
  getDocument,
  listDocuments,
} = require("../digimon-tamagotchi-frontend/api/_lib/firestoreAdmin");
const {
  listNotificationSubscribers,
} = require("../digimon-tamagotchi-frontend/api/_lib/notificationSubscribers");

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

test("Firestore Emulator에서 revision, eventId, 알림 delivery가 원자적·멱등적으로 동작한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
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
  await db.doc("users/emulator-user/settings/main").set({
    isNotificationEnabled: true,
    discordWebhookUrl: "https://discord.com/api/webhooks/test/token",
  });
  await slotRef.set({
    revision: 0,
    notificationEligible: true,
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

  const initialSubscribers = await listNotificationSubscribers();
  assert.deepEqual(initialSubscribers.map((subscriber) => subscriber.uid), ["emulator-user"]);
  await db.doc("users/emulator-user/settings/main").update({ isNotificationEnabled: false });
  assert.equal((await listNotificationSubscribers()).length, 0);
  await db.doc("users/emulator-user/settings/main").update({ isNotificationEnabled: true });
  const restoredSubscribers = await listNotificationSubscribers();
  assert.deepEqual(restoredSubscribers.map((subscriber) => subscriber.uid), ["emulator-user"]);

  const prepareArgs = {
    subscribers: restoredSubscribers,
    getDocumentByPath: getDocument,
    listCollectionDocuments: listDocuments,
    listPendingDeliveryDocuments: listPendingUrgentDeliveries,
    commit: commitWrites,
    currentTime: new Date(now),
  };
  const first = await prepareUrgentCareNotifications(prepareArgs);
  const second = await prepareUrgentCareNotifications(prepareArgs);
  assert.equal(first.summary.newDeliveries, 1);
  assert.equal(second.summary.reusedDeliveries, 1);
  assert.equal(first.reports[0].deliveryIds[0], second.reports[0].deliveryIds[0]);

  const deliveryId = first.reports[0].deliveryIds[0];
  const firstAck = await acknowledgeUrgentCareDeliveries({
    deliveryIds: [deliveryId],
    getDocumentByPath: getDocument,
    commit: commitWrites,
    currentTime: new Date(now + 1000),
  });
  const secondAck = await acknowledgeUrgentCareDeliveries({
    deliveryIds: [deliveryId],
    getDocumentByPath: getDocument,
    commit: commitWrites,
    currentTime: new Date(now + 2000),
  });
  assert.equal(firstAck.acknowledged, 1);
  assert.equal(secondAck.alreadyAcknowledged, 1);
});
