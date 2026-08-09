"use strict";

const { getArenaFirestore } = require("./arenaTransactions");
const {
  MAX_MASTER_DATA_SNAPSHOT_BYTES,
  MASTER_DATA_VERSION_KEYS,
  MasterDataError,
  assertSaveChangeScope,
  createMasterDataSnapshotId,
  createRestoreRequestFingerprint,
  createSaveRequestFingerprint,
  getChangedDigimonIdsBetweenOverrides,
  jsonBytes,
  normalizeMasterDataRestoreRequest,
  normalizeMasterDataSaveRequest,
  normalizeMasterDataOverrides,
  normalizeStoredOverrides,
} = require("./masterDataDomain");

const MASTER_DATA_DOCUMENT_PATH = "game_settings/digimon_master_data";
const MASTER_DATA_SNAPSHOT_COLLECTION_PATH = `${MASTER_DATA_DOCUMENT_PATH}/snapshots`;

function buildActor(decodedToken = {}) {
  return {
    uid: decodedToken.uid,
    displayName:
      typeof decodedToken.name === "string" && decodedToken.name.trim()
        ? decodedToken.name.trim().slice(0, 100)
        : null,
  };
}

function getStoredRevision(activeData = {}) {
  if (activeData.revision === undefined || activeData.revision === null) {
    return 0;
  }
  const revision = activeData.revision;
  if (
    typeof revision !== "number" ||
    !Number.isInteger(revision) ||
    revision < 0
  ) {
    throw new MasterDataError(
      "MASTER_DATA_REVISION_CORRUPT",
      "현재 마스터 데이터 revision이 손상되었습니다.",
      500
    );
  }
  return revision;
}

function assertExpectedRevision(currentRevision, expectedRevision) {
  if (currentRevision !== expectedRevision) {
    throw new MasterDataError(
      "MASTER_DATA_REVISION_CONFLICT",
      "마스터 데이터가 다른 운영자에 의해 변경되었습니다.",
      409,
      { currentRevision }
    );
  }
}

function buildActiveOverrideFields(overrides) {
  return MASTER_DATA_VERSION_KEYS.reduce((result, versionKey) => {
    result[`${versionKey}Overrides`] = overrides[versionKey] || {};
    return result;
  }, {});
}

function buildMutationResponse({ snapshotId, revisionBefore, revisionAfter, now, changeSummary }) {
  return {
    snapshotId,
    revisionBefore,
    revisionAfter,
    updatedAt: now.toISOString(),
    changeSummary,
  };
}

function readReceiptResult(receipt, fingerprint) {
  const data = receipt.data() || {};
  if (data.requestFingerprint !== fingerprint) {
    throw new MasterDataError(
      "IDEMPOTENCY_KEY_REUSED",
      "같은 requestId가 다른 마스터 데이터 요청에 사용되었습니다.",
      409
    );
  }
  if (!data.result || typeof data.result !== "object") {
    throw new MasterDataError(
      "MASTER_DATA_RECEIPT_CORRUPT",
      "마스터 데이터 멱등성 기록이 손상되었습니다.",
      500
    );
  }
  return data.result;
}

function buildSnapshotDocument({
  action,
  request,
  requestFingerprint,
  actor,
  now,
  revisionBefore,
  revisionAfter,
  beforeOverrides,
  afterOverrides,
  changeSummary,
  result,
  restoredFromSnapshotId = null,
  versionLabel = null,
  targetDigimonId = null,
}) {
  const snapshot = {
    schemaVersion: 2,
    requestId: request.requestId,
    action,
    actionType:
      action === "master-data-restore" ? "restore_snapshot" : request.actionType,
    requestFingerprint,
    revisionBefore,
    revisionAfter,
    createdByUid: actor.uid,
    createdBy: actor,
    createdAt: now,
    note: request.note || null,
    versionLabel,
    targetDigimonId,
    restoredFromSnapshotId,
    changeSummary,
    beforeOverrides,
    afterOverrides,
    result,
  };
  if (jsonBytes(snapshot) > MAX_MASTER_DATA_SNAPSHOT_BYTES) {
    throw new MasterDataError(
      "MASTER_DATA_SNAPSHOT_TOO_LARGE",
      "마스터 데이터 snapshot 크기가 허용 범위를 초과했습니다.",
      413
    );
  }
  return snapshot;
}

function buildActiveDocument({
  overrides,
  snapshotId,
  revision,
  now,
  actor,
  actionType,
  note,
  changeSummary,
}) {
  return {
    ...buildActiveOverrideFields(overrides),
    activeSnapshotId: snapshotId,
    revision,
    updatedAt: now,
    updatedBy: actor,
    latestActionType: actionType,
    latestNote: note || null,
    changeSummary,
  };
}

async function saveMasterData({ decodedToken, input, deps = {} }) {
  const request = normalizeMasterDataSaveRequest(input);
  const actor = buildActor(decodedToken);
  const action = "master-data-save";
  const snapshotId = createMasterDataSnapshotId({
    operatorUid: actor.uid,
    action,
    requestId: request.requestId,
  });
  const requestFingerprint = createSaveRequestFingerprint(request);
  const db = deps.db || getArenaFirestore();
  const transact = deps.runTransaction || ((callback) => db.runTransaction(callback));
  const now = deps.now instanceof Date ? deps.now : new Date();

  return transact(async (transaction) => {
    const activeRef = db.doc(MASTER_DATA_DOCUMENT_PATH);
    const snapshotRef = db.doc(`${MASTER_DATA_SNAPSHOT_COLLECTION_PATH}/${snapshotId}`);
    const [activeSnapshot, receiptSnapshot] = await transaction.getAll(
      activeRef,
      snapshotRef
    );

    if (receiptSnapshot.exists) {
      return readReceiptResult(receiptSnapshot, requestFingerprint);
    }

    const activeData = activeSnapshot.exists ? activeSnapshot.data() || {} : {};
    const revisionBefore = getStoredRevision(activeData);
    assertExpectedRevision(revisionBefore, request.expectedRevision);
    const beforeOverrides = normalizeStoredOverrides(activeData);
    const afterOverrides = request.overrides;
    const changeSummary = getChangedDigimonIdsBetweenOverrides(
      beforeOverrides,
      afterOverrides
    );
    assertSaveChangeScope(request, changeSummary);
    const revisionAfter = revisionBefore + 1;
    const result = buildMutationResponse({
      snapshotId,
      revisionBefore,
      revisionAfter,
      now,
      changeSummary,
    });
    const snapshotDocument = buildSnapshotDocument({
      action,
      request,
      requestFingerprint,
      actor,
      now,
      revisionBefore,
      revisionAfter,
      beforeOverrides,
      afterOverrides,
      changeSummary,
      result,
      versionLabel: request.versionLabel,
      targetDigimonId: request.targetDigimonId,
    });

    transaction.set(
      activeRef,
      buildActiveDocument({
        overrides: afterOverrides,
        snapshotId,
        revision: revisionAfter,
        now,
        actor,
        actionType: request.actionType,
        note: request.note,
        changeSummary,
      }),
      { merge: true }
    );
    transaction.create(snapshotRef, snapshotDocument);
    return result;
  });
}

async function restoreMasterData({ decodedToken, input, deps = {} }) {
  const request = normalizeMasterDataRestoreRequest(input);
  const actor = buildActor(decodedToken);
  const action = "master-data-restore";
  const snapshotId = createMasterDataSnapshotId({
    operatorUid: actor.uid,
    action,
    requestId: request.requestId,
  });
  const requestFingerprint = createRestoreRequestFingerprint(request);
  const db = deps.db || getArenaFirestore();
  const transact = deps.runTransaction || ((callback) => db.runTransaction(callback));
  const now = deps.now instanceof Date ? deps.now : new Date();

  return transact(async (transaction) => {
    const activeRef = db.doc(MASTER_DATA_DOCUMENT_PATH);
    const receiptRef = db.doc(`${MASTER_DATA_SNAPSHOT_COLLECTION_PATH}/${snapshotId}`);
    const sourceRef = db.doc(`${MASTER_DATA_SNAPSHOT_COLLECTION_PATH}/${request.snapshotId}`);
    const [activeSnapshot, receiptSnapshot, sourceSnapshot] = await transaction.getAll(
      activeRef,
      receiptRef,
      sourceRef
    );

    if (receiptSnapshot.exists) {
      return readReceiptResult(receiptSnapshot, requestFingerprint);
    }
    if (!sourceSnapshot.exists) {
      throw new MasterDataError(
        "MASTER_DATA_SNAPSHOT_NOT_FOUND",
        "복원할 마스터 데이터 snapshot을 찾을 수 없습니다.",
        404
      );
    }

    const activeData = activeSnapshot.exists ? activeSnapshot.data() || {} : {};
    const revisionBefore = getStoredRevision(activeData);
    assertExpectedRevision(revisionBefore, request.expectedRevision);
    const beforeOverrides = normalizeStoredOverrides(activeData);
    const sourceData = sourceSnapshot.data() || {};
    const afterOverrides = normalizeMasterDataOverrides(sourceData.afterOverrides || {});
    const changeSummary = getChangedDigimonIdsBetweenOverrides(
      beforeOverrides,
      afterOverrides
    );
    if (changeSummary.totalCount === 0) {
      throw new MasterDataError(
        "MASTER_DATA_NO_CHANGES",
        "복원할 마스터 데이터 변경사항이 없습니다.",
        409
      );
    }
    const revisionAfter = revisionBefore + 1;
    const result = buildMutationResponse({
      snapshotId,
      revisionBefore,
      revisionAfter,
      now,
      changeSummary,
    });
    const snapshotDocument = buildSnapshotDocument({
      action,
      request,
      requestFingerprint,
      actor,
      now,
      revisionBefore,
      revisionAfter,
      beforeOverrides,
      afterOverrides,
      changeSummary,
      result,
      restoredFromSnapshotId: request.snapshotId,
      versionLabel: sourceData.versionLabel || null,
      targetDigimonId: sourceData.targetDigimonId || null,
    });

    transaction.set(
      activeRef,
      buildActiveDocument({
        overrides: afterOverrides,
        snapshotId,
        revision: revisionAfter,
        now,
        actor,
        actionType: "restore_snapshot",
        note: request.note || `스냅샷 복원: ${request.snapshotId}`,
        changeSummary,
      }),
      { merge: true }
    );
    transaction.create(receiptRef, snapshotDocument);
    return result;
  });
}

module.exports = {
  MASTER_DATA_DOCUMENT_PATH,
  MASTER_DATA_SNAPSHOT_COLLECTION_PATH,
  buildActor,
  getStoredRevision,
  restoreMasterData,
  saveMasterData,
};
