import { ensureSlotPersistenceIdentity } from "./slotPersistenceIdentity";

function createTransactionHarness(initialData) {
  let data = { ...initialData };
  const update = jest.fn((_ref, patch) => {
    data = { ...data, ...patch };
  });
  const transaction = {
    get: jest.fn(async () => ({ exists: () => true, data: () => ({ ...data }) })),
    update,
  };
  const runTransaction = jest.fn(async (_db, callback) => callback(transaction));
  return { getData: () => data, runTransaction, update };
}

describe("ensureSlotPersistenceIdentity", () => {
  test("legacy 슬롯의 두 identity를 revision 변경 없이 보강한다", async () => {
    const harness = createTransactionHarness({ revision: 7, selectedDigimon: "Agumon" });

    const result = await ensureSlotPersistenceIdentity({
      db: {},
      slotRef: {},
      runTransaction: harness.runTransaction,
      createSlotIdentity: () => ({
        slotInstanceIdSchemaVersion: 1,
        slotInstanceId: "slot-life-a",
      }),
      createCombatIdentity: () => ({
        arenaIdentitySchemaVersion: 1,
        digimonInstanceId: "digimon-life-a",
        combatRevision: 1,
      }),
    });

    expect(result.didBackfill).toBe(true);
    expect(harness.getData()).toMatchObject({
      revision: 7,
      slotInstanceId: "slot-life-a",
      digimonInstanceId: "digimon-life-a",
      combatRevision: 1,
    });
    expect(harness.update).toHaveBeenCalledTimes(1);
  });

  test("유효한 identity가 있으면 쓰기하지 않는다", async () => {
    const harness = createTransactionHarness({
      slotInstanceIdSchemaVersion: 1,
      slotInstanceId: "slot-life-a",
      arenaIdentitySchemaVersion: 1,
      digimonInstanceId: "digimon-life-a",
      combatRevision: 3,
    });

    const result = await ensureSlotPersistenceIdentity({
      db: {},
      slotRef: {},
      runTransaction: harness.runTransaction,
    });

    expect(result.didBackfill).toBe(false);
    expect(harness.update).not.toHaveBeenCalled();
  });
});
