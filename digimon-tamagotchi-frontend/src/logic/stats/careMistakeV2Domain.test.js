import {
  CARE_MISTAKE_EFFECTIVE_INTEGRITY,
  CARE_MISTAKE_V2_CLASSIFICATION,
  CARE_MISTAKE_V2_DIAGNOSTIC,
  classifyCareMistakeSlotV2,
  resolveEffectiveCareMistakeIntegrity,
  validateCareMistakeV2Projection,
} from "./careMistakeV2Domain";

const identity = {
  slotInstanceId: "slot-life-4",
  digimonInstanceId: "digimon-life-4",
  evolutionStageInstanceId: "stage-life-4",
};

function buildV2Fixture({ receiptId = "receipt-A", baseline = 2, postCutover = 1 } = {}) {
  const unresolved = baseline + postCutover;
  const rootReceiptId = "receipt-A";
  return {
    slotData: {
      ...identity,
      careMistakes: unresolved,
      unresolvedCareMistakeCount: unresolved,
      careMistakeState: {
        schemaVersion: 2,
        rootReceiptId,
        receiptId,
        evolutionStageInstanceId: identity.evolutionStageInstanceId,
        baselineRemainingCount: baseline,
        postCutoverUnresolvedCount: postCutover,
        unresolvedCareMistakeCount: unresolved,
        latestUnresolvedIncidentId: postCutover ? "incident-1" : null,
        integrityStatus: "verified",
      },
      digimonStats: {
        careMistakes: unresolved,
        unresolvedCareMistakeCount: unresolved,
      },
    },
    receipts: [
      {
        receiptId: rootReceiptId,
        rootReceiptId,
        receiptType: "migration",
        ...identity,
      },
      ...(receiptId === rootReceiptId ? [] : [{
        receiptId,
        rootReceiptId,
        supersedesReceiptId: rootReceiptId,
        receiptType: "baseline_override",
        ...identity,
      }]),
    ],
  };
}

describe("careMistakeV2Domain", () => {
  test("legacy canonical은 로그가 아니라 digimonStats.careMistakes만 사용한다", () => {
    const result = classifyCareMistakeSlotV2({
      slotData: {
        ...identity,
        careMistakes: 0,
        unresolvedCareMistakeCount: 0,
        digimonStats: { careMistakes: 2, unresolvedCareMistakeCount: 2 },
      },
      legacyEvidence: { occurrenceCount: 5, resolutionCount: 0 },
    });

    expect(result).toMatchObject({
      canonicalBaseline: 2,
      classification: CARE_MISTAKE_V2_CLASSIFICATION.DEGRADED,
    });
    expect(result.diagnosticCodes).toEqual(expect.arrayContaining([
      CARE_MISTAKE_V2_DIAGNOSTIC.LEGACY_ROOT_COUNTER_MISMATCH,
      CARE_MISTAKE_V2_DIAGNOSTIC.LEGACY_EVIDENCE_COUNTER_MISMATCH,
    ]));
  });

  test("유효하지 않은 nested canonical은 자동 fallback하지 않는다", () => {
    const result = classifyCareMistakeSlotV2({
      slotData: {
        ...identity,
        careMistakes: 3,
        digimonStats: { careMistakes: null },
      },
    });

    expect(result.canonicalBaseline).toBeNull();
    expect(result.classification).toBe(CARE_MISTAKE_V2_CLASSIFICATION.REPAIR_REQUIRED);
    expect(result.diagnosticCodes).toContain(
      CARE_MISTAKE_V2_DIAGNOSTIC.INVALID_LEGACY_CANONICAL_BASELINE
    );
  });

  test("V2 projection과 receipt lineage가 모두 맞으면 verified다", () => {
    const fixture = buildV2Fixture();
    expect(validateCareMistakeV2Projection(fixture)).toMatchObject({
      valid: true,
      diagnosticCodes: [],
    });
  });

  test("저장 mirror가 drift해도 자동 보정하지 않고 effective repair_required다", () => {
    const fixture = buildV2Fixture();
    fixture.slotData.digimonStats.careMistakes = 99;
    const result = resolveEffectiveCareMistakeIntegrity({
      ...fixture,
      incidents: [],
    });

    expect(result.effectiveIntegrityStatus).toBe(
      CARE_MISTAKE_EFFECTIVE_INTEGRITY.REPAIR_REQUIRED
    );
    expect(result.diagnosticCodes).toContain(
      CARE_MISTAKE_V2_DIAGNOSTIC.CARE_MISTAKE_MIRROR_MISMATCH
    );
    expect(fixture.slotData.digimonStats.careMistakes).toBe(99);
  });

  test("baseline repair 뒤 기존 root incident는 현재 receipt가 달라도 유효하다", () => {
    const fixture = buildV2Fixture({ receiptId: "receipt-B" });
    const result = resolveEffectiveCareMistakeIntegrity({
      ...fixture,
      incidents: [{
        incidentId: "incident-1",
        careSchemaVersion: 2,
        rootReceiptId: "receipt-A",
        evolutionStageInstanceId: identity.evolutionStageInstanceId,
        status: "unresolved",
        resolvedAt: null,
      }],
    });

    expect(result).toEqual({
      effectiveIntegrityStatus: CARE_MISTAKE_EFFECTIVE_INTEGRITY.VERIFIED,
      diagnosticCodes: [],
    });
  });

  test("hydration은 head 존재·root·stage·unresolved만 저비용 검증한다", () => {
    const fixture = buildV2Fixture();
    const result = resolveEffectiveCareMistakeIntegrity({
      ...fixture,
      incidents: [{
        incidentId: "incident-1",
        careSchemaVersion: 2,
        rootReceiptId: "other-root",
        evolutionStageInstanceId: identity.evolutionStageInstanceId,
        status: "unresolved",
        resolvedAt: null,
      }],
    });

    expect(result.effectiveIntegrityStatus).toBe(
      CARE_MISTAKE_EFFECTIVE_INTEGRITY.REPAIR_REQUIRED
    );
    expect(result.diagnosticCodes).toContain(
      CARE_MISTAKE_V2_DIAGNOSTIC.CARE_HEAD_INCIDENT_INVALID
    );
  });
});
