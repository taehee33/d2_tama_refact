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
  deleteDoc,
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
      replayBasisHash: "basis-1",
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

  async function assertLegacyRecoveryRejected({
    slotId,
    transitionType,
    incidentReplayBasisHash,
    transitionReplayBasisHash,
  }) {
    const rejectedSlotRef = doc(db, `users/alice/slots/${slotId}`);
    const rejectedIncidentRef = doc(
      db,
      `users/alice/slots/${slotId}/careMistakeIncidents/legacy-incident-1`
    );
    const rejectedReceiptRef = doc(
      db,
      `users/alice/slots/${slotId}/gameTransitions/legacy-transition-1`
    );

    await setDoc(rejectedSlotRef, {
      revision: 0,
      slotInstanceIdSchemaVersion: 1,
      slotInstanceId: `slot-life-${slotId}`,
      arenaIdentitySchemaVersion: 1,
      digimonInstanceId: `digimon-life-${slotId}`,
      combatRevision: 1,
      selectedDigimon: "Agumon",
      ...slotProjection(0),
      digimonStats: {},
    });

    await assertFails(runTransaction(db, async (transaction) => {
      await transaction.get(rejectedSlotRef);
      transaction.set(rejectedIncidentRef, {
        incidentId: "legacy-incident-1",
        transitionId: "legacy-transition-1",
        eventId: null,
        slotInstanceId: `slot-life-${slotId}`,
        digimonInstanceId: `digimon-life-${slotId}`,
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
        replayBasisHash: incidentReplayBasisHash,
        ordinal: 1,
      });
      transaction.update(rejectedSlotRef, {
        ...slotProjection(1),
        latestUnresolvedCareMistakeIncidentId: "legacy-incident-1",
        revision: 1,
        lastGameTransitionId: "legacy-transition-1",
      });
      transaction.set(rejectedReceiptRef, {
        schemaVersion: 1,
        transitionId: "legacy-transition-1",
        clientInstanceId: "reconciliation",
        localSequence: 0,
        parentTransitionId: null,
        transitionType,
        baseRevision: 0,
        resultRevision: 1,
        eventIds: [],
        incidentIds: ["legacy-incident-1"],
        slotInstanceId: `slot-life-${slotId}`,
        digimonInstanceId: `digimon-life-${slotId}`,
        evolutionStageInstanceId: "stage-1",
        resultingStateHash: `hash-${slotId}`,
        replayBasisHash: transitionReplayBasisHash,
        projection: {
          ...slotProjection(1),
          latestUnresolvedCareMistakeIncidentId: "legacy-incident-1",
        },
        requestFingerprint: `fingerprint-${slotId}`,
      });
    }));

    assert.equal((await getDoc(rejectedIncidentRef)).exists(), false);
    assert.equal((await getDoc(rejectedReceiptRef)).exists(), false);
    assert.equal((await getDoc(rejectedSlotRef)).data().revision, 0);
  }

  await t.test("다른 transition type의 legacy recovery incident는 거부한다", async () => {
    await assertLegacyRecoveryRejected({
      slotId: "wrong-transition-type",
      transitionType: "CARE_MISTAKE_OCCURRED",
      incidentReplayBasisHash: "basis-1",
      transitionReplayBasisHash: "basis-1",
    });
  });
  await t.test("transition과 replayBasisHash가 다르면 legacy recovery incident를 거부한다", async () => {
    await assertLegacyRecoveryRejected({
      slotId: "wrong-replay-basis-hash",
      transitionType: "CARE_MISTAKE_RECONCILED",
      incidentReplayBasisHash: "basis-incident",
      transitionReplayBasisHash: "basis-transition",
    });
  });
});

test("V1 client는 self-upgrade할 수 없고 V2 슬롯은 trusted server write만 허용한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const emulator = parseEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST);
  const testEnvironment = await initializeTestEnvironment({
    projectId: `care-mistake-v2-rules-${Date.now()}`,
    firestore: {
      ...emulator,
      rules: fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
  t.after(() => testEnvironment.cleanup());

  const db = testEnvironment.authenticatedContext("alice").firestore();
  const v1Ref = doc(db, "users/alice/slots/slot1");
  const baseSlot = {
    revision: 1,
    slotInstanceIdSchemaVersion: 1,
    slotInstanceId: "slot-life-1",
    arenaIdentitySchemaVersion: 1,
    digimonInstanceId: "digimon-life-1",
    combatRevision: 1,
    selectedDigimon: "Agumon",
    ...slotProjection(0),
    digimonStats: {},
  };
  await assertSucceeds(setDoc(v1Ref, baseSlot));
  await assertSucceeds(updateDoc(v1Ref, { combatRevision: 1 }));
  await assertFails(updateDoc(v1Ref, {
    careMistakeState: {
      schemaVersion: 2,
      rootReceiptId: "root-a",
      receiptId: "root-a",
    },
  }));

  const v2Ref = doc(db, "users/alice/slots/slot2");
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users/alice/slots/slot2"), {
      ...baseSlot,
      slotInstanceId: "slot-life-2",
      digimonInstanceId: "digimon-life-2",
      careMistakeSchemaVersion: 2,
      careMistakeState: {
        schemaVersion: 2,
        rootReceiptId: "root-b",
        receiptId: "root-b",
        evolutionStageInstanceId: "stage-1",
        baselineRemainingCount: 0,
        postCutoverUnresolvedCount: 0,
        unresolvedCareMistakeCount: 0,
        latestUnresolvedIncidentId: null,
        integrityStatus: "verified",
      },
    });
  });

  await assertSucceeds(getDoc(v2Ref));
  await assertFails(updateDoc(v2Ref, { combatRevision: 2 }));
  await assertFails(setDoc(
    doc(db, "users/alice/slots/slot2/careMistakeReceipts/repair-a"),
    { receiptId: "repair-a" }
  ));
  await assertFails(setDoc(
    doc(db, "users/alice/slots/slot2/logs/log-a"),
    { eventId: "log-a", type: "TRAIN" }
  ));
});

test("slotId deletion lock은 슬롯 재생성과 모든 descendant write를 차단한다", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async (t) => {
  const emulator = parseEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST);
  const testEnvironment = await initializeTestEnvironment({
    projectId: `care-mistake-v2-delete-lock-${Date.now()}`,
    firestore: {
      ...emulator,
      rules: fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
  t.after(() => testEnvironment.cleanup());

  const db = testEnvironment.authenticatedContext("alice").firestore();
  const slotRef = doc(db, "users/alice/slots/slot4");
  const lockRef = doc(
    db,
    "users/alice/careMistakeV2SlotDeletionLocks/slot4"
  );
  const operationRef = doc(
    db,
    "users/alice/careMistakeV2SlotDeletions/delete-a"
  );
  const baseSlot = {
    revision: 1,
    slotInstanceIdSchemaVersion: 1,
    slotInstanceId: "slot-life-4",
    arenaIdentitySchemaVersion: 1,
    digimonInstanceId: "digimon-life-4",
    combatRevision: 1,
    selectedDigimon: "Agumon",
    ...slotProjection(0),
    digimonStats: {},
  };
  await setDoc(slotRef, baseSlot);
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(
      adminDb,
      "users/alice/careMistakeV2SlotDeletionLocks/slot4"
    ), {
      operationId: "delete-a",
      slotInstanceId: "slot-life-4",
      status: "in_progress",
    });
  });

  await assertFails(getDoc(lockRef));
  await assertFails(setDoc(operationRef, { status: "complete" }));
  await assertFails(updateDoc(slotRef, { combatRevision: 1 }));
  await assertFails(deleteDoc(slotRef));
  await assertFails(setDoc(
    doc(db, "users/alice/slots/slot4/logs/stale-log"),
    { eventId: "stale-log", type: "TRAIN" }
  ));

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(doc(
      context.firestore(),
      "users/alice/slots/slot4"
    ));
  });
  await assertFails(setDoc(slotRef, baseSlot));
  await assertFails(setDoc(
    doc(db, "users/alice/slots/slot4/battleLogs/stale-battle"),
    { eventId: "stale-battle" }
  ));
});
