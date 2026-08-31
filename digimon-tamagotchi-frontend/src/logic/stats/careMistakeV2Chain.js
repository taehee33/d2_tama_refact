import {
  CARE_MISTAKE_V2_REPAIR_LIMIT,
  CARE_MISTAKE_V2_SCHEMA_VERSION,
  isNonNegativeInteger,
} from "./careMistakeV2Domain";

export const CARE_MISTAKE_CHAIN_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  OVER_REPAIR_BOUNDARY: "over_repair_boundary",
});

export const CARE_MISTAKE_ORDERING_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
});

export const CARE_MISTAKE_EPOCH_OPERATION = Object.freeze({
  MIGRATION: "migration",
  BASELINE_OVERRIDE: "baseline_override",
  LINKED_HEAD_REPAIR: "linked_head_repair",
});

export const CARE_MISTAKE_CHAIN_DIAGNOSTIC = Object.freeze({
  INVALID_INCIDENT_ORDERING: "INVALID_INCIDENT_ORDERING",
  DUPLICATE_INCIDENT_OPERATION_KEY: "DUPLICATE_INCIDENT_OPERATION_KEY",
  DUPLICATE_INCIDENT_ID: "DUPLICATE_INCIDENT_ID",
  OVER_REPAIR_BOUNDARY: "OVER_REPAIR_BOUNDARY",
  POST_CUTOVER_COUNT_MISMATCH: "POST_CUTOVER_COUNT_MISMATCH",
  HEAD_CHAIN_CYCLE: "HEAD_CHAIN_CYCLE",
  HEAD_CHAIN_INCIDENT_MISSING: "HEAD_CHAIN_INCIDENT_MISSING",
  HEAD_CHAIN_SET_MISMATCH: "HEAD_CHAIN_SET_MISMATCH",
  HEAD_CHAIN_ORDER_MISMATCH: "HEAD_CHAIN_ORDER_MISMATCH",
  HEAD_CHAIN_NULLABILITY_MISMATCH: "HEAD_CHAIN_NULLABILITY_MISMATCH",
  REVISION_CONFLICT: "REVISION_CONFLICT",
  INVALID_EPOCH_OPERATION: "INVALID_EPOCH_OPERATION",
  REPAIR_RECEIPT_REQUIRED: "REPAIR_RECEIPT_REQUIRED",
});

function normalizeId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeIncident(incident = {}) {
  const incidentId = normalizeId(incident.incidentId ?? incident.id);
  return incidentId ? { ...incident, incidentId } : { ...incident, incidentId: null };
}

function uniqueDiagnostics(values = []) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

export function selectCareMistakeV2UnresolvedIncidents({ state = {}, incidents = [] } = {}) {
  return (Array.isArray(incidents) ? incidents : [])
    .map(normalizeIncident)
    .filter((incident) =>
      incident.careSchemaVersion === CARE_MISTAKE_V2_SCHEMA_VERSION &&
      incident.rootReceiptId === state.rootReceiptId &&
      incident.evolutionStageInstanceId === state.evolutionStageInstanceId &&
      incident.status === "unresolved" &&
      incident.resolvedAt === null
    );
}

export function compareCareMistakeIncidentOrder(left, right) {
  return left.occurredRevision - right.occurredRevision ||
    left.operationIndex - right.operationIndex ||
    String(left.incidentId).localeCompare(String(right.incidentId));
}

export function validateCareMistakeIncidentOrdering(incidents = []) {
  const diagnostics = [];
  const incidentIds = new Set();
  const operationKeys = new Set();
  const normalized = (Array.isArray(incidents) ? incidents : []).map(normalizeIncident);
  normalized.forEach((incident) => {
    if (!incident.incidentId || !isNonNegativeInteger(incident.occurredRevision) ||
        !isNonNegativeInteger(incident.operationIndex)) {
      diagnostics.push(CARE_MISTAKE_CHAIN_DIAGNOSTIC.INVALID_INCIDENT_ORDERING);
      return;
    }
    if (incidentIds.has(incident.incidentId)) {
      diagnostics.push(CARE_MISTAKE_CHAIN_DIAGNOSTIC.DUPLICATE_INCIDENT_ID);
    }
    incidentIds.add(incident.incidentId);
    const operationKey = `${incident.occurredRevision}:${incident.operationIndex}`;
    if (operationKeys.has(operationKey)) {
      diagnostics.push(CARE_MISTAKE_CHAIN_DIAGNOSTIC.DUPLICATE_INCIDENT_OPERATION_KEY);
    }
    operationKeys.add(operationKey);
  });
  const diagnosticCodes = uniqueDiagnostics(diagnostics);
  return {
    orderingStatus: diagnosticCodes.length
      ? CARE_MISTAKE_ORDERING_STATUS.INVALID
      : CARE_MISTAKE_ORDERING_STATUS.VALID,
    diagnosticCodes,
    orderedIncidents: diagnosticCodes.length
      ? []
      : [...normalized].sort(compareCareMistakeIncidentOrder),
  };
}

function buildExpectedPointers(orderedIncidents) {
  return orderedIncidents.map((incident, index) => ({
    incidentId: incident.incidentId,
    previousUnresolvedIncidentId: orderedIncidents[index - 1]?.incidentId || null,
  }));
}

export function auditCareMistakeFullChain({ state = {}, incidents = [] } = {}) {
  const targets = selectCareMistakeV2UnresolvedIncidents({ state, incidents });
  const storedCount = state.postCutoverUnresolvedCount;
  if ((isNonNegativeInteger(storedCount) && storedCount > CARE_MISTAKE_V2_REPAIR_LIMIT) ||
      targets.length > CARE_MISTAKE_V2_REPAIR_LIMIT) {
    return {
      chainStatus: CARE_MISTAKE_CHAIN_STATUS.OVER_REPAIR_BOUNDARY,
      orderingStatus: CARE_MISTAKE_ORDERING_STATUS.INVALID,
      repairability: "none",
      diagnosticCodes: [CARE_MISTAKE_CHAIN_DIAGNOSTIC.OVER_REPAIR_BOUNDARY],
      v2UnresolvedIncidentCount: targets.length,
      expectedHeadIncidentId: null,
      pointerChanges: [],
    };
  }

  const ordering = validateCareMistakeIncidentOrdering(targets);
  if (ordering.orderingStatus !== CARE_MISTAKE_ORDERING_STATUS.VALID) {
    return {
      chainStatus: CARE_MISTAKE_CHAIN_STATUS.INVALID,
      orderingStatus: ordering.orderingStatus,
      repairability: "none",
      diagnosticCodes: ordering.diagnosticCodes,
      v2UnresolvedIncidentCount: targets.length,
      expectedHeadIncidentId: null,
      pointerChanges: [],
    };
  }

  const diagnostics = [];
  const ordered = ordering.orderedIncidents;
  const expectedPointers = buildExpectedPointers(ordered);
  const expectedHeadIncidentId = ordered.at(-1)?.incidentId || null;
  if (!isNonNegativeInteger(storedCount) || storedCount !== targets.length) {
    diagnostics.push(CARE_MISTAKE_CHAIN_DIAGNOSTIC.POST_CUTOVER_COUNT_MISMATCH);
  }
  if ((targets.length === 0 && state.latestUnresolvedIncidentId != null) ||
      (targets.length > 0 && normalizeId(state.latestUnresolvedIncidentId) == null)) {
    diagnostics.push(CARE_MISTAKE_CHAIN_DIAGNOSTIC.HEAD_CHAIN_NULLABILITY_MISMATCH);
  }

  const byId = new Map(targets.map((incident) => [incident.incidentId, incident]));
  const visited = new Set();
  let cursorId = normalizeId(state.latestUnresolvedIncidentId);
  while (cursorId) {
    if (visited.has(cursorId)) {
      diagnostics.push(CARE_MISTAKE_CHAIN_DIAGNOSTIC.HEAD_CHAIN_CYCLE);
      break;
    }
    const incident = byId.get(cursorId);
    if (!incident) {
      diagnostics.push(CARE_MISTAKE_CHAIN_DIAGNOSTIC.HEAD_CHAIN_INCIDENT_MISSING);
      break;
    }
    visited.add(cursorId);
    cursorId = normalizeId(incident.previousUnresolvedIncidentId);
  }
  if (visited.size !== targets.length || targets.some((incident) => !visited.has(incident.incidentId))) {
    diagnostics.push(CARE_MISTAKE_CHAIN_DIAGNOSTIC.HEAD_CHAIN_SET_MISMATCH);
  }

  const pointerChanges = expectedPointers.filter(({ incidentId, previousUnresolvedIncidentId }) => {
    const current = normalizeId(byId.get(incidentId)?.previousUnresolvedIncidentId);
    return current !== previousUnresolvedIncidentId;
  });
  if (normalizeId(state.latestUnresolvedIncidentId) !== expectedHeadIncidentId || pointerChanges.length > 0) {
    diagnostics.push(CARE_MISTAKE_CHAIN_DIAGNOSTIC.HEAD_CHAIN_ORDER_MISMATCH);
  }

  const diagnosticCodes = uniqueDiagnostics(diagnostics);
  const countMatches = storedCount === targets.length;
  const repairable = ordering.orderingStatus === CARE_MISTAKE_ORDERING_STATUS.VALID && countMatches;
  return {
    chainStatus: diagnosticCodes.length
      ? CARE_MISTAKE_CHAIN_STATUS.INVALID
      : CARE_MISTAKE_CHAIN_STATUS.VALID,
    orderingStatus: ordering.orderingStatus,
    repairability: diagnosticCodes.length && repairable ? "linked_head_repair" : "none",
    diagnosticCodes,
    v2UnresolvedIncidentCount: targets.length,
    expectedHeadIncidentId,
    pointerChanges,
  };
}

export function advanceCareMistakeRevision({
  operationType,
  currentRevision,
  expectedRevision,
} = {}) {
  const validOperations = new Set(Object.values(CARE_MISTAKE_EPOCH_OPERATION));
  const diagnostics = [];
  if (!validOperations.has(operationType)) {
    diagnostics.push(CARE_MISTAKE_CHAIN_DIAGNOSTIC.INVALID_EPOCH_OPERATION);
  }
  if (!isNonNegativeInteger(currentRevision) || expectedRevision !== currentRevision) {
    diagnostics.push(CARE_MISTAKE_CHAIN_DIAGNOSTIC.REVISION_CONFLICT);
  }
  if (diagnostics.length) {
    return {
      ok: false,
      diagnosticCodes: uniqueDiagnostics(diagnostics),
      nextRevision: null,
    };
  }
  return { ok: true, diagnosticCodes: [], nextRevision: currentRevision + 1 };
}

export function buildLinkedHeadRepairPlan({
  state = {},
  incidents = [],
  currentRevision,
  expectedRevision,
  nextReceiptId,
} = {}) {
  const revision = advanceCareMistakeRevision({
    operationType: CARE_MISTAKE_EPOCH_OPERATION.LINKED_HEAD_REPAIR,
    currentRevision,
    expectedRevision,
  });
  const repairReceiptId = normalizeId(nextReceiptId);
  if (!revision.ok || !repairReceiptId) {
    return {
      ok: false,
      diagnosticCodes: uniqueDiagnostics([
        ...revision.diagnosticCodes,
        repairReceiptId ? null : CARE_MISTAKE_CHAIN_DIAGNOSTIC.REPAIR_RECEIPT_REQUIRED,
      ]),
    };
  }
  const audit = auditCareMistakeFullChain({ state, incidents });
  if (audit.chainStatus === CARE_MISTAKE_CHAIN_STATUS.VALID) {
    return { ok: true, noChange: true, audit, nextRevision: currentRevision };
  }
  if (audit.repairability !== "linked_head_repair") {
    return { ok: false, diagnosticCodes: audit.diagnosticCodes, audit };
  }
  return {
    ok: true,
    noChange: false,
    nextRevision: revision.nextRevision,
    nextReceiptId: repairReceiptId,
    statePatch: {
      latestUnresolvedIncidentId: audit.expectedHeadIncidentId,
      receiptId: repairReceiptId,
    },
    incidentPointerUpdates: audit.pointerChanges,
    audit,
  };
}

export function snapshotLinkedHeadProtectedFields({ state = {}, incidents = [] } = {}) {
  return {
    baselineRemainingCount: state.baselineRemainingCount,
    postCutoverUnresolvedCount: state.postCutoverUnresolvedCount,
    unresolvedCareMistakeCount: state.unresolvedCareMistakeCount,
    incidents: (Array.isArray(incidents) ? incidents : [])
      .map(normalizeIncident)
      .sort((left, right) => String(left.incidentId).localeCompare(String(right.incidentId)))
      .map((incident) => ({
        incidentId: incident.incidentId,
        occurredRevision: incident.occurredRevision,
        operationIndex: incident.operationIndex,
        rootReceiptId: incident.rootReceiptId,
        evolutionStageInstanceId: incident.evolutionStageInstanceId,
        status: incident.status,
        resolvedAt: incident.resolvedAt ?? null,
      })),
  };
}
