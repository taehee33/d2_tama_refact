import {
  buildNewLifeTransitionEnvelope,
  commitNewLifeTransition,
} from "./newLifeTransition";

function snapshot(data = null) {
  return { exists: () => data != null, data: () => data };
}

function createInput() {
  const transition = buildNewLifeTransitionEnvelope({
    transitionId: "new-life-1",
    sourceDigimon: "Ohakadamon",
    targetDigimon: "Digitama",
    previousIdentity: {
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-old",
    },
    nextCombatIdentity: {
      arenaIdentitySchemaVersion: 1,
      digimonInstanceId: "digimon-new",
      combatRevision: 1,
    },
    logEntry: {
      eventId: "activity:new-life:new-life-1",
      text: "New start: Reborn as Digitama",
      timestamp: 1000,
    },
    createdAt: 1000,
  });
  return {
    db: {},
    slotRef: { path: "users/u/slots/slot1" },
    logRef: { path: "users/u/slots/slot1/logs/activity:new-life:new-life-1" },
    baseRevision: 7,
    updateData: { digimonStats: { careMistakes: 0, activityLogs: undefined } },
    transition,
  };
}

function transactionWith({ receipt = null, slot = null } = {}) {
  return {
    get: jest.fn(async (ref) =>
      ref.path.includes("/logs/") ? snapshot(receipt) : snapshot(slot)
    ),
    update: jest.fn(),
    set: jest.fn(),
  };
}

test("새 생애는 stats·형태·새 combat identity·NEW_START 로그를 원자 저장한다", async () => {
  const input = createInput();
  const transaction = transactionWith({
    slot: {
      revision: 7,
      selectedDigimon: "Ohakadamon",
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-old",
    },
  });

  await expect(commitNewLifeTransition({
    ...input,
    runTransaction: async (_db, callback) => callback(transaction),
  })).resolves.toEqual({
    revision: 8,
    nextDigimonInstanceId: "digimon-new",
    idempotent: false,
  });
  expect(transaction.update).toHaveBeenCalledWith(input.slotRef, expect.objectContaining({
    selectedDigimon: "Digitama",
    digimonInstanceId: "digimon-new",
    revision: 8,
    previousLifeCleanup: expect.objectContaining({ digimonInstanceId: "digimon-old" }),
  }));
  expect(transaction.set).toHaveBeenCalledWith(input.logRef, expect.objectContaining({
    type: "NEW_START",
    digimonInstanceId: "digimon-new",
    previousDigimonInstanceId: "digimon-old",
  }));
});

test("같은 transition 재시도는 receipt만 읽고 중복 저장하지 않는다", async () => {
  const input = createInput();
  const transaction = transactionWith({
    receipt: {
      requestFingerprint: input.transition.requestFingerprint,
      revisionAfter: 8,
      digimonInstanceId: "digimon-new",
    },
  });
  await expect(commitNewLifeTransition({
    ...input,
    runTransaction: async (_db, callback) => callback(transaction),
  })).resolves.toMatchObject({ revision: 8, idempotent: true });
  expect(transaction.update).not.toHaveBeenCalled();
  expect(transaction.set).not.toHaveBeenCalled();
});

test.each([
  ["revision", { revision: 8 }, "game/revision-conflict"],
  ["slot instance", { slotInstanceId: "other-slot" }, "game/new-life-source-conflict"],
  ["digimon instance", { digimonInstanceId: "other-life" }, "game/new-life-source-conflict"],
  ["source form", { selectedDigimon: "Other" }, "game/new-life-source-conflict"],
])("%s 충돌 시 어떤 문서도 쓰지 않는다", async (_label, patch, code) => {
  const input = createInput();
  const transaction = transactionWith({
    slot: {
      revision: 7,
      selectedDigimon: "Ohakadamon",
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-old",
      ...patch,
    },
  });
  await expect(commitNewLifeTransition({
    ...input,
    runTransaction: async (_db, callback) => callback(transaction),
  })).rejects.toMatchObject({ code });
  expect(transaction.update).not.toHaveBeenCalled();
  expect(transaction.set).not.toHaveBeenCalled();
});
