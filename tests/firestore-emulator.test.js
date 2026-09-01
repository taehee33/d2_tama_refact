"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const {
  acknowledgeUrgentCareDeliveries,
  listPendingUrgentDeliveries,
  prepareUrgentCareNotifications,
} = require("../digimon-tamagotchi-frontend/api/_lib/urgentCareNotifications");
const {
  commitWrites,
  getDocument,
  listDocuments,
} = require("../digimon-tamagotchi-frontend/api/_lib/firestoreAdmin");
const {
  listNotificationSubscribers,
} = require("../digimon-tamagotchi-frontend/api/_lib/notificationSubscribers");
const {
  commitCareMistakeV2Command,
  nativeInitCareMistakeV2Slot,
} = require("../digimon-tamagotchi-frontend/api/_lib/careMistakeV2Service");

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

test("Care Mistake V2 저장 경계는 실제 Timestamp와 legacy 필드 삭제를 보장한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  process.env.FIREBASE_PROJECT_ID = PROJECT_ID;
  const app = initializeApp({ projectId: PROJECT_ID }, `care-v2-boundary-${Date.now()}`);
  const db = getFirestore(app);
  const slotRef = db.doc("users/care-v2-emulator/slots/slot7");
  const createdAt = Date.parse("2026-08-30T00:00:00.000Z");
  const initialSlot = {
    slotInstanceId: "slot-life-emulator",
    digimonInstanceId: "digimon-life-emulator",
    evolutionStageInstanceId: "stage-emulator",
    selectedDigimon: "Botamon",
    createdAt,
    lastSavedAt: createdAt,
    digimonStats: {
      birthTime: createdAt,
      evolutionStageStartedAt: createdAt,
      lastSavedAt: createdAt,
      lifespanSeconds: 0,
      timeToEvolveSeconds: 8,
      hungerTimer: 0,
      hungerCountdown: 0,
      strengthTimer: 0,
      strengthCountdown: 0,
      poopTimer: 999,
      poopCountdown: 999 * 60,
      fullness: 3,
      careMistakes: 0,
    },
  };

  t.after(async () => {
    await db.recursiveDelete(db.doc("users/care-v2-emulator"));
    await deleteApp(app);
  });

  const initialized = await nativeInitCareMistakeV2Slot({
    uid: "care-v2-emulator",
    slotId: 7,
    commandId: "native-emulator",
    slotData: initialSlot,
    deps: { db, now: new Date(createdAt) },
  });
  await slotRef.update({ dailySleepMistake: true });

  const state = initialized.careMistakeState;
  const legacyResult = await commitCareMistakeV2Command({
    uid: "care-v2-emulator",
    slotId: 7,
    command: {
      commandId: "state-emulator-1",
      commandType: "STATE_MUTATION",
      careSchemaVersion: 2,
      rootReceiptId: state.rootReceiptId,
      receiptId: state.receiptId,
      evolutionStageInstanceId: state.evolutionStageInstanceId,
      expectedRevision: 1,
      payload: {
        updateData: {
          lastSavedAt: createdAt + 1_000,
          updatedAt: { _methodName: "serverTimestamp" },
          lastSavedAtServer: { _methodName: "serverTimestamp" },
          dailySleepMistake: { _methodName: "deleteField" },
          digimonStats: { fullness: 4 },
        },
      },
    },
    deps: { db, now: new Date(createdAt + 1_000) },
  });
  const currentResult = await commitCareMistakeV2Command({
    uid: "care-v2-emulator",
    slotId: 7,
    command: {
      commandId: "state-emulator-2",
      commandType: "STATE_MUTATION",
      careSchemaVersion: 2,
      rootReceiptId: state.rootReceiptId,
      receiptId: state.receiptId,
      evolutionStageInstanceId: state.evolutionStageInstanceId,
      expectedRevision: 2,
      payload: {
        updateData: {
          lastSavedAt: createdAt + 2_000,
          digimonStats: { fullness: 5 },
        },
      },
    },
    deps: { db, now: new Date(createdAt + 2_000) },
  });

  const stored = (await slotRef.get()).data();
  assert.equal(initialized.revision, 1);
  assert.equal(legacyResult.revision, 2);
  assert.equal(currentResult.revision, 3);
  assert.equal(stored.revision, 3);
  assert.ok(stored.updatedAt instanceof Timestamp);
  assert.ok(stored.lastSavedAtServer instanceof Timestamp);
  assert.equal(stored.updatedAt.toMillis(), createdAt + 2_000);
  assert.equal(stored.lastSavedAtServer.toMillis(), createdAt + 2_000);
  assert.equal(Object.hasOwn(stored, "dailySleepMistake"), false);
  assert.equal(JSON.stringify(stored).includes("_methodName"), false);
  assert.equal(stored.slotInstanceId, initialSlot.slotInstanceId);
  assert.equal(stored.digimonInstanceId, initialSlot.digimonInstanceId);
  assert.equal(stored.selectedDigimon, initialSlot.selectedDigimon);
  assert.equal(stored.digimonStats.birthTime, initialSlot.digimonStats.birthTime);
  assert.equal(
    stored.digimonStats.evolutionStageStartedAt,
    initialSlot.digimonStats.evolutionStageStartedAt
  );
  assert.equal(stored.digimonStats.fullness, 5);
  assert.equal(stored.careMistakeState.rootReceiptId, state.rootReceiptId);
});
