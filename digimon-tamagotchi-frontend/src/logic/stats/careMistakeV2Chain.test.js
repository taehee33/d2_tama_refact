import {
  CARE_MISTAKE_CHAIN_DIAGNOSTIC,
  CARE_MISTAKE_CHAIN_STATUS,
  CARE_MISTAKE_EPOCH_OPERATION,
  advanceCareMistakeRevision,
  auditCareMistakeFullChain,
  buildLinkedHeadRepairPlan,
  snapshotLinkedHeadProtectedFields,
  validateCareMistakeIncidentOrdering,
} from "./careMistakeV2Chain";

const rootReceiptId = "receipt-A";
const stageId = "stage-1";

function incident(index, overrides = {}) {
  return {
    incidentId: `incident-${index}`,
    careSchemaVersion: 2,
    rootReceiptId,
    evolutionStageInstanceId: stageId,
    occurredRevision: 10 + index,
    operationIndex: 0,
    status: "unresolved",
    resolvedAt: null,
    previousUnresolvedIncidentId: index > 0 ? `incident-${index - 1}` : null,
    ...overrides,
  };
}

function state(count, overrides = {}) {
  return {
    schemaVersion: 2,
    rootReceiptId,
    receiptId: rootReceiptId,
    evolutionStageInstanceId: stageId,
    baselineRemainingCount: 2,
    postCutoverUnresolvedCount: count,
    unresolvedCareMistakeCount: count + 2,
    latestUnresolvedIncidentId: count ? `incident-${count - 1}` : null,
    ...overrides,
  };
}

describe("careMistakeV2Chain ordering", () => {
  test("ordering metadata는 0 이상의 정수와 non-empty ID를 요구한다", () => {
    const result = validateCareMistakeIncidentOrdering([
      incident(0, { occurredRevision: -1 }),
    ]);
    expect(result.orderingStatus).toBe("invalid");
    expect(result.diagnosticCodes).toContain(
      CARE_MISTAKE_CHAIN_DIAGNOSTIC.INVALID_INCIDENT_ORDERING
    );
  });

  test("동일 revision과 operationIndex 중복은 incidentId로 자동 보정하지 않는다", () => {
    const result = validateCareMistakeIncidentOrdering([
      incident(0, { incidentId: "incident-a", occurredRevision: 50, operationIndex: 0 }),
      incident(1, { incidentId: "incident-b", occurredRevision: 50, operationIndex: 0 }),
    ]);
    expect(result.orderingStatus).toBe("invalid");
    expect(result.orderedIncidents).toEqual([]);
    expect(result.diagnosticCodes).toContain(
      CARE_MISTAKE_CHAIN_DIAGNOSTIC.DUPLICATE_INCIDENT_OPERATION_KEY
    );
  });
});

describe("careMistakeV2Chain full audit", () => {
  test("현재 root/stage의 unresolved V2 incident만 chain 대상이다", () => {
    const current = [incident(0), incident(1)];
    const ignored = [
      incident(2, { careSchemaVersion: 1 }),
      incident(3, { rootReceiptId: "old-root" }),
      incident(4, { evolutionStageInstanceId: "old-stage" }),
      incident(5, { status: "resolved", resolvedAt: 100 }),
    ];
    const result = auditCareMistakeFullChain({ state: state(2), incidents: [...ignored, ...current] });

    expect(result.chainStatus).toBe(CARE_MISTAKE_CHAIN_STATUS.VALID);
    expect(result.v2UnresolvedIncidentCount).toBe(2);
  });

  test("cycle을 탐지한다", () => {
    const incidents = [
      incident(0, { previousUnresolvedIncidentId: "incident-1" }),
      incident(1, { previousUnresolvedIncidentId: "incident-0" }),
      incident(2),
    ];
    const result = auditCareMistakeFullChain({ state: state(3), incidents });

    expect(result.chainStatus).toBe(CARE_MISTAKE_CHAIN_STATUS.INVALID);
    expect(result.diagnosticCodes).toContain(CARE_MISTAKE_CHAIN_DIAGNOSTIC.HEAD_CHAIN_CYCLE);
  });

  test("head chain에 연결되지 않은 unresolved incident를 탐지한다", () => {
    const incidents = [
      incident(0),
      incident(1, { previousUnresolvedIncidentId: null }),
      incident(2, { previousUnresolvedIncidentId: "incident-1" }),
    ];
    const result = auditCareMistakeFullChain({ state: state(3), incidents });

    expect(result.chainStatus).toBe(CARE_MISTAKE_CHAIN_STATUS.INVALID);
    expect(result.diagnosticCodes).toContain(
      CARE_MISTAKE_CHAIN_DIAGNOSTIC.HEAD_CHAIN_SET_MISMATCH
    );
  });

  test("stored count와 실제 unresolved 집합이 다르면 linked repair로 숫자를 고치지 않는다", () => {
    const result = auditCareMistakeFullChain({
      state: state(3),
      incidents: [incident(0), incident(1)],
    });
    expect(result.repairability).toBe("none");
    expect(result.diagnosticCodes).toContain(
      CARE_MISTAKE_CHAIN_DIAGNOSTIC.POST_CUTOVER_COUNT_MISMATCH
    );
  });

  test("400건은 감사 가능하고 401건은 truncation 없이 거부한다", () => {
    const fourHundred = Array.from({ length: 400 }, (_, index) => incident(index));
    const valid = auditCareMistakeFullChain({ state: state(400), incidents: fourHundred });
    expect(valid.chainStatus).toBe(CARE_MISTAKE_CHAIN_STATUS.VALID);

    const fourHundredOne = [...fourHundred, incident(400)];
    const rejected = auditCareMistakeFullChain({ state: state(401), incidents: fourHundredOne });
    expect(rejected.chainStatus).toBe(CARE_MISTAKE_CHAIN_STATUS.OVER_REPAIR_BOUNDARY);
    expect(rejected.diagnosticCodes).toEqual([
      CARE_MISTAKE_CHAIN_DIAGNOSTIC.OVER_REPAIR_BOUNDARY,
    ]);
    expect(rejected.pointerChanges).toEqual([]);
  });
});

describe("careMistakeV2Chain rebuild", () => {
  test.each(Object.values(CARE_MISTAKE_EPOCH_OPERATION))(
    "%s 성공은 공통 revision epoch를 정확히 1 증가시킨다",
    (operationType) => {
      expect(advanceCareMistakeRevision({
        operationType,
        currentRevision: 50,
        expectedRevision: 50,
      })).toEqual({ ok: true, diagnosticCodes: [], nextRevision: 51 });
    }
  );

  test("손상된 pointer/head만 결정적으로 복구하고 revision을 1 증가시킨다", () => {
    const incidents = [
      incident(0, { previousUnresolvedIncidentId: "incident-2" }),
      incident(1, { previousUnresolvedIncidentId: null }),
      incident(2, { previousUnresolvedIncidentId: "incident-0" }),
    ];
    const currentState = state(3, { latestUnresolvedIncidentId: "incident-1" });
    const before = snapshotLinkedHeadProtectedFields({ state: currentState, incidents });
    const plan = buildLinkedHeadRepairPlan({
      state: currentState,
      incidents,
      currentRevision: 50,
      expectedRevision: 50,
      nextReceiptId: "receipt-B",
    });

    expect(plan).toMatchObject({
      ok: true,
      noChange: false,
      nextRevision: 51,
      nextReceiptId: "receipt-B",
      statePatch: {
        latestUnresolvedIncidentId: "incident-2",
        receiptId: "receipt-B",
      },
    });
    const repairedIncidents = incidents.map((item) => {
      const update = plan.incidentPointerUpdates.find((candidate) => candidate.incidentId === item.incidentId);
      return update ? { ...item, ...update } : item;
    });
    const after = snapshotLinkedHeadProtectedFields({
      state: { ...currentState, ...plan.statePatch },
      incidents: repairedIncidents,
    });
    expect(after).toEqual(before);
  });

  test("revision 불일치면 repair payload를 만들지 않는다", () => {
    const plan = buildLinkedHeadRepairPlan({
      state: state(2, { latestUnresolvedIncidentId: "incident-0" }),
      incidents: [incident(0), incident(1)],
      currentRevision: 51,
      expectedRevision: 50,
      nextReceiptId: "receipt-B",
    });
    expect(plan.ok).toBe(false);
    expect(plan.diagnosticCodes).toContain(CARE_MISTAKE_CHAIN_DIAGNOSTIC.REVISION_CONFLICT);
  });
});
