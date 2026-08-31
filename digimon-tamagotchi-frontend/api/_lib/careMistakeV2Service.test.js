"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCommandFingerprint,
  commitCareMistakeV2Command,
  migrateCareMistakeV2Slot,
  nativeInitCareMistakeV2Slot,
  repairCareMistakeV2,
} = require("./careMistakeV2Service");

class FakeSnapshot {
  constructor(ref, value) {
    this.ref = ref;
    this.exists = value !== undefined;
    this._value = value;
    this.id = ref.path.split("/").pop();
  }
  data() { return this._value; }
}

class FakeRef {
  constructor(store, path) {
    this.store = store;
    this.path = path;
  }
  collection(name) { return new FakeCollection(this.store, `${this.path}/${name}`); }
}

class FakeCollection extends FakeRef {
  doc(id) { return new FakeRef(this.store, `${this.path}/${id}`); }
  where() { return this; }
  limit() { return this; }
}

function createHarness(initial = {}) {
  const store = new Map(Object.entries(initial));
  let writeCount = 0;
  const transaction = {
    get: async (ref) => new FakeSnapshot(ref, store.get(ref.path)),
    create(ref, data) {
      if (store.has(ref.path)) throw new Error(`already exists: ${ref.path}`);
      store.set(ref.path, structuredClone(data));
      writeCount += 1;
    },
    set(ref, data, options = {}) {
      const next = options.merge ? { ...(store.get(ref.path) || {}), ...data } : data;
      store.set(ref.path, structuredClone(next));
      writeCount += 1;
    },
    update(ref, data) {
      store.set(ref.path, structuredClone({ ...(store.get(ref.path) || {}), ...data }));
      writeCount += 1;
    },
  };
  return {
    store,
    get writeCount() { return writeCount; },
    db: {
      doc: (path) => new FakeRef(store, path),
      runTransaction: (callback) => callback(transaction),
    },
  };
}

function nativeSlot() {
  return {
    slotInstanceId: "slot-life-a",
    digimonInstanceId: "digimon-life-a",
    evolutionStageInstanceId: "stage-a",
    selectedDigimon: "Botamon",
    digimonStats: { fullness: 3, careMistakes: 99 },
  };
}

test("NATIVE_INIT은 slot/state/receipt/transition을 revision 1로 원자 생성한다", async () => {
  const harness = createHarness();
  const result = await nativeInitCareMistakeV2Slot({
    uid: "user-a",
    slotId: 1,
    commandId: "native-command-a",
    slotData: nativeSlot(),
    deps: { db: harness.db, now: new Date("2026-08-30T00:00:00.000Z") },
  });

  const slot = harness.store.get("users/user-a/slots/slot1");
  assert.equal(result.revision, 1);
  assert.equal(slot.revision, 1);
  assert.equal(slot.careMistakeState.schemaVersion, 2);
  assert.equal(slot.careMistakes, 0);
  assert.equal(slot.digimonStats.careMistakes, 0);
  assert.equal(harness.writeCount, 3);
  assert.equal(
    harness.store.get(`users/user-a/slots/slot1/careMistakeReceipts/${slot.careMistakeState.receiptId}`).cutoverRevision,
    1
  );
});

test("성공 command 재시도는 stale revision 검사보다 receipt를 먼저 보고 추가 write하지 않는다", async () => {
  const harness = createHarness();
  const initialized = await nativeInitCareMistakeV2Slot({
    uid: "user-a",
    slotId: 1,
    commandId: "native-command-a",
    slotData: nativeSlot(),
    deps: { db: harness.db },
  });
  const state = initialized.careMistakeState;
  const command = {
    commandId: "state-command-a",
    commandType: "STATE_MUTATION",
    careSchemaVersion: 2,
    rootReceiptId: state.rootReceiptId,
    receiptId: state.receiptId,
    evolutionStageInstanceId: state.evolutionStageInstanceId,
    expectedRevision: 1,
    payload: { updateData: { digimonStats: { fullness: 4, careMistakes: 777 } } },
  };
  const first = await commitCareMistakeV2Command({
    uid: "user-a", slotId: 1, command, deps: { db: harness.db },
  });
  const writesAfterFirst = harness.writeCount;
  const retry = await commitCareMistakeV2Command({
    uid: "user-a", slotId: 1, command, deps: { db: harness.db },
  });

  assert.equal(first.revision, 2);
  assert.equal(retry.revision, 2);
  assert.equal(retry.idempotent, true);
  assert.equal(harness.writeCount, writesAfterFirst);
  assert.equal(harness.store.get("users/user-a/slots/slot1").digimonStats.careMistakes, 0);
});

test("동일 commandId/action이라도 receipt·stage·revision이 다르면 fingerprint가 다르다", () => {
  const base = {
    commandId: "same-command",
    commandType: "STATE_MUTATION",
    careSchemaVersion: 2,
    rootReceiptId: "root-a",
    receiptId: "receipt-a",
    evolutionStageInstanceId: "stage-a",
    expectedRevision: 50,
    payload: { updateData: { value: 1 }, retryCount: 1 },
  };
  const first = buildCommandFingerprint({ uid: "user-a", slotId: 1, command: base });
  const retryMetadataOnly = buildCommandFingerprint({
    uid: "user-a", slotId: 1, command: { ...base, payload: { ...base.payload, retryCount: 9 } },
  });
  const nextEpoch = buildCommandFingerprint({
    uid: "user-a", slotId: 1,
    command: { ...base, receiptId: "receipt-b", evolutionStageInstanceId: "stage-b", expectedRevision: 51 },
  });
  assert.equal(first, retryMetadataOnly);
  assert.notEqual(first, nextEpoch);
});

test("V2 command에 V1 schema가 오면 slot write 없이 거부한다", async () => {
  const harness = createHarness();
  const initialized = await nativeInitCareMistakeV2Slot({
    uid: "user-a", slotId: 1, commandId: "native-command-a", slotData: nativeSlot(),
    deps: { db: harness.db },
  });
  const writesBefore = harness.writeCount;
  await assert.rejects(
    commitCareMistakeV2Command({
      uid: "user-a",
      slotId: 1,
      command: {
        commandId: "stale-command",
        commandType: "STATE_MUTATION",
        careSchemaVersion: 1,
        rootReceiptId: initialized.careMistakeState.rootReceiptId,
        receiptId: initialized.careMistakeState.receiptId,
        evolutionStageInstanceId: initialized.careMistakeState.evolutionStageInstanceId,
        expectedRevision: 1,
        payload: {},
      },
      deps: { db: harness.db },
    }),
    (error) => error.code === "STALE_PRE_CUTOVER_COMMAND"
  );
  assert.equal(harness.writeCount, writesBefore);
});

test("V2 NEW_LIFE는 서버가 생애 identity를 교체하고 slot identity는 보존한다", async () => {
  const harness = createHarness();
  const initialized = await nativeInitCareMistakeV2Slot({
    uid: "user-a", slotId: 1, commandId: "native-command-a", slotData: nativeSlot(),
    deps: { db: harness.db },
  });
  const state = initialized.careMistakeState;
  const result = await commitCareMistakeV2Command({
    uid: "user-a",
    slotId: 1,
    command: {
      commandId: "new-life-command-a",
      commandType: "NEW_LIFE",
      careSchemaVersion: 2,
      rootReceiptId: state.rootReceiptId,
      receiptId: state.receiptId,
      evolutionStageInstanceId: state.evolutionStageInstanceId,
      expectedRevision: 1,
      payload: {
        nextDigimonInstanceId: "digimon-life-b",
        nextEvolutionStageInstanceId: "stage-b",
        updateData: {
          slotInstanceId: "client-cannot-change-slot",
          digimonInstanceId: "client-cannot-override-life",
          combatRevision: 99,
          selectedDigimon: "Punimon",
        },
      },
    },
    deps: { db: harness.db },
  });

  const slot = harness.store.get("users/user-a/slots/slot1");
  assert.equal(result.revision, 2);
  assert.equal(slot.slotInstanceId, "slot-life-a");
  assert.equal(slot.digimonInstanceId, "digimon-life-b");
  assert.equal(slot.combatRevision, 1);
  assert.equal(slot.selectedDigimon, "Punimon");
  assert.equal(slot.careMistakeState.rootReceiptId, result.careMistakeState.receiptId);
});

test("explicit migration은 성공 시 revision을 1 증가시키고 stale 실패는 write 0건이다", async () => {
  const slotPath = "users/user-a/slots/slot1";
  const legacySlot = {
    ...nativeSlot(),
    slotInstanceIdSchemaVersion: 1,
    arenaIdentitySchemaVersion: 1,
    combatRevision: 1,
    revision: 7,
    digimonStats: { careMistakes: 3 },
  };
  const successHarness = createHarness({ [slotPath]: legacySlot });
  const migrated = await migrateCareMistakeV2Slot({
    uid: "user-a", slotId: 1, expectedRevision: 7, deps: { db: successHarness.db },
  });
  assert.equal(migrated.revision, 8);
  assert.equal(successHarness.store.get(slotPath).revision, 8);
  assert.equal(successHarness.store.get(slotPath).careMistakeState.baselineRemainingCount, 3);

  const failedHarness = createHarness({ [slotPath]: legacySlot });
  await assert.rejects(
    migrateCareMistakeV2Slot({
      uid: "user-a", slotId: 1, expectedRevision: 6, deps: { db: failedHarness.db },
    }),
    (error) => error.code === "REVISION_CONFLICT"
  );
  assert.equal(failedHarness.writeCount, 0);
  assert.deepEqual(failedHarness.store.get(slotPath), legacySlot);
});

test("baseline repair는 count만 바꾸고 revision/receipt를 교체하며 stale 실패는 write 0건이다", async () => {
  const harness = createHarness();
  const initialized = await nativeInitCareMistakeV2Slot({
    uid: "user-a", slotId: 1, commandId: "native-command-a", slotData: nativeSlot(),
    deps: { db: harness.db },
  });
  const repaired = await repairCareMistakeV2({
    uid: "user-a",
    slotId: 1,
    repairType: "baseline_override",
    repairId: "repair-a",
    expectedRevision: 1,
    expectedReceiptId: initialized.careMistakeState.receiptId,
    baseline: 4,
    reason: "legacy baseline correction",
    operator: { uid: "operator-a" },
    deps: { db: harness.db },
  });
  assert.equal(repaired.revision, 2);
  assert.equal(repaired.careMistakeState.baselineRemainingCount, 4);
  assert.equal(repaired.careMistakeState.postCutoverUnresolvedCount, 0);
  assert.equal(repaired.careMistakeState.unresolvedCareMistakeCount, 4);
  assert.notEqual(repaired.receiptId, initialized.careMistakeState.receiptId);

  const writesBeforeFailure = harness.writeCount;
  await assert.rejects(
    repairCareMistakeV2({
      uid: "user-a",
      slotId: 1,
      repairType: "baseline_override",
      repairId: "repair-b",
      expectedRevision: 1,
      expectedReceiptId: initialized.careMistakeState.receiptId,
      baseline: 5,
      reason: "stale repair",
      operator: { uid: "operator-a" },
      deps: { db: harness.db },
    }),
    (error) => error.code === "STALE_CARE_REPAIR"
  );
  assert.equal(harness.writeCount, writesBeforeFailure);
  assert.equal(harness.store.get("users/user-a/slots/slot1").revision, 2);
});
