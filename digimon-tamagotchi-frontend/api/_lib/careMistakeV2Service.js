"use strict";

const crypto = require("node:crypto");
const { getArenaFirestore } = require("./arenaTransactions");
const {
  CARE_MISTAKE_EFFECTIVE_INTEGRITY,
  CARE_MISTAKE_V2_CLASSIFICATION,
  CARE_MISTAKE_V2_SCHEMA_VERSION,
  auditCareMistakeFullChain,
  buildLinkedHeadRepairPlan,
  classifyCareMistakeSlotV2,
  resolveEffectiveCareMistakeIntegrity,
} = require("../_generated/gameProjection.cjs");

const RECEIPT_COLLECTION = "careMistakeReceipts";
const SLOT_DELETION_COLLECTION = "careMistakeV2SlotDeletions";
const SLOT_DELETION_LOCK_COLLECTION = "careMistakeV2SlotDeletionLocks";
const SLOT_DELETION_LEASE_MS = 5 * 60 * 1000;
const COMMAND_TYPES = new Set([
  "STATE_MUTATION",
  "CARE_MISTAKE_OCCURRED",
  "CARE_MISTAKE_RESOLVED",
  "EVOLUTION",
  "NEW_LIFE",
]);
const NON_SEMANTIC_KEYS = new Set([
  "retryCount",
  "requestSentAt",
  "clientTimestamp",
  "networkMetadata",
]);
const PROTECTED_ROOT_FIELDS = new Set([
  "careMistakeState",
  "careMistakes",
  "unresolvedCareMistakeCount",
  "careMistakeSchemaVersion",
  "careMistakeReconciliationStatus",
  "latestUnresolvedCareMistakeIncidentId",
  "latestUnresolvedIncidentId",
  "rootReceiptId",
  "receiptId",
  "revision",
  "slotInstanceIdSchemaVersion",
  "slotInstanceId",
  "arenaIdentitySchemaVersion",
  "digimonInstanceId",
  "combatRevision",
  "selectedDigimon",
  "careMistakeDeletion",
]);
const NATIVE_INIT_NON_NEGATIVE_STATS_FIELDS = Object.freeze([
  "birthTime",
  "evolutionStageStartedAt",
  "lastSavedAt",
  "lifespanSeconds",
  "timeToEvolveSeconds",
  "hungerTimer",
  "hungerCountdown",
  "strengthTimer",
  "strengthCountdown",
  "poopTimer",
  "poopCountdown",
]);

class CareMistakeV2Error extends Error {
  constructor(code, message, status = 409, details = null) {
    super(message);
    this.name = "CareMistakeV2Error";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function requiredId(value, fieldName) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 180 || normalized.includes("/")) {
    throw new CareMistakeV2Error("INVALID_CARE_COMMAND", `${fieldName} 값이 올바르지 않습니다.`, 400);
  }
  return normalized;
}

function normalizeSlotId(value) {
  const normalized = String(value ?? "").trim();
  if (!/^(?:slot)?[1-9]\d*$/.test(normalized)) {
    throw new CareMistakeV2Error("INVALID_SLOT_ID", "slotId 값이 올바르지 않습니다.", 400);
  }
  return normalized.startsWith("slot") ? normalized : `slot${normalized}`;
}

function normalizeRevision(value, fieldName = "expectedRevision") {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new CareMistakeV2Error("INVALID_CARE_COMMAND", `${fieldName}은 0 이상의 정수여야 합니다.`, 400);
  }
  return normalized;
}

function snapshotExists(snapshot) {
  return typeof snapshot?.exists === "function" ? snapshot.exists() : Boolean(snapshot?.exists);
}

function snapshotData(snapshot) {
  return snapshotExists(snapshot) ? snapshot.data() || {} : null;
}

function assertCompleteNativeInitGameplayStats(slotData) {
  const stats = slotData?.digimonStats;
  const createdAt = slotData?.createdAt;
  const isPlainStats = stats != null &&
    typeof stats === "object" &&
    !Array.isArray(stats);
  const invalidFields = !isPlainStats
    ? [...NATIVE_INIT_NON_NEGATIVE_STATS_FIELDS]
    : NATIVE_INIT_NON_NEGATIVE_STATS_FIELDS.filter((field) =>
      typeof stats[field] !== "number" ||
      !Number.isFinite(stats[field]) ||
      stats[field] < 0
    );
  const hasValidCreatedAt =
    typeof createdAt === "number" && Number.isFinite(createdAt) && createdAt >= 0;
  const timestampsMatch = hasValidCreatedAt && isPlainStats &&
    slotData.lastSavedAt === createdAt &&
    stats.birthTime === createdAt &&
    stats.evolutionStageStartedAt === createdAt &&
    stats.lastSavedAt === createdAt;

  if (invalidFields.length > 0 || !hasValidCreatedAt || !timestampsMatch) {
    throw new CareMistakeV2Error(
      "INVALID_NATIVE_INIT_STATS",
      "신규 슬롯 gameplay 초기 상태가 완전하지 않습니다.",
      400,
      { invalidFields, timestampsMatch }
    );
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .filter((key) => !NON_SEMANTIC_KEYS.has(key) && value[key] !== undefined)
    .sort()
    .reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
}

function buildCommandFingerprint({ uid, slotId, command }) {
  const semantic = {
    uid: requiredId(uid, "uid"),
    slotId: normalizeSlotId(slotId),
    commandId: requiredId(command.commandId, "commandId"),
    commandType: requiredId(command.commandType, "commandType"),
    careSchemaVersion: command.careSchemaVersion,
    rootReceiptId: command.rootReceiptId,
    receiptId: command.receiptId,
    evolutionStageInstanceId: command.evolutionStageInstanceId,
    expectedRevision: command.expectedRevision,
    payload: command.payload || {},
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonicalize(semantic))).digest("hex");
}

function deterministicId(prefix, ...parts) {
  const digest = crypto.createHash("sha256").update(parts.join("\u001f")).digest("hex").slice(0, 40);
  return `${prefix}:${digest}`;
}

function careSlotDeletionOperationId({ uid, slotId, slotInstanceId }) {
  return deterministicId("care-slot-delete-v2", uid, slotId, slotInstanceId);
}

function resolveNow(deps = {}) {
  return typeof deps.now === "function" ? deps.now() : deps.now || new Date();
}

function toMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === "function") return value.toMillis();
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function deletionRefs(db, uid, normalizedSlotId, slotInstanceId) {
  const operationId = careSlotDeletionOperationId({
    uid,
    slotId: normalizedSlotId,
    slotInstanceId,
  });
  return {
    operationId,
    slotRef: db.doc(`users/${uid}/slots/${normalizedSlotId}`),
    operationRef: db.doc(`users/${uid}/${SLOT_DELETION_COLLECTION}/${operationId}`),
    lockRef: db.doc(`users/${uid}/${SLOT_DELETION_LOCK_COLLECTION}/${normalizedSlotId}`),
  };
}

function assertDeletionIdentity(operation, normalizedSlotId, slotInstanceId) {
  if (
    operation.slotId !== normalizedSlotId ||
    operation.slotInstanceId !== slotInstanceId
  ) {
    throw new CareMistakeV2Error(
      "SLOT_DELETE_IDENTITY_CONFLICT",
      "삭제 operation identity가 요청과 일치하지 않습니다."
    );
  }
}

function assertDeletionLock(lock, operationId, slotInstanceId) {
  if (
    !lock ||
    lock.operationId !== operationId ||
    lock.slotInstanceId !== slotInstanceId ||
    lock.status !== "in_progress"
  ) {
    throw new CareMistakeV2Error(
      "SLOT_DELETE_LOCK_INTEGRITY_FAILURE",
      "슬롯 삭제 lock을 확인할 수 없습니다."
    );
  }
}

async function assertSlotDeletionUnlocked(transaction, lockRef) {
  const lock = snapshotData(await transaction.get(lockRef));
  if (lock) {
    throw new CareMistakeV2Error(
      "SLOT_DELETION_IN_PROGRESS",
      "슬롯 삭제가 진행 중입니다. 잠시 후 다시 시도해 주세요."
    );
  }
}

function sanitizeDeletionError(error) {
  return {
    code: typeof error?.code === "string" ? error.code.slice(0, 120) : "RECURSIVE_DELETE_FAILED",
    message: typeof error?.message === "string"
      ? error.message.replace(/[\r\n]+/g, " ").slice(0, 300)
      : "슬롯 하위 데이터 삭제에 실패했습니다.",
  };
}

function careRootReceiptId({ uid, slotId, slotInstanceId, digimonInstanceId }) {
  return deterministicId("care-root-v2", uid, slotId, slotInstanceId, digimonInstanceId);
}

function createCareState({ rootReceiptId, evolutionStageInstanceId, baseline = 0 }) {
  return {
    schemaVersion: CARE_MISTAKE_V2_SCHEMA_VERSION,
    rootReceiptId,
    receiptId: rootReceiptId,
    evolutionStageInstanceId,
    baselineRemainingCount: baseline,
    postCutoverUnresolvedCount: 0,
    unresolvedCareMistakeCount: baseline,
    latestUnresolvedIncidentId: null,
    integrityStatus: "verified",
  };
}

function projectionFields(state) {
  return {
    careMistakeState: state,
    careMistakes: state.unresolvedCareMistakeCount,
    unresolvedCareMistakeCount: state.unresolvedCareMistakeCount,
    careMistakeSchemaVersion: CARE_MISTAKE_V2_SCHEMA_VERSION,
    careMistakeReconciliationStatus: "verified",
    latestUnresolvedCareMistakeIncidentId: state.latestUnresolvedIncidentId,
    evolutionStageInstanceId: state.evolutionStageInstanceId,
  };
}

function applyProjection(slotData, state) {
  const projection = projectionFields(state);
  return {
    ...slotData,
    ...projection,
    digimonStats: {
      ...(slotData.digimonStats || {}),
      careMistakes: projection.careMistakes,
      unresolvedCareMistakeCount: projection.unresolvedCareMistakeCount,
      careMistakeSchemaVersion: projection.careMistakeSchemaVersion,
      careMistakeReconciliationStatus: projection.careMistakeReconciliationStatus,
      latestUnresolvedCareMistakeIncidentId: projection.latestUnresolvedCareMistakeIncidentId,
      evolutionStageInstanceId: projection.evolutionStageInstanceId,
    },
  };
}

function sanitizeClientUpdate(updateData = {}) {
  if (!updateData || typeof updateData !== "object" || Array.isArray(updateData)) return {};
  const safe = Object.entries(updateData).reduce((result, [key, value]) => {
    if (!PROTECTED_ROOT_FIELDS.has(key) && key !== "digimonStats") result[key] = value;
    return result;
  }, {});
  if (updateData.digimonStats && typeof updateData.digimonStats === "object" &&
      !Array.isArray(updateData.digimonStats)) {
    safe.digimonStats = Object.entries(updateData.digimonStats).reduce((result, [key, value]) => {
      if (!PROTECTED_ROOT_FIELDS.has(key) && key !== "careMistakeLedger") result[key] = value;
      return result;
    }, {});
  }
  return safe;
}

function mergeSlotUpdate(slotData, clientUpdate) {
  const safe = sanitizeClientUpdate(clientUpdate);
  return {
    ...slotData,
    ...safe,
    ...(safe.digimonStats
      ? { digimonStats: { ...(slotData.digimonStats || {}), ...safe.digimonStats } }
      : {}),
  };
}

function receiptPayload({ receiptId, rootReceiptId, receiptType, slotData, revision, now,
  supersedesReceiptId = null, extra = {} }) {
  return {
    schemaVersion: CARE_MISTAKE_V2_SCHEMA_VERSION,
    receiptId,
    rootReceiptId,
    supersedesReceiptId,
    receiptType,
    slotInstanceId: slotData.slotInstanceId,
    digimonInstanceId: slotData.digimonInstanceId,
    cutoverRevision: revision,
    createdAt: now,
    ...extra,
  };
}

async function readReceiptLineage(transaction, slotRef, state, limit = 32) {
  const receipts = [];
  const visited = new Set();
  let receiptId = state.receiptId;
  while (receiptId && receipts.length < limit && !visited.has(receiptId)) {
    visited.add(receiptId);
    const snapshot = await transaction.get(slotRef.collection(RECEIPT_COLLECTION).doc(receiptId));
    const data = snapshotData(snapshot);
    if (!data) break;
    receipts.push({ id: receiptId, ...data });
    if (receiptId === state.rootReceiptId) break;
    receiptId = data.supersedesReceiptId || null;
  }
  return receipts;
}

async function readIntegritySnapshot(transaction, slotRef) {
  const slotSnapshot = await transaction.get(slotRef);
  const slotData = snapshotData(slotSnapshot);
  if (!slotData) throw new CareMistakeV2Error("SLOT_NOT_FOUND", "슬롯을 찾을 수 없습니다.", 404);
  const state = slotData.careMistakeState;
  if (state?.schemaVersion !== CARE_MISTAKE_V2_SCHEMA_VERSION) {
    const classification = classifyCareMistakeSlotV2({ slotData, receipts: [], legacyEvidence: {} });
    return { slotData, state: null, receipts: [], incidents: [], classification };
  }
  const receipts = await readReceiptLineage(transaction, slotRef, state);
  const incidents = [];
  if (state.latestUnresolvedIncidentId) {
    const headSnapshot = await transaction.get(
      slotRef.collection("careMistakeIncidents").doc(state.latestUnresolvedIncidentId)
    );
    const head = snapshotData(headSnapshot);
    if (head) incidents.push({ id: state.latestUnresolvedIncidentId, ...head });
  }
  const integrity = resolveEffectiveCareMistakeIntegrity({ slotData, receipts, incidents });
  return { slotData, state, receipts, incidents, integrity };
}

function assertVerifiedV2(snapshot) {
  if (!snapshot.state || snapshot.state.schemaVersion !== CARE_MISTAKE_V2_SCHEMA_VERSION) {
    throw new CareMistakeV2Error("STALE_PRE_CUTOVER_COMMAND", "V2 슬롯 명령이 아닙니다.", 409);
  }
  if (snapshot.integrity?.effectiveIntegrityStatus !== CARE_MISTAKE_EFFECTIVE_INTEGRITY.VERIFIED) {
    throw new CareMistakeV2Error(
      "CARE_MISTAKE_INTEGRITY_FAILURE",
      "케어미스 정합성 복구가 필요합니다.",
      422,
      { diagnosticCodes: snapshot.integrity?.diagnosticCodes || [] }
    );
  }
}

function assertCommandEpoch(command, slotData, state) {
  if (command.careSchemaVersion !== CARE_MISTAKE_V2_SCHEMA_VERSION) {
    throw new CareMistakeV2Error("STALE_PRE_CUTOVER_COMMAND", "V2 이전 명령은 실행할 수 없습니다.");
  }
  const comparisons = [
    [command.rootReceiptId, state.rootReceiptId, "STALE_CARE_ROOT_COMMAND"],
    [command.receiptId, state.receiptId, "STALE_CARE_RECEIPT_COMMAND"],
    [command.evolutionStageInstanceId, state.evolutionStageInstanceId, "STALE_CARE_STAGE_COMMAND"],
  ];
  for (const [actual, expected, code] of comparisons) {
    if (actual !== expected) throw new CareMistakeV2Error(code, "현재 케어미스 epoch와 명령이 일치하지 않습니다.");
  }
  if (normalizeRevision(command.expectedRevision) !== normalizeRevision(slotData.revision, "revision")) {
    throw new CareMistakeV2Error("STALE_CARE_REVISION_COMMAND", "슬롯 revision이 변경되었습니다.");
  }
}

function commandResult({ commandId, revision, state, slotData = {}, idempotent = false, noOp = false }) {
  return {
    commandId,
    revision,
    idempotent,
    noOp,
    careMistakeState: state,
    projection: projectionFields(state),
    slotInstanceId: slotData.slotInstanceId || null,
    digimonInstanceId: slotData.digimonInstanceId || null,
  };
}

async function commitCareMistakeV2Command({ uid, slotId, command, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const normalizedSlotId = normalizeSlotId(slotId);
  const commandId = requiredId(command?.commandId, "commandId");
  const commandType = requiredId(command?.commandType, "commandType");
  if (!COMMAND_TYPES.has(commandType)) {
    throw new CareMistakeV2Error("INVALID_CARE_COMMAND", "지원하지 않는 V2 command입니다.", 400);
  }
  const fingerprint = buildCommandFingerprint({ uid, slotId: normalizedSlotId, command });
  const slotRef = db.doc(`users/${uid}/slots/${normalizedSlotId}`);
  const lockRef = db.doc(
    `users/${uid}/${SLOT_DELETION_LOCK_COLLECTION}/${normalizedSlotId}`
  );
  const transitionRef = slotRef.collection("gameTransitions").doc(commandId);
  const transact = deps.runTransaction || ((callback) => db.runTransaction(callback));
  return transact(async (transaction) => {
    const existingSnapshot = await transaction.get(transitionRef);
    const existing = snapshotData(existingSnapshot);
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        throw new CareMistakeV2Error(
          "COMMAND_ID_REUSE_CONFLICT",
          "같은 commandId가 다른 epoch 또는 payload에 재사용되었습니다."
        );
      }
      return { ...(existing.result || {}), idempotent: true };
    }

    await assertSlotDeletionUnlocked(transaction, lockRef);
    const integrity = await readIntegritySnapshot(transaction, slotRef);
    assertVerifiedV2(integrity);
    const { slotData } = integrity;
    let state = { ...integrity.state };
    assertCommandEpoch(command, slotData, state);
    const currentRevision = normalizeRevision(slotData.revision, "revision");
    const nextRevision = currentRevision + 1;
    let nextSlot = mergeSlotUpdate(slotData, command.payload?.updateData);
    // identity epoch은 command type에 따라 서버가만 변경한다.
    nextSlot.slotInstanceIdSchemaVersion = slotData.slotInstanceIdSchemaVersion;
    nextSlot.slotInstanceId = slotData.slotInstanceId;
    nextSlot.arenaIdentitySchemaVersion = slotData.arenaIdentitySchemaVersion;
    nextSlot.digimonInstanceId = slotData.digimonInstanceId;
    nextSlot.combatRevision = slotData.combatRevision;
    nextSlot.selectedDigimon = slotData.selectedDigimon;
    const incidentWrites = [];
    const logWrites = [];
    let noOp = false;

    if (commandType === "CARE_MISTAKE_OCCURRED") {
      const operations = Array.isArray(command.payload?.operations)
        ? command.payload.operations
        : [{}];
      if (!operations.length || operations.length > 50) {
        throw new CareMistakeV2Error("INVALID_CARE_COMMAND", "케어미스 operation 수가 올바르지 않습니다.", 400);
      }
      let head = state.latestUnresolvedIncidentId || null;
      operations.forEach((operation, operationIndex) => {
        const incidentId = deterministicId(
          "care-incident-v2",
          uid,
          normalizedSlotId,
          state.rootReceiptId,
          state.evolutionStageInstanceId,
          commandId,
          String(operationIndex)
        );
        incidentWrites.push({
          ref: slotRef.collection("careMistakeIncidents").doc(incidentId),
          data: {
            careSchemaVersion: CARE_MISTAKE_V2_SCHEMA_VERSION,
            incidentId,
            commandId,
            rootReceiptId: state.rootReceiptId,
            evolutionStageInstanceId: state.evolutionStageInstanceId,
            occurredRevision: nextRevision,
            operationIndex,
            reasonKey: String(operation?.reasonKey || "care_mistake"),
            text: String(operation?.text || "케어미스 발생"),
            status: "unresolved",
            resolvedAt: null,
            resolvedBy: null,
            previousUnresolvedIncidentId: head,
          },
        });
        head = incidentId;
      });
      state = {
        ...state,
        postCutoverUnresolvedCount: state.postCutoverUnresolvedCount + incidentWrites.length,
        unresolvedCareMistakeCount: state.unresolvedCareMistakeCount + incidentWrites.length,
        latestUnresolvedIncidentId: head,
      };
    } else if (commandType === "CARE_MISTAKE_RESOLVED") {
      if (state.postCutoverUnresolvedCount > 0) {
        const headId = requiredId(state.latestUnresolvedIncidentId, "latestUnresolvedIncidentId");
        const headRef = slotRef.collection("careMistakeIncidents").doc(headId);
        const headSnapshot = await transaction.get(headRef);
        const head = snapshotData(headSnapshot);
        if (!head || head.status !== "unresolved" || head.resolvedAt !== null ||
            head.rootReceiptId !== state.rootReceiptId ||
            head.evolutionStageInstanceId !== state.evolutionStageInstanceId) {
          throw new CareMistakeV2Error("CARE_MISTAKE_INTEGRITY_FAILURE", "현재 head incident가 올바르지 않습니다.", 422);
        }
        const previousId = head.previousUnresolvedIncidentId || null;
        if (previousId) {
          const previousSnapshot = await transaction.get(
            slotRef.collection("careMistakeIncidents").doc(previousId)
          );
          const previous = snapshotData(previousSnapshot);
          if (!previous || previous.status !== "unresolved" || previous.resolvedAt !== null ||
              previous.rootReceiptId !== state.rootReceiptId ||
              previous.evolutionStageInstanceId !== state.evolutionStageInstanceId) {
            throw new CareMistakeV2Error("CARE_MISTAKE_INTEGRITY_FAILURE", "다음 head incident가 올바르지 않습니다.", 422);
          }
        }
        incidentWrites.push({
          ref: headRef,
          update: {
            status: "resolved",
            resolvedAt: deps.now || new Date(),
            resolvedBy: String(command.payload?.resolvedBy || "game_action"),
          },
        });
        state = {
          ...state,
          postCutoverUnresolvedCount: state.postCutoverUnresolvedCount - 1,
          unresolvedCareMistakeCount: state.unresolvedCareMistakeCount - 1,
          latestUnresolvedIncidentId: previousId,
        };
      } else if (state.baselineRemainingCount > 0) {
        state = {
          ...state,
          baselineRemainingCount: state.baselineRemainingCount - 1,
          unresolvedCareMistakeCount: state.unresolvedCareMistakeCount - 1,
        };
      } else {
        noOp = true;
      }
    } else if (commandType === "EVOLUTION") {
      const nextStage = requiredId(
        command.payload?.nextEvolutionStageInstanceId,
        "nextEvolutionStageInstanceId"
      );
      nextSlot.selectedDigimon = requiredId(
        command.payload?.updateData?.selectedDigimon,
        "selectedDigimon"
      );
      nextSlot.combatRevision = normalizeRevision(slotData.combatRevision, "combatRevision") + 1;
      state = {
        ...state,
        evolutionStageInstanceId: nextStage,
        baselineRemainingCount: 0,
        postCutoverUnresolvedCount: 0,
        unresolvedCareMistakeCount: 0,
        latestUnresolvedIncidentId: null,
      };
    } else if (commandType === "NEW_LIFE") {
      const nextDigimonInstanceId = requiredId(
        command.payload?.nextDigimonInstanceId,
        "nextDigimonInstanceId"
      );
      const nextStage = requiredId(
        command.payload?.nextEvolutionStageInstanceId,
        "nextEvolutionStageInstanceId"
      );
      const nextSelectedDigimon = requiredId(
        command.payload?.updateData?.selectedDigimon,
        "selectedDigimon"
      );
      const rootReceiptId = careRootReceiptId({
        uid,
        slotId: normalizedSlotId,
        slotInstanceId: slotData.slotInstanceId,
        digimonInstanceId: nextDigimonInstanceId,
      });
      nextSlot.arenaIdentitySchemaVersion = 1;
      nextSlot.digimonInstanceId = nextDigimonInstanceId;
      nextSlot.combatRevision = 1;
      nextSlot.selectedDigimon = nextSelectedDigimon;
      state = createCareState({ rootReceiptId, evolutionStageInstanceId: nextStage });
      transaction.create(
        slotRef.collection(RECEIPT_COLLECTION).doc(rootReceiptId),
        receiptPayload({
          receiptId: rootReceiptId,
          rootReceiptId,
          receiptType: "native_init",
          slotData: nextSlot,
          revision: nextRevision,
          now: deps.now || new Date(),
        })
      );
    }

    nextSlot = applyProjection(nextSlot, state);
    nextSlot.revision = nextRevision;
    nextSlot.updatedAt = deps.now || new Date();
    const activityEvents = Array.isArray(command.payload?.activityEvents)
      ? command.payload.activityEvents
      : [];
    activityEvents.forEach((event) => {
      const eventId = requiredId(event?.eventId, "activity eventId");
      logWrites.push({
        ref: slotRef.collection("logs").doc(eventId),
        data: { ...event, eventId, commandId, revision: nextRevision },
      });
    });
    const battleEvents = Array.isArray(command.payload?.battleEvents)
      ? command.payload.battleEvents
      : [];
    battleEvents.forEach((event) => {
      const eventId = requiredId(event?.eventId, "battle eventId");
      logWrites.push({
        ref: slotRef.collection("battleLogs").doc(eventId),
        data: { ...event, eventId, commandId, revision: nextRevision },
      });
    });
    const result = commandResult({
      commandId,
      revision: nextRevision,
      state,
      slotData: nextSlot,
      noOp,
    });
    incidentWrites.forEach((write) => {
      if (write.update) transaction.update(write.ref, write.update);
      else transaction.create(write.ref, write.data);
    });
    logWrites.forEach((write) => transaction.set(write.ref, write.data, { merge: true }));
    transaction.set(slotRef, nextSlot);
    transaction.create(transitionRef, {
      schemaVersion: CARE_MISTAKE_V2_SCHEMA_VERSION,
      commandId,
      commandType,
      requestFingerprint: fingerprint,
      revisionBefore: currentRevision,
      revisionAfter: nextRevision,
      result,
      createdAt: deps.now || new Date(),
    });
    return result;
  });
}

async function nativeInitCareMistakeV2Slot({ uid, slotId, commandId, slotData, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const normalizedSlotId = normalizeSlotId(slotId);
  const normalizedCommandId = requiredId(commandId, "commandId");
  assertCompleteNativeInitGameplayStats(slotData);
  const slotInstanceId = requiredId(slotData?.slotInstanceId, "slotInstanceId");
  const digimonInstanceId = requiredId(slotData?.digimonInstanceId, "digimonInstanceId");
  const stageId = requiredId(
    slotData?.evolutionStageInstanceId || slotData?.digimonStats?.evolutionStageInstanceId,
    "evolutionStageInstanceId"
  );
  const rootReceiptId = careRootReceiptId({ uid, slotId: normalizedSlotId, slotInstanceId, digimonInstanceId });
  const command = {
    commandId: normalizedCommandId,
    commandType: "NATIVE_INIT",
    careSchemaVersion: CARE_MISTAKE_V2_SCHEMA_VERSION,
    rootReceiptId,
    receiptId: rootReceiptId,
    evolutionStageInstanceId: stageId,
    expectedRevision: 0,
    payload: sanitizeClientUpdate(slotData),
  };
  const fingerprint = buildCommandFingerprint({ uid, slotId: normalizedSlotId, command });
  const slotRef = db.doc(`users/${uid}/slots/${normalizedSlotId}`);
  const lockRef = db.doc(
    `users/${uid}/${SLOT_DELETION_LOCK_COLLECTION}/${normalizedSlotId}`
  );
  const deletedInstanceOperationRef = db.doc(
    `users/${uid}/${SLOT_DELETION_COLLECTION}/${careSlotDeletionOperationId({
      uid,
      slotId: normalizedSlotId,
      slotInstanceId,
    })}`
  );
  const transitionRef = slotRef.collection("gameTransitions").doc(normalizedCommandId);
  const transact = deps.runTransaction || ((callback) => db.runTransaction(callback));
  return transact(async (transaction) => {
    await assertSlotDeletionUnlocked(transaction, lockRef);
    const deletedInstanceOperation = snapshotData(
      await transaction.get(deletedInstanceOperationRef)
    );
    if (deletedInstanceOperation) {
      throw new CareMistakeV2Error(
        "SLOT_INSTANCE_DELETED",
        "이미 삭제된 슬롯 instance는 다시 생성할 수 없습니다."
      );
    }
    const existing = snapshotData(await transaction.get(transitionRef));
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        throw new CareMistakeV2Error("COMMAND_ID_REUSE_CONFLICT", "NATIVE_INIT commandId가 재사용되었습니다.");
      }
      return { ...(existing.result || {}), idempotent: true };
    }
    if (snapshotExists(await transaction.get(slotRef))) {
      throw new CareMistakeV2Error("SLOT_ALREADY_EXISTS", "이미 존재하는 슬롯은 native init할 수 없습니다.");
    }
    const state = createCareState({ rootReceiptId, evolutionStageInstanceId: stageId });
    const now = deps.now || new Date();
    const createdSlot = applyProjection({
      ...sanitizeClientUpdate(slotData),
      slotInstanceIdSchemaVersion: 1,
      slotInstanceId,
      arenaIdentitySchemaVersion: 1,
      digimonInstanceId,
      combatRevision: 1,
      selectedDigimon: requiredId(slotData?.selectedDigimon, "selectedDigimon"),
    }, state);
    createdSlot.revision = 1;
    createdSlot.createdAt = createdSlot.createdAt || now;
    createdSlot.updatedAt = now;
    const result = commandResult({
      commandId: normalizedCommandId,
      revision: 1,
      state,
      slotData: createdSlot,
    });
    transaction.create(slotRef, createdSlot);
    transaction.create(
      slotRef.collection(RECEIPT_COLLECTION).doc(rootReceiptId),
      receiptPayload({
        receiptId: rootReceiptId,
        rootReceiptId,
        receiptType: "native_init",
        slotData: createdSlot,
        revision: 1,
        now,
      })
    );
    transaction.create(transitionRef, {
      schemaVersion: CARE_MISTAKE_V2_SCHEMA_VERSION,
      commandId: normalizedCommandId,
      commandType: "NATIVE_INIT",
      requestFingerprint: fingerprint,
      revisionBefore: 0,
      revisionAfter: 1,
      result,
      createdAt: now,
    });
    return result;
  });
}

async function migrateCareMistakeV2Slot({ uid, slotId, expectedRevision, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const normalizedSlotId = normalizeSlotId(slotId);
  const slotRef = db.doc(`users/${uid}/slots/${normalizedSlotId}`);
  const lockRef = db.doc(
    `users/${uid}/${SLOT_DELETION_LOCK_COLLECTION}/${normalizedSlotId}`
  );
  const transact = deps.runTransaction || ((callback) => db.runTransaction(callback));
  return transact(async (transaction) => {
    await assertSlotDeletionUnlocked(transaction, lockRef);
    const slotData = snapshotData(await transaction.get(slotRef));
    if (!slotData) throw new CareMistakeV2Error("SLOT_NOT_FOUND", "슬롯을 찾을 수 없습니다.", 404);
    if (slotData.careMistakeState?.schemaVersion === CARE_MISTAKE_V2_SCHEMA_VERSION) {
      const integrity = await readIntegritySnapshot(transaction, slotRef);
      assertVerifiedV2(integrity);
      return { revision: slotData.revision, careMistakeState: slotData.careMistakeState, idempotent: true };
    }
    const currentRevision = normalizeRevision(slotData.revision, "revision");
    if (normalizeRevision(expectedRevision) !== currentRevision) {
      throw new CareMistakeV2Error("REVISION_CONFLICT", "migration revision이 변경되었습니다.");
    }
    const classification = classifyCareMistakeSlotV2({ slotData, receipts: [], legacyEvidence: {} });
    if (classification.classification === CARE_MISTAKE_V2_CLASSIFICATION.REPAIR_REQUIRED) {
      throw new CareMistakeV2Error(
        "CARE_MISTAKE_INTEGRITY_FAILURE",
        "자동 migration할 수 없는 슬롯입니다.",
        422,
        { diagnosticCodes: classification.diagnosticCodes }
      );
    }
    const rootReceiptId = careRootReceiptId({
      uid,
      slotId: normalizedSlotId,
      slotInstanceId: requiredId(slotData.slotInstanceId, "slotInstanceId"),
      digimonInstanceId: requiredId(slotData.digimonInstanceId, "digimonInstanceId"),
    });
    const nextRevision = currentRevision + 1;
    const state = createCareState({
      rootReceiptId,
      evolutionStageInstanceId: requiredId(slotData.evolutionStageInstanceId, "evolutionStageInstanceId"),
      baseline: classification.canonicalBaseline,
    });
    const now = deps.now || new Date();
    transaction.update(slotRef, { ...projectionFields(state),
      digimonStats: applyProjection(slotData, state).digimonStats, revision: nextRevision, updatedAt: now });
    transaction.create(
      slotRef.collection(RECEIPT_COLLECTION).doc(rootReceiptId),
      receiptPayload({
        receiptId: rootReceiptId,
        rootReceiptId,
        receiptType: "migration",
        slotData,
        revision: nextRevision,
        now,
        extra: {
          baselineInitialCount: classification.canonicalBaseline,
          canonicalSource: "digimonStats.careMistakes",
          diagnosticCodes: classification.diagnosticCodes,
        },
      })
    );
    return { revision: nextRevision, careMistakeState: state, classification };
  });
}

async function getCareMistakeV2Integrity({ uid, slotId, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const normalizedSlotId = normalizeSlotId(slotId);
  const slotRef = db.doc(`users/${uid}/slots/${normalizedSlotId}`);
  const lockRef = db.doc(
    `users/${uid}/${SLOT_DELETION_LOCK_COLLECTION}/${normalizedSlotId}`
  );
  const transact = deps.runTransaction || ((callback) => db.runTransaction(callback, { readOnly: true }));
  try {
    return await transact(async (transaction) => {
      await assertSlotDeletionUnlocked(transaction, lockRef);
      const snapshot = await readIntegritySnapshot(transaction, slotRef);
      if (!snapshot.state) {
        return {
          schemaVersion: 1,
          classification: snapshot.classification.classification,
          effectiveIntegrityStatus: snapshot.classification.classification,
          diagnosticCodes: snapshot.classification.diagnosticCodes,
          revision: snapshot.slotData.revision ?? 0,
        };
      }
      return {
        schemaVersion: CARE_MISTAKE_V2_SCHEMA_VERSION,
        effectiveIntegrityStatus: snapshot.integrity.effectiveIntegrityStatus,
        diagnosticCodes: snapshot.integrity.diagnosticCodes,
        revision: snapshot.slotData.revision,
        careMistakeState: snapshot.state,
      };
    });
  } catch (error) {
    if (error instanceof CareMistakeV2Error) throw error;
    return {
      schemaVersion: null,
      effectiveIntegrityStatus: "integrity_unknown",
      diagnosticCodes: [],
      retryable: true,
    };
  }
}

async function deleteCareMistakeV2Slot({
  uid,
  slotId,
  slotInstanceId,
  expectedRevision,
  deps = {},
}) {
  const db = deps.db || getArenaFirestore();
  const normalizedSlotId = normalizeSlotId(slotId);
  const normalizedSlotInstanceId = requiredId(slotInstanceId, "slotInstanceId");
  const normalizedExpectedRevision = normalizeRevision(expectedRevision);
  const refs = deletionRefs(db, uid, normalizedSlotId, normalizedSlotInstanceId);
  const executorId = requiredId(
    deps.executorId || crypto.randomUUID(),
    "executorId"
  );
  const transact = deps.runTransaction || ((callback) => db.runTransaction(callback));

  const claim = await transact(async (transaction) => {
    // P0 계약: operation을 현재 슬롯보다 항상 먼저 읽는다.
    const operation = snapshotData(await transaction.get(refs.operationRef));
    const now = resolveNow(deps);

    if (operation) {
      assertDeletionIdentity(operation, normalizedSlotId, normalizedSlotInstanceId);
      if (operation.status === "complete") {
        return {
          status: "complete",
          operationId: refs.operationId,
          idempotent: true,
          execute: false,
        };
      }
      if (operation.status !== "in_progress") {
        throw new CareMistakeV2Error(
          "SLOT_DELETE_OPERATION_INVALID",
          "슬롯 삭제 operation 상태가 올바르지 않습니다."
        );
      }

      const lock = snapshotData(await transaction.get(refs.lockRef));
      assertDeletionLock(
        lock,
        refs.operationId,
        normalizedSlotInstanceId
      );
      const leaseRemainingMs = toMillis(operation.leaseUntil) - now.getTime();
      if (leaseRemainingMs > 0) {
        return {
          status: "in_progress",
          operationId: refs.operationId,
          retryAfterMs: leaseRemainingMs,
          idempotent: true,
          execute: false,
        };
      }

      transaction.update(refs.operationRef, {
        attempt: normalizeRevision(operation.attempt || 0, "attempt") + 1,
        executorId,
        leaseUntil: new Date(now.getTime() + SLOT_DELETION_LEASE_MS),
        lastError: null,
        updatedAt: now,
      });
      return {
        status: "in_progress",
        operationId: refs.operationId,
        idempotent: true,
        execute: true,
      };
    }

    const existingLock = snapshotData(await transaction.get(refs.lockRef));
    if (existingLock) {
      throw new CareMistakeV2Error(
        "SLOT_DELETION_IN_PROGRESS",
        "같은 슬롯 번호의 삭제가 이미 진행 중입니다."
      );
    }

    const slotData = snapshotData(await transaction.get(refs.slotRef));
    if (!slotData) {
      throw new CareMistakeV2Error("SLOT_NOT_FOUND", "슬롯을 찾을 수 없습니다.", 404);
    }
    if (slotData.careMistakeState?.schemaVersion !== CARE_MISTAKE_V2_SCHEMA_VERSION) {
      throw new CareMistakeV2Error(
        "INVALID_CARE_MISTAKE_STATE",
        "V2 슬롯만 trusted delete할 수 있습니다.",
        422
      );
    }
    if (slotData.slotInstanceId !== normalizedSlotInstanceId) {
      throw new CareMistakeV2Error(
        "STALE_SLOT_DELETE_IDENTITY",
        "삭제 대상 슬롯 instance가 변경되었습니다."
      );
    }
    if (normalizeRevision(slotData.revision, "revision") !== normalizedExpectedRevision) {
      throw new CareMistakeV2Error(
        "STALE_SLOT_DELETE_REVISION",
        "삭제 대상 슬롯 revision이 변경되었습니다."
      );
    }

    const leaseUntil = new Date(now.getTime() + SLOT_DELETION_LEASE_MS);
    transaction.create(refs.operationRef, {
      schemaVersion: 1,
      operationId: refs.operationId,
      status: "in_progress",
      slotId: normalizedSlotId,
      slotInstanceId: normalizedSlotInstanceId,
      expectedRevision: normalizedExpectedRevision,
      attempt: 1,
      leaseUntil,
      executorId,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });
    transaction.create(refs.lockRef, {
      schemaVersion: 1,
      operationId: refs.operationId,
      slotId: normalizedSlotId,
      slotInstanceId: normalizedSlotInstanceId,
      status: "in_progress",
      createdAt: now,
      updatedAt: now,
    });
    transaction.update(refs.slotRef, {
      careMistakeDeletion: {
        schemaVersion: 1,
        operationId: refs.operationId,
        slotInstanceId: normalizedSlotInstanceId,
        status: "in_progress",
        requestedRevision: normalizedExpectedRevision,
        requestedAt: now,
      },
      updatedAt: now,
    });
    return {
      status: "in_progress",
      operationId: refs.operationId,
      idempotent: false,
      execute: true,
    };
  });

  if (!claim.execute) return claim;

  const recursiveDelete = deps.recursiveDelete || ((ref) => db.recursiveDelete(ref));
  try {
    await recursiveDelete(refs.slotRef);
  } catch (error) {
    const failureAt = resolveNow(deps);
    await transact(async (transaction) => {
      const operation = snapshotData(await transaction.get(refs.operationRef));
      if (
        operation?.status === "in_progress" &&
        operation.executorId === executorId
      ) {
        transaction.update(refs.operationRef, {
          leaseUntil: failureAt,
          lastError: sanitizeDeletionError(error),
          updatedAt: failureAt,
        });
      }
    });
    throw new CareMistakeV2Error(
      "SLOT_DELETE_RETRY_REQUIRED",
      "슬롯 삭제를 완료하지 못했습니다. 다시 시도해 주세요.",
      503,
      { operationId: refs.operationId }
    );
  }

  const completedAt = resolveNow(deps);
  const completion = await transact(async (transaction) => {
    const operation = snapshotData(await transaction.get(refs.operationRef));
    if (!operation) {
      throw new CareMistakeV2Error(
        "SLOT_DELETE_OPERATION_INVALID",
        "슬롯 삭제 operation이 사라졌습니다."
      );
    }
    assertDeletionIdentity(operation, normalizedSlotId, normalizedSlotInstanceId);
    if (operation.status === "complete") {
      return { status: "complete", operationId: refs.operationId, idempotent: true };
    }
    if (operation.executorId !== executorId) {
      throw new CareMistakeV2Error(
        "SLOT_DELETE_EXECUTION_LOST",
        "슬롯 삭제 실행 권한이 다른 요청으로 이전되었습니다."
      );
    }
    const lock = snapshotData(await transaction.get(refs.lockRef));
    assertDeletionLock(lock, refs.operationId, normalizedSlotInstanceId);
    transaction.update(refs.operationRef, {
      status: "complete",
      leaseUntil: null,
      executorId: null,
      lastError: null,
      completedAt,
      updatedAt: completedAt,
    });
    transaction.delete(refs.lockRef);
    return {
      status: "complete",
      operationId: refs.operationId,
      idempotent: claim.idempotent,
    };
  });
  return completion;
}

async function repairCareMistakeV2({ uid, slotId, repairType, repairId, expectedRevision,
  expectedReceiptId, baseline, reason, operator, deps = {} }) {
  const db = deps.db || getArenaFirestore();
  const normalizedSlotId = normalizeSlotId(slotId);
  const normalizedRepairId = requiredId(repairId, "repairId");
  const slotRef = db.doc(`users/${uid}/slots/${normalizedSlotId}`);
  const receiptId = deterministicId("care-repair-v2", uid, normalizedSlotId, normalizedRepairId);
  const receiptRef = slotRef.collection(RECEIPT_COLLECTION).doc(receiptId);
  const lockRef = db.doc(
    `users/${uid}/${SLOT_DELETION_LOCK_COLLECTION}/${normalizedSlotId}`
  );
  const requestFingerprint = crypto.createHash("sha256").update(JSON.stringify(canonicalize({
    uid: requiredId(uid, "uid"),
    slotId: normalizedSlotId,
    repairType: requiredId(repairType, "repairType"),
    repairId: normalizedRepairId,
    expectedRevision: normalizeRevision(expectedRevision),
    expectedReceiptId: requiredId(expectedReceiptId, "expectedReceiptId"),
    baseline: repairType === "baseline_override" ? normalizeRevision(baseline, "baseline") : null,
    reason: requiredId(reason, "reason"),
    operatorUid: requiredId(operator?.uid, "operator uid"),
  }))).digest("hex");
  const transact = deps.runTransaction || ((callback) => db.runTransaction(callback));
  return transact(async (transaction) => {
    await assertSlotDeletionUnlocked(transaction, lockRef);
    const existing = snapshotData(await transaction.get(receiptRef));
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) {
        throw new CareMistakeV2Error(
          "REPAIR_ID_REUSE_CONFLICT",
          "같은 repairId가 다른 요청 내용에 재사용되었습니다."
        );
      }
      return { revision: existing.revisionAfter, receiptId, idempotent: true };
    }
    const integritySnapshot = await readIntegritySnapshot(transaction, slotRef);
    if (!integritySnapshot.state) {
      throw new CareMistakeV2Error("INVALID_CARE_MISTAKE_STATE", "V2 슬롯만 repair할 수 있습니다.", 422);
    }
    const slotData = integritySnapshot.slotData;
    const state = { ...integritySnapshot.state };
    const currentRevision = normalizeRevision(slotData.revision, "revision");
    if (normalizeRevision(expectedRevision) !== currentRevision || expectedReceiptId !== state.receiptId) {
      throw new CareMistakeV2Error("STALE_CARE_REPAIR", "repair 대상 epoch가 변경되었습니다.");
    }
    const now = deps.now || new Date();
    const nextRevision = currentRevision + 1;
    let nextState;
    const incidentUpdates = [];
    if (repairType === "baseline_override") {
      const nextBaseline = normalizeRevision(baseline, "baseline");
      nextState = {
        ...state,
        receiptId,
        baselineRemainingCount: nextBaseline,
        unresolvedCareMistakeCount: nextBaseline + state.postCutoverUnresolvedCount,
      };
    } else if (repairType === "linked_head_repair") {
      const query = slotRef.collection("careMistakeIncidents")
        .where("careSchemaVersion", "==", CARE_MISTAKE_V2_SCHEMA_VERSION)
        .where("rootReceiptId", "==", state.rootReceiptId)
        .where("evolutionStageInstanceId", "==", state.evolutionStageInstanceId)
        .where("status", "==", "unresolved")
        .where("resolvedAt", "==", null)
        .limit(401);
      const querySnapshot = await transaction.get(query);
      const incidents = querySnapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
      const plan = buildLinkedHeadRepairPlan({
        state,
        incidents,
        currentRevision,
        expectedRevision,
        nextReceiptId: receiptId,
      });
      if (!plan.ok) {
        throw new CareMistakeV2Error(
          "CARE_MISTAKE_INTEGRITY_FAILURE",
          "linked head를 자동 복구할 수 없습니다.",
          422,
          { diagnosticCodes: plan.diagnosticCodes }
        );
      }
      nextState = plan.nextState;
      plan.pointerChanges.forEach((change) => {
        incidentUpdates.push({
          ref: slotRef.collection("careMistakeIncidents").doc(change.incidentId),
          previousUnresolvedIncidentId: change.previousUnresolvedIncidentId,
        });
      });
    } else {
      throw new CareMistakeV2Error("INVALID_REPAIR_TYPE", "지원하지 않는 repair 유형입니다.", 400);
    }
    const nextSlot = applyProjection(slotData, nextState);
    transaction.update(slotRef, {
      ...projectionFields(nextState),
      digimonStats: nextSlot.digimonStats,
      revision: nextRevision,
      updatedAt: now,
    });
    incidentUpdates.forEach((update) => transaction.update(update.ref, {
      previousUnresolvedIncidentId: update.previousUnresolvedIncidentId,
    }));
    transaction.create(receiptRef, receiptPayload({
      receiptId,
      rootReceiptId: state.rootReceiptId,
      supersedesReceiptId: state.receiptId,
      receiptType: repairType,
      slotData,
      revision: nextRevision,
      now,
      extra: {
        revisionBefore: currentRevision,
        revisionAfter: nextRevision,
        previousBaselineRemainingCount: state.baselineRemainingCount,
        nextBaselineRemainingCount: nextState.baselineRemainingCount,
        previousUnresolvedCareMistakeCount: state.unresolvedCareMistakeCount,
        nextUnresolvedCareMistakeCount: nextState.unresolvedCareMistakeCount,
        reason: requiredId(reason, "reason"),
        operatorUid: requiredId(operator?.uid, "operator uid"),
        requestFingerprint,
      },
    }));
    return { revision: nextRevision, receiptId, careMistakeState: nextState, idempotent: false };
  });
}

module.exports = {
  CareMistakeV2Error,
  RECEIPT_COLLECTION,
  buildCommandFingerprint,
  commitCareMistakeV2Command,
  deleteCareMistakeV2Slot,
  getCareMistakeV2Integrity,
  migrateCareMistakeV2Slot,
  nativeInitCareMistakeV2Slot,
  normalizeSlotId,
  repairCareMistakeV2,
};
