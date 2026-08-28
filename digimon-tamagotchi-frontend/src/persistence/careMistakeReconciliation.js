import { toEpochMs } from "../utils/time";
import {
  collection,
  doc,
  runTransaction as firestoreRunTransaction,
  serverTimestamp,
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
export const CARE_MISTAKE_REPLAY_VERSION = "care-replay-v1";
export const CARE_MISTAKE_RECONCILIATION_LEASE_MS = 5 * 60 * 1000;

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

function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getLatestLifeTransitionAt(logs = [], digimonInstanceId = null) {
  return (Array.isArray(logs) ? logs : []).reduce((latest, log) => {
    const type = String(log?.type || "").trim().toUpperCase();
    if (type !== "EVOLUTION" && type !== "NEW_START") return latest;
    if (
      log?.digimonInstanceId &&
      digimonInstanceId &&
      log.digimonInstanceId !== digimonInstanceId
    ) return latest;
    const timestamp = toEpochMs(log?.timestamp);
    return Number.isSafeInteger(timestamp) ? Math.max(latest ?? timestamp, timestamp) : latest;
  }, null);
}

function resolveStageContext({ slotData = {}, savedStats = {}, logs = [] } = {}) {
  const rootDigimonIdentity = normalizeNonEmptyString(slotData.digimonInstanceId);
  const nestedDigimonIdentity = normalizeNonEmptyString(savedStats.digimonInstanceId);
  const digimonInstanceId = rootDigimonIdentity || nestedDigimonIdentity;
  const hasConflictingDigimonIdentity = Boolean(
    rootDigimonIdentity &&
    nestedDigimonIdentity &&
    rootDigimonIdentity !== nestedDigimonIdentity
  );
  const rootStageIdentity = normalizeNonEmptyString(slotData.evolutionStageInstanceId);
  const nestedStageIdentity = normalizeNonEmptyString(savedStats.evolutionStageInstanceId);
  const hasConflictingStageIdentity = Boolean(
    rootStageIdentity && nestedStageIdentity && rootStageIdentity !== nestedStageIdentity
  );
  const recoveredStageStartedAt = [
    slotData.evolutionStageStartedAt,
    savedStats.evolutionStageStartedAt,
    savedStats.stageStartedAt,
    getLatestLifeTransitionAt(logs, digimonInstanceId),
    savedStats.birthTime,
    slotData.createdAt,
  ].map(toEpochMs).find(Number.isSafeInteger) ?? null;
  const evolutionStage =
    normalizeNonEmptyString(slotData.evolutionStage) ||
    normalizeNonEmptyString(savedStats.evolutionStage);
  const evolutionStageInstanceId = hasConflictingStageIdentity
    ? null
    : rootStageIdentity || nestedStageIdentity || (
      digimonInstanceId && recoveredStageStartedAt != null && evolutionStage
        ? buildEvolutionStageInstanceId({
            digimonInstanceId,
            evolutionStageStartedAt: recoveredStageStartedAt,
            evolutionStage,
          })
        : null
    );
  return {
    digimonInstanceId,
    evolutionStage,
    evolutionStageInstanceId,
    recoveredStageStartedAt,
    hasConflictingDigimonIdentity,
    hasConflictingStageIdentity,
  };
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

function hasConsistentDuplicateEventIds(logs = []) {
  const fingerprints = new Map();
  return logs.every((log) => {
    const eventId = normalizeNonEmptyString(log?.eventId);
    if (!eventId) return true;
    const fingerprint = JSON.stringify({
      type: String(log?.type || "").trim().toUpperCase(),
      timestamp: toEpochMs(log?.timestamp),
      text: String(log?.text || ""),
      reasonKey: normalizeNonEmptyString(log?.reasonKey),
      slotInstanceId: normalizeNonEmptyString(log?.slotInstanceId),
      digimonInstanceId: normalizeNonEmptyString(log?.digimonInstanceId),
      evolutionStageInstanceId: normalizeNonEmptyString(log?.evolutionStageInstanceId),
    });
    const existing = fingerprints.get(eventId);
    if (existing != null && existing !== fingerprint) return false;
    fingerprints.set(eventId, fingerprint);
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

function getReconciliationIncidentMetadata(incident = {}) {
  return {
    source: incident.source || null,
    originalOccurredAtKnown:
      typeof incident.originalOccurredAtKnown === "boolean"
        ? incident.originalOccurredAtKnown
        : null,
    replayVersion: incident.replayVersion || null,
    replayBasisHash: incident.replayBasisHash || null,
    ordinal: Number.isInteger(incident.ordinal) ? incident.ordinal : null,
  };
}

function buildChecksum({ identity, incidents, sourceEventIds, recoveryBasis }) {
  const canonical = JSON.stringify({
    identity,
    incidents: sortCareMistakeIncidents(incidents).map((incident) => ({
      incidentId: incident.incidentId,
      occurredAt: incident.occurredAt,
      reasonKey: incident.reasonKey,
      status: incident.status,
      resolvedAt: incident.resolvedAt,
      resolvedBy: incident.resolvedBy,
      ...getReconciliationIncidentMetadata(
        incidents.find((candidate) => candidate.incidentId === incident.incidentId)
      ),
    })),
    sourceEventIds: [...sourceEventIds].sort(),
    recoveryBasis,
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
      ...getReconciliationIncidentMetadata(incident),
    })),
  }))}`;
}

function collectLegacyCounterCandidates(slotData = {}, savedStats = {}) {
  const candidates = [];
  [
    ["root.careMistakes", slotData, "careMistakes"],
    ["root.unresolvedCareMistakeCount", slotData, "unresolvedCareMistakeCount"],
    ["stats.careMistakes", savedStats, "careMistakes"],
    ["stats.unresolvedCareMistakeCount", savedStats, "unresolvedCareMistakeCount"],
  ].forEach(([source, container, key]) => {
    if (!Object.prototype.hasOwnProperty.call(container || {}, key)) return;
    candidates.push({ source, value: container[key] });
  });
  return candidates;
}

function buildLegacyRecoveryIncident({
  identity,
  recoveredStageStartedAt,
  replayBasisHash,
  syntheticOrderingBase,
  ordinal,
} = {}) {
  const canonical = JSON.stringify([
    "legacy-recovery-v1",
    identity.slotInstanceId,
    identity.digimonInstanceId,
    identity.evolutionStageInstanceId,
    recoveredStageStartedAt,
    replayBasisHash,
    ordinal,
  ]);
  const occurredAt = syntheticOrderingBase + ordinal;
  return {
    incidentId: `care:legacy-recovery:${ordinal}:${hashText(canonical)}`,
    transitionId: null,
    eventId: null,
    ...identity,
    occurredAt,
    reasonKey: "legacy_recovery",
    text: "복구된 케어미스 기록",
    status: "unresolved",
    resolvedAt: null,
    resolvedBy: null,
    previousUnresolvedIncidentId: null,
    source: "legacy_recovery",
    originalOccurredAtKnown: false,
    replayVersion: CARE_MISTAKE_REPLAY_VERSION,
    replayBasisHash,
    ordinal,
  };
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
  runTransaction = firestoreRunTransaction,
  stagedAtValue,
  ownerAttemptId = null,
} = {}) {
  if (!db || !slotRef || !transitionId) {
    throw new TypeError("reconciliation staging 저장 정보가 필요합니다.");
  }
  const batches = buildCareMistakeReconciliationBatches(plan);
  const runRef = doc(collection(slotRef, "careMistakeReconciliations"), transitionId);
  let stagedBatchCount = 0;
  const assertRunOwner = (runSnapshot) => {
    if (!ownerAttemptId || !runSnapshot.exists()) return;
    const runData = runSnapshot.data() || {};
    const existingOwner = normalizeNonEmptyString(runData.ownerAttemptId);
    if (existingOwner && existingOwner !== ownerAttemptId) {
      const error = new Error("reconciliation lease 소유자가 변경되었습니다.");
      error.code = "game/reconciliation-owner-conflict";
      throw error;
    }
    if (runData.checksum && runData.checksum !== plan.checksum) {
      const error = new Error("기존 reconciliation run의 checksum이 다릅니다.");
      error.code = "game/reconciliation-run-conflict";
      throw error;
    }
  };

  for (const batch of batches) {
    const batchRef = doc(collection(runRef, "batches"), batch.batchId);
    await runTransaction(db, async (transaction) => {
      const runSnapshot = await transaction.get(runRef);
      const existingSnapshot = await transaction.get(batchRef);
      assertRunOwner(runSnapshot);
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
        // stale owner가 남긴 동일 checksum batch는 새 lease owner가 재사용한다.
        return;
      }
      transaction.set(runRef, {
        schemaVersion: 1,
        transitionId,
        ...plan.identity,
        checksum: plan.checksum,
        replayVersion: plan.recoveryBasis?.replayVersion || CARE_MISTAKE_REPLAY_VERSION,
        replayBasisHash: plan.replayBasisHash,
        ...(ownerAttemptId ? { ownerAttemptId } : {}),
        incidentCount: plan.incidents.length,
        batchCount: batches.length,
        status: "staging",
        updatedAt: stagedAtValue || serverTimestamp(),
      }, { merge: true });
      transaction.set(batchRef, {
        schemaVersion: 1,
        transitionId,
        batchId: batch.batchId,
        batchIndex: batch.batchIndex,
        incidentCount: batch.incidentCount,
        checksum: batch.checksum,
        ...(ownerAttemptId ? { ownerAttemptId } : {}),
        incidentIds: batch.incidents.map((incident) => incident.incidentId),
        incidents: batch.incidents,
        stagedAt: stagedAtValue || serverTimestamp(),
      });
    });
    stagedBatchCount += 1;
  }

  await runTransaction(db, async (transaction) => {
    const runSnapshot = await transaction.get(runRef);
    assertRunOwner(runSnapshot);
    transaction.set(runRef, {
      status: "ready",
      checksum: plan.checksum,
      replayVersion: plan.recoveryBasis?.replayVersion || CARE_MISTAKE_REPLAY_VERSION,
      replayBasisHash: plan.replayBasisHash,
      ...(ownerAttemptId ? { ownerAttemptId } : {}),
      incidentCount: plan.incidents.length,
      batchCount: batches.length,
      stagedBatchCount,
      updatedAt: stagedAtValue || serverTimestamp(),
    }, { merge: true });
  });

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

export function createCareMistakeReconciliationOwnerAttemptId() {
  const randomId =
    typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `care-reconciliation-attempt:${randomId}`;
}

export async function acquireCareMistakeReconciliationLease({
  db,
  runRef,
  transitionId,
  plan,
  ownerAttemptId,
  nowMs = Date.now(),
  leaseMs = CARE_MISTAKE_RECONCILIATION_LEASE_MS,
  runTransaction = firestoreRunTransaction,
  updatedAtValue,
} = {}) {
  if (
    !db ||
    !runRef ||
    !transitionId ||
    !plan?.canActivateProjection ||
    !normalizeNonEmptyString(ownerAttemptId) ||
    !Number.isSafeInteger(nowMs) ||
    !Number.isSafeInteger(leaseMs) ||
    leaseMs < 1
  ) {
    throw new TypeError("reconciliation lease 인수가 올바르지 않습니다.");
  }

  return runTransaction(db, async (transaction) => {
    const runSnapshot = await transaction.get(runRef);
    const existing = runSnapshot.exists() ? runSnapshot.data() || {} : null;
    if (existing?.checksum && existing.checksum !== plan.checksum) {
      const error = new Error("기존 reconciliation run의 checksum이 다릅니다.");
      error.code = "game/reconciliation-run-conflict";
      throw error;
    }
    if (existing?.status === "ready" || existing?.status === "committed") {
      return {
        acquired: true,
        resumed: true,
        existingStatus: existing.status,
        runRef,
      };
    }

    const existingOwner = normalizeNonEmptyString(existing?.ownerAttemptId);
    const existingUpdatedAt = toEpochMs(existing?.updatedAt);
    const activeOtherOwner = Boolean(
      existingOwner &&
      existingOwner !== ownerAttemptId &&
      Number.isSafeInteger(existingUpdatedAt) &&
      nowMs - existingUpdatedAt >= 0 &&
      nowMs - existingUpdatedAt < leaseMs
    );
    if (activeOtherOwner) {
      return {
        acquired: false,
        ownerAttemptId: existingOwner,
        retryAt: existingUpdatedAt + leaseMs,
        runRef,
      };
    }

    transaction.set(runRef, {
      schemaVersion: 1,
      transitionId,
      ...plan.identity,
      checksum: plan.checksum,
      replayVersion: plan.recoveryBasis?.replayVersion || CARE_MISTAKE_REPLAY_VERSION,
      replayBasisHash: plan.replayBasisHash,
      ownerAttemptId,
      status: "staging",
      updatedAt: updatedAtValue || serverTimestamp(),
    }, { merge: true });
    return {
      acquired: true,
      resumed: Boolean(existing),
      takenOver: Boolean(existingOwner && existingOwner !== ownerAttemptId),
      runRef,
    };
  });
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
  const rootSlotIdentity = normalizeNonEmptyString(slotData.slotInstanceId);
  const nestedSlotIdentity = normalizeNonEmptyString(savedStats.slotInstanceId);
  const slotInstanceId = rootSlotIdentity || nestedSlotIdentity;
  const hasConflictingSlotIdentity = Boolean(
    rootSlotIdentity && nestedSlotIdentity && rootSlotIdentity !== nestedSlotIdentity
  );
  const normalizedNowMs = toEpochMs(nowMs);
  const inputLogs = [
    ...(Array.isArray(activityLogs) ? activityLogs : []),
    ...(Array.isArray(pendingActivityLogs) ? pendingActivityLogs : []),
  ];
  const stageContext = resolveStageContext({
    slotData,
    savedStats,
    logs: inputLogs,
  });
  const {
    digimonInstanceId,
    evolutionStageInstanceId,
    recoveredStageStartedAt: stageStartedAt,
    hasConflictingDigimonIdentity,
    hasConflictingStageIdentity,
  } = stageContext;
  const counterCandidates = collectLegacyCounterCandidates(slotData, savedStats);
  const countersAreValid = counterCandidates.every(({ value }) =>
    Number.isInteger(value) &&
    value >= 0 &&
    value <= CARE_MISTAKE_RECONCILIATION_MAX_INCIDENTS
  );
  const countersAreConsistent = new Set(
    counterCandidates.map(({ value }) => value)
  ).size <= 1;
  const audit = {
    hasValidSlotInstanceId: typeof slotInstanceId === "string" && slotInstanceId.trim().length > 0,
    hasValidDigimonInstanceId:
      typeof digimonInstanceId === "string" && digimonInstanceId.trim().length > 0,
    hasCurrentStageStartedAt:
      Number.isSafeInteger(stageStartedAt) &&
      Number.isSafeInteger(normalizedNowMs) &&
      stageStartedAt <= normalizedNowMs,
    hasCurrentStageIdentity:
      typeof evolutionStageInstanceId === "string" && evolutionStageInstanceId.trim().length > 0,
    hasConsistentSlotIdentity: !hasConflictingSlotIdentity,
    hasConsistentDigimonIdentity: !hasConflictingDigimonIdentity,
    hasConsistentStageIdentity: !hasConflictingStageIdentity,
    hasReadableActivityLogs: Array.isArray(activityLogs),
    hasInterpretableCareEvents: true,
    hasInterpretableCurrentIncidents: true,
    hasIncludedPendingEvents: Array.isArray(pendingActivityLogs),
    hasDeduplicableEventIds: hasConsistentDuplicateEventIds(inputLogs),
    hasValidLegacyCounters: countersAreValid,
    hasConsistentLegacyProjection: countersAreConsistent,
    hasSafeSyntheticOrdering: true,
    withinAutomaticIncidentLimit: true,
  };

  const identity = normalizeCareMistakeIdentity({
    slotInstanceId,
    digimonInstanceId,
    evolutionStageInstanceId,
  });
  const allLogs = deduplicateLogs(inputLogs);
  const careEvidenceLogs = allLogs.filter(
    (log) => isCareMistakeActivityLog(log) || normalizeResolutionLog(log)
  );
  audit.hasDeduplicableEventIds = audit.hasDeduplicableEventIds &&
    careEvidenceLogs.every((log) => getStableLogKey(log) != null);
  const sourceEventIds = new Set();
  const careLogs = [];
  const resolutionLogs = [];

  if (audit.hasReadableActivityLogs && audit.hasCurrentStageStartedAt) {
    sortLogs(allLogs).forEach((log, index) => {
      const timestamp = toEpochMs(log?.timestamp);
      if (timestamp == null) {
        if (isCareMistakeActivityLog(log) || normalizeResolutionLog(log)) {
          audit.hasInterpretableCareEvents = false;
        }
        return;
      }
      if (timestamp < stageStartedAt) return;
      if (timestamp > normalizedNowMs) {
        if (isCareMistakeActivityLog(log) || normalizeResolutionLog(log)) {
          audit.hasInterpretableCareEvents = false;
        }
        return;
      }
      if (isCareMistakeActivityLog(log)) {
        if (log?.eventId) sourceEventIds.add(log.eventId);
        careLogs.push({ log, index });
      } else if (normalizeResolutionLog(log)) {
        if (log?.eventId) sourceEventIds.add(log.eventId);
        resolutionLogs.push({ log, index });
      }
    });
  }

  const currentIncidents = [];
  (Array.isArray(incidents) ? incidents : []).forEach((incident) => {
    const rawLifeId = normalizeNonEmptyString(incident?.digimonInstanceId);
    const rawStageId = normalizeNonEmptyString(incident?.evolutionStageInstanceId);
    if (rawLifeId && rawLifeId !== identity.digimonInstanceId) return;
    if (rawStageId && rawStageId !== identity.evolutionStageInstanceId) return;
    const normalized = normalizeCareMistakeIncident(incident);
    if (
      !normalized ||
      normalized.slotInstanceId !== identity.slotInstanceId ||
      normalized.digimonInstanceId !== identity.digimonInstanceId ||
      normalized.evolutionStageInstanceId !== identity.evolutionStageInstanceId ||
      !Number.isSafeInteger(normalized.occurredAt) ||
      normalized.occurredAt < stageStartedAt ||
      normalized.occurredAt > normalizedNowMs
    ) {
      audit.hasInterpretableCurrentIncidents = false;
      return;
    }
    currentIncidents.push({
      ...normalized,
      ...getReconciliationIncidentMetadata(incident),
    });
  });
  currentIncidents.sort((left, right) =>
    left.occurredAt - right.occurredAt ||
    String(left.incidentId).localeCompare(String(right.incidentId))
  );
  const incidentMap = new Map(currentIncidents.map((incident) => [incident.incidentId, incident]));

  const replayOrderByIncidentId = new Map();
  const evidenceEventIdByIncidentId = new Map();
  careLogs.forEach(({ log, index }) => {
    const candidate = buildIncidentFromLog(log, identity, index);
    if (!candidate?.incidentId) {
      audit.hasInterpretableCareEvents = false;
      return;
    }
    const previousEventId = evidenceEventIdByIncidentId.get(candidate.incidentId);
    if (previousEventId && previousEventId !== candidate.eventId) {
      audit.hasDeduplicableEventIds = false;
      return;
    }
    evidenceEventIdByIncidentId.set(candidate.incidentId, candidate.eventId);
    replayOrderByIncidentId.set(candidate.incidentId, index);
    incidentMap.set(candidate.incidentId, mergeIncident(incidentMap.get(candidate.incidentId), candidate));
  });

  // normalizeCareMistakeIncident 기반 공용 sorter는 core 필드만 반환하므로
  // legacy recovery metadata를 잃는다. 이미 정규화한 incident를 직접 정렬한다.
  const replayedIncidents = Array.from(incidentMap.values()).sort((left, right) =>
    left.occurredAt - right.occurredAt ||
    String(left.incidentId).localeCompare(String(right.incidentId))
  );
  const resolutionOperations = [];
  const consumedResolutionEvidence = new Set();
  resolutionLogs.forEach(({ log, index }) => {
    const resolvedAt = toEpochMs(log.timestamp);
    const isEligible = (incident) => {
      if (consumedResolutionEvidence.has(incident.incidentId)) return false;
      if (incident.occurredAt > resolvedAt) return false;
      if (
        incident.occurredAt === resolvedAt &&
        (replayOrderByIncidentId.get(incident.incidentId) ?? -1) > index
      ) return false;
      return true;
    };
    const reverseIncidents = [...replayedIncidents].reverse();
    // incident 정본에 같은 resolvedAt이 이미 남아 있으면 해당 로그의 소비 대상이다.
    // 이를 먼저 찾지 않으면 그 뒤에 발생한 unresolved incident를 잘못 해소할 수 있다.
    const persistedTarget = reverseIncidents.find((incident) =>
      incident.status === "resolved" &&
      incident.resolvedAt === resolvedAt &&
      isEligible(incident)
    );
    const target = persistedTarget || reverseIncidents.find((incident) =>
      incident.status === "unresolved" && isEligible(incident)
    );
    if (!target) return;
    consumedResolutionEvidence.add(target.incidentId);
    // 이미 incident 정본에 반영된 해소 로그는 다시 다음 unresolved에 적용하지 않는다.
    if (target.status === "resolved") return;
    target.status = "resolved";
    target.resolvedAt = resolvedAt;
    target.resolvedBy = "play_or_snack";
    resolutionOperations.push({ incidentId: target.incidentId, resolvedAt, resolvedBy: "play_or_snack" });
  });

  const replayedUnresolved = replayedIncidents.filter(
    (incident) => incident.status === "unresolved"
  );
  const replayedUnresolvedCount = replayedUnresolved.length;
  const preservedCount = counterCandidates.length
    ? Math.max(...counterCandidates.map(({ value }) =>
        Number.isInteger(value) ? value : 0
      ))
    : replayedUnresolvedCount;
  const legacyRecoveryCount = preservedCount - replayedUnresolvedCount;
  audit.hasConsistentLegacyProjection =
    audit.hasConsistentLegacyProjection && legacyRecoveryCount >= 0;
  const recoveryBasis = {
    replayVersion: CARE_MISTAKE_REPLAY_VERSION,
    preservedCount,
    replayedUnresolvedIncidentIds: replayedUnresolved
      .map((incident) => incident.incidentId)
      .sort(),
    legacyRecoveryCount,
  };
  const replayBasisHash = `care-replay-basis:${hashText(JSON.stringify(recoveryBasis))}`;
  const syntheticOrderingBase = Math.max(
    Number.isSafeInteger(stageStartedAt) ? stageStartedAt - 1 : Number.NaN,
    ...replayedUnresolved.map((incident) => incident.occurredAt)
  );
  if (
    legacyRecoveryCount > 0 &&
    (!Number.isSafeInteger(syntheticOrderingBase) ||
      !Number.isSafeInteger(syntheticOrderingBase + legacyRecoveryCount))
  ) {
    audit.hasSafeSyntheticOrdering = false;
  }

  const validBeforeRecovery = Object.values(audit).every(Boolean);
  if (validBeforeRecovery && legacyRecoveryCount > 0) {
    for (let ordinal = 1; ordinal <= legacyRecoveryCount; ordinal += 1) {
      const recoveryIncident = buildLegacyRecoveryIncident({
        identity,
        recoveredStageStartedAt: stageStartedAt,
        replayBasisHash,
        syntheticOrderingBase,
        ordinal,
      });
      replayedIncidents.push(recoveryIncident);
    }
    replayedIncidents.sort((left, right) =>
      left.occurredAt - right.occurredAt ||
      String(left.incidentId).localeCompare(String(right.incidentId))
    );
  }
  audit.withinAutomaticIncidentLimit =
    replayedIncidents.length <= CARE_MISTAKE_RECONCILIATION_MAX_INCIDENTS;

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
  const checksum = buildChecksum({
    identity,
    incidents: replayedIncidents,
    sourceEventIds,
    recoveryBasis,
  });
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
    recoveredStageStartedAt: stageStartedAt,
    recoveryBasis,
    replayBasisHash,
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
  acquireLease = acquireCareMistakeReconciliationLease,
  ownerAttemptId = createCareMistakeReconciliationOwnerAttemptId(),
  leaseNowMs = Date.now(),
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
  const runRef = doc(collection(slotRef, "careMistakeReconciliations"), transitionId);
  const lease = await acquireLease({
    db,
    runRef,
    transitionId,
    plan,
    ownerAttemptId,
    nowMs: leaseNowMs,
  });
  if (!lease?.acquired) {
    const error = new Error("다른 기기에서 케어미스 기록을 확인하고 있습니다.");
    error.code = "game/reconciliation-in-progress";
    error.retryAt = lease?.retryAt ?? null;
    throw error;
  }
  if (lease.existingStatus !== "ready" && lease.existingStatus !== "committed") {
    await stageBatches({ db, slotRef, plan, transitionId, ownerAttemptId });
  }
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

    const runSnapshot = await transaction.get(runRef);
    if (runSnapshot.exists()) {
      const runData = runSnapshot.data() || {};
      if (
        runData.checksum && runData.checksum !== plan.checksum
      ) {
        const error = new Error("reconciliation run checksum이 변경되었습니다.");
        error.code = "game/reconciliation-run-conflict";
        throw error;
      }
      if (
        runData.ownerAttemptId &&
        runData.ownerAttemptId !== ownerAttemptId
      ) {
        const error = new Error("reconciliation lease 소유자가 변경되었습니다.");
        error.code = "game/reconciliation-owner-conflict";
        throw error;
      }
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
      evolutionStageStartedAt: plan.recoveredStageStartedAt,
    };
    delete nextStats.careMistakeLedger;
    const slotUpdate = {
      digimonStats: nextStats,
      ...projection,
      evolutionStageStartedAt: plan.recoveredStageStartedAt,
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
      replayVersion: plan.recoveryBasis?.replayVersion || CARE_MISTAKE_REPLAY_VERSION,
      replayBasisHash: plan.replayBasisHash,
      recoveryBasis: plan.recoveryBasis,
      reconciliationVersion: CARE_MISTAKE_RECONCILIATION_VERSION,
      committedAt: committedAtValue || serverTimestamp(),
    });
    transaction.set(runRef, {
      ownerAttemptId,
      status: "committed",
      resultRevision: nextRevision,
      updatedAt: committedAtValue || serverTimestamp(),
    }, { merge: true });

    return {
      transitionId,
      revision: nextRevision,
      projection,
      idempotent: false,
    };
  });
}
