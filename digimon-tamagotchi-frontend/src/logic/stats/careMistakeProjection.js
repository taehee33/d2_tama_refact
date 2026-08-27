import { toEpochMs } from "../../utils/time";

export const CARE_MISTAKE_SCHEMA_VERSION = 1;

export const CARE_MISTAKE_TRANSITION_TYPES = Object.freeze({
  OCCURRED: "CARE_MISTAKE_OCCURRED",
  RESOLVED: "CARE_MISTAKE_RESOLVED",
  CALL_HISTORY_ACKNOWLEDGED: "CALL_HISTORY_ACKNOWLEDGED",
  FRIDGE_ENTERED: "FRIDGE_ENTERED",
  FRIDGE_EXITED: "FRIDGE_EXITED",
  RECONCILED: "CARE_MISTAKE_RECONCILED",
  EVOLUTION: "EVOLUTION",
});

export const CARE_MISTAKE_RECONCILIATION_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  VERIFIED: "verified",
  AMBIGUOUS: "ambiguous",
  FAILED: "failed",
});

const CARE_MISTAKE_TYPES = new Set(["CAREMISTAKE", "CARE_MISTAKE"]);

function normalizeType(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeTimestamp(value, fallback = null) {
  const timestamp = toEpochMs(value);
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function hashText(value = "") {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function canonicalIdentityPart(value) {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9._~-]/g, "_");
}

export function getCareMistakeReasonKey(text = "", explicitReasonKey = null) {
  const explicit = normalizeString(explicitReasonKey);
  if (explicit) return explicit;
  const normalizedText = String(text || "");
  if (normalizedText.includes("배고픔 콜")) return "hunger_call";
  if (normalizedText.includes("힘 콜")) return "strength_call";
  if (normalizedText.includes("수면 조명 경고")) return "sleep_light_warning";
  if (normalizedText.includes("괴롭히기")) return "tease";
  if (normalizedText.includes("동기화")) return "sync_repair";
  return "other";
}

export function isCareMistakeActivityLog(log = {}) {
  if (!log || typeof log !== "object") return false;
  const type = normalizeType(log.type);
  if (!CARE_MISTAKE_TYPES.has(type)) return false;
  const text = String(log.text || "");
  return type === "CAREMISTAKE" || text.includes("케어미스") || text.includes("Care Mistake");
}

export function isCareMistakeResolutionActivityLog(log = {}) {
  if (!log || typeof log !== "object") return false;
  const type = normalizeType(log.type);
  if (type === CARE_MISTAKE_TRANSITION_TYPES.RESOLVED) return true;
  if (type !== "PLAY_OR_SNACK") return false;
  const text = String(log.text || "");
  return text.includes("케어미스") || text.includes("Care Mistakes");
}

export function buildCareMistakeIncidentId({
  reasonKey = "other",
  occurredAt,
  slotInstanceId,
  digimonInstanceId,
  evolutionStageInstanceId,
} = {}) {
  const timestamp = normalizeTimestamp(occurredAt);
  const lifeId = normalizeString(digimonInstanceId);
  const stageId = normalizeString(evolutionStageInstanceId);
  if (timestamp == null || !lifeId || !stageId) return null;
  const canonical = [reasonKey, timestamp, slotInstanceId, lifeId, stageId].join("|");
  return [
    "care",
    canonicalIdentityPart(reasonKey),
    String(timestamp),
    hashText(canonical),
  ].join(":");
}

export function buildCareMistakeTransitionEventId(transitionId, eventType, index = 0) {
  const safeTransitionId = normalizeString(transitionId);
  const safeEventType = normalizeString(eventType);
  if (!safeTransitionId || !safeEventType || !Number.isInteger(index) || index < 0) {
    return null;
  }
  return `${safeTransitionId}:${safeEventType}:${index}`;
}

export function buildEvolutionStageInstanceId({
  digimonInstanceId,
  evolutionStageStartedAt,
  evolutionStage,
} = {}) {
  const lifeId = normalizeString(digimonInstanceId);
  const startedAt = normalizeTimestamp(evolutionStageStartedAt);
  const stage = normalizeString(evolutionStage) || "unknown";
  if (!lifeId || startedAt == null) return null;
  return `stage:${canonicalIdentityPart(lifeId)}:${canonicalIdentityPart(stage)}:${startedAt}`;
}

export function normalizeCareMistakeIdentity(identity = {}) {
  return {
    slotInstanceId: normalizeString(identity.slotInstanceId),
    digimonInstanceId: normalizeString(identity.digimonInstanceId),
    evolutionStageInstanceId: normalizeString(identity.evolutionStageInstanceId),
  };
}

export function normalizeCareMistakeIncident(incident = {}) {
  if (!incident || typeof incident !== "object") return null;
  const identity = normalizeCareMistakeIdentity(incident);
  const incidentId = normalizeString(incident.incidentId || incident.id);
  const occurredAt = normalizeTimestamp(incident.occurredAt);
  const reasonKey = getCareMistakeReasonKey(incident.text, incident.reasonKey);
  if (!incidentId || occurredAt == null || !identity.digimonInstanceId || !identity.evolutionStageInstanceId) {
    return null;
  }
  const status = incident.status === "resolved" ? "resolved" : "unresolved";
  return {
    incidentId,
    transitionId: normalizeString(incident.transitionId),
    eventId: normalizeString(incident.eventId),
    ...identity,
    occurredAt,
    reasonKey,
    text: String(incident.text || "케어미스 발생"),
    status,
    resolvedAt: normalizeTimestamp(incident.resolvedAt),
    resolvedBy: normalizeString(incident.resolvedBy),
    previousUnresolvedIncidentId: normalizeString(incident.previousUnresolvedIncidentId),
  };
}

export function isCurrentCareMistakeIncident(incident, identity = {}) {
  const normalizedIncident = normalizeCareMistakeIncident(incident);
  const currentIdentity = normalizeCareMistakeIdentity(identity);
  return Boolean(
    normalizedIncident &&
      normalizedIncident.digimonInstanceId === currentIdentity.digimonInstanceId &&
      normalizedIncident.evolutionStageInstanceId === currentIdentity.evolutionStageInstanceId
  );
}

export function sortCareMistakeIncidents(incidents = []) {
  return incidents
    .map(normalizeCareMistakeIncident)
    .filter(Boolean)
    .sort((left, right) =>
      left.occurredAt - right.occurredAt ||
      String(left.incidentId).localeCompare(String(right.incidentId))
    );
}

export function getCurrentStageCareMistakeIncidents(incidents = [], identity = {}) {
  return sortCareMistakeIncidents(incidents).filter((incident) =>
    isCurrentCareMistakeIncident(incident, identity)
  );
}

export function getUnresolvedCareMistakeIncidents(incidents = [], identity = {}) {
  return getCurrentStageCareMistakeIncidents(incidents, identity).filter(
    (incident) => incident.status === "unresolved"
  );
}

export function deriveCareMistakeProjection({
  incidents = [],
  identity = {},
  reconciliationStatus,
  reconciliationVersion,
} = {}) {
  const normalizedIdentity = normalizeCareMistakeIdentity(identity);
  const unresolved = getUnresolvedCareMistakeIncidents(incidents, normalizedIdentity);
  const latest = unresolved[unresolved.length - 1] || null;
  return {
    careMistakes: unresolved.length,
    unresolvedCareMistakeCount: unresolved.length,
    latestUnresolvedCareMistakeIncidentId: latest?.incidentId || null,
    latestCareMistakeAt: latest?.occurredAt ?? null,
    careMistakeSchemaVersion: CARE_MISTAKE_SCHEMA_VERSION,
    ...(reconciliationVersion == null
      ? {}
      : { careMistakeReconciliationVersion: reconciliationVersion }),
    ...(reconciliationStatus == null ? {} : { careMistakeReconciliationStatus: reconciliationStatus }),
    evolutionStageInstanceId: normalizedIdentity.evolutionStageInstanceId,
  };
}

export function buildEmptyCareMistakeStageProjection({
  digimonInstanceId,
  evolutionStageStartedAt,
  evolutionStage,
  reconciliationStatus = CARE_MISTAKE_RECONCILIATION_STATUS.VERIFIED,
  reconciliationVersion = CARE_MISTAKE_SCHEMA_VERSION,
} = {}) {
  const evolutionStageInstanceId = buildEvolutionStageInstanceId({
    digimonInstanceId,
    evolutionStageStartedAt,
    evolutionStage,
  });
  return deriveCareMistakeProjection({
    incidents: [],
    identity: { digimonInstanceId, evolutionStageInstanceId },
    reconciliationStatus,
    reconciliationVersion,
  });
}

export function validateCareMistakeProjection({
  stats = {},
  incidents = [],
  identity = {},
  requireMetadata = false,
} = {}) {
  const expected = deriveCareMistakeProjection({ incidents, identity });
  const actual = {
    careMistakes: Math.max(0, Number(stats.careMistakes) || 0),
    unresolvedCareMistakeCount: Math.max(0, Number(stats.unresolvedCareMistakeCount ?? stats.careMistakes) || 0),
    latestUnresolvedCareMistakeIncidentId: stats.latestUnresolvedCareMistakeIncidentId ?? null,
    latestCareMistakeAt: normalizeTimestamp(stats.latestCareMistakeAt),
  };
  const valid =
    actual.careMistakes === expected.careMistakes &&
    actual.unresolvedCareMistakeCount === expected.unresolvedCareMistakeCount &&
    actual.latestUnresolvedCareMistakeIncidentId === expected.latestUnresolvedCareMistakeIncidentId &&
    actual.latestCareMistakeAt === expected.latestCareMistakeAt &&
    (!requireMetadata || Number(stats.careMistakeSchemaVersion) === CARE_MISTAKE_SCHEMA_VERSION);
  return {
    valid,
    expected,
    actual,
    reason: valid ? null : "CARE_MISTAKE_PROJECTION_MISMATCH",
  };
}

function buildOccurrenceIncident({ transition, operation, previousUnresolvedIncidentId }) {
  const identity = normalizeCareMistakeIdentity({
    ...transition.identity,
    ...(operation.identity || {}),
  });
  const occurredAt = normalizeTimestamp(operation.occurredAt ?? transition.createdAt, Date.now());
  const reasonKey = getCareMistakeReasonKey(operation.text, operation.reasonKey);
  const incidentId =
    operation.incidentId ||
    buildCareMistakeIncidentId({
      reasonKey,
      occurredAt,
      ...identity,
    });
  const eventId =
    operation.eventId ||
    buildCareMistakeTransitionEventId(
      transition.transitionId,
      CARE_MISTAKE_TRANSITION_TYPES.OCCURRED,
      operation.index ?? 0
    );
  return {
    incidentId,
    transitionId: transition.transitionId,
    eventId,
    ...identity,
    occurredAt,
    reasonKey,
    text: String(operation.text || "케어미스 발생"),
    status: "unresolved",
    resolvedAt: null,
    resolvedBy: null,
    previousUnresolvedIncidentId: previousUnresolvedIncidentId || null,
  };
}

function buildActivityEvent({ transition, operation, eventType, index, fallbackText, occurredAt }) {
  return {
    eventId:
      operation.eventId ||
      buildCareMistakeTransitionEventId(transition.transitionId, eventType, index),
    transitionId: transition.transitionId,
    type: operation.logType || (eventType === CARE_MISTAKE_TRANSITION_TYPES.OCCURRED ? "CAREMISTAKE" : "PLAY_OR_SNACK"),
    text: String(operation.text || fallbackText),
    timestamp: normalizeTimestamp(operation.occurredAt ?? occurredAt, Date.now()),
    slotInstanceId: transition.identity.slotInstanceId,
    digimonInstanceId: transition.identity.digimonInstanceId,
    evolutionStageInstanceId: transition.identity.evolutionStageInstanceId,
  };
}

export function applyCareMistakeTransition({
  stats = {},
  incidents = [],
  transition = {},
} = {}) {
  const identity = normalizeCareMistakeIdentity(transition.identity || {});
  const normalizedTransition = {
    transitionId: normalizeString(transition.transitionId) || "local-transition",
    transitionType: transition.transitionType,
    createdAt: normalizeTimestamp(transition.createdAt, Date.now()),
    identity,
  };
  let nextIncidents = sortCareMistakeIncidents(incidents);
  let nextStats = { ...stats };
  const activityEvents = [];
  const changedIncidentIds = [];
  let changed = false;
  const operations = Array.isArray(transition.operations)
    ? transition.operations
    : [transition];

  operations.forEach((operation, index) => {
    const type = operation.transitionType || normalizedTransition.transitionType;
    if (type === CARE_MISTAKE_TRANSITION_TYPES.OCCURRED) {
      const occurrence = buildOccurrenceIncident({
        transition: normalizedTransition,
        operation: { ...operation, index },
        previousUnresolvedIncidentId:
          operation.previousUnresolvedIncidentId ||
          getUnresolvedCareMistakeIncidents(nextIncidents, identity).at(-1)?.incidentId,
      });
      if (!occurrence.incidentId) return;
      const existing = nextIncidents.find((incident) => incident.incidentId === occurrence.incidentId);
      if (!existing) {
        nextIncidents = [...nextIncidents, occurrence];
        changedIncidentIds.push(occurrence.incidentId);
        changed = true;
      }
      activityEvents.push(
        buildActivityEvent({
          transition: normalizedTransition,
          operation: { ...operation, index },
          eventType: type,
          index,
          fallbackText: occurrence.text,
          occurredAt: occurrence.occurredAt,
        })
      );
      return;
    }

    if (type === CARE_MISTAKE_TRANSITION_TYPES.RESOLVED) {
      const unresolved = getUnresolvedCareMistakeIncidents(nextIncidents, identity);
      const targetId = operation.incidentId || unresolved.at(-1)?.incidentId;
      const target = nextIncidents.find((incident) => incident.incidentId === targetId);
      if (target && target.status === "unresolved" && isCurrentCareMistakeIncident(target, identity)) {
        const resolvedAt = normalizeTimestamp(operation.resolvedAt ?? normalizedTransition.createdAt, Date.now());
        nextIncidents = nextIncidents.map((incident) =>
          incident.incidentId === targetId
            ? { ...incident, status: "resolved", resolvedAt, resolvedBy: operation.resolvedBy || "play_or_snack" }
            : incident
        );
        changedIncidentIds.push(targetId);
        changed = true;
      }
      activityEvents.push(
        buildActivityEvent({
          transition: normalizedTransition,
          operation: { ...operation, index },
          eventType: type,
          index,
          fallbackText: "교감 성공으로 케어미스를 해소했습니다.",
          occurredAt: normalizedTransition.createdAt,
        })
      );
      return;
    }

    if (type === CARE_MISTAKE_TRANSITION_TYPES.CALL_HISTORY_ACKNOWLEDGED) {
      const acknowledged = new Set(Array.isArray(nextStats.acknowledgedRecentCallIds) ? nextStats.acknowledgedRecentCallIds : []);
      (operation.callIds || operation.ids || []).forEach((id) => {
        if (typeof id === "string" && id.trim()) acknowledged.add(id.trim());
      });
      nextStats.acknowledgedRecentCallIds = Array.from(acknowledged).slice(-100);
      return;
    }

    if (type === CARE_MISTAKE_TRANSITION_TYPES.FRIDGE_ENTERED) {
      nextStats = {
        ...nextStats,
        isFrozen: true,
        frozenAt: normalizeTimestamp(operation.frozenAt ?? normalizedTransition.createdAt, normalizedTransition.createdAt),
      };
      return;
    }

    if (type === CARE_MISTAKE_TRANSITION_TYPES.FRIDGE_EXITED) {
      nextStats = {
        ...nextStats,
        isFrozen: false,
        frozenAt: null,
        takeOutAt: normalizeTimestamp(operation.takeOutAt ?? normalizedTransition.createdAt, normalizedTransition.createdAt),
      };
    }
  });

  const projection = deriveCareMistakeProjection({ incidents: nextIncidents, identity });
  nextStats = {
    ...nextStats,
    ...projection,
    careMistakeLedger: Array.isArray(nextStats.careMistakeLedger)
      ? nextStats.careMistakeLedger
      : undefined,
  };
  return {
    changed,
    stats: nextStats,
    incidents: sortCareMistakeIncidents(nextIncidents),
    projection,
    activityEvents,
    changedIncidentIds,
  };
}

export function buildCareMistakeOccurrenceFromActivityLog(log, identity, transitionId, index = 0) {
  if (!isCareMistakeActivityLog(log)) return null;
  const occurredAt = normalizeTimestamp(log.timestamp);
  const normalizedIdentity = normalizeCareMistakeIdentity(identity);
  if (occurredAt == null) return null;
  const reasonKey = getCareMistakeReasonKey(log.text, log.reasonKey);
  return {
    transitionType: CARE_MISTAKE_TRANSITION_TYPES.OCCURRED,
    index,
    incidentId:
      log.incidentId ||
      buildCareMistakeIncidentId({ reasonKey, occurredAt, ...normalizedIdentity }),
    reasonKey,
    occurredAt,
    text: String(log.text || "케어미스 발생"),
    source: log.source || "realtime",
    eventId:
      log.eventId ||
      buildCareMistakeTransitionEventId(
        transitionId,
        CARE_MISTAKE_TRANSITION_TYPES.OCCURRED,
        index
      ),
  };
}
