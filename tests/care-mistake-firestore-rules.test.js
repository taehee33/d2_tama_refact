"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  runTransaction,
  setDoc,
  updateDoc,
} = require("firebase/firestore");

function parseEmulatorHost(value) {
  const [host, port] = String(value || "127.0.0.1:8080").split(":");
  return { host, port: Number(port) || 8080 };
}

function slotProjection(count, stageId = "stage-1") {
  return {
    careMistakes: count,
    unresolvedCareMistakeCount: count,
    latestUnresolvedCareMistakeIncidentId: count ? "incident-1" : null,
    latestCareMistakeAt: count ? 1000 : null,
    careMistakeSchemaVersion: 1,
    careMistakeReconciliationVersion: 1,
    careMistakeReconciliationStatus: "verified",
    evolutionStageInstanceId: stageId,
  };
}

test("케어미스 incident·로그·projection·receipt transaction만 Rules를 통과한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const emulator = parseEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST);
  const testEnvironment = await initializeTestEnvironment({
    projectId: `care-mistake-rules-${Date.now()}`,
    firestore: {
      ...emulator,
      rules: fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
  t.after(() => testEnvironment.cleanup());

  const db = testEnvironment.authenticatedContext("alice").firestore();
  const slotRef = doc(db, "users/alice/slots/slot1");
  const incidentRef = doc(db, "users/alice/slots/slot1/careMistakeIncidents/incident-1");
  const logRef = doc(db, "users/alice/slots/slot1/logs/event-1");
  const receiptRef = doc(db, "users/alice/slots/slot1/gameTransitions/transition-1");

  await setDoc(slotRef, {
    revision: 0,
    slotInstanceIdSchemaVersion: 1,
    slotInstanceId: "slot-life-1",
    arenaIdentitySchemaVersion: 1,
    digimonInstanceId: "digimon-life-1",
    combatRevision: 1,
    selectedDigimon: "Agumon",
    ...slotProjection(0),
    digimonStats: {},
  });

  await assertSucceeds(runTransaction(db, async (transaction) => {
    await transaction.get(slotRef);
    transaction.set(incidentRef, {
      incidentId: "incident-1",
      transitionId: "transition-1",
      eventId: "event-1",
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-life-1",
      evolutionStageInstanceId: "stage-1",
      occurredAt: 1000,
      reasonKey: "hunger_call",
      text: "케어미스",
      status: "unresolved",
      resolvedAt: null,
      resolvedBy: null,
      previousUnresolvedIncidentId: null,
    });
    transaction.set(logRef, {
      eventId: "event-1",
      transitionId: "transition-1",
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-life-1",
      evolutionStageInstanceId: "stage-1",
      type: "CAREMISTAKE",
      text: "케어미스",
      timestamp: 1000,
    });
    transaction.update(slotRef, {
      ...slotProjection(1),
      revision: 1,
      lastGameTransitionId: "transition-1",
    });
    transaction.set(receiptRef, {
      schemaVersion: 1,
      transitionId: "transition-1",
      clientInstanceId: "client-1",
      localSequence: 1,
      parentTransitionId: null,
      transitionType: "CARE_MISTAKE_OCCURRED",
      baseRevision: 0,
      resultRevision: 1,
      eventIds: ["event-1"],
      incidentIds: ["incident-1"],
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-life-1",
      evolutionStageInstanceId: "stage-1",
      resultingStateHash: "hash-1",
      projection: slotProjection(1),
      requestFingerprint: "fingerprint-1",
    });
  }));

  await assertFails(setDoc(
    doc(db, "users/alice/slots/slot1/logs/direct-care"),
    { eventId: "direct-care", type: "CAREMISTAKE", text: "케어미스" }
  ));
  await assertFails(setDoc(slotRef, {
    ...slotProjection(0),
    revision: 2,
  }, { merge: true }));
  await assertFails(updateDoc(slotRef, {
    "digimonStats.careMistakes": 0,
  }));
  await assertSucceeds(getDoc(receiptRef));

  const abortedIncidentRef = doc(
    db,
    "users/alice/slots/slot1/careMistakeIncidents/incident-aborted"
  );
  const abortedLogRef = doc(db, "users/alice/slots/slot1/logs/event-aborted");
  const abortedReceiptRef = doc(
    db,
    "users/alice/slots/slot1/gameTransitions/transition-aborted"
  );
  await assert.rejects(runTransaction(db, async (transaction) => {
    await transaction.get(slotRef);
    transaction.set(abortedIncidentRef, {
      incidentId: "incident-aborted",
      transitionId: "transition-aborted",
      eventId: "event-aborted",
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-life-1",
      evolutionStageInstanceId: "stage-1",
      occurredAt: 2000,
      reasonKey: "strength_call",
      text: "케어미스",
      status: "unresolved",
      resolvedAt: null,
      resolvedBy: null,
      previousUnresolvedIncidentId: "incident-1",
    });
    transaction.set(abortedLogRef, {
      eventId: "event-aborted",
      transitionId: "transition-aborted",
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-life-1",
      evolutionStageInstanceId: "stage-1",
      type: "CAREMISTAKE",
      text: "케어미스",
      timestamp: 2000,
    });
    transaction.update(slotRef, {
      ...slotProjection(2),
      latestUnresolvedCareMistakeIncidentId: "incident-aborted",
      latestCareMistakeAt: 2000,
      revision: 2,
      lastGameTransitionId: "transition-aborted",
    });
    transaction.set(abortedReceiptRef, {
      schemaVersion: 1,
      transitionId: "transition-aborted",
      clientInstanceId: "client-1",
      localSequence: 2,
      parentTransitionId: "transition-1",
      transitionType: "CARE_MISTAKE_OCCURRED",
      baseRevision: 1,
      resultRevision: 2,
      eventIds: ["event-aborted"],
      incidentIds: ["incident-aborted"],
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-life-1",
      evolutionStageInstanceId: "stage-1",
      resultingStateHash: "hash-aborted",
      projection: {
        ...slotProjection(2),
        latestUnresolvedCareMistakeIncidentId: "incident-aborted",
        latestCareMistakeAt: 2000,
      },
      requestFingerprint: "fingerprint-aborted",
    });
    throw new Error("injected transaction failure");
  }), /injected transaction failure/);

  assert.equal((await getDoc(abortedIncidentRef)).exists(), false);
  assert.equal((await getDoc(abortedLogRef)).exists(), false);
  assert.equal((await getDoc(abortedReceiptRef)).exists(), false);
  assert.equal((await getDoc(slotRef)).data().revision, 1);
});

test("legacy recovery incident는 활동 로그 없이 원자적으로 확정할 수 있다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const emulator = parseEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST);
  const testEnvironment = await initializeTestEnvironment({
    projectId: `care-mistake-legacy-recovery-${Date.now()}`,
    firestore: {
      ...emulator,
      rules: fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
  t.after(() => testEnvironment.cleanup());

  const db = testEnvironment.authenticatedContext("alice").firestore();
  const slotRef = doc(db, "users/alice/slots/slot1");
  const incidentRef = doc(
    db,
    "users/alice/slots/slot1/careMistakeIncidents/legacy-incident-1"
  );
  const receiptRef = doc(
    db,
    "users/alice/slots/slot1/gameTransitions/legacy-transition-1"
  );

  await setDoc(slotRef, {
    revision: 0,
    slotInstanceIdSchemaVersion: 1,
    slotInstanceId: "slot-life-1",
    arenaIdentitySchemaVersion: 1,
    digimonInstanceId: "digimon-life-1",
    combatRevision: 1,
    selectedDigimon: "Agumon",
    ...slotProjection(0),
    digimonStats: {},
  });

  await assertSucceeds(runTransaction(db, async (transaction) => {
    await transaction.get(slotRef);
    transaction.set(incidentRef, {
      incidentId: "legacy-incident-1",
      transitionId: "legacy-transition-1",
      eventId: null,
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-life-1",
      evolutionStageInstanceId: "stage-1",
      occurredAt: 1000,
      reasonKey: "legacy_recovery",
      text: "복구된 케어미스 기록",
      status: "unresolved",
      resolvedAt: null,
      resolvedBy: null,
      previousUnresolvedIncidentId: null,
      source: "legacy_recovery",
      originalOccurredAtKnown: false,
      replayVersion: "care-replay-v1",
      replayBasisHash: "basis-1",
      ordinal: 1,
    });
    transaction.update(slotRef, {
      ...slotProjection(1),
      latestUnresolvedCareMistakeIncidentId: "legacy-incident-1",
      revision: 1,
      lastGameTransitionId: "legacy-transition-1",
    });
    transaction.set(receiptRef, {
      schemaVersion: 1,
      transitionId: "legacy-transition-1",
      clientInstanceId: "reconciliation",
      localSequence: 0,
      parentTransitionId: null,
      transitionType: "CARE_MISTAKE_RECONCILED",
      baseRevision: 0,
      resultRevision: 1,
      eventIds: [],
      incidentIds: ["legacy-incident-1"],
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-life-1",
      evolutionStageInstanceId: "stage-1",
      resultingStateHash: "hash-legacy-1",
      projection: {
        ...slotProjection(1),
        latestUnresolvedCareMistakeIncidentId: "legacy-incident-1",
      },
      requestFingerprint: "fingerprint-legacy-1",
    });
  }));

  assert.equal((await getDoc(incidentRef)).data().originalOccurredAtKnown, false);
  assert.equal((await getDoc(receiptRef)).data().eventIds.length, 0);
  assert.equal((await getDoc(slotRef)).data().revision, 1);
});
