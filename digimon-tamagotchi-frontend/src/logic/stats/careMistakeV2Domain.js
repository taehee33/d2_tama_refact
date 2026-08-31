export const CARE_MISTAKE_V2_SCHEMA_VERSION = 2;
export const CARE_MISTAKE_V2_REPAIR_LIMIT = 400;

export const CARE_MISTAKE_V2_CLASSIFICATION = Object.freeze({
  LEGACY_BASELINE: "legacy_baseline",
  DEGRADED: "degraded",
  REPAIR_REQUIRED: "repair_required",
  VERIFIED_V2: "verified_v2",
});

export const CARE_MISTAKE_EFFECTIVE_INTEGRITY = Object.freeze({
  VERIFIED: "verified",
  REPAIR_REQUIRED: "repair_required",
});

export const CARE_MISTAKE_V2_DIAGNOSTIC = Object.freeze({
  INVALID_LEGACY_CANONICAL_BASELINE: "INVALID_LEGACY_CANONICAL_BASELINE",
  INCOMPLETE_CARE_IDENTITY: "INCOMPLETE_CARE_IDENTITY",
  LEGACY_ROOT_COUNTER_MISMATCH: "LEGACY_ROOT_COUNTER_MISMATCH",
  LEGACY_UNRESOLVED_COUNTER_MISMATCH: "LEGACY_UNRESOLVED_COUNTER_MISMATCH",
  LEGACY_EVIDENCE_COUNTER_MISMATCH: "LEGACY_EVIDENCE_COUNTER_MISMATCH",
  INVALID_CARE_MISTAKE_STATE: "INVALID_CARE_MISTAKE_STATE",
  INVALID_CARE_MISTAKE_COUNT: "INVALID_CARE_MISTAKE_COUNT",
  CARE_MISTAKE_PROJECTION_MISMATCH: "CARE_MISTAKE_PROJECTION_MISMATCH",
  CARE_MISTAKE_MIRROR_MISMATCH: "CARE_MISTAKE_MIRROR_MISMATCH",
  CARE_RECEIPT_NOT_FOUND: "CARE_RECEIPT_NOT_FOUND",
  CARE_ROOT_RECEIPT_NOT_FOUND: "CARE_ROOT_RECEIPT_NOT_FOUND",
  CARE_RECEIPT_IDENTITY_MISMATCH: "CARE_RECEIPT_IDENTITY_MISMATCH",
  CARE_RECEIPT_LINEAGE_BROKEN: "CARE_RECEIPT_LINEAGE_BROKEN",
  CARE_RECEIPT_LINEAGE_CYCLE: "CARE_RECEIPT_LINEAGE_CYCLE",
  CARE_HEAD_NULLABILITY_MISMATCH: "CARE_HEAD_NULLABILITY_MISMATCH",
  CARE_HEAD_INCIDENT_NOT_FOUND: "CARE_HEAD_INCIDENT_NOT_FOUND",
  CARE_HEAD_INCIDENT_INVALID: "CARE_HEAD_INCIDENT_INVALID",
});

function normalizeId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function uniqueDiagnostics(values = []) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function getCareMistakeState(slotData = {}) {
  return slotData?.careMistakeState && typeof slotData.careMistakeState === "object"
    ? slotData.careMistakeState
    : null;
}

export function resolveCareMistakeV2Identity(slotData = {}) {
  const stats = slotData?.digimonStats || {};
  const state = getCareMistakeState(slotData) || {};
  return {
    slotInstanceId: normalizeId(slotData.slotInstanceId ?? stats.slotInstanceId),
    digimonInstanceId: normalizeId(slotData.digimonInstanceId ?? stats.digimonInstanceId),
    rootReceiptId: normalizeId(state.rootReceiptId),
    receiptId: normalizeId(state.receiptId),
    evolutionStageInstanceId: normalizeId(
      state.evolutionStageInstanceId ??
      slotData.evolutionStageInstanceId ??
      stats.evolutionStageInstanceId
    ),
  };
}

function normalizeReceipt(receipt = {}) {
  if (!receipt || typeof receipt !== "object") return null;
  const receiptId = normalizeId(receipt.receiptId ?? receipt.id);
  return receiptId ? { ...receipt, receiptId } : null;
}

function validateReceiptLineage({ state, slotData, receipts }) {
  const diagnostics = [];
  const receiptMap = new Map(
    (Array.isArray(receipts) ? receipts : [])
      .map(normalizeReceipt)
      .filter(Boolean)
      .map((receipt) => [receipt.receiptId, receipt])
  );
  const currentReceipt = receiptMap.get(state.receiptId);
  const rootReceipt = receiptMap.get(state.rootReceiptId);
  if (!currentReceipt) diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.CARE_RECEIPT_NOT_FOUND);
  if (!rootReceipt) diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.CARE_ROOT_RECEIPT_NOT_FOUND);
  if (!currentReceipt || !rootReceipt) return diagnostics;

  const identity = resolveCareMistakeV2Identity(slotData);
  const receiptIdentityMatches = (receipt) =>
    receipt.rootReceiptId === state.rootReceiptId &&
    (!receipt.slotInstanceId || receipt.slotInstanceId === identity.slotInstanceId) &&
    (!receipt.digimonInstanceId || receipt.digimonInstanceId === identity.digimonInstanceId);
  if (!receiptIdentityMatches(currentReceipt) || !receiptIdentityMatches(rootReceipt)) {
    diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.CARE_RECEIPT_IDENTITY_MISMATCH);
    return diagnostics;
  }

  const visited = new Set();
  let cursor = currentReceipt;
  while (cursor.receiptId !== state.rootReceiptId) {
    if (visited.has(cursor.receiptId)) {
      diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.CARE_RECEIPT_LINEAGE_CYCLE);
      return diagnostics;
    }
    visited.add(cursor.receiptId);
    const parentId = normalizeId(cursor.supersedesReceiptId);
    const parent = parentId ? receiptMap.get(parentId) : null;
    if (!parent || !receiptIdentityMatches(parent)) {
      diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.CARE_RECEIPT_LINEAGE_BROKEN);
      return diagnostics;
    }
    cursor = parent;
  }
  return diagnostics;
}

export function validateCareMistakeV2Projection({
  slotData = {},
  receipts = [],
} = {}) {
  const diagnostics = [];
  const state = getCareMistakeState(slotData);
  const stats = slotData?.digimonStats || {};
  if (!state || state.schemaVersion !== CARE_MISTAKE_V2_SCHEMA_VERSION) {
    return {
      valid: false,
      state,
      diagnosticCodes: [CARE_MISTAKE_V2_DIAGNOSTIC.INVALID_CARE_MISTAKE_STATE],
    };
  }

  const identity = resolveCareMistakeV2Identity(slotData);
  if (!identity.slotInstanceId || !identity.digimonInstanceId ||
      !identity.rootReceiptId || !identity.receiptId || !identity.evolutionStageInstanceId) {
    diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.INCOMPLETE_CARE_IDENTITY);
  }

  const baseline = state.baselineRemainingCount;
  const postCutover = state.postCutoverUnresolvedCount;
  const unresolved = state.unresolvedCareMistakeCount;
  if (![baseline, postCutover, unresolved].every(isNonNegativeInteger)) {
    diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.INVALID_CARE_MISTAKE_COUNT);
  } else if (unresolved !== baseline + postCutover) {
    diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.CARE_MISTAKE_PROJECTION_MISMATCH);
  }

  const mirrors = [
    slotData.careMistakes,
    slotData.unresolvedCareMistakeCount,
    stats.careMistakes,
    stats.unresolvedCareMistakeCount,
  ];
  if (!mirrors.every((value) => value === unresolved)) {
    diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.CARE_MISTAKE_MIRROR_MISMATCH);
  }
  diagnostics.push(...validateReceiptLineage({ state, slotData, receipts }));

  const diagnosticCodes = uniqueDiagnostics(diagnostics);
  return { valid: diagnosticCodes.length === 0, state, diagnosticCodes };
}

function isValidLegacyBaseline(value) {
  return isNonNegativeInteger(value) && value <= CARE_MISTAKE_V2_REPAIR_LIMIT;
}

export function classifyCareMistakeSlotV2({
  slotData = {},
  receipts = [],
  legacyEvidence = {},
} = {}) {
  const state = getCareMistakeState(slotData);
  if (state?.schemaVersion === CARE_MISTAKE_V2_SCHEMA_VERSION) {
    const validation = validateCareMistakeV2Projection({ slotData, receipts });
    return {
      canonicalBaseline: validation.valid ? state.baselineRemainingCount : null,
      classification: validation.valid
        ? CARE_MISTAKE_V2_CLASSIFICATION.VERIFIED_V2
        : CARE_MISTAKE_V2_CLASSIFICATION.REPAIR_REQUIRED,
      diagnosticCodes: validation.diagnosticCodes,
    };
  }

  const diagnostics = [];
  const stats = slotData?.digimonStats || {};
  const canonicalBaseline = stats.careMistakes;
  const identity = resolveCareMistakeV2Identity(slotData);
  if (!identity.slotInstanceId || !identity.digimonInstanceId || !identity.evolutionStageInstanceId) {
    diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.INCOMPLETE_CARE_IDENTITY);
  }
  if (!isValidLegacyBaseline(canonicalBaseline)) {
    diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.INVALID_LEGACY_CANONICAL_BASELINE);
  }
  if (slotData.careMistakes != null && slotData.careMistakes !== canonicalBaseline) {
    diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.LEGACY_ROOT_COUNTER_MISMATCH);
  }
  const unresolvedMirrors = [slotData.unresolvedCareMistakeCount, stats.unresolvedCareMistakeCount]
    .filter((value) => value != null);
  if (unresolvedMirrors.some((value) => value !== canonicalBaseline)) {
    diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.LEGACY_UNRESOLVED_COUNTER_MISMATCH);
  }
  const occurrenceCount = legacyEvidence.occurrenceCount;
  const resolutionCount = legacyEvidence.resolutionCount;
  if (isNonNegativeInteger(occurrenceCount) && isNonNegativeInteger(resolutionCount) &&
      Math.max(0, occurrenceCount - resolutionCount) !== canonicalBaseline) {
    diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.LEGACY_EVIDENCE_COUNTER_MISMATCH);
  }

  const diagnosticCodes = uniqueDiagnostics(diagnostics);
  const hasBlockingDiagnostic = diagnosticCodes.includes(
    CARE_MISTAKE_V2_DIAGNOSTIC.INVALID_LEGACY_CANONICAL_BASELINE
  ) || diagnosticCodes.includes(CARE_MISTAKE_V2_DIAGNOSTIC.INCOMPLETE_CARE_IDENTITY);
  return {
    canonicalBaseline: isValidLegacyBaseline(canonicalBaseline) ? canonicalBaseline : null,
    classification: hasBlockingDiagnostic
      ? CARE_MISTAKE_V2_CLASSIFICATION.REPAIR_REQUIRED
      : diagnosticCodes.length > 0
        ? CARE_MISTAKE_V2_CLASSIFICATION.DEGRADED
        : CARE_MISTAKE_V2_CLASSIFICATION.LEGACY_BASELINE,
    diagnosticCodes,
  };
}

function findIncidentById(incidents, incidentId) {
  return (Array.isArray(incidents) ? incidents : []).find(
    (incident) => normalizeId(incident?.incidentId ?? incident?.id) === incidentId
  ) || null;
}

export function resolveEffectiveCareMistakeIntegrity({
  slotData = {},
  receipts = [],
  incidents = [],
} = {}) {
  const projection = validateCareMistakeV2Projection({ slotData, receipts });
  if (!projection.valid) {
    return {
      effectiveIntegrityStatus: CARE_MISTAKE_EFFECTIVE_INTEGRITY.REPAIR_REQUIRED,
      diagnosticCodes: projection.diagnosticCodes,
    };
  }

  const state = projection.state;
  const diagnostics = [];
  const headId = normalizeId(state.latestUnresolvedIncidentId);
  if (state.postCutoverUnresolvedCount === 0 && headId) {
    diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.CARE_HEAD_NULLABILITY_MISMATCH);
  } else if (state.postCutoverUnresolvedCount > 0 && !headId) {
    diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.CARE_HEAD_NULLABILITY_MISMATCH);
  } else if (headId) {
    const head = findIncidentById(incidents, headId);
    if (!head) {
      diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.CARE_HEAD_INCIDENT_NOT_FOUND);
    } else if (
      head.careSchemaVersion !== CARE_MISTAKE_V2_SCHEMA_VERSION ||
      head.rootReceiptId !== state.rootReceiptId ||
      head.evolutionStageInstanceId !== state.evolutionStageInstanceId ||
      head.status !== "unresolved" ||
      head.resolvedAt !== null
    ) {
      diagnostics.push(CARE_MISTAKE_V2_DIAGNOSTIC.CARE_HEAD_INCIDENT_INVALID);
    }
  }

  const diagnosticCodes = uniqueDiagnostics(diagnostics);
  return {
    effectiveIntegrityStatus: diagnosticCodes.length
      ? CARE_MISTAKE_EFFECTIVE_INTEGRITY.REPAIR_REQUIRED
      : CARE_MISTAKE_EFFECTIVE_INTEGRITY.VERIFIED,
    diagnosticCodes,
  };
}
