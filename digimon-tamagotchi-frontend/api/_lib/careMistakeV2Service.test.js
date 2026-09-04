"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCommandFingerprint,
  commitCareMistakeV2Command,
  deleteCareMistakeV2Slot,
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
  const readPaths = [];
  const transaction = {
    get: async (ref) => {
      readPaths.push(ref.path);
      return new FakeSnapshot(ref, store.get(ref.path));
    },
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
    delete(ref) {
      store.delete(ref.path);
      writeCount += 1;
    },
  };
  return {
    store,
    readPaths,
    get writeCount() { return writeCount; },
    db: {
      doc: (path) => new FakeRef(store, path),
      runTransaction: (callback) => callback(transaction),
    },
  };
}

function recursivelyDeleteFromStore(store, ref) {
  for (const key of [...store.keys()]) {
    if (key === ref.path || key.startsWith(`${ref.path}/`)) store.delete(key);
  }
}

function snapshotTree(store, prefix) {
  return [...store.entries()]
    .filter(([key]) => key === prefix || key.startsWith(`${prefix}/`))
    .map(([key, value]) => [key, structuredClone(value)]);
}

function nativeSlot() {
  const createdAt = 1_777_000_000_123;
  return {
    slotInstanceId: "slot-life-a",
    digimonInstanceId: "digimon-life-a",
    evolutionStageInstanceId: "stage-a",
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
      careMistakes: 99,
      customGameplayMarker: 42,
    },
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
  assert.equal(slot.digimonStats.customGameplayMarker, 42);
  assert.equal(slot.createdAt, slot.digimonStats.birthTime);
  assert.equal(slot.lastSavedAt, slot.digimonStats.lastSavedAt);
  assert.equal(harness.writeCount, 3);
  assert.equal(
    harness.store.get(`users/user-a/slots/slot1/careMistakeReceipts/${slot.careMistakeState.receiptId}`).cutoverRevision,
    1
  );
});

test("NATIVE_INIT은 불완전 gameplay stats를 write 없이 거부한다", async (t) => {
  const cases = [
    ["빈 stats", () => ({})],
    ["projection-only stats", () => ({ careMistakeSchemaVersion: 2, careMistakes: 0 })],
    ["필수 필드 누락", (slot) => {
      const stats = { ...slot.digimonStats };
      delete stats.hungerTimer;
      return stats;
    }],
    ["null", (slot) => ({ ...slot.digimonStats, strengthCountdown: null })],
    ["NaN", (slot) => ({ ...slot.digimonStats, poopCountdown: NaN })],
    ["Infinity", (slot) => ({ ...slot.digimonStats, timeToEvolveSeconds: Infinity })],
    ["음수", (slot) => ({ ...slot.digimonStats, lifespanSeconds: -1 })],
  ];

  for (const [name, buildStats] of cases) {
    await t.test(name, async () => {
      const harness = createHarness();
      const slotData = nativeSlot();
      slotData.digimonStats = buildStats(slotData);
      await assert.rejects(
        nativeInitCareMistakeV2Slot({
          uid: "user-a",
          slotId: 1,
          commandId: `invalid-${name}`,
          slotData,
          deps: { db: harness.db },
        }),
        (error) => error.code === "INVALID_NATIVE_INIT_STATS" && error.status === 400
      );
      assert.equal(harness.writeCount, 0);
    });
  }
});

test("NATIVE_INIT은 초기 timestamp 불일치를 write 없이 거부한다", async () => {
  const harness = createHarness();
  const slotData = nativeSlot();
  slotData.digimonStats.lastSavedAt += 1;
  await assert.rejects(
    nativeInitCareMistakeV2Slot({
      uid: "user-a",
      slotId: 1,
      commandId: "invalid-timestamps",
      slotData,
      deps: { db: harness.db },
    }),
    (error) => error.code === "INVALID_NATIVE_INIT_STATS"
  );
  assert.equal(harness.writeCount, 0);
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
    payload: {
      updateData: {
        digimonStats: {
          fullness: 4,
          poopCount: 0,
          poopReachedMaxAt: null,
          lastPoopPenaltyAt: null,
          poopPenaltyFrozenDurationMs: 0,
          careMistakes: 777,
        },
      },
      activityEvents: [{
        eventId: "clean:1000",
        type: "CLEAN",
        text: "Cleaned Poop (Full flush, 8 → 0)",
        timestamp: 1000,
      }],
    },
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
  assert.equal(harness.store.get("users/user-a/slots/slot1").digimonStats.poopCount, 0);
  assert.equal(
    harness.store.get("users/user-a/slots/slot1/logs/clean:1000").type,
    "CLEAN"
  );
});

test("legacy sentinel은 허용 경로에서만 서버 timestamp와 필드 삭제로 변환한다", async () => {
  const harness = createHarness();
  const initialized = await nativeInitCareMistakeV2Slot({
    uid: "user-a",
    slotId: 1,
    commandId: "native-command-sentinel",
    slotData: nativeSlot(),
    deps: { db: harness.db, now: new Date("2026-08-30T00:00:00.000Z") },
  });
  // 과거 문서에 남아 있던 root legacy 필드를 재현한다.
  const slotPath = "users/user-a/slots/slot1";
  const receiptPath = `${slotPath}/careMistakeReceipts/${initialized.careMistakeState.receiptId}`;
  const logPath = `${slotPath}/logs/existing-log`;
  const incidentPath = `${slotPath}/careMistakeIncidents/existing-incident`;
  harness.store.get(slotPath).dailySleepMistake = true;
  harness.store.set(logPath, { eventId: "existing-log", type: "FEED", timestamp: 1234 });
  harness.store.set(incidentPath, {
    incidentId: "existing-incident",
    status: "resolved",
    rootReceiptId: initialized.careMistakeState.rootReceiptId,
  });
  const receiptBefore = structuredClone(harness.store.get(receiptPath));
  const logBefore = structuredClone(harness.store.get(logPath));
  const incidentBefore = structuredClone(harness.store.get(incidentPath));
  const careStateBefore = structuredClone(harness.store.get(slotPath).careMistakeState);
  const committedAt = new Date("2026-08-30T00:00:05.000Z");
  const command = {
    commandId: "state-command-sentinel",
    commandType: "STATE_MUTATION",
    careSchemaVersion: 2,
    rootReceiptId: initialized.careMistakeState.rootReceiptId,
    receiptId: initialized.careMistakeState.receiptId,
    evolutionStageInstanceId: initialized.careMistakeState.evolutionStageInstanceId,
    expectedRevision: 1,
    payload: {
      updateData: {
        lastSavedAt: 1_777_000_005_123,
        updatedAt: { _methodName: "serverTimestamp" },
        lastSavedAtServer: { _methodName: "serverTimestamp" },
        dailySleepMistake: { _methodName: "deleteField" },
        digimonStats: { fullness: 4 },
      },
    },
  };

  const result = await commitCareMistakeV2Command({
    uid: "user-a",
    slotId: 1,
    command,
    deps: { db: harness.db, now: committedAt },
  });
  const slot = harness.store.get("users/user-a/slots/slot1");

  assert.equal(result.revision, 2);
  assert.deepEqual(slot.updatedAt, committedAt);
  assert.deepEqual(slot.lastSavedAtServer, committedAt);
  assert.equal(Object.hasOwn(slot, "dailySleepMistake"), false);
  assert.equal(JSON.stringify(slot).includes("_methodName"), false);
  assert.equal(slot.digimonStats.fullness, 4);
  assert.equal(slot.digimonStats.customGameplayMarker, 42);
  assert.deepEqual(slot.careMistakeState, careStateBefore);
  assert.deepEqual(harness.store.get(receiptPath), receiptBefore);
  assert.deepEqual(harness.store.get(logPath), logBefore);
  assert.deepEqual(harness.store.get(incidentPath), incidentBefore);
});

test("허용 경로 밖 sentinel-shaped object와 unknown method는 write 없이 거부한다", async (t) => {
  const cases = [
    ["updateData 자체가 sentinel", { _methodName: "serverTimestamp" }],
    ["중첩 serverTimestamp", { digimonStats: { nested: { _methodName: "serverTimestamp" } } }],
    ["unknown method", { backgroundSettings: { marker: { _methodName: "increment" } } }],
    ["잘못된 허용 경로 method", { lastSavedAtServer: { _methodName: "deleteField" } }],
  ];

  for (const [name, updateData] of cases) {
    await t.test(name, async () => {
      const harness = createHarness();
      const initialized = await nativeInitCareMistakeV2Slot({
        uid: "user-a",
        slotId: 1,
        commandId: `native-invalid-${name}`,
        slotData: nativeSlot(),
        deps: { db: harness.db },
      });
      const writesBefore = harness.writeCount;

      await assert.rejects(
        commitCareMistakeV2Command({
          uid: "user-a",
          slotId: 1,
          command: {
            commandId: `state-invalid-${name}`,
            commandType: "STATE_MUTATION",
            careSchemaVersion: 2,
            rootReceiptId: initialized.careMistakeState.rootReceiptId,
            receiptId: initialized.careMistakeState.receiptId,
            evolutionStageInstanceId: initialized.careMistakeState.evolutionStageInstanceId,
            expectedRevision: 1,
            payload: { updateData },
          },
          deps: { db: harness.db },
        }),
        (error) => error.code === "INVALID_PAYLOAD" && error.status === 400
      );
      assert.equal(harness.writeCount, writesBefore);
    });
  }
});

test("NATIVE_INIT 이후 두 STATE_MUTATION은 revision 1→2→3과 gameplay identity를 보존한다", async () => {
  const harness = createHarness();
  const initialSlot = nativeSlot();
  const initialized = await nativeInitCareMistakeV2Slot({
    uid: "user-a",
    slotId: 1,
    commandId: "native-regression",
    slotData: initialSlot,
    deps: { db: harness.db, now: new Date("2026-08-30T00:00:00.000Z") },
  });
  const state = initialized.careMistakeState;
  const buildCommand = (commandId, expectedRevision, lastSavedAt, fullness) => ({
    commandId,
    commandType: "STATE_MUTATION",
    careSchemaVersion: 2,
    rootReceiptId: state.rootReceiptId,
    receiptId: state.receiptId,
    evolutionStageInstanceId: state.evolutionStageInstanceId,
    expectedRevision,
    payload: {
      updateData: {
        lastSavedAt,
        lastSavedAtServer: { _methodName: "serverTimestamp" },
        updatedAt: { _methodName: "serverTimestamp" },
        dailySleepMistake: { _methodName: "deleteField" },
        digimonStats: { fullness },
      },
    },
  });

  const second = await commitCareMistakeV2Command({
    uid: "user-a",
    slotId: 1,
    command: buildCommand("state-regression-1", 1, initialSlot.lastSavedAt + 1_000, 4),
    deps: { db: harness.db, now: new Date("2026-08-30T00:00:01.000Z") },
  });
  const third = await commitCareMistakeV2Command({
    uid: "user-a",
    slotId: 1,
    command: buildCommand("state-regression-2", 2, initialSlot.lastSavedAt + 2_000, 5),
    deps: { db: harness.db, now: new Date("2026-08-30T00:00:02.000Z") },
  });
  const slot = harness.store.get("users/user-a/slots/slot1");

  assert.equal(initialized.revision, 1);
  assert.equal(second.revision, 2);
  assert.equal(third.revision, 3);
  assert.equal(slot.revision, 3);
  assert.equal(slot.slotInstanceId, initialSlot.slotInstanceId);
  assert.equal(slot.digimonInstanceId, initialSlot.digimonInstanceId);
  assert.equal(slot.selectedDigimon, initialSlot.selectedDigimon);
  assert.equal(slot.digimonStats.birthTime, initialSlot.digimonStats.birthTime);
  assert.equal(
    slot.digimonStats.evolutionStageStartedAt,
    initialSlot.digimonStats.evolutionStageStartedAt
  );
  assert.equal(slot.digimonStats.fullness, 5);
  assert.equal(slot.careMistakeState.rootReceiptId, state.rootReceiptId);
  assert.equal(JSON.stringify(slot).includes("_methodName"), false);
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
          selectedDigimon: "DigitamaV3",
          slotVersion: "Ver.3",
          digimonStats: {
            selectedDigimon: "DigitamaV3",
            evolutionStage: "Egg",
            isDead: false,
            deathReason: null,
            diedAt: null,
            fullness: 0,
            strength: 0,
            activityLogs: [],
          },
        },
        activityEvents: [{
          eventId: "activity:new-life:new-life-command-a",
          type: "NEW_START",
          text: "New start: Reborn as DigitamaV3",
          timestamp: 1_777_000_001_000,
        }],
      },
    },
    deps: { db: harness.db },
  });

  const slot = harness.store.get("users/user-a/slots/slot1");
  assert.equal(result.revision, 2);
  assert.equal(slot.slotInstanceId, "slot-life-a");
  assert.equal(slot.digimonInstanceId, "digimon-life-b");
  assert.equal(slot.combatRevision, 1);
  assert.equal(slot.selectedDigimon, "DigitamaV3");
  assert.equal(slot.digimonStats.isDead, false);
  assert.equal(slot.digimonStats.deathReason, null);
  assert.equal(slot.careMistakeState.rootReceiptId, result.careMistakeState.receiptId);
  assert.equal(
    harness.store.get("users/user-a/slots/slot1/logs/activity:new-life:new-life-command-a").type,
    "NEW_START"
  );
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

test("부분 삭제로 root가 사라진 retry는 operation을 먼저 읽고 revision 재검증 없이 resume한다", async () => {
  const harness = createHarness();
  await nativeInitCareMistakeV2Slot({
    uid: "user-a", slotId: 1, commandId: "native-command-a", slotData: nativeSlot(),
    deps: { db: harness.db },
  });
  const slotPath = "users/user-a/slots/slot1";
  const fixedNow = new Date("2026-08-31T00:00:00.000Z");

  await assert.rejects(
    deleteCareMistakeV2Slot({
      uid: "user-a",
      slotId: 1,
      slotInstanceId: "slot-life-a",
      expectedRevision: 1,
      deps: {
        db: harness.db,
        now: fixedNow,
        executorId: "executor-a",
        recursiveDelete: async (ref) => {
          harness.store.delete(ref.path);
          throw new Error("injected partial delete");
        },
      },
    }),
    (error) => error.code === "SLOT_DELETE_RETRY_REQUIRED"
  );
  assert.equal(harness.store.has(slotPath), false);
  assert.equal(
    [...harness.store.keys()].some((key) => key.startsWith(`${slotPath}/`)),
    true
  );

  const readsBeforeRetry = harness.readPaths.length;
  const resumed = await deleteCareMistakeV2Slot({
    uid: "user-a",
    slotId: 1,
    slotInstanceId: "slot-life-a",
    expectedRevision: 999,
    deps: {
      db: harness.db,
      now: fixedNow,
      executorId: "executor-b",
      recursiveDelete: async (ref) => recursivelyDeleteFromStore(harness.store, ref),
    },
  });
  const retryReads = harness.readPaths.slice(readsBeforeRetry);
  assert.match(retryReads[0], /careMistakeV2SlotDeletions/);
  assert.equal(retryReads.includes(slotPath), false);
  assert.equal(resumed.status, "complete");
  assert.equal(
    [...harness.store.keys()].some((key) => key === slotPath || key.startsWith(`${slotPath}/`)),
    false
  );
  assert.equal(
    harness.store.has("users/user-a/careMistakeV2SlotDeletionLocks/slot1"),
    false
  );
});

test("완료된 A 삭제 재호출은 같은 slotId의 새 instance B를 읽거나 삭제하지 않는다", async () => {
  const harness = createHarness();
  await nativeInitCareMistakeV2Slot({
    uid: "user-a", slotId: 1, commandId: "native-command-a", slotData: nativeSlot(),
    deps: { db: harness.db },
  });
  await deleteCareMistakeV2Slot({
    uid: "user-a",
    slotId: 1,
    slotInstanceId: "slot-life-a",
    expectedRevision: 1,
    deps: {
      db: harness.db,
      executorId: "executor-a",
      recursiveDelete: async (ref) => recursivelyDeleteFromStore(harness.store, ref),
    },
  });
  await nativeInitCareMistakeV2Slot({
    uid: "user-a",
    slotId: 1,
    commandId: "native-command-b",
    slotData: {
      ...nativeSlot(),
      slotInstanceId: "slot-life-b",
      digimonInstanceId: "digimon-life-b",
      evolutionStageInstanceId: "stage-b",
    },
    deps: { db: harness.db },
  });
  const slotPath = "users/user-a/slots/slot1";
  const before = snapshotTree(harness.store, slotPath);
  const readsBeforeRetry = harness.readPaths.length;
  let recursiveDeleteCalls = 0;

  const retry = await deleteCareMistakeV2Slot({
    uid: "user-a",
    slotId: 1,
    slotInstanceId: "slot-life-a",
    expectedRevision: 1,
    deps: {
      db: harness.db,
      executorId: "executor-c",
      recursiveDelete: async () => { recursiveDeleteCalls += 1; },
    },
  });

  assert.equal(retry.status, "complete");
  assert.equal(retry.idempotent, true);
  assert.equal(recursiveDeleteCalls, 0);
  assert.deepEqual(snapshotTree(harness.store, slotPath), before);
  assert.deepEqual(harness.readPaths.slice(readsBeforeRetry), [
    harness.readPaths[readsBeforeRetry],
  ]);
  assert.match(harness.readPaths[readsBeforeRetry], /careMistakeV2SlotDeletions/);
});

test("active lease는 두 번째 recursive delete를 막고 만료 뒤 takeover를 허용한다", async () => {
  const harness = createHarness();
  await nativeInitCareMistakeV2Slot({
    uid: "user-a", slotId: 1, commandId: "native-command-a", slotData: nativeSlot(),
    deps: { db: harness.db },
  });
  const now = new Date("2026-08-31T00:00:00.000Z");
  await assert.rejects(deleteCareMistakeV2Slot({
    uid: "user-a",
    slotId: 1,
    slotInstanceId: "slot-life-a",
    expectedRevision: 1,
    deps: {
      db: harness.db,
      now,
      executorId: "executor-a",
      recursiveDelete: async () => { throw new Error("pause deletion"); },
    },
  }));
  const operationPath = [...harness.store.keys()].find((key) =>
    key.includes("/careMistakeV2SlotDeletions/")
  );
  harness.store.set(operationPath, {
    ...harness.store.get(operationPath),
    executorId: "executor-a",
    leaseUntil: new Date(now.getTime() + 60_000),
  });
  let deleteCalls = 0;
  const concurrent = await deleteCareMistakeV2Slot({
    uid: "user-a",
    slotId: 1,
    slotInstanceId: "slot-life-a",
    expectedRevision: 1,
    deps: {
      db: harness.db,
      now,
      executorId: "executor-b",
      recursiveDelete: async () => { deleteCalls += 1; },
    },
  });
  assert.equal(concurrent.status, "in_progress");
  assert.equal(deleteCalls, 0);

  const resumed = await deleteCareMistakeV2Slot({
    uid: "user-a",
    slotId: 1,
    slotInstanceId: "slot-life-a",
    expectedRevision: 1,
    deps: {
      db: harness.db,
      now: new Date(now.getTime() + 60_001),
      executorId: "executor-c",
      recursiveDelete: async (ref) => {
        deleteCalls += 1;
        recursivelyDeleteFromStore(harness.store, ref);
      },
    },
  });
  assert.equal(resumed.status, "complete");
  assert.equal(deleteCalls, 1);
});

test("최초 삭제의 stale revision은 operation과 lock을 만들지 않는다", async () => {
  const harness = createHarness();
  await nativeInitCareMistakeV2Slot({
    uid: "user-a", slotId: 1, commandId: "native-command-a", slotData: nativeSlot(),
    deps: { db: harness.db },
  });
  const writesBefore = harness.writeCount;
  const storeBefore = structuredClone([...harness.store.entries()]);
  await assert.rejects(deleteCareMistakeV2Slot({
    uid: "user-a",
    slotId: 1,
    slotInstanceId: "slot-life-a",
    expectedRevision: 0,
    deps: { db: harness.db, executorId: "executor-a" },
  }), (error) => error.code === "STALE_SLOT_DELETE_REVISION");
  assert.equal(harness.writeCount, writesBefore);
  assert.deepEqual([...harness.store.entries()], storeBefore);
  assert.equal(
    [...harness.store.keys()].some((key) => key.includes("careMistakeV2SlotDeletion")),
    false
  );
});

test("native init은 slot root보다 외부 deletion lock을 먼저 확인한다", async () => {
  const lockPath = "users/user-a/careMistakeV2SlotDeletionLocks/slot1";
  const harness = createHarness({
    [lockPath]: {
      operationId: "delete-a",
      slotInstanceId: "slot-life-a",
      status: "in_progress",
    },
  });
  await assert.rejects(nativeInitCareMistakeV2Slot({
    uid: "user-a",
    slotId: 1,
    commandId: "native-command-b",
    slotData: {
      ...nativeSlot(),
      slotInstanceId: "slot-life-b",
      digimonInstanceId: "digimon-life-b",
    },
    deps: { db: harness.db },
  }), (error) => error.code === "SLOT_DELETION_IN_PROGRESS");
  assert.equal(harness.readPaths[0], lockPath);
  assert.equal(harness.readPaths.includes("users/user-a/slots/slot1"), false);
  assert.equal(harness.writeCount, 0);
});
