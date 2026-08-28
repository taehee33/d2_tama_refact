import { initializeApp } from "firebase/app";
import { doc, getFirestore } from "firebase/firestore";
import {
  acquireCareMistakeReconciliationLease,
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
      careMistakes: 2,
      unresolvedCareMistakeCount: 2,
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

test("저장 5건과 현재 stage 발생 5건이 일치하면 추가 복구 없이 verified가 된다", () => {
  const plan = buildCareMistakeReconciliationPlan({
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      careMistakes: 5,
      unresolvedCareMistakeCount: 5,
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
  expect(plan.recoveryBasis.legacyRecoveryCount).toBe(0);
});

test("LIFO는 confirmed evidence보다 최신인 synthetic recovery를 먼저 해소한다", () => {
  const existingIncidents = [200, 300].map((occurredAt, index) => ({
    ...identity,
    incidentId: `confirmed-${index + 1}`,
    occurredAt,
    reasonKey: "hunger_call",
    text: "확인된 케어미스",
    status: "unresolved",
  }));
  const input = {
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      evolutionStage: "성장기",
      careMistakes: 5,
      unresolvedCareMistakeCount: 5,
    },
    activityLogs: [],
    incidents: existingIncidents,
  };

  const first = buildCareMistakeReconciliationPlan(input);
  const second = buildCareMistakeReconciliationPlan(input);
  const recovered = first.incidents.filter((incident) => incident.source === "legacy_recovery");

  expect(first.status).toBe("verified");
  expect(first.recoveryBasis).toMatchObject({
    preservedCount: 5,
    replayedUnresolvedIncidentIds: ["confirmed-1", "confirmed-2"],
    legacyRecoveryCount: 3,
  });
  expect(recovered).toHaveLength(3);
  expect(recovered.map((incident) => incident.occurredAt)).toEqual([301, 302, 303]);
  expect(first.projection.latestUnresolvedCareMistakeIncidentId).toBe(
    recovered[2].incidentId
  );
  expect(recovered.every((incident) => incident.originalOccurredAtKnown === false)).toBe(true);
  expect(second.checksum).toBe(first.checksum);
  expect(second.incidents.map((incident) => incident.incidentId)).toEqual(
    first.incidents.map((incident) => incident.incidentId)
  );

  const persistedReload = buildCareMistakeReconciliationPlan({
    ...input,
    incidents: first.incidents,
  });
  const repeatedReload = buildCareMistakeReconciliationPlan({
    ...input,
    incidents: first.incidents,
    nowMs: 999999,
  });
  expect(persistedReload.recoveryBasis.legacyRecoveryCount).toBe(0);
  expect(persistedReload.incidents.filter((incident) =>
    incident.source === "legacy_recovery"
  )).toHaveLength(3);
  expect(repeatedReload.checksum).toBe(persistedReload.checksum);
});

test("preserved 2 / replayed 5는 자동 수정하지 않고 ambiguous가 된다", () => {
  const plan = buildCareMistakeReconciliationPlan({
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      careMistakes: 2,
      unresolvedCareMistakeCount: 2,
    },
    activityLogs: [],
    incidents: Array.from({ length: 5 }, (_, index) => ({
      ...identity,
      incidentId: `confirmed-${index + 1}`,
      occurredAt: 200 + index,
      reasonKey: "hunger_call",
      status: "unresolved",
    })),
  });

  expect(plan.status).toBe("ambiguous");
  expect(plan.canActivateProjection).toBe(false);
  expect(plan.recoveryBasis.legacyRecoveryCount).toBe(-3);
});

test("현재 stage incident timestamp가 손상되면 제외하지 않고 ambiguous가 된다", () => {
  const plan = buildCareMistakeReconciliationPlan({
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      careMistakes: 1,
      unresolvedCareMistakeCount: 1,
    },
    activityLogs: [],
    incidents: [{
      ...identity,
      incidentId: "broken-incident",
      occurredAt: "not-a-date",
      reasonKey: "hunger_call",
      status: "unresolved",
    }],
  });

  expect(plan.status).toBe("ambiguous");
  expect(plan.audit.hasInterpretableCurrentIncidents).toBe(false);
});

test("stage identity 충돌과 counter 일부 손상은 작은 값으로 조용히 복구하지 않는다", () => {
  const plan = buildCareMistakeReconciliationPlan({
    slotData: {
      ...identity,
      evolutionStageInstanceId: "root-stage",
      evolutionStageStartedAt: 100,
      careMistakes: 3,
    },
    savedStats: {
      evolutionStageInstanceId: "nested-stage",
      unresolvedCareMistakeCount: 999,
    },
    activityLogs: [],
    incidents: [],
  });

  expect(plan.status).toBe("ambiguous");
  expect(plan.audit).toMatchObject({
    hasConsistentStageIdentity: false,
    hasValidLegacyCounters: false,
  });
  expect(plan.canActivateProjection).toBe(false);
});

test("root와 nested의 유효한 counter가 다르면 큰 값으로 추측 복구하지 않는다", () => {
  const plan = buildCareMistakeReconciliationPlan({
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      careMistakes: 2,
      unresolvedCareMistakeCount: 2,
    },
    savedStats: {
      careMistakes: 5,
      unresolvedCareMistakeCount: 5,
    },
    activityLogs: [200, 300].map((timestamp, index) => ({
      eventId: `counter-care-${index + 1}`,
      type: "CAREMISTAKE",
      text: "배고픔 호출 -> 케어미스!",
      timestamp,
    })),
    incidents: [],
    nowMs: 1000,
  });

  expect(plan.status).toBe("ambiguous");
  expect(plan.audit.hasConsistentLegacyProjection).toBe(false);
  expect(plan.incidents).toHaveLength(2);
  expect(plan.incidents.some((incident) => incident.source === "legacy_recovery")).toBe(false);
});

test.each([
  ["slot", { slotInstanceId: "other-slot" }, "hasConsistentSlotIdentity"],
  ["digimon", { digimonInstanceId: "other-life" }, "hasConsistentDigimonIdentity"],
  ["stage", { evolutionStageInstanceId: "other-stage" }, "hasConsistentStageIdentity"],
])("root와 nested %s identity가 충돌하면 ambiguous가 된다", (_label, nestedIdentity, auditKey) => {
  const plan = buildCareMistakeReconciliationPlan({
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      careMistakes: 0,
      unresolvedCareMistakeCount: 0,
    },
    savedStats: {
      ...nestedIdentity,
      careMistakes: 0,
      unresolvedCareMistakeCount: 0,
    },
    activityLogs: [],
    incidents: [],
    nowMs: 1000,
  });

  expect(plan.status).toBe("ambiguous");
  expect(plan.audit[auditKey]).toBe(false);
});

test("발생과 해소는 시간순으로 재생해 미래 incident를 해소하지 않는다", () => {
  const plan = buildCareMistakeReconciliationPlan({
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      careMistakes: 1,
      unresolvedCareMistakeCount: 1,
    },
    activityLogs: [
      { eventId: "care-1", type: "CAREMISTAKE", text: "배고픔 호출 -> 케어미스!", timestamp: 200 },
      { eventId: "resolve-1", type: "CARE_MISTAKE_RESOLVED", text: "케어미스 해소", timestamp: 300 },
      { eventId: "care-2", type: "CAREMISTAKE", text: "힘 호출 -> 케어미스!", timestamp: 400 },
    ],
    incidents: [],
    nowMs: 1000,
  });

  expect(plan.status).toBe("verified");
  expect(plan.incidents.find((incident) => incident.eventId === "care-1")?.status).toBe("resolved");
  expect(plan.incidents.find((incident) => incident.eventId === "care-2")?.status).toBe("unresolved");
  expect(plan.projection.latestCareMistakeAt).toBe(400);
});

test("incident에 이미 반영된 해소 로그는 다음 unresolved incident에 중복 적용하지 않는다", () => {
  const baseInput = {
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      careMistakes: 1,
      unresolvedCareMistakeCount: 1,
    },
    activityLogs: [
      { eventId: "care-1", type: "CAREMISTAKE", text: "배고픔 호출 -> 케어미스!", timestamp: 200 },
      { eventId: "resolve-1", type: "CARE_MISTAKE_RESOLVED", text: "케어미스 해소", timestamp: 300 },
      { eventId: "care-2", type: "CAREMISTAKE", text: "힘 호출 -> 케어미스!", timestamp: 400 },
    ],
    nowMs: 1000,
  };
  const first = buildCareMistakeReconciliationPlan({ ...baseInput, incidents: [] });
  const reloaded = buildCareMistakeReconciliationPlan({
    ...baseInput,
    incidents: first.incidents,
  });

  expect(reloaded.status).toBe("verified");
  expect(reloaded.projection.careMistakes).toBe(1);
  expect(reloaded.incidents.find((incident) => incident.eventId === "care-2")?.status).toBe("unresolved");
});

test.each([
  ["stage 시작 전", 99],
  ["현재 시각 이후", 1001],
])("%s incident timestamp는 ambiguous가 된다", (_label, occurredAt) => {
  const plan = buildCareMistakeReconciliationPlan({
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      careMistakes: 1,
      unresolvedCareMistakeCount: 1,
    },
    activityLogs: [],
    incidents: [{
      ...identity,
      incidentId: `timestamp-${occurredAt}`,
      occurredAt,
      reasonKey: "hunger_call",
      status: "unresolved",
    }],
    nowMs: 1000,
  });

  expect(plan.status).toBe("ambiguous");
  expect(plan.audit.hasInterpretableCurrentIncidents).toBe(false);
});

test("같은 eventId의 timestamp가 충돌하면 ambiguous가 된다", () => {
  const plan = buildCareMistakeReconciliationPlan({
    slotData: { ...identity, evolutionStageStartedAt: 100 },
    activityLogs: [{
      eventId: "duplicate-event",
      type: "CAREMISTAKE",
      text: "배고픔 호출 -> 케어미스!",
      timestamp: 200,
    }],
    pendingActivityLogs: [{
      eventId: "duplicate-event",
      type: "CAREMISTAKE",
      text: "배고픔 호출 -> 케어미스!",
      timestamp: 300,
    }],
    incidents: [],
    nowMs: 1000,
  });

  expect(plan.status).toBe("ambiguous");
  expect(plan.audit.hasDeduplicableEventIds).toBe(false);
});

test("stage identity가 없으면 life·기준 시각·stage로만 결정적으로 재구성한다", () => {
  const input = {
    slotData: {
      slotInstanceId: "slot-instance",
      digimonInstanceId: "digimon-instance",
      evolutionStage: "성장기",
      birthTime: 100,
      createdAt: 50,
      careMistakes: 0,
      unresolvedCareMistakeCount: 0,
    },
    savedStats: {},
    activityLogs: [{
      eventId: "evolution-1",
      type: "EVOLUTION",
      digimonInstanceId: "digimon-instance",
      timestamp: 200,
    }],
    incidents: [],
  };
  const first = buildCareMistakeReconciliationPlan(input);
  const second = buildCareMistakeReconciliationPlan({
    ...input,
    nowMs: 999999,
    slotData: { ...input.slotData, lastSavedAt: 888888 },
  });

  expect(first.recoveredStageStartedAt).toBe(200);
  expect(first.identity.evolutionStageInstanceId).toBeTruthy();
  expect(second.identity.evolutionStageInstanceId).toBe(
    first.identity.evolutionStageInstanceId
  );
  expect(second.checksum).toBe(first.checksum);
});

test("손상 plan은 lease·staging·transaction을 포함해 total zero-write다", async () => {
  const { db, slotRef } = createDbAndSlot();
  const plan = buildCareMistakeReconciliationPlan({
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      careMistakes: 401,
      unresolvedCareMistakeCount: 401,
    },
    activityLogs: [],
    incidents: [],
  });
  const acquireLease = jest.fn();
  const stageBatches = jest.fn();
  const runTransaction = jest.fn();

  await expect(commitCareMistakeReconciliation({
    db,
    slotRef,
    plan,
    baseRevision: 4,
    acquireLease,
    stageBatches,
    runTransaction,
  })).rejects.toThrow("검증된 careMistake reconciliation plan이 필요합니다.");
  expect(acquireLease).not.toHaveBeenCalled();
  expect(stageBatches).not.toHaveBeenCalled();
  expect(runTransaction).not.toHaveBeenCalled();
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
  const runTransaction = async (_db, callback) => {
    const writes = [];
    const transaction = {
      get: async (ref) => snapshot(stored.get(ref.path) || null),
      set(ref, value, options) {
        writes.push({ ref, value, options });
      },
    };
    const result = await callback(transaction);
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
    return result;
  };

  await expect(stageCareMistakeReconciliationBatches({
    db,
    slotRef,
    plan,
    transitionId: "reconciliation-resume",
    runTransaction,
    stagedAtValue: 123,
  })).rejects.toThrow("network interrupted");

  const result = await stageCareMistakeReconciliationBatches({
    db,
    slotRef,
    plan,
    transitionId: "reconciliation-resume",
    runTransaction,
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

test("stale owner batch는 새 owner가 재사용하고 이전 owner의 후속 쓰기는 차단한다", async () => {
  const { db, slotRef } = createDbAndSlot();
  const plan = createPlan();
  const runPath = `${slotRef.path}/careMistakeReconciliations/reconciliation-fenced`;
  const batchPath = `${runPath}/batches/batch-0000`;
  const stored = new Map([
    [runPath, { ownerAttemptId: "owner-new", checksum: plan.checksum }],
    [batchPath, {
      ownerAttemptId: "owner-stale",
      checksum: buildCareMistakeReconciliationBatches(plan)[0].checksum,
      incidentCount: 2,
    }],
  ]);
  const runTransaction = async (_db, callback) => {
    const writes = [];
    const result = await callback({
      get: async (ref) => snapshot(stored.get(ref.path) || null),
      set: (ref, value, options) => writes.push({ ref, value, options }),
    });
    writes.forEach(({ ref, value, options }) => {
      const previous = stored.get(ref.path) || {};
      stored.set(ref.path, options?.merge ? { ...previous, ...value } : value);
    });
    return result;
  };

  const resumed = await stageCareMistakeReconciliationBatches({
    db,
    slotRef,
    plan,
    transitionId: "reconciliation-fenced",
    ownerAttemptId: "owner-new",
    runTransaction,
    stagedAtValue: 1000,
  });
  expect(resumed.stagedBatchCount).toBe(1);
  expect(stored.get(batchPath).ownerAttemptId).toBe("owner-stale");
  expect(stored.get(runPath)).toMatchObject({ ownerAttemptId: "owner-new", status: "ready" });

  await expect(stageCareMistakeReconciliationBatches({
    db,
    slotRef,
    plan,
    transitionId: "reconciliation-fenced",
    ownerAttemptId: "owner-stale",
    runTransaction,
  })).rejects.toMatchObject({ code: "game/reconciliation-owner-conflict" });
});

test("저장 2건과 실제 호출 2건이 일치하면 verified가 된다", () => {
  const plan = buildCareMistakeReconciliationPlan({
    slotData: {
      ...identity,
      evolutionStageStartedAt: 100,
      careMistakes: 2,
      unresolvedCareMistakeCount: 2,
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
    acquireLease: jest.fn(async () => ({ acquired: true })),
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

test("최종 transaction 전에 lease 소유자가 바뀌면 공식 상태를 쓰지 않는다", async () => {
  const { db, slotRef } = createDbAndSlot();
  const plan = createPlan();
  const transaction = {
    get: jest.fn(async (ref) => {
      if (ref.path === slotRef.path) {
        return snapshot({ ...identity, revision: 4, digimonStats: {} });
      }
      if (ref.path.includes("/careMistakeReconciliations/")) {
        return snapshot({
          checksum: plan.checksum,
          ownerAttemptId: "owner-new",
          status: "ready",
        });
      }
      return snapshot();
    }),
    update: jest.fn(),
    set: jest.fn(),
    create: jest.fn(),
  };

  await expect(commitCareMistakeReconciliation({
    db,
    slotRef,
    plan,
    baseRevision: 4,
    ownerAttemptId: "owner-stale",
    acquireLease: jest.fn(async () => ({ acquired: true, existingStatus: "ready" })),
    stageBatches: jest.fn(),
    runTransaction: async (_db, callback) => callback(transaction),
  })).rejects.toMatchObject({ code: "game/reconciliation-owner-conflict" });
  expect(transaction.update).not.toHaveBeenCalled();
  expect(transaction.set).not.toHaveBeenCalled();
  expect(transaction.create).not.toHaveBeenCalled();
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
    acquireLease: jest.fn(async () => ({ acquired: true })),
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
    acquireLease: jest.fn(async () => ({ acquired: true })),
    stageBatches: jest.fn(async () => ({ stagedBatchCount: 1 })),
    runTransaction: async (_db, callback) => callback(retryTransaction),
  });

  expect(result).toMatchObject({ revision: 5, idempotent: true });
  expect(retryTransaction.update).not.toHaveBeenCalled();
  expect(retryTransaction.set).not.toHaveBeenCalled();
  expect(retryTransaction.create).not.toHaveBeenCalled();
  expect(receipt).toBeTruthy();
});

test("owner attempt ID가 달라도 lease 밖의 영속 artifact는 동일하다", async () => {
  const { db, slotRef } = createDbAndSlot();
  const plan = createPlan();
  const run = async (ownerAttemptId) => {
    const transaction = {
      get: jest.fn(async (ref) =>
        ref.path === slotRef.path
          ? snapshot({ ...identity, revision: 4, digimonStats: {} })
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
      ownerAttemptId,
      acquireLease: jest.fn(async () => ({ acquired: true })),
      stageBatches: jest.fn(async () => ({ stagedBatchCount: 1 })),
      runTransaction: async (_db, callback) => callback(transaction),
      committedAtValue: 500,
    });
    return {
      result,
      slotUpdate: transaction.update.mock.calls[0][1],
      incidents: transaction.create.mock.calls.map(([ref, value]) => [ref.path, value]),
      receipt: transaction.set.mock.calls.find(([, value]) =>
        value.transitionType === "CARE_MISTAKE_RECONCILED"
      ).map((value, index) => index === 0 ? value.path : value),
    };
  };

  const first = await run("owner-a");
  const second = await run("owner-b");
  expect(second).toEqual(first);
});

test("활성 lease는 쓰지 않고 대기하며 stale lease는 같은 run을 인수한다", async () => {
  const { db, slotRef } = createDbAndSlot();
  const plan = createPlan();
  const runRef = doc(db, `${slotRef.path}/careMistakeReconciliations/run-1`);
  const activeTransaction = {
    get: jest.fn(async () => snapshot({
      checksum: plan.checksum,
      ownerAttemptId: "other-owner",
      status: "staging",
      updatedAt: 900,
    })),
    set: jest.fn(),
  };
  const active = await acquireCareMistakeReconciliationLease({
    db,
    runRef,
    transitionId: "run-1",
    plan,
    ownerAttemptId: "my-owner",
    nowMs: 1000,
    leaseMs: 500,
    runTransaction: async (_db, callback) => callback(activeTransaction),
  });
  expect(active).toMatchObject({ acquired: false, retryAt: 1400 });
  expect(activeTransaction.set).not.toHaveBeenCalled();

  const staleTransaction = {
    get: jest.fn(async () => snapshot({
      checksum: plan.checksum,
      ownerAttemptId: "other-owner",
      status: "staging",
      updatedAt: 100,
    })),
    set: jest.fn(),
  };
  const stale = await acquireCareMistakeReconciliationLease({
    db,
    runRef,
    transitionId: "run-1",
    plan,
    ownerAttemptId: "my-owner",
    nowMs: 1000,
    leaseMs: 500,
    updatedAtValue: 1000,
    runTransaction: async (_db, callback) => callback(staleTransaction),
  });
  expect(stale).toMatchObject({ acquired: true, resumed: true, takenOver: true });
  expect(staleTransaction.set).toHaveBeenCalledWith(
    runRef,
    expect.objectContaining({ ownerAttemptId: "my-owner", status: "staging" }),
    { merge: true }
  );

  const committedTransaction = {
    get: jest.fn(async () => snapshot({
      checksum: plan.checksum,
      ownerAttemptId: "previous-owner",
      status: "committed",
      updatedAt: 100,
    })),
    set: jest.fn(),
  };
  const committed = await acquireCareMistakeReconciliationLease({
    db,
    runRef,
    transitionId: "run-1",
    plan,
    ownerAttemptId: "my-owner",
    nowMs: 1000,
    leaseMs: 500,
    runTransaction: async (_db, callback) => callback(committedTransaction),
  });
  expect(committed).toMatchObject({
    acquired: true,
    resumed: true,
    existingStatus: "committed",
  });
  expect(committedTransaction.set).not.toHaveBeenCalled();
});

test("동시 두 실행은 활성 lease 하나만 통과시켜 receipt와 revision을 한 번만 만든다", async () => {
  const { db, slotRef } = createDbAndSlot();
  const plan = createPlan();
  let leaseOwner = null;
  const acquireLease = jest.fn(async ({ ownerAttemptId }) => {
    if (!leaseOwner) {
      leaseOwner = ownerAttemptId;
      return { acquired: true };
    }
    return { acquired: leaseOwner === ownerAttemptId, retryAt: 5000 };
  });
  const stageBatches = jest.fn(async () => ({ stagedBatchCount: 1 }));
  const transaction = {
    get: jest.fn(async (ref) =>
      ref.path === slotRef.path
        ? snapshot({ ...identity, revision: 4, digimonStats: {} })
        : snapshot()
    ),
    update: jest.fn(),
    set: jest.fn(),
    create: jest.fn(),
  };
  const runTransaction = jest.fn(async (_db, callback) => callback(transaction));

  const results = await Promise.allSettled([
    commitCareMistakeReconciliation({
      db,
      slotRef,
      plan,
      baseRevision: 4,
      ownerAttemptId: "owner-a",
      acquireLease,
      stageBatches,
      runTransaction,
    }),
    commitCareMistakeReconciliation({
      db,
      slotRef,
      plan,
      baseRevision: 4,
      ownerAttemptId: "owner-b",
      acquireLease,
      stageBatches,
      runTransaction,
    }),
  ]);

  expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
  expect(results.find((result) => result.status === "rejected").reason).toMatchObject({
    code: "game/reconciliation-in-progress",
  });
  expect(stageBatches).toHaveBeenCalledTimes(1);
  expect(runTransaction).toHaveBeenCalledTimes(1);
  expect(transaction.update).toHaveBeenCalledTimes(1);
  expect(transaction.set.mock.calls.filter(([, value]) =>
    value.transitionType === "CARE_MISTAKE_RECONCILED"
  )).toHaveLength(1);
});
