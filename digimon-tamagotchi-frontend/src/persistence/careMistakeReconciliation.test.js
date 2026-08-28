import { initializeApp } from "firebase/app";
import { doc, getFirestore } from "firebase/firestore";
import {
  buildCareMistakeReconciliationBatches,
  buildCareMistakeReconciliationPlan,
  commitCareMistakeReconciliation,
  stageCareMistakeReconciliationBatches,
} from "./careMistakeReconciliation";

function snapshot(data = null) {
  return {
    exists: () => data != null,
    data: () => data,
  };
}

const identity = {
  slotInstanceId: "slot-life-1",
  digimonInstanceId: "digimon-life-1",
  evolutionStageInstanceId: "stage-life-1",
};

function createDbAndSlot() {
  const app = initializeApp(
    { projectId: "care-reconciliation-test" },
    `care-reconciliation-${Math.random()}`
  );
  const db = getFirestore(app);
  return { db, slotRef: doc(db, "users/u/slots/slot1") };
}

function createPlan() {
  return buildCareMistakeReconciliationPlan({
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      evolutionStage: "성장기",
      careMistakes: 0,
      unresolvedCareMistakeCount: 0,
    },
    savedStats: {},
    activityLogs: [
      {
        eventId: "legacy-care-1",
        type: "CAREMISTAKE",
        text: "케어미스(사유: 배고픔 콜 10분 무시)",
        timestamp: 200,
      },
      {
        eventId: "legacy-care-2",
        type: "CAREMISTAKE",
        text: "케어미스(사유: 힘 콜 10분 무시)",
        timestamp: 300,
      },
    ],
    incidents: [],
  });
}

test("슬롯 4 fixture는 현재 stage 발생 5건과 해소 0건을 5로 복구한다", () => {
  const plan = buildCareMistakeReconciliationPlan({
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      careMistakes: 2,
      unresolvedCareMistakeCount: 2,
    },
    activityLogs: Array.from({ length: 5 }, (_, index) => ({
      eventId: `slot4-care-${index + 1}`,
      type: "CAREMISTAKE",
      text: index % 2 === 0 ? "배고픔 호출 -> 케어미스!" : "힘 호출 -> 케어미스!",
      timestamp: 200 + index,
    })),
    incidents: [],
  });

  expect(plan.status).toBe("verified");
  expect(plan.projection).toMatchObject({
    careMistakes: 5,
    unresolvedCareMistakeCount: 5,
  });
});

test("대량 reconciliation은 결정적 batch로 나눈다", () => {
  const plan = buildCareMistakeReconciliationPlan({
    slotData: { ...identity, evolutionStageStartedAt: 100 },
    activityLogs: Array.from({ length: 120 }, (_, index) => ({
      eventId: `bulk-care-${index}`,
      type: "CAREMISTAKE",
      text: "배고픔 호출 -> 케어미스!",
      timestamp: 200 + index,
    })),
    incidents: [],
  });

  const batches = buildCareMistakeReconciliationBatches(plan);
  expect(batches.map((batch) => batch.incidentCount)).toEqual([50, 50, 20]);
  expect(batches.map((batch) => batch.batchId)).toEqual([
    "batch-0000",
    "batch-0001",
    "batch-0002",
  ]);
});

test("400건을 초과하면 추측해 자동 복구하지 않고 ambiguous로 보낸다", () => {
  const plan = buildCareMistakeReconciliationPlan({
    slotData: { ...identity, evolutionStageStartedAt: 100 },
    activityLogs: Array.from({ length: 401 }, (_, index) => ({
      eventId: `operator-care-${index}`,
      type: "CAREMISTAKE",
      text: "배고픔 호출 -> 케어미스!",
      timestamp: 200 + index,
    })),
    incidents: [],
  });

  expect(plan.status).toBe("ambiguous");
  expect(plan.canActivateProjection).toBe(false);
  expect(plan.reconciliationVersion).toBeNull();
  expect(plan.audit.withinAutomaticIncidentLimit).toBe(false);
  expect(() => buildCareMistakeReconciliationBatches(plan)).toThrow(
    "검증된 reconciliation plan이 필요합니다."
  );
});

test("staging 중단 후 재시작하면 완료 batch를 다시 쓰지 않는다", async () => {
  const { db, slotRef } = createDbAndSlot();
  const plan = buildCareMistakeReconciliationPlan({
    slotData: { ...identity, evolutionStageStartedAt: 100 },
    activityLogs: Array.from({ length: 120 }, (_, index) => ({
      eventId: `resume-care-${index}`,
      type: "CAREMISTAKE",
      text: "힘 호출 -> 케어미스!",
      timestamp: 200 + index,
    })),
    incidents: [],
  });
  const stored = new Map();
  const committedPaths = [];
  let shouldFailSecondBatch = true;
  const getDocument = async (ref) => snapshot(stored.get(ref.path) || null);
  const createWriteBatch = () => {
    const writes = [];
    return {
      set(ref, value, options) {
        writes.push({ ref, value, options });
      },
      async commit() {
        const batchWrite = writes.find(({ ref }) => ref.path.includes("/batches/"));
        if (shouldFailSecondBatch && batchWrite?.ref.path.endsWith("/batch-0001")) {
          shouldFailSecondBatch = false;
          throw new Error("network interrupted");
        }
        writes.forEach(({ ref, value, options }) => {
          const previous = stored.get(ref.path) || {};
          stored.set(ref.path, options?.merge ? { ...previous, ...value } : value);
          committedPaths.push(ref.path);
        });
      },
    };
  };

  await expect(stageCareMistakeReconciliationBatches({
    db,
    slotRef,
    plan,
    transitionId: "reconciliation-resume",
    getDocument,
    createWriteBatch,
    stagedAtValue: 123,
  })).rejects.toThrow("network interrupted");

  const result = await stageCareMistakeReconciliationBatches({
    db,
    slotRef,
    plan,
    transitionId: "reconciliation-resume",
    getDocument,
    createWriteBatch,
    stagedAtValue: 123,
  });

  expect(result.stagedBatchCount).toBe(3);
  expect(committedPaths.filter((path) => path.endsWith("/batch-0000"))).toHaveLength(1);
  expect(stored.get(result.runRef.path)).toMatchObject({
    status: "ready",
    batchCount: 3,
    stagedBatchCount: 3,
  });
});

test("슬롯 5 fixture는 실제 호출 케어미스 2건을 projection 0보다 우선한다", () => {
  const plan = buildCareMistakeReconciliationPlan({
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      careMistakes: 0,
      unresolvedCareMistakeCount: 0,
    },
    activityLogs: [
      {
        eventId: "slot5-hunger-care",
        type: "CAREMISTAKE",
        text: "배고픔 호출 -> 케어미스!",
        timestamp: 200,
      },
      {
        eventId: "slot5-strength-care",
        type: "CAREMISTAKE",
        text: "힘 호출 -> 케어미스!",
        timestamp: 201,
      },
    ],
    incidents: [],
  });

  expect(plan.status).toBe("verified");
  expect(plan.projection).toMatchObject({
    careMistakes: 2,
    unresolvedCareMistakeCount: 2,
  });
});

test("검증된 reconciliation은 누락 incident와 projection을 한 transaction에 확정한다", async () => {
  const { db, slotRef } = createDbAndSlot();
  const plan = createPlan();
  const transaction = {
    get: jest.fn(async (ref) => {
      if (ref.path === slotRef.path) {
        return snapshot({
          ...identity,
          revision: 4,
          digimonStats: {},
        });
      }
      return snapshot();
    }),
    update: jest.fn(),
    set: jest.fn(),
    create: jest.fn(),
  };

  const result = await commitCareMistakeReconciliation({
    db,
    slotRef,
    plan,
    baseRevision: 4,
    stageBatches: jest.fn(async () => ({ stagedBatchCount: 1 })),
    runTransaction: async (_db, callback) => callback(transaction),
  });

  expect(result).toMatchObject({ revision: 5, idempotent: false });
  expect(result.projection).toMatchObject({
    careMistakes: 2,
    unresolvedCareMistakeCount: 2,
    careMistakeReconciliationStatus: "verified",
  });
  expect(transaction.create).toHaveBeenCalledTimes(2);
  const createdIncidents = transaction.create.mock.calls.map(([, value]) => value);
  expect(createdIncidents[0].previousUnresolvedIncidentId).toBeNull();
  expect(createdIncidents[1].previousUnresolvedIncidentId).toBe(createdIncidents[0].incidentId);
  expect(transaction.update).toHaveBeenCalledWith(
    slotRef,
    expect.objectContaining({
      revision: 5,
      careMistakes: 2,
      unresolvedCareMistakeCount: 2,
      careMistakeReconciliationChecksum: plan.checksum,
    })
  );
  expect(transaction.set.mock.calls.some(([, value]) =>
    value.transitionType === "CARE_MISTAKE_RECONCILED"
  )).toBe(true);
});

test("같은 reconciliation receipt는 재시도해도 revision과 incident를 다시 쓰지 않는다", async () => {
  const { db, slotRef } = createDbAndSlot();
  const plan = createPlan();
  const receipt = {
    requestFingerprint: JSON.stringify([
      "care-reconciliation-v1",
      "reconciliation:placeholder",
    ]),
  };

  // 첫 실행에서 생성되는 transitionId를 알아낸 뒤 receipt를 구성한다.
  let transitionId = null;
  const firstTransaction = {
    get: jest.fn(async (ref) => {
      if (ref.path === slotRef.path) return snapshot({ ...identity, revision: 4 });
      return snapshot();
    }),
    update: jest.fn(),
    set: jest.fn((ref, value) => {
      if (value.transitionType === "CARE_MISTAKE_RECONCILED") transitionId = value.transitionId;
    }),
    create: jest.fn(),
  };
  await commitCareMistakeReconciliation({
    db,
    slotRef,
    plan,
    baseRevision: 4,
    stageBatches: jest.fn(async () => ({ stagedBatchCount: 1 })),
    runTransaction: async (_db, callback) => callback(firstTransaction),
  });
  const receiptValue = firstTransaction.set.mock.calls.find(([, value]) =>
    value.transitionType === "CARE_MISTAKE_RECONCILED"
  )[1];

  const retryTransaction = {
    get: jest.fn(async (ref) =>
      ref.path.endsWith(`/gameTransitions/${transitionId}`)
        ? snapshot({
            ...receiptValue,
            requestFingerprint: receiptValue.requestFingerprint,
          })
        : snapshot()
    ),
    update: jest.fn(),
    set: jest.fn(),
    create: jest.fn(),
  };
  const result = await commitCareMistakeReconciliation({
    db,
    slotRef,
    plan,
    baseRevision: 4,
    stageBatches: jest.fn(async () => ({ stagedBatchCount: 1 })),
    runTransaction: async (_db, callback) => callback(retryTransaction),
  });

  expect(result).toMatchObject({ revision: 5, idempotent: true });
  expect(retryTransaction.update).not.toHaveBeenCalled();
  expect(retryTransaction.set).not.toHaveBeenCalled();
  expect(retryTransaction.create).not.toHaveBeenCalled();
  expect(receipt).toBeTruthy();
});
