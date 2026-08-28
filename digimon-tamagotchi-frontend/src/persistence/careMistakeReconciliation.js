import { toEpochMs } from "../utils/time";
import {
  collection,
  doc,
  getDoc,
  runTransaction as firestoreRunTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  CARE_MISTAKE_RECONCILIATION_STATUS,
  CARE_MISTAKE_SCHEMA_VERSION,
  CARE_MISTAKE_TRANSITION_TYPES,
  buildCareMistakeIncidentId,
  buildEvolutionStageInstanceId,
  deriveCareMistakeProjection,
  getCareMistakeReasonKey,
  isCareMistakeActivityLog,
  normalizeCareMistakeIdentity,
  normalizeCareMistakeIncident,
  sortCareMistakeIncidents,
} from "../logic/stats/careMistakeProjection";

export const CARE_MISTAKE_RECONCILIATION_VERSION = 1;
export const CARE_MISTAKE_RECONCILIATION_BATCH_SIZE = 50;
export const CARE_MISTAKE_RECONCILIATION_MAX_INCIDENTS = 400;

export const CARE_MISTAKE_RECONCILIATION_TRANSITION_TYPE =
  CARE_MISTAKE_TRANSITION_TYPES.RECONCILED;

function hashText(value = "") {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeResolutionLog(log = {}) {
  const type = String(log.type || "").trim().toUpperCase();
  if (type === "CARE_MISTAKE_RESOLVED") return true;
  if (type !== "PLAY_OR_SNACK") return false;
  const text = String(log.text || "");
  return text.includes("성공") || text.includes("해소") || text.includes("Care Mistakes");
}

function getStageStartedAt(slotData = {}, savedStats = {}) {
  return toEpochMs(
    slotData.evolutionStageStartedAt ??
      savedStats.evolutionStageStartedAt ??
      savedStats.stageStartedAt
  );
}

function resolveStageIdentity(slotData = {}, savedStats = {}, digimonInstanceId) {
  return (
    slotData.evolutionStageInstanceId ||
    savedStats.evolutionStageInstanceId ||
    buildEvolutionStageInstanceId({
      digimonInstanceId,
      evolutionStageStartedAt: getStageStartedAt(slotData, savedStats),
      evolutionStage: slotData.evolutionStage || savedStats.evolutionStage,
    })
  );
}

function sortLogs(logs = []) {
  return [...logs].sort((left, right) => {
    const leftAt = toEpochMs(left?.timestamp) ?? 0;
    const rightAt = toEpochMs(right?.timestamp) ?? 0;
    return leftAt - rightAt || String(left?.eventId || "").localeCompare(String(right?.eventId || ""));
  });
}

function getStableLogKey(log = {}) {
  if (typeof log.eventId === "string" && log.eventId.trim()) {
    return `event:${log.eventId.trim()}`;
  }
  const timestamp = toEpochMs(log.timestamp);
  const type = String(log.type || "").trim().toUpperCase();
  const text = String(log.text || "");
  if (timestamp == null || (!type && !text)) return null;
  return `legacy:${type}:${timestamp}:${text}`;
}

function deduplicateLogs(logs = []) {
  const seen = new Set();
  return logs.filter((log, index) => {
    const stableKey = getStableLogKey(log);
    const key = stableKey || `unstable:${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildIncidentFromLog(log, identity, index) {
  const occurredAt = toEpochMs(log?.timestamp);
  if (occurredAt == null) return null;
  const reasonKey = getCareMistakeReasonKey(log.text, log.reasonKey);
  return {
    incidentId:
      log.incidentId ||
      buildCareMistakeIncidentId({
        reasonKey,
        occurredAt,
        ...identity,
      }),
    transitionId: log.transitionId || `reconciliation:${identity.digimonInstanceId}:${identity.evolutionStageInstanceId}`,
    eventId: log.eventId || `legacy-care:${reasonKey}:${occurredAt}:${index}`,
    ...identity,
    occurredAt,
    reasonKey,
    text: String(log.text || "케어미스 발생"),
    status: "unresolved",
    resolvedAt: null,
    resolvedBy: null,
    previousUnresolvedIncidentId: null,
  };
}

function mergeIncident(existing, candidate) {
  if (!existing) return candidate;
  return {
    ...candidate,
    transitionId: existing.transitionId || candidate.transitionId,
    eventId: existing.eventId || candidate.eventId,
    status: existing.status === "resolved" ? "resolved" : candidate.status,
    resolvedAt: existing.resolvedAt ?? null,
    resolvedBy: existing.resolvedBy ?? null,
    previousUnresolvedIncidentId:
      existing.previousUnresolvedIncidentId || candidate.previousUnresolvedIncidentId || null,
  };
}

function buildChecksum({ identity, incidents, sourceEventIds }) {
  const canonical = JSON.stringify({
    identity,
    incidents: sortCareMistakeIncidents(incidents).map((incident) => ({
      incidentId: incident.incidentId,
      occurredAt: incident.occurredAt,
      reasonKey: incident.reasonKey,
      status: incident.status,
      resolvedAt: incident.resolvedAt,
      resolvedBy: incident.resolvedBy,
    })),
    sourceEventIds: [...sourceEventIds].sort(),
  });
  return `care-reconcile:${hashText(canonical)}`;
}

function buildBatchChecksum(identity, incidents) {
  return `care-stage:${hashText(JSON.stringify({
    identity,
    incidents: incidents.map((incident) => ({
      incidentId: incident.incidentId,
      status: incident.status,
      resolvedAt: incident.resolvedAt,
      previousUnresolvedIncidentId: incident.previousUnresolvedIncidentId,
    })),
  }))}`;
}

export function buildCareMistakeReconciliationBatches(plan, {
  batchSize = CARE_MISTAKE_RECONCILIATION_BATCH_SIZE,
} = {}) {
  if (!plan?.canActivateProjection || !Array.isArray(plan.incidents)) {
    throw new TypeError("검증된 reconciliation plan이 필요합니다.");
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new TypeError("reconciliation batchSize는 1~100 정수여야 합니다.");
  }
  if (plan.incidents.length > CARE_MISTAKE_RECONCILIATION_MAX_INCIDENTS) {
    const error = new Error("자동 reconciliation 상한을 초과했습니다.");
    error.code = "game/reconciliation-operator-required";
    error.incidentCount = plan.incidents.length;
    throw error;
  }

  const identity = normalizeCareMistakeIdentity(plan.identity);
  const batches = [];
  for (let offset = 0; offset < plan.incidents.length; offset += batchSize) {
    const incidents = plan.incidents.slice(offset, offset + batchSize);
    const batchIndex = batches.length;
    batches.push({
      batchId: `batch-${String(batchIndex).padStart(4, "0")}`,
      batchIndex,
      incidentCount: incidents.length,
      incidents,
      checksum: buildBatchChecksum(identity, incidents),
    });
  }
  return batches;
}

/**
 * reconciliation incident를 결정적 batch로 먼저 staging합니다.
 * 이전에 완료된 batch는 checksum이 같으면 건너뛰므로 중단 후 재시작할 수 있습니다.
 */
export async function stageCareMistakeReconciliationBatches({
  db,
  slotRef,
  plan,
  transitionId,
  getDocument = getDoc,
  createWriteBatch = writeBatch,
  stagedAtValue,
} = {}) {
  if (!db || !slotRef || !transitionId) {
    throw new TypeError("reconciliation staging 저장 정보가 필요합니다.");
  }
  const batches = buildCareMistakeReconciliationBatches(plan);
  const runRef = doc(collection(slotRef, "careMistakeReconciliations"), transitionId);
  let stagedBatchCount = 0;

  for (const batch of batches) {
    const batchRef = doc(collection(runRef, "batches"), batch.batchId);
    const existingSnapshot = await getDocument(batchRef);
    if (existingSnapshot.exists()) {
      const existing = existingSnapshot.data() || {};
      if (
        existing.checksum !== batch.checksum ||
        existing.incidentCount !== batch.incidentCount
      ) {
        const error = new Error("기존 reconciliation staging batch의 checksum이 다릅니다.");
        error.code = "game/reconciliation-staging-conflict";
        error.batchId = batch.batchId;
        throw error;
      }
      stagedBatchCount += 1;
      continue;
    }

    const batchWriter = createWriteBatch(db);
    batchWriter.set(runRef, {
      schemaVersion: 1,
      transitionId,
      ...plan.identity,
      checksum: plan.checksum,
      incidentCount: plan.incidents.length,
      batchCount: batches.length,
      status: "staging",
      updatedAt: stagedAtValue || serverTimestamp(),
    }, { merge: true });
    batchWriter.set(batchRef, {
      schemaVersion: 1,
      transitionId,
      batchId: batch.batchId,
      batchIndex: batch.batchIndex,
      incidentCount: batch.incidentCount,
      checksum: batch.checksum,
      incidentIds: batch.incidents.map((incident) => incident.incidentId),
      incidents: batch.incidents,
      stagedAt: stagedAtValue || serverTimestamp(),
    });
    await batchWriter.commit();
    stagedBatchCount += 1;
  }

  const finalWriter = createWriteBatch(db);
  finalWriter.set(runRef, {
    status: "ready",
    checksum: plan.checksum,
    incidentCount: plan.incidents.length,
    batchCount: batches.length,
    stagedBatchCount,
    updatedAt: stagedAtValue || serverTimestamp(),
  }, { merge: true });
  await finalWriter.commit();

  return { runRef, batches, stagedBatchCount };
}

function normalizeRevision(value, fieldName = "revision") {
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 0) {
    throw new TypeError(`${fieldName}은(는) 0 이상의 정수여야 합니다.`);
  }
  return revision;
}

function buildReconciliationRequestFingerprint({ transitionId, plan }) {
  return JSON.stringify([
    `care-reconciliation-v${CARE_MISTAKE_RECONCILIATION_VERSION}`,
    transitionId,
    plan.identity,
    plan.checksum,
    plan.projection,
    plan.incidents.map((incident) => ({
      incidentId: incident.incidentId,
      status: incident.status,
      resolvedAt: incident.resolvedAt,
      resolvedBy: incident.resolvedBy,
    })),
  ]);
}

export function buildCareMistakeReconciliationTransitionId({
  identity = {},
  checksum,
} = {}) {
  const normalizedIdentity = normalizeCareMistakeIdentity(identity);
  if (
    !normalizedIdentity.slotInstanceId ||
    !normalizedIdentity.digimonInstanceId ||
    !normalizedIdentity.evolutionStageInstanceId ||
    typeof checksum !== "string" ||
    !checksum.trim()
  ) {
    throw new TypeError("케어미스 reconciliation identity와 checksum이 필요합니다.");
  }
  return `reconciliation:${hashText(JSON.stringify({
    identity: normalizedIdentity,
    checksum,
  }))}`;
}

/**
 * 기존 슬롯의 케어미스 로그를 incident로 재생합니다.
 * 기존 careMistakes 값은 감사 결과에만 사용하고 재생 입력으로 사용하지 않습니다.
 */
export function buildCareMistakeReconciliationPlan({
  slotData = {},
  savedStats = {},
  activityLogs,
  incidents = [],
  pendingActivityLogs = [],
  nowMs = Date.now(),
} = {}) {
  const slotInstanceId = slotData.slotInstanceId || savedStats.slotInstanceId || null;
  const digimonInstanceId = slotData.digimonInstanceId || savedStats.digimonInstanceId || null;
  const stageStartedAt = getStageStartedAt(slotData, savedStats);
  const evolutionStageInstanceId = resolveStageIdentity(
    slotData,
    savedStats,
    digimonInstanceId
  );
  const audit = {
    hasValidSlotInstanceId: typeof slotInstanceId === "string" && slotInstanceId.trim().length > 0,
    hasValidDigimonInstanceId:
      typeof digimonInstanceId === "string" && digimonInstanceId.trim().length > 0,
    hasCurrentStageStartedAt: Number.isFinite(stageStartedAt),
    hasCurrentStageIdentity:
      typeof evolutionStageInstanceId === "string" && evolutionStageInstanceId.trim().length > 0,
    hasReadableActivityLogs: Array.isArray(activityLogs),
    hasInterpretableCareEvents: true,
    hasIncludedPendingEvents: Array.isArray(pendingActivityLogs),
    hasDeduplicableEventIds: true,
    withinAutomaticIncidentLimit: true,
  };

  const identity = normalizeCareMistakeIdentity({
    slotInstanceId,
    digimonInstanceId,
    evolutionStageInstanceId,
  });
  const allLogs = deduplicateLogs([
    ...(Array.isArray(activityLogs) ? activityLogs : []),
    ...(Array.isArray(pendingActivityLogs) ? pendingActivityLogs : []),
  ]);
  const careEvidenceLogs = allLogs.filter(
    (log) => isCareMistakeActivityLog(log) || normalizeResolutionLog(log)
  );
  audit.hasDeduplicableEventIds = careEvidenceLogs.every(
    (log) => getStableLogKey(log) != null
  );
  const sourceEventIds = new Set();
  const careLogs = [];
  const resolutionLogs = [];

  if (audit.hasReadableActivityLogs && audit.hasCurrentStageStartedAt) {
    sortLogs(allLogs).forEach((log, index) => {
      const timestamp = toEpochMs(log?.timestamp);
      if (log?.eventId) sourceEventIds.add(log.eventId);
      if (timestamp == null) {
        if (isCareMistakeActivityLog(log) || normalizeResolutionLog(log)) {
          audit.hasInterpretableCareEvents = false;
        }
        return;
      }
      if (timestamp < stageStartedAt) return;
      if (isCareMistakeActivityLog(log)) {
        careLogs.push({ log, index });
      } else if (normalizeResolutionLog(log)) {
        resolutionLogs.push({ log, index });
      }
    });
  }

  const currentIncidents = sortCareMistakeIncidents(incidents).filter(
    (incident) =>
      incident.slotInstanceId === identity.slotInstanceId &&
      incident.digimonInstanceId === identity.digimonInstanceId &&
      incident.evolutionStageInstanceId === identity.evolutionStageInstanceId
  );
  const incidentMap = new Map(currentIncidents.map((incident) => [incident.incidentId, incident]));

  careLogs.forEach(({ log, index }) => {
    const candidate = buildIncidentFromLog(log, identity, index);
    if (!candidate?.incidentId) {
      audit.hasInterpretableCareEvents = false;
      return;
    }
    incidentMap.set(candidate.incidentId, mergeIncident(incidentMap.get(candidate.incidentId), candidate));
  });

  const replayedIncidents = sortCareMistakeIncidents(Array.from(incidentMap.values()));
  audit.withinAutomaticIncidentLimit =
    replayedIncidents.length <= CARE_MISTAKE_RECONCILIATION_MAX_INCIDENTS;
  const resolutionOperations = [];
  resolutionLogs.forEach(({ log }) => {
    const unresolved = replayedIncidents.filter((incident) => incident.status === "unresolved");
    const target = unresolved[unresolved.length - 1];
    if (!target) return;
    const resolvedAt = toEpochMs(log.timestamp) ?? nowMs;
    const updated = replayedIncidents.find((incident) => incident.incidentId === target.incidentId);
    if (updated) {
      updated.status = "resolved";
      updated.resolvedAt = resolvedAt;
      updated.resolvedBy = "play_or_snack";
      resolutionOperations.push({ incidentId: target.incidentId, resolvedAt, resolvedBy: "play_or_snack" });
    }
  });

  // 최종 unresolved 집합을 기준으로 head 연결을 다시 만든다. 특히 레거시
  // 로그에서 새로 만든 incident는 이 링크가 있어야 이후 교감 해소가
  // query 없이 5→4→3처럼 이전 incident로 정확히 돌아간다.
  let previousUnresolvedIncidentId = null;
  replayedIncidents.forEach((incident) => {
    if (incident.status !== "unresolved") return;
    incident.previousUnresolvedIncidentId = previousUnresolvedIncidentId;
    previousUnresolvedIncidentId = incident.incidentId;
  });

  const validAudit = Object.values(audit).every(Boolean);
  const status = validAudit
    ? CARE_MISTAKE_RECONCILIATION_STATUS.VERIFIED
    : CARE_MISTAKE_RECONCILIATION_STATUS.AMBIGUOUS;
  const projection = deriveCareMistakeProjection({ incidents: replayedIncidents, identity });
  const checksum = buildChecksum({ identity, incidents: replayedIncidents, sourceEventIds });
  const occurrenceOperations = careLogs
    .map(({ log, index }) => buildIncidentFromLog(log, identity, index))
    .filter(Boolean)
    .map((incident) => ({
      transitionType: "CARE_MISTAKE_OCCURRED",
      incidentId: incident.incidentId,
      eventId: incident.eventId,
      reasonKey: incident.reasonKey,
      occurredAt: incident.occurredAt,
      text: incident.text,
      source: "reconciliation",
    }));

  return {
    status,
    reconciliationVersion: status === CARE_MISTAKE_RECONCILIATION_STATUS.VERIFIED
      ? CARE_MISTAKE_RECONCILIATION_VERSION
      : null,
    schemaVersion: CARE_MISTAKE_SCHEMA_VERSION,
    identity,
    audit,
    incidents: replayedIncidents,
    projection: {
      ...projection,
      careMistakeReconciliationStatus: status,
      ...(status === CARE_MISTAKE_RECONCILIATION_STATUS.VERIFIED
        ? { careMistakeReconciliationVersion: CARE_MISTAKE_RECONCILIATION_VERSION }
        : {}),
    },
    operations: [...occurrenceOperations, ...resolutionOperations.map((operation) => ({
      transitionType: "CARE_MISTAKE_RESOLVED",
      ...operation,
    }))],
    sourceEventIds: Array.from(sourceEventIds),
    checksum,
    generatedAt: toEpochMs(nowMs) ?? Date.now(),
    canActivateProjection: status === CARE_MISTAKE_RECONCILIATION_STATUS.VERIFIED,
  };
}

function buildReconciliationProjection(plan) {
  const projection = deriveCareMistakeProjection({
    incidents: plan.incidents,
    identity: plan.identity,
    reconciliationStatus: CARE_MISTAKE_RECONCILIATION_STATUS.VERIFIED,
    reconciliationVersion: CARE_MISTAKE_RECONCILIATION_VERSION,
  });
  if (
    projection.careMistakes !== plan.projection.careMistakes ||
    projection.latestUnresolvedCareMistakeIncidentId !==
      plan.projection.latestUnresolvedCareMistakeIncidentId
  ) {
    throw new Error("케어미스 reconciliation projection checksum이 일치하지 않습니다.");
  }
  return projection;
}

function assertReconciliationIncidentIdentity(incident, identity) {
  if (
    incident.slotInstanceId !== identity.slotInstanceId ||
    incident.digimonInstanceId !== identity.digimonInstanceId ||
    incident.evolutionStageInstanceId !== identity.evolutionStageInstanceId
  ) {
    const error = new Error("다른 생애 또는 stage incident를 reconciliation할 수 없습니다.");
    error.code = "game/reconciliation-incident-identity-conflict";
    throw error;
  }
}

/**
 * 검증된 reconciliation plan을 incident·projection·receipt와 함께 확정합니다.
 * 기존 activity log를 다시 쓰지 않으며, 같은 checksum은 receipt로 멱등 처리합니다.
 */
export async function commitCareMistakeReconciliation({
  db,
  slotRef,
  plan,
  baseRevision,
  runTransaction = firestoreRunTransaction,
  stageBatches = stageCareMistakeReconciliationBatches,
  committedAtValue,
} = {}) {
  if (!db || !slotRef || !plan?.canActivateProjection) {
    throw new TypeError("검증된 careMistake reconciliation plan이 필요합니다.");
  }
  const identity = normalizeCareMistakeIdentity(plan.identity);
  const projection = buildReconciliationProjection(plan);
  const expectedRevision = normalizeRevision(baseRevision);
  const transitionId = buildCareMistakeReconciliationTransitionId({
    identity,
    checksum: plan.checksum,
  });
  const requestFingerprint = buildReconciliationRequestFingerprint({
    transitionId,
    plan,
  });
  const transitionRef = doc(collection(slotRef, "gameTransitions"), transitionId);
  await stageBatches({ db, slotRef, plan, transitionId });
  const incidentRefs = new Map(
    plan.incidents.map((incident) => [
      incident.incidentId,
      doc(collection(slotRef, "careMistakeIncidents"), incident.incidentId),
    ])
  );

  return runTransaction(db, async (transaction) => {
    const receiptSnapshot = await transaction.get(transitionRef);
    if (receiptSnapshot.exists()) {
      const receipt = receiptSnapshot.data() || {};
      if (receipt.requestFingerprint !== requestFingerprint) {
        const error = new Error("같은 reconciliation transitionId에 다른 plan을 재사용했습니다.");
        error.code = "game/reconciliation-idempotency-conflict";
        throw error;
      }
      return {
        transitionId,
        revision: normalizeRevision(receipt.resultRevision, "resultRevision"),
        projection: receipt.projection || projection,
        idempotent: true,
      };
    }

    const slotSnapshot = await transaction.get(slotRef);
    if (!slotSnapshot.exists()) {
      const error = new Error("reconciliation 대상 슬롯을 찾을 수 없습니다.");
      error.code = "game/reconciliation-slot-missing";
      throw error;
    }
    const slotData = slotSnapshot.data() || {};
    const actualRevision = normalizeRevision(slotData.revision ?? 0);
    if (actualRevision !== expectedRevision) {
      const error = new Error("reconciliation 대상 슬롯 revision이 변경되었습니다.");
      error.code = "game/reconciliation-revision-conflict";
      error.expectedRevision = expectedRevision;
      error.actualRevision = actualRevision;
      error.remoteData = slotData;
      throw error;
    }
    if (
      slotData.slotInstanceId !== identity.slotInstanceId ||
      slotData.digimonInstanceId !== identity.digimonInstanceId ||
      (slotData.evolutionStageInstanceId &&
        slotData.evolutionStageInstanceId !== identity.evolutionStageInstanceId)
    ) {
      const error = new Error("reconciliation 대상 슬롯 identity가 변경되었습니다.");
      error.code = "game/reconciliation-identity-conflict";
      throw error;
    }

    // Firestore transaction의 모든 read를 write보다 먼저 수행합니다.
    const incidentSnapshots = new Map();
    for (const [incidentId, incidentRef] of incidentRefs.entries()) {
      incidentSnapshots.set(incidentId, await transaction.get(incidentRef));
    }

    const incidentWrites = [];
    plan.incidents.forEach((incident) => {
      assertReconciliationIncidentIdentity(incident, identity);
      const snapshot = incidentSnapshots.get(incident.incidentId);
      if (!snapshot?.exists()) {
        incidentWrites.push({
          kind: "create",
          ref: incidentRefs.get(incident.incidentId),
          incident: {
            ...incident,
            transitionId,
          },
        });
        return;
      }
      const existing = normalizeCareMistakeIncident({
        incidentId: incident.incidentId,
        ...snapshot.data(),
      });
      if (!existing) {
        const error = new Error("기존 careMistake incident 형식을 해석할 수 없습니다.");
        error.code = "game/reconciliation-incident-invalid";
        throw error;
      }
      assertReconciliationIncidentIdentity(existing, identity);
      if (
        incident.status === "resolved" &&
        existing.status === "unresolved"
      ) {
        incidentWrites.push({
          kind: "resolve",
          ref: incidentRefs.get(incident.incidentId),
          value: {
            status: "resolved",
            resolvedAt: incident.resolvedAt,
            resolvedBy: incident.resolvedBy || "reconciliation",
          },
        });
      } else if (
        incident.status === "unresolved" &&
        existing.status === "unresolved" &&
        existing.previousUnresolvedIncidentId !== incident.previousUnresolvedIncidentId
      ) {
        incidentWrites.push({
          kind: "repair-head",
          ref: incidentRefs.get(incident.incidentId),
          value: {
            previousUnresolvedIncidentId: incident.previousUnresolvedIncidentId || null,
          },
        });
      }
    });

    const nextRevision = actualRevision + 1;
    const nextStats = {
      ...(slotData.digimonStats || {}),
      ...projection,
    };
    delete nextStats.careMistakeLedger;
    const slotUpdate = {
      digimonStats: nextStats,
      ...projection,
      careMistakeReconciliationChecksum: plan.checksum,
      lastGameTransitionId: transitionId,
      revision: nextRevision,
      updatedAt: serverTimestamp(),
    };

    incidentWrites.forEach((write) => {
      if (write.kind === "create") {
        if (typeof transaction.create === "function") {
          transaction.create(write.ref, write.incident);
        } else {
          transaction.set(write.ref, write.incident, { merge: true });
        }
      } else {
        transaction.set(write.ref, write.value, { merge: true });
      }
    });
    transaction.update(slotRef, slotUpdate);
    transaction.set(transitionRef, {
      schemaVersion: 1,
      transitionId,
      clientInstanceId: "reconciliation",
      localSequence: 0,
      parentTransitionId: null,
      transitionType: CARE_MISTAKE_RECONCILIATION_TRANSITION_TYPE,
      baseRevision: expectedRevision,
      resultRevision: nextRevision,
      eventIds: plan.sourceEventIds || [],
      incidentIds: plan.incidents.map((incident) => incident.incidentId),
      slotInstanceId: identity.slotInstanceId,
      digimonInstanceId: identity.digimonInstanceId,
      evolutionStageInstanceId: identity.evolutionStageInstanceId,
      resultingStateHash: plan.checksum,
      requestFingerprint,
      projection,
      reconciliationVersion: CARE_MISTAKE_RECONCILIATION_VERSION,
      committedAt: committedAtValue || serverTimestamp(),
    });

    return {
      transitionId,
      revision: nextRevision,
      projection,
      idempotent: false,
    };
  });
}
