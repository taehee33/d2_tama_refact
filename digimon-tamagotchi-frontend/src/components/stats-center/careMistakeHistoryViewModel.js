import {
  getCareMistakeReasonKeyFromText,
  isCareMistakeLog,
} from "../../logic/stats/careMistakeLedger";
import { compareCareMistakeIncidentOrder } from "../../logic/stats/careMistakeV2Chain";
import { CARE_MISTAKE_V2_SCHEMA_VERSION } from "../../logic/stats/careMistakeV2Domain";
import { toEpochMs } from "../../utils/time";

const DISPLAY_LIMIT = 10;

function normalizeId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeReason(value, fallback = "케어미스 발생") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getReasonKey(value = {}) {
  return normalizeId(value.reasonKey) || getCareMistakeReasonKeyFromText(value.text || "");
}

function getActivityLogKey(log = {}) {
  const incidentId = normalizeId(log.incidentId);
  if (incidentId) return `incident:${incidentId}`;
  const eventId = normalizeId(log.eventId);
  if (eventId) return `event:${eventId}`;
  const occurredAt = toEpochMs(log.timestamp);
  return occurredAt == null ? null : `legacy:${occurredAt}:${getReasonKey(log)}`;
}

function getActivityLogMatchKeys(log = {}) {
  const keys = [];
  const incidentId = normalizeId(log.incidentId);
  const eventId = normalizeId(log.eventId);
  const occurredAt = toEpochMs(log.timestamp);
  if (incidentId) keys.push(`incident:${incidentId}`);
  if (eventId) keys.push(`event:${eventId}`);
  if (occurredAt != null) keys.push(`legacy:${occurredAt}:${getReasonKey(log)}`);
  return keys;
}

function getIncidentKey(incident = {}) {
  const incidentId = normalizeId(incident.incidentId ?? incident.id);
  if (incidentId) return `incident:${incidentId}`;
  const eventId = normalizeId(incident.eventId);
  if (eventId) return `event:${eventId}`;
  const occurredAt = toEpochMs(incident.occurredAt);
  return occurredAt == null ? null : `legacy:${occurredAt}:${getReasonKey(incident)}`;
}

function getIncidentMatchKeys(incident = {}) {
  const keys = [];
  const incidentId = normalizeId(incident.incidentId ?? incident.id);
  const eventId = normalizeId(incident.eventId);
  const occurredAt = toEpochMs(incident.occurredAt);
  if (incidentId) keys.push(`incident:${incidentId}`);
  if (eventId) keys.push(`event:${eventId}`);
  if (occurredAt != null) keys.push(`legacy:${occurredAt}:${getReasonKey(incident)}`);
  return keys;
}

function hasV2Ordering(incident = {}) {
  return Number.isInteger(incident.occurredRevision) && incident.occurredRevision >= 0 &&
    Number.isInteger(incident.operationIndex) && incident.operationIndex >= 0;
}

function isV2Incident(incident = {}) {
  return incident?.careSchemaVersion === CARE_MISTAKE_V2_SCHEMA_VERSION &&
    Boolean(normalizeId(incident.incidentId ?? incident.id)) &&
    Boolean(normalizeId(incident.evolutionStageInstanceId)) &&
    hasV2Ordering(incident);
}

function isCurrentStage(value, currentStageId, currentStageStartedAt) {
  const stageId = normalizeId(value?.evolutionStageInstanceId);
  if (currentStageId) {
    if (stageId) return stageId === currentStageId;
    const occurredAt = toEpochMs(value?.occurredAt ?? value?.timestamp);
    return currentStageStartedAt != null && occurredAt != null && occurredAt >= currentStageStartedAt;
  }
  const occurredAt = toEpochMs(value?.occurredAt ?? value?.timestamp);
  return currentStageStartedAt != null && occurredAt != null && occurredAt >= currentStageStartedAt;
}

function createLogLookup(activityLogs) {
  const lookup = new Map();
  (Array.isArray(activityLogs) ? activityLogs : [])
    .filter(isCareMistakeLog)
    .forEach((log) => {
      getActivityLogMatchKeys(log).forEach((key) => {
        if (!lookup.has(key)) lookup.set(key, log);
      });
    });
  return lookup;
}

function findLinkedActivityLog(incident, logLookup) {
  return getIncidentMatchKeys(incident)
    .map((key) => logLookup.get(key))
    .find(Boolean) || null;
}

function toStatus(incident) {
  if (incident.status === "unresolved" && incident.resolvedAt == null) return "active";
  if (incident.status === "resolved") return "resolved";
  return "unknown";
}

function buildV2History({ incidents, activityLogs, currentStageId, currentStageStartedAt }) {
  const scoped = incidents.filter((incident) =>
    isV2Incident(incident) && isCurrentStage(incident, currentStageId, currentStageStartedAt)
  );
  const unique = new Map();
  [...scoped].sort(compareCareMistakeIncidentOrder).forEach((incident) => {
    const key = getIncidentKey(incident);
    if (key && !unique.has(key)) unique.set(key, incident);
  });
  const logLookup = createLogLookup(activityLogs);
  const ordered = [...unique.values()].sort(compareCareMistakeIncidentOrder).reverse();
  const items = ordered.slice(0, DISPLAY_LIMIT).map((incident) => {
    const log = findLinkedActivityLog(incident, logLookup);
    return {
      incidentId: normalizeId(incident.incidentId ?? incident.id),
      occurredAt: toEpochMs(incident.occurredAt) ?? toEpochMs(log?.timestamp),
      reason: normalizeReason(log?.text, normalizeReason(incident.text, getReasonKey(incident))),
      status: toStatus(incident),
    };
  });

  return {
    totalCount: ordered.length,
    displayedCount: items.length,
    isTruncated: ordered.length > items.length,
    isLegacyFallback: false,
    isIncomplete: false,
    items,
  };
}

function buildLegacyHistory({ activityLogs, currentStageId, currentStageStartedAt }) {
  const sourceLogs = (Array.isArray(activityLogs) ? activityLogs : [])
    .filter(isCareMistakeLog)
    .filter((log) => isCurrentStage(log, currentStageId, currentStageStartedAt));
  const unique = new Map();
  sourceLogs.forEach((log) => {
    const key = getActivityLogKey(log);
    if (key && !unique.has(key)) unique.set(key, log);
  });
  const ordered = [...unique.entries()]
    .sort(([leftKey, left], [rightKey, right]) =>
      (toEpochMs(right.timestamp) ?? -1) - (toEpochMs(left.timestamp) ?? -1) ||
      leftKey.localeCompare(rightKey)
    );
  const items = ordered.slice(0, DISPLAY_LIMIT).map(([key, log]) => ({
    incidentId: normalizeId(log.incidentId) || normalizeId(log.eventId) || key,
    occurredAt: toEpochMs(log.timestamp),
    reason: normalizeReason(log.text, getReasonKey(log)),
    status: "unknown",
  }));

  return {
    totalCount: ordered.length,
    displayedCount: items.length,
    isTruncated: ordered.length > items.length,
    isLegacyFallback: true,
    isIncomplete: true,
    items,
  };
}

/**
 * 상태 탭 전용 케어미스 이력을 만듭니다. V2 incident는 상태 정본으로만
 * 사용하며 활동 로그는 사유·시각 표시 보완에만 사용합니다.
 */
export function buildCareMistakeHistoryViewModel({ stats = {}, activityLogs = [] } = {}) {
  const currentStageId = normalizeId(stats.evolutionStageInstanceId);
  const currentStageStartedAt = toEpochMs(stats.evolutionStageStartedAt);
  const incidents = Array.isArray(stats.careMistakeHistoryIncidents)
    ? stats.careMistakeHistoryIncidents
    : Array.isArray(stats.careMistakeLedger)
      ? stats.careMistakeLedger
      : [];
  const hasCompleteV2Source = incidents.length > 0 && incidents.every(isV2Incident);

  if (hasCompleteV2Source) {
    return buildV2History({
      incidents,
      activityLogs,
      currentStageId,
      currentStageStartedAt,
    });
  }

  return buildLegacyHistory({ activityLogs, currentStageId, currentStageStartedAt });
}
