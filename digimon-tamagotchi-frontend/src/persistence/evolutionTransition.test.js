import {
  buildEvolutionTransitionEnvelope,
  commitEvolutionTransition,
} from "./evolutionTransition";

function snapshot(data = null) {
  return {
    exists: () => data != null,
    data: () => data,
  };
}

function createInput(overrides = {}) {
  const transition = buildEvolutionTransitionEnvelope({
    transitionId: "evolution-1",
    sourceDigimon: "Agumon",
    targetDigimon: "Greymon",
    nowMs: 1000,
    identity: {
      slotInstanceId: "slot-life-1",
      digimonInstanceId: "digimon-life-1",
    },
    logEntry: {
      eventId: "activity:evolution:evolution-1",
      type: "EVOLUTION",
      text: "그레이몬으로 진화!",
      timestamp: 1000,
    },
  });
  return {
    db: {},
    slotRef: { path: "users/u/slots/slot1" },
    logRef: { path: "users/u/slots/slot1/logs/activity:evolution:evolution-1" },
    baseRevision: 4,
    updateData: { digimonStats: { strength: 0 } },
    transition,
    ...overrides,
  };
}

function createTransaction({ receipt = null, slot = null } = {}) {
  const transaction = {
    get: jest.fn(async (ref) =>
      ref.path.includes("/logs/") ? snapshot(receipt) : snapshot(slot)
    ),
    update: jest.fn(),
    set: jest.fn(),
  };
  return transaction;
}

test("진화는 형태·스탯·revision·combat identity·로그를 한 transaction에 쓴다", async () => {
  const input = createInput();
  const transaction = createTransaction({
    slot: {
      selectedDigimon: "Agumon",
      revision: 4,
      slotInstanceId: "slot-life-1",
      arenaIdentitySchemaVersion: 1,
      digimonInstanceId: "digimon-life-1",
      combatRevision: 7,
    },
  });

  const result = await commitEvolutionTransition({
    ...input,
    runTransaction: async (_db, callback) => callback(transaction),
  });

  expect(result).toEqual({ revision: 5, combatRevision: 8, idempotent: false });
  expect(transaction.update).toHaveBeenCalledWith(
    input.slotRef,
    expect.objectContaining({
      selectedDigimon: "Greymon",
      digimonStats: expect.objectContaining({
        strength: 0,
        careMistakes: 0,
        unresolvedCareMistakeCount: 0,
        careMistakeReconciliationStatus: "verified",
      }),
      revision: 5,
      combatRevision: 8,
    })
  );
  expect(transaction.set).toHaveBeenCalledWith(
    input.logRef,
    expect.objectContaining({
      transitionId: "evolution-1",
      revisionBefore: 4,
      revisionAfter: 5,
      combatRevisionBefore: 7,
      combatRevisionAfter: 8,
    })
  );
});

test("응답 유실 뒤 같은 transition 재시도는 기존 receipt를 반환한다", async () => {
  const input = createInput();
  const transaction = createTransaction({
    receipt: {
      requestFingerprint: input.transition.requestFingerprint,
      revisionAfter: 5,
      combatRevisionAfter: 8,
    },
  });

  const result = await commitEvolutionTransition({
    ...input,
    runTransaction: async (_db, callback) => callback(transaction),
  });

  expect(result).toEqual({ revision: 5, combatRevision: 8, idempotent: true });
  expect(transaction.update).not.toHaveBeenCalled();
  expect(transaction.set).not.toHaveBeenCalled();
});

test("같은 transitionId에 다른 내용이 오면 충돌로 거부한다", async () => {
  const input = createInput();
  const transaction = createTransaction({
    receipt: {
      requestFingerprint: "different",
      revisionAfter: 5,
    },
  });

  await expect(
    commitEvolutionTransition({
      ...input,
      runTransaction: async (_db, callback) => callback(transaction),
    })
  ).rejects.toMatchObject({ code: "game/evolution-transition-id-reused" });
  expect(transaction.update).not.toHaveBeenCalled();
});

test.each([
  ["revision", { revision: 6 }, "game/revision-conflict"],
  ["source", { selectedDigimon: "Betamon" }, "game/evolution-source-conflict"],
  ["slot instance", { slotInstanceId: "other-slot-life" }, "game/evolution-source-conflict"],
])("%s 불일치에서는 슬롯과 로그를 전혀 쓰지 않는다", async (_label, patch, code) => {
  const input = createInput();
  const transaction = createTransaction({
    slot: {
      selectedDigimon: "Agumon",
      revision: 4,
      slotInstanceId: "slot-life-1",
      arenaIdentitySchemaVersion: 1,
      digimonInstanceId: "digimon-life-1",
      combatRevision: 7,
      ...patch,
    },
  });

  await expect(
    commitEvolutionTransition({
      ...input,
      runTransaction: async (_db, callback) => callback(transaction),
    })
  ).rejects.toMatchObject({ code });
  expect(transaction.update).not.toHaveBeenCalled();
  expect(transaction.set).not.toHaveBeenCalled();
});
