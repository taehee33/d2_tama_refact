import { useCallback, useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { createIndexedDbOutbox } from "../../persistence/indexedDbOutbox";
import {
  GameRevisionConflictError,
  buildReplayAction,
  commitRevisionedSlot,
  createMutationId,
  normalizeGameRevision,
  replaySafeActions,
} from "../../persistence/gameRevision";
import {
  buildEvolutionTransitionEnvelope,
  commitEvolutionTransition,
} from "../../persistence/evolutionTransition";
import {
  GameTransitionConflictError,
  buildGameTransitionEnvelope,
  commitGameTransition,
} from "../../persistence/careMistakeTransition";
import { TRANSITION_STATUS } from "../../persistence/transitionQueue";
import { buildActivityLogEventId } from "../../utils/activityLogEventId";
import {
  buildPersistentActivityLogPayload,
  getPersistentActivityLogDocId,
  isFeedActivityLog,
  shouldPersistActivityLog,
} from "../../utils/activityLogPersistence";
import { buildPersistentBattleLogPayload } from "../../utils/battleLogPersistence";
import { toEpochMs } from "../../utils/time";
import {
  isCareMistakeActivityLog,
  isCareMistakeResolutionActivityLog,
} from "../../logic/stats/careMistakeProjection";
import { useGameOutboxSync } from "../game-runtime/useGameOutboxSync";
import {
  getFeedSummaryBucketEndAt,
  getNextStateSyncAt,
} from "../game-runtime/gameSyncSchedule";
import {
  GAME_SAVE_BLOCKED_REASON,
  GAME_SAVE_LOCAL_CLEANUP,
  GAME_SAVE_RECEIPT_STATUS,
  createGameSaveReceipt,
  normalizeGameSaveErrorCode,
  resolveGameplayWriteBlockedReason,
} from "./gameSaveReceipt";

export const GAME_SYNC_STATUS = {
  SAVING: "saving",
  LOCAL: "local",
  SYNCED: "synced",
  CONFLICT: "conflict",
  UNAVAILABLE: "unavailable",
};

export const GAME_RECORD_SYNC_STATUS = {
  SYNCED: "synced",
  LOCAL: "local",
  FEED_PENDING: "feed_pending",
  UNAVAILABLE: "unavailable",
};

export const GAME_PERSISTENCE_PHASE = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  RECOVERING: "recovering",
  FAILED: "failed",
};

export const LOCAL_PERSISTENCE_STATUS = {
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
};

export function canUseGameplayPersistence({
  access,
  currentUid,
  currentSlotId,
  saveContext,
  loadedRevision,
  hasConflict = false,
  allowCareTransition = false,
} = {}) {
  if (access?.phase !== GAME_PERSISTENCE_PHASE.READY || hasConflict) return false;
  if (
    access?.careMistakeReconciliationStatus &&
    access.careMistakeReconciliationStatus !== "verified" &&
    (!allowCareTransition ||
      access.careMistakeReconciliationStatus !== "in_progress")
  ) return false;
  if (loadedRevision == null) return false;
  const loadedIdentity = resolveLoadedPersistenceIdentity({
    access,
    currentUid,
    currentSlotId,
  });
  if (!loadedIdentity) return false;
  if (!saveContext) return true;
  return saveContext.uid === currentUid &&
    String(saveContext.slotId) === String(currentSlotId) &&
    saveContext.generation === access.generation &&
    saveContext.slotInstanceId === loadedIdentity.slotInstanceId &&
    saveContext.digimonInstanceId === loadedIdentity.digimonInstanceId;
}

export function resolveLoadedPersistenceIdentity({
  access,
  currentUid,
  currentSlotId,
} = {}) {
  const identity = access?.loadedIdentity;
  if (!identity?.uid || identity.slotId == null) return null;
  if (!identity.slotInstanceId || !identity.digimonInstanceId) return null;
  if (identity.uid !== currentUid) return null;
  if (String(identity.slotId) !== String(currentSlotId)) return null;
  return {
    uid: identity.uid,
    slotId: identity.slotId,
    slotInstanceId: identity.slotInstanceId,
    digimonInstanceId: identity.digimonInstanceId,
  };
}

export function isCurrentConflictIdentity({
  conflict,
  access,
  currentUid,
  currentSlotId,
} = {}) {
  const identity = conflict?.identity;
  return Boolean(
    identity &&
    access?.loadedIdentity &&
    identity.uid === currentUid &&
    identity.uid === access.loadedIdentity.uid &&
    String(identity.slotId) === String(currentSlotId) &&
    String(identity.slotId) === String(access.loadedIdentity.slotId) &&
    identity.slotInstanceId === access.loadedIdentity.slotInstanceId &&
    identity.digimonInstanceId === access.loadedIdentity.digimonInstanceId &&
    identity.generation === access.generation
  );
}

const OUTBOX_SCHEMA_VERSION = 1;

function formatSyncError(error, fallback = "알 수 없는 동기화 오류") {
  const message = String(error?.message || error || fallback).trim();
  return message || fallback;
}

function createClientInstanceId() {
  const browserCrypto = typeof window !== "undefined" ? window.crypto : null;
  const randomUuid = typeof browserCrypto?.randomUUID === "function"
    ? browserCrypto.randomUUID()
    : null;
  return randomUuid || `client:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function resolveNewReplayActions({
  previousLogs = [],
  updatedLogs = [],
  beforeStats = {},
  afterStats = {},
} = {}) {
  const previousIds = new Set(
    (previousLogs || []).map((log) => buildActivityLogEventId(log)).filter(Boolean)
  );
  const nextLogs = (updatedLogs || []).filter((log) => {
      const eventId = buildActivityLogEventId(log);
      return eventId && !previousIds.has(eventId);
    }).sort(
      (left, right) => (toEpochMs(left?.timestamp) || 0) - (toEpochMs(right?.timestamp) || 0)
    );

  return nextLogs.map((nextLog) => buildReplayAction({
      eventId: buildActivityLogEventId(nextLog),
      type: nextLog.type,
      timestamp: toEpochMs(nextLog.timestamp) ?? Date.now(),
      beforeStats,
      afterStats,
    }));
}

function buildFeedEventMetadata(logEntry = {}) {
  const text = String(logEntry?.text || "");
  let result = "accepted";
  if (/refused|거절/i.test(text)) result = "refused";
  else if (/overfeed|과식/i.test(text)) result = "overfeed";
  else if (/overdose|과다/i.test(text)) result = "overdose";

  return {
    kind: /protein|프로틴/i.test(text) ? "protein" : "meat",
    result,
    text,
  };
}

export function buildFeedSummaryUpdate({
  existing = {},
  events = [],
  bucketStartAt,
  bucketSizeMs = 15 * 60 * 1000,
} = {}) {
  const knownEventIds = new Set(existing.sourceEventIds || []);
  const newEvents = (events || []).filter((event) => !knownEventIds.has(event.eventId));
  if (newEvents.length === 0) return null;

  const countsByKind = { ...(existing.countsByKind || {}) };
  const countsByResult = { ...(existing.countsByResult || {}) };
  newEvents.forEach((event) => {
    const kind = event.payload?.kind || "unknown";
    const result = event.payload?.result || "accepted";
    countsByKind[kind] = (countsByKind[kind] || 0) + 1;
    countsByResult[result] = (countsByResult[result] || 0) + 1;
    knownEventIds.add(event.eventId);
  });
  const eventCount = (existing.eventCount || 0) + newEvents.length;
  const firstOccurredAt = Math.min(
    existing.firstOccurredAt ?? Number.POSITIVE_INFINITY,
    ...newEvents.map((event) => event.occurredAt)
  );
  const lastOccurredAt = Math.max(
    existing.lastOccurredAt ?? 0,
    ...newEvents.map((event) => event.occurredAt)
  );
  const eventId = `feed-summary:${bucketStartAt}`;

  return {
    payload: {
      type: "FEED_SUMMARY",
      eventId,
      timestamp: lastOccurredAt,
      bucketStartAt,
      bucketEndAt: bucketStartAt + bucketSizeMs,
      eventCount,
      countsByKind,
      countsByResult,
      firstOccurredAt,
      lastOccurredAt,
      sourceEventIds: Array.from(knownEventIds),
      text: `먹이 ${eventCount}회 (고기 ${countsByKind.meat || 0}, 프로틴 ${countsByKind.protein || 0})`,
    },
  };
}

export function useDurableGamePersistence({
  slotId,
  currentUser,
  isFirebaseAvailable,
  isLoadingSlot,
  digimonStats,
  activityLogs,
  selectedDigimon,
  isLightsOn,
  wakeUntil,
  setDigimonStats,
  buildUpdateDataForSnapshot,
  normalizeStats,
  saveQueue,
  outboxOverride,
  persistenceAccessRef,
  onPersistenceAccessChange,
  reloadPage,
}) {
  const [stateSyncStatus, setStateSyncStatus] = useState(GAME_SYNC_STATUS.SYNCED);
  const [recordSyncStatus, setRecordSyncStatus] = useState(GAME_RECORD_SYNC_STATUS.SYNCED);
  const [nextStateSyncAt, setNextStateSyncAt] = useState(null);
  const [nextRecordSyncAt, setNextRecordSyncAt] = useState(null);
  const [pendingRecordCount, setPendingRecordCount] = useState(0);
  const [pendingSaveCount, setPendingSaveCount] = useState(0);
  const [oldestPendingAt, setOldestPendingAt] = useState(null);
  const [syncConflict, setSyncConflict] = useState(null);
  const [lastStateSyncedAt, setLastStateSyncedAt] = useState(null);
  const [lastRecordSyncedAt, setLastRecordSyncedAt] = useState(null);
  const [stateSyncError, setStateSyncError] = useState("");
  const [recordSyncError, setRecordSyncError] = useState("");
  const [outbox] = useState(() => {
    if (outboxOverride !== undefined) return outboxOverride;
    try {
      return createIndexedDbOutbox();
    } catch (_error) {
      return null;
    }
  });
  const [clientInstanceId] = useState(createClientInstanceId);
  const fallbackTransitionSequenceRef = useRef(0);
  const [localPersistenceStatus, setLocalPersistenceStatus] = useState(() =>
    outbox ? LOCAL_PERSISTENCE_STATUS.AVAILABLE : LOCAL_PERSISTENCE_STATUS.UNAVAILABLE
  );
  const fallbackAccessRef = useRef({
    phase: GAME_PERSISTENCE_PHASE.IDLE,
    generation: 0,
    loadedIdentity: null,
    loadedRevision: null,
  });
  const activeAccessRef = persistenceAccessRef || fallbackAccessRef;
  const revisionRef = useRef(activeAccessRef.current?.loadedRevision ?? null);
  const lastSyncedStatsRef = useRef(null);
  const conflictRef = useRef(null);
  const cleanupFailedMutationIdsRef = useRef(new Set());

  const getOutboxIdentity = useCallback(() =>
    resolveLoadedPersistenceIdentity({
      access: activeAccessRef.current,
      currentUid: currentUser?.uid,
      currentSlotId: slotId,
    }), [activeAccessRef, currentUser?.uid, slotId]);

  const captureSaveContext = useCallback(() => {
    const identity = getOutboxIdentity();
    return {
      uid: currentUser?.uid ?? null,
      slotId,
      slotInstanceId: identity?.slotInstanceId ?? null,
      digimonInstanceId: identity?.digimonInstanceId ?? null,
      generation: activeAccessRef.current?.generation,
      requestedAtRevision: revisionRef.current,
    };
  }, [activeAccessRef, currentUser?.uid, getOutboxIdentity, slotId]);

  const canStartGameplayWrite = useCallback((saveContext = null, options = {}) =>
    canUseGameplayPersistence({
      access: activeAccessRef.current,
      currentUid: currentUser?.uid,
      currentSlotId: slotId,
      saveContext,
      loadedRevision: revisionRef.current,
      hasConflict: Boolean(conflictRef.current),
      allowCareTransition: options.allowCareTransition === true,
    }), [activeAccessRef, currentUser?.uid, slotId]);

  const changePersistenceAccess = useCallback((patch) => {
    if (typeof onPersistenceAccessChange === "function") {
      onPersistenceAccessChange(patch);
      return;
    }
    activeAccessRef.current = { ...activeAccessRef.current, ...patch };
  }, [activeAccessRef, onPersistenceAccessChange]);

  useEffect(() => {
    if (!outbox) {
      setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.UNAVAILABLE);
      setStateSyncStatus(GAME_SYNC_STATUS.UNAVAILABLE);
      setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
    }
  }, [outbox]);

  useEffect(() => {
    setLocalPersistenceStatus(
      outbox ? LOCAL_PERSISTENCE_STATUS.AVAILABLE : LOCAL_PERSISTENCE_STATUS.UNAVAILABLE
    );
    setStateSyncStatus(outbox ? GAME_SYNC_STATUS.SYNCED : GAME_SYNC_STATUS.UNAVAILABLE);
    setRecordSyncStatus(outbox ? GAME_RECORD_SYNC_STATUS.SYNCED : GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
    setNextStateSyncAt(null);
    setNextRecordSyncAt(null);
    setPendingRecordCount(0);
    setPendingSaveCount(0);
    setOldestPendingAt(null);
    setLastStateSyncedAt(null);
    setLastRecordSyncedAt(null);
    setStateSyncError("");
    setRecordSyncError("");
    cleanupFailedMutationIdsRef.current.clear();
    conflictRef.current = null;
    setSyncConflict(null);
  }, [currentUser?.uid, outbox, slotId]);

  const refreshOutboxStatus = useCallback(async () => {
    const identity = getOutboxIdentity();
    if (!outbox || !identity) {
      setStateSyncStatus(GAME_SYNC_STATUS.UNAVAILABLE);
      setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      return GAME_SYNC_STATUS.UNAVAILABLE;
    }
    if (conflictRef.current) {
      setStateSyncStatus(GAME_SYNC_STATUS.CONFLICT);
      return GAME_SYNC_STATUS.CONFLICT;
    }

    const [stateRecord, transitionRecords, activityEvents, battleEvents, feedEvents] = await Promise.all([
      outbox.getStateMutation(identity),
      outbox.listTransitions ? outbox.listTransitions(identity) : [],
      outbox.listActivityEvents(identity),
      outbox.listBattleEvents(identity),
      outbox.listFeedEvents(identity),
    ]);
    const pendingTransitions = transitionRecords.filter((record) =>
      record.status === TRANSITION_STATUS.PENDING || record.status === TRANSITION_STATUS.BLOCKED
    );
    const pendingFeedEvents = feedEvents.filter((event) => event.syncStatus !== "synced");
    const recordCount = activityEvents.length + battleEvents.length + pendingFeedEvents.length;
    const pendingItems = [
      ...(stateRecord ? [stateRecord] : []),
      ...pendingTransitions,
      ...activityEvents,
      ...battleEvents,
      ...pendingFeedEvents,
    ];
    const pendingTimestamps = pendingItems
      .map((item) => Number(item?.queuedAt ?? item?.occurredAt ?? item?.updatedAt))
      .filter((value) => Number.isFinite(value) && value > 0);
    setStateSyncStatus(stateRecord || pendingTransitions.length ? GAME_SYNC_STATUS.LOCAL : GAME_SYNC_STATUS.SYNCED);
    if (!stateRecord && pendingTransitions.length === 0) setStateSyncError("");
    setPendingRecordCount(recordCount + pendingTransitions.length);
    setPendingSaveCount(recordCount + (stateRecord ? 1 : 0) + pendingTransitions.length);
    setOldestPendingAt(pendingTimestamps.length ? Math.min(...pendingTimestamps) : null);
    if (activityEvents.length || battleEvents.length) {
      setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.LOCAL);
    } else if (pendingFeedEvents.length) {
      setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.FEED_PENDING);
    } else {
      setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.SYNCED);
      setRecordSyncError("");
    }
    const nextFeedAt = pendingFeedEvents.length
      ? Math.min(...pendingFeedEvents.map((event) => getFeedSummaryBucketEndAt(event.occurredAt)))
      : null;
    setNextRecordSyncAt(nextFeedAt);
    return stateRecord || pendingTransitions.length
      ? GAME_SYNC_STATUS.LOCAL
      : GAME_SYNC_STATUS.SYNCED;
  }, [getOutboxIdentity, outbox]);

  const holdRevisionConflict = useCallback((record, conflictError) => {
    const conflict = {
      mutationId: record?.mutationId,
      expectedRevision: conflictError.expectedRevision,
      actualRevision: conflictError.actualRevision,
      localState: record?.state?.stateSnapshot || null,
      remoteData: conflictError.remoteData || null,
      actions: record?.state?.actions || [],
      reason: conflictError.reason || null,
      classification: conflictError.classification || "TRUE_REMOTE_CONFLICT",
      localSavedAt:
        conflictError.localSavedAt ??
        record?.state?.stateSnapshot?.lastSavedAt ??
        record?.updatedAt ??
        null,
      recoveryResult: "pending",
      errorCode: null,
      identity: {
        uid: currentUser?.uid ?? null,
        slotId,
        slotInstanceId: record?.slotInstanceId ?? null,
        digimonInstanceId: record?.digimonInstanceId ?? null,
        generation: activeAccessRef.current?.generation,
      },
    };
    conflictRef.current = conflict;
    setSyncConflict(conflict);
    setStateSyncError("다른 기기의 변경사항 확인이 필요합니다.");
    setStateSyncStatus(GAME_SYNC_STATUS.CONFLICT);
    return false;
  }, [activeAccessRef, currentUser?.uid, slotId]);

  const quarantinePendingState = useCallback((record, {
    expectedRevision,
    actualRevision,
    remoteData = null,
    reason = "unsafe_pending_hydration",
    classification = "INVALID_LOCAL_SNAPSHOT",
    localSavedAt = null,
  } = {}) => holdRevisionConflict(record, {
    expectedRevision: normalizeGameRevision(expectedRevision),
    actualRevision: normalizeGameRevision(actualRevision),
    remoteData,
    reason,
    classification,
    localSavedAt,
  }), [holdRevisionConflict]);

  const cleanupCommittedStateRecord = useCallback(async (record, { localWriteFailed = false } = {}) => {
    const identity = record?.slotInstanceId && record?.digimonInstanceId
      ? {
          uid: record.uid,
          slotId: record.slotId,
          slotInstanceId: record.slotInstanceId,
          digimonInstanceId: record.digimonInstanceId,
        }
      : getOutboxIdentity();
    if (!outbox || !record?.mutationId || !record?.recordVersion || !identity) {
      return localWriteFailed
        ? GAME_SAVE_LOCAL_CLEANUP.FAILED
        : GAME_SAVE_LOCAL_CLEANUP.NOT_NEEDED;
    }

    let cleanup = localWriteFailed
      ? GAME_SAVE_LOCAL_CLEANUP.FAILED
      : GAME_SAVE_LOCAL_CLEANUP.COMPLETE;
    try {
      const didDelete = await outbox.deleteStateMutation({
        ...identity,
        mutationId: record.mutationId,
        recordVersion: record.recordVersion,
      });
      const remainingState = await outbox.getStateMutation(identity);
      if (!didDelete || remainingState?.recordVersion === record.recordVersion) {
        cleanupFailedMutationIdsRef.current.add(record.mutationId);
        cleanup = GAME_SAVE_LOCAL_CLEANUP.FAILED;
      } else {
        cleanupFailedMutationIdsRef.current.delete(record.mutationId);
      }
    } catch (error) {
      cleanupFailedMutationIdsRef.current.add(record.mutationId);
      setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.UNAVAILABLE);
      setStateSyncError(formatSyncError(error, "원격 저장 후 로컬 대기 항목을 정리하지 못했습니다."));
      cleanup = GAME_SAVE_LOCAL_CLEANUP.FAILED;
    }
    return cleanup;
  }, [getOutboxIdentity, outbox]);

  const commitStateRecordWithReceipt = useCallback(async (record, {
    commandId = null,
    saveContext = null,
    localRecordIsDurable = false,
    localWriteFailed = false,
    allowCareTransition = false,
  } = {}) => {
    const resolvedCommandId = commandId || record?.commandId || record?.mutationId || null;
    const mutationId = record?.mutationId || null;
    if (conflictRef.current) {
      return {
        receipt: createGameSaveReceipt({
          status: GAME_SAVE_RECEIPT_STATUS.CONFLICT,
          commandId: resolvedCommandId,
          mutationId,
        }),
        error: null,
      };
    }
    if (
      !record ||
      !currentUser?.uid ||
      !slotId ||
      !isFirebaseAvailable ||
      !canStartGameplayWrite(saveContext, { allowCareTransition })
    ) {
      return {
        receipt: createGameSaveReceipt({
          status: GAME_SAVE_RECEIPT_STATUS.BLOCKED,
          commandId: resolvedCommandId,
          mutationId,
          blockedReason: !slotId
            ? GAME_SAVE_BLOCKED_REASON.SLOT_CHANGED
            : resolveGameplayWriteBlockedReason({
                currentUid: currentUser?.uid,
                currentSlotId: slotId,
                currentGeneration: activeAccessRef.current?.generation,
                saveContext,
                isFirebaseAvailable,
              }),
        }),
        error: null,
      };
    }
    const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
    const stateEnvelope = record.state || {};
    const localSnapshot = stateEnvelope.stateSnapshot || {};

    try {
      const result = stateEnvelope.transition?.transitionType
        ? await commitGameTransition({
            db,
            slotRef,
            baseRevision: stateEnvelope.baseRevision,
            updateData: buildUpdateDataForSnapshot(
              localSnapshot,
              record.updatedAt,
              stateEnvelope.transition
            ),
            transition: stateEnvelope.transition,
            runTransaction,
          })
        : stateEnvelope.transition
        ? await commitEvolutionTransition({
            db,
            slotRef,
            logRef: doc(
              collection(slotRef, "logs"),
              stateEnvelope.transition.eventId
            ),
            baseRevision: stateEnvelope.baseRevision,
            updateData: buildUpdateDataForSnapshot(
              localSnapshot,
              record.updatedAt,
              stateEnvelope.transition
            ),
            transition: stateEnvelope.transition,
            runTransaction,
          })
        : await commitRevisionedSlot({
            db,
            slotRef,
            baseRevision: stateEnvelope.baseRevision,
            updateData: buildUpdateDataForSnapshot(localSnapshot, record.updatedAt),
            runTransaction,
            activityEvents: stateEnvelope.activityEvents,
            activityLogIdentity: {
              slotInstanceId: record.slotInstanceId,
              digimonInstanceId: record.digimonInstanceId,
            },
          });
      if (stateEnvelope.transition?.transitionType && outbox?.updateTransitionStatus) {
        await outbox.updateTransitionStatus({
          uid: record.uid,
          slotId: record.slotId,
          slotInstanceId: record.slotInstanceId,
          digimonInstanceId: record.digimonInstanceId,
          transitionId: stateEnvelope.transition.transitionId,
          status: TRANSITION_STATUS.COMMITTED,
          resultRevision: result.revision,
        });
      }
      const committedSnapshot = result.projection
        ? {
            ...localSnapshot,
            ...result.projection,
            digimonStats: {
              ...(localSnapshot.digimonStats || {}),
              ...result.projection,
            },
          }
        : localSnapshot;
      revisionRef.current = result.revision;
      lastSyncedStatsRef.current = committedSnapshot;
      setLastStateSyncedAt(Date.now());
      setStateSyncError("");
      setStateSyncStatus(GAME_SYNC_STATUS.SYNCED);
      setNextStateSyncAt(getNextStateSyncAt());
      let localCleanup = await cleanupCommittedStateRecord(record, { localWriteFailed });
      conflictRef.current = null;
      setSyncConflict(null);
      try {
        await refreshOutboxStatus();
      } catch (refreshError) {
        setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.UNAVAILABLE);
        setStateSyncError(formatSyncError(refreshError, "원격 저장 후 로컬 상태 확인에 실패했습니다."));
        localCleanup = GAME_SAVE_LOCAL_CLEANUP.FAILED;
      }
      return {
        receipt: {
          ...createGameSaveReceipt({
            status: GAME_SAVE_RECEIPT_STATUS.SYNCED,
            commandId: resolvedCommandId,
            mutationId,
            localCleanup,
          }),
          ...(stateEnvelope.transition
            ? {
                transitionId: stateEnvelope.transition.transitionId,
                idempotent: result.idempotent === true,
                revision: result.revision,
              }
            : {}),
        },
        error: null,
      };
    } catch (commitError) {
      const isTransitionConflict =
        commitError instanceof GameTransitionConflictError ||
        String(commitError?.code || "").startsWith("game/transition-");
      if (isTransitionConflict) {
        if (stateEnvelope.transition?.transitionId && outbox?.blockTransitionChain) {
          await outbox.blockTransitionChain({
            uid: record.uid,
            slotId: record.slotId,
            slotInstanceId: record.slotInstanceId,
            digimonInstanceId: record.digimonInstanceId,
            localSequence: stateEnvelope.transition.localSequence || 0,
            errorCode: commitError.code || "game/transition-conflict",
          });
        }
        holdRevisionConflict(record, {
          ...commitError,
          expectedRevision:
            commitError.expectedRevision ?? stateEnvelope.baseRevision ?? revisionRef.current,
          actualRevision: commitError.actualRevision ?? revisionRef.current,
        });
        return {
          receipt: createGameSaveReceipt({
            status: GAME_SAVE_RECEIPT_STATUS.CONFLICT,
            commandId: resolvedCommandId,
            mutationId,
            errorCode: commitError.code,
          }),
          error: null,
        };
      }
      if (!(commitError instanceof GameRevisionConflictError)) {
        setStateSyncError(formatSyncError(commitError));
        setStateSyncStatus(localRecordIsDurable ? GAME_SYNC_STATUS.LOCAL : GAME_SYNC_STATUS.UNAVAILABLE);
        return {
          receipt: createGameSaveReceipt({
            status: localRecordIsDurable
              ? GAME_SAVE_RECEIPT_STATUS.QUEUED
              : GAME_SAVE_RECEIPT_STATUS.FAILED,
            commandId: resolvedCommandId,
            mutationId,
            errorCode: normalizeGameSaveErrorCode(commitError),
          }),
          error: commitError,
        };
      }

      const remoteRootFields = {
        isLightsOn: commitError.remoteData?.isLightsOn ?? true,
        wakeUntil: toEpochMs(commitError.remoteData?.wakeUntil),
      };
      const replayResult = stateEnvelope.hasUnreplayableChanges
        ? { status: "conflict" }
        : replaySafeActions(
            {
              ...normalizeStats(commitError.remoteData?.digimonStats || {}),
              ...remoteRootFields,
            },
            stateEnvelope.actions || []
          );
      if (replayResult.status !== "replayed") {
        holdRevisionConflict(record, commitError);
        return {
          receipt: createGameSaveReceipt({
            status: GAME_SAVE_RECEIPT_STATUS.CONFLICT,
            commandId: resolvedCommandId,
            mutationId,
          }),
          error: null,
        };
      }

      const replayedSnapshot = {
        ...remoteRootFields,
        ...replayResult.stats,
        selectedDigimon:
          commitError.remoteData?.selectedDigimon ||
          replayResult.stats?.selectedDigimon ||
          selectedDigimon || null,
      };
      let replayCommit;
      try {
        replayCommit = await commitRevisionedSlot({
          db,
          slotRef,
          baseRevision: commitError.actualRevision,
          updateData: buildUpdateDataForSnapshot(replayedSnapshot),
          runTransaction,
          activityEvents: stateEnvelope.activityEvents,
          activityLogIdentity: {
            slotInstanceId: record.slotInstanceId,
            digimonInstanceId: record.digimonInstanceId,
          },
        });
      } catch (replayError) {
        if (replayError instanceof GameRevisionConflictError) {
          holdRevisionConflict(record, replayError);
          return {
            receipt: createGameSaveReceipt({
              status: GAME_SAVE_RECEIPT_STATUS.CONFLICT,
              commandId: resolvedCommandId,
              mutationId,
            }),
            error: null,
          };
        }
        setStateSyncError(formatSyncError(replayError));
        setStateSyncStatus(localRecordIsDurable ? GAME_SYNC_STATUS.LOCAL : GAME_SYNC_STATUS.UNAVAILABLE);
        return {
          receipt: createGameSaveReceipt({
            status: localRecordIsDurable
              ? GAME_SAVE_RECEIPT_STATUS.QUEUED
              : GAME_SAVE_RECEIPT_STATUS.FAILED,
            commandId: resolvedCommandId,
            mutationId,
            errorCode: normalizeGameSaveErrorCode(replayError),
          }),
          error: replayError,
        };
      }
      revisionRef.current = replayCommit.revision;
      lastSyncedStatsRef.current = replayedSnapshot;
      setLastStateSyncedAt(Date.now());
      setStateSyncError("");
      setStateSyncStatus(GAME_SYNC_STATUS.SYNCED);
      setNextStateSyncAt(getNextStateSyncAt());
      setDigimonStats((previous) => ({
        ...replayedSnapshot,
        activityLogs: previous?.activityLogs || [],
        battleLogs: previous?.battleLogs || [],
      }));
      let localCleanup = await cleanupCommittedStateRecord(record, { localWriteFailed });
      conflictRef.current = null;
      setSyncConflict(null);
      try {
        await refreshOutboxStatus();
      } catch (refreshError) {
        setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.UNAVAILABLE);
        setStateSyncError(formatSyncError(refreshError, "원격 저장 후 로컬 상태 확인에 실패했습니다."));
        localCleanup = GAME_SAVE_LOCAL_CLEANUP.FAILED;
      }
      return {
        receipt: createGameSaveReceipt({
          status: GAME_SAVE_RECEIPT_STATUS.SYNCED,
          commandId: resolvedCommandId,
          mutationId,
          localCleanup,
        }),
        error: null,
      };
    }
  }, [
    activeAccessRef,
    buildUpdateDataForSnapshot,
    canStartGameplayWrite,
    cleanupCommittedStateRecord,
    currentUser,
    holdRevisionConflict,
    isFirebaseAvailable,
    normalizeStats,
    outbox,
    refreshOutboxStatus,
    selectedDigimon,
    setDigimonStats,
    slotId,
  ]);

  const commitStateRecord = useCallback(async (record) => {
    const outcome = await commitStateRecordWithReceipt(record, {
      localRecordIsDurable: true,
      allowCareTransition: Boolean(
        record?.state?.transition?.transitionType &&
        record.state.transition.transitionType !== "EVOLUTION"
      ),
    });
    if (outcome.receipt.status === GAME_SAVE_RECEIPT_STATUS.SYNCED) return true;
    if (
      outcome.receipt.status === GAME_SAVE_RECEIPT_STATUS.CONFLICT ||
      outcome.receipt.status === GAME_SAVE_RECEIPT_STATUS.BLOCKED
    ) return false;
    throw outcome.error || new Error("게임 상태 저장에 실패했습니다.");
  }, [commitStateRecordWithReceipt]);

  const buildCareTransitionEnvelopeForSnapshot = useCallback(({
    transition,
    statsSnapshot,
    nowMs,
    identity,
    baseRevision,
    localSequence,
    parentTransitionId = null,
  }) => {
    const stageInstanceId =
      transition?.evolutionStageInstanceId ||
      transition?.identity?.evolutionStageInstanceId ||
      statsSnapshot?.evolutionStageInstanceId ||
      null;
    const transitionIdentity = {
      ...identity,
      evolutionStageInstanceId: stageInstanceId,
    };
    const operations = (Array.isArray(transition?.operations)
      ? transition.operations
      : [transition]
    ).map((operation, index) => {
      const { eventId: _eventId, ...operationWithoutGeneratedEventId } = operation || {};
      return {
        ...operationWithoutGeneratedEventId,
        index,
        transitionType:
          operationWithoutGeneratedEventId.transitionType || transition.transitionType,
      };
    });
    const normalizedTransitionType = transition?.transitionType || operations[0]?.transitionType;
    const requiresStage = operations.some((operation) =>
      operation.transitionType === "CARE_MISTAKE_OCCURRED" ||
      operation.transitionType === "CARE_MISTAKE_RESOLVED"
    );
    if (requiresStage && !stageInstanceId) {
      throw new GameTransitionConflictError(
        "현재 stage identity를 확인할 수 없어 케어미스 전이를 저장할 수 없습니다.",
        { code: "game/transition-stage-missing" }
      );
    }

    return buildGameTransitionEnvelope({
      ...transition,
      identity: transitionIdentity,
      transitionType: normalizedTransitionType,
      transitionId: transition?.transitionId || null,
      clientInstanceId: transition?.clientInstanceId || clientInstanceId,
      localSequence,
      parentTransitionId,
      baseRevision,
      createdAt: transition?.createdAt ?? nowMs,
      operations,
      activityEvents: [],
      eventIds: [],
      resultingState: statsSnapshot,
      updateData: null,
    });
  }, [clientInstanceId]);

  const enqueueCareTransition = useCallback(async ({
    statsSnapshot,
    transition,
    nowMs,
    saveContext,
    allowCareTransition = false,
  }) => {
    const identity = getOutboxIdentity();
    if (!outbox?.enqueueTransition || !identity) return null;
    if (!canStartGameplayWrite(saveContext, { allowCareTransition })) return null;
    const transitionType = transition?.transitionType;
    const stageInstanceId =
      transition?.evolutionStageInstanceId ||
      transition?.identity?.evolutionStageInstanceId ||
      statsSnapshot?.evolutionStageInstanceId ||
      null;
    const transitionIdentity = {
      ...identity,
      evolutionStageInstanceId: stageInstanceId,
    };
    const operations = (Array.isArray(transition?.operations)
      ? transition.operations
      : [transition]
    ).map((operation, index) => {
      const {
        eventId: _eventId,
        requestFingerprint: _requestFingerprint,
        resultRevision: _resultRevision,
        ...operationWithoutGeneratedFields
      } = operation || {};
      return {
        ...operationWithoutGeneratedFields,
        index,
        transitionType:
          operationWithoutGeneratedFields.transitionType || transitionType,
      };
    });
    const requiresStage = operations.some((operation) =>
      operation.transitionType === "CARE_MISTAKE_OCCURRED" ||
      operation.transitionType === "CARE_MISTAKE_RESOLVED"
    );
    if (requiresStage && !stageInstanceId) {
      throw new GameTransitionConflictError(
        "현재 stage identity를 확인할 수 없어 케어미스 전이를 저장할 수 없습니다.",
        { code: "game/transition-stage-missing" }
      );
    }
    const {
      requestFingerprint: _requestFingerprint,
      resultRevision: _resultRevision,
      ...transitionWithoutReceiptFields
    } = transition || {};
    const record = await outbox.enqueueTransition({
      ...identity,
      clientInstanceId: transition?.clientInstanceId || clientInstanceId,
      transitionType,
      baseRevision: transition?.baseRevision ?? revisionRef.current ?? 0,
      createdAt: transition?.createdAt ?? nowMs,
      resultingState: statsSnapshot,
      transition: {
        ...transitionWithoutReceiptFields,
        identity: transitionIdentity,
        operations,
        activityEvents: [],
        eventIds: [],
        resultingState: statsSnapshot,
        updateData: null,
      },
    });
    return record;
  }, [
    canStartGameplayWrite,
    clientInstanceId,
    getOutboxIdentity,
    outbox,
  ]);

  const flushTransitionQueueInternal = useCallback(async (
    saveContext = null,
    { allowCareTransition = true } = {}
  ) => {
    const identity = getOutboxIdentity();
    if (!outbox?.getNextTransition || !identity || !isFirebaseAvailable) {
      return { status: "empty", syncedCount: 0 };
    }
    const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
    let syncedCount = 0;
    let lastResult = null;

    while (canStartGameplayWrite(saveContext, { allowCareTransition })) {
      const next = await outbox.getNextTransition(identity);
      if (next.status === "empty" || next.status === "waiting") {
        return { status: "synced", syncedCount, result: lastResult };
      }
      if (next.status === TRANSITION_STATUS.BLOCKED) {
        return { status: "conflict", syncedCount, record: next.record };
      }

      const record = next.record;
      const parent = record.parentTransitionId
        ? await outbox.getTransition({
            ...identity,
            transitionId: record.parentTransitionId,
          })
        : null;
      const baseRevision = parent?.resultRevision ?? record.baseRevision;
      const storedTransition = record.transition || {};
      const transition = buildCareTransitionEnvelopeForSnapshot({
        transition: storedTransition,
        statsSnapshot: record.resultingState || storedTransition.resultingState || {},
        nowMs: record.createdAt,
        identity,
        baseRevision,
        localSequence: record.localSequence,
        parentTransitionId: record.parentTransitionId,
      });
      try {
        const result = await commitGameTransition({
          db,
          slotRef,
          baseRevision,
          updateData: buildUpdateDataForSnapshot(
            record.resultingState || storedTransition.resultingState || {},
            record.updatedAt || record.createdAt,
            transition
          ),
          transition,
          runTransaction,
        });
        await outbox.updateTransitionStatus({
          ...identity,
          transitionId: record.transitionId,
          status: TRANSITION_STATUS.COMMITTED,
          resultRevision: result.revision,
        });
        revisionRef.current = result.revision;
        const resultingState = record.resultingState || storedTransition.resultingState || {};
        lastSyncedStatsRef.current = {
          ...resultingState,
          ...result.projection,
        };
        if (typeof setDigimonStats === "function") {
          setDigimonStats((previousStats) => ({
            ...(previousStats || {}),
            ...resultingState,
            ...result.projection,
          }));
        }
        if (result.projection?.careMistakeReconciliationStatus === "verified") {
          changePersistenceAccess({
            careMistakeReconciliationStatus: "verified",
          });
        }
        lastResult = result;
        syncedCount += 1;
      } catch (error) {
        if (error instanceof GameTransitionConflictError || String(error?.code || "").startsWith("game/transition-")) {
          await outbox.blockTransitionChain({
            ...identity,
            localSequence: record.localSequence,
            errorCode: error.code || "game/transition-conflict",
          });
          return { status: "conflict", syncedCount, record, error };
        }
        return { status: "queued", syncedCount, record, error };
      }
    }

    return { status: "blocked", syncedCount, result: lastResult };
  }, [
    buildCareTransitionEnvelopeForSnapshot,
    buildUpdateDataForSnapshot,
    canStartGameplayWrite,
    changePersistenceAccess,
    currentUser?.uid,
    getOutboxIdentity,
    isFirebaseAvailable,
    outbox,
    setDigimonStats,
    slotId,
  ]);

  const queueStateSnapshot = useCallback(async ({
    statsSnapshot,
    updatedLogs,
    nowMs,
    saveContext,
    transition = null,
    activityEvents = [],
    allowCareTransition = false,
  }) => {
    const identity = getOutboxIdentity();
    if (
      !outbox ||
      !identity ||
      !canStartGameplayWrite(saveContext, { allowCareTransition })
    ) return null;
    const existing = await outbox.getStateMutation(identity);
    const beforeStats = existing?.state?.stateSnapshot || lastSyncedStatsRef.current || digimonStats || {};
    const nextActions = updatedLogs
      ? resolveNewReplayActions({
          previousLogs: beforeStats.activityLogs || activityLogs || [],
          updatedLogs,
          beforeStats,
          afterStats: statsSnapshot,
        })
      : [];
    const existingActions = existing?.state?.actions || [];
    const existingActionIds = new Set(existingActions.map((action) => action.eventId));
    const actions = [
      ...existingActions,
      ...nextActions.filter((action) => !existingActionIds.has(action.eventId)),
    ];
    const requestedTransition = transition
      ? transition.transitionType
        ? buildGameTransitionEnvelope({
            ...transition,
            identity: transition.identity || identity,
            clientInstanceId: transition.clientInstanceId || clientInstanceId,
            localSequence:
              transition.localSequence ?? ++fallbackTransitionSequenceRef.current,
            parentTransitionId: transition.parentTransitionId || null,
            baseRevision:
              transition.baseRevision ?? existing?.state?.baseRevision ?? revisionRef.current ?? 0,
            nowMs: transition.createdAt ?? nowMs,
            resultingState: statsSnapshot,
          })
        : buildEvolutionTransitionEnvelope({
            ...transition,
            nowMs: transition.createdAt ?? nowMs,
            identity,
          })
      : null;
    const existingTransition = existing?.state?.transition || null;
    const resolvedActivityEvents = [
      ...(Array.isArray(existing?.state?.activityEvents)
        ? existing.state.activityEvents
        : []),
      ...(Array.isArray(activityEvents) ? activityEvents : []),
    ].filter((event, index, events) =>
      event?.eventId && events.findIndex((candidate) => candidate?.eventId === event.eventId) === index
    );
    if (
      existingTransition &&
      requestedTransition &&
      existingTransition.requestFingerprint !== requestedTransition.requestFingerprint
    ) {
      const transitionError = new Error(
        "동기화 대기 중인 다른 진화가 있어 새 진화를 저장할 수 없습니다."
      );
      transitionError.code = "game/evolution-pending-conflict";
      throw transitionError;
    }
    const resolvedTransition = requestedTransition || existingTransition || null;

    if (!canStartGameplayWrite(saveContext, { allowCareTransition })) return null;
    const candidateRecord = {
      ...identity,
      mutationId: existing?.mutationId || createMutationId(nowMs),
      recordVersion: existing?.recordVersion,
      updatedAt: nowMs,
      queuedAt: existing?.queuedAt ?? nowMs,
      state: {
        schemaVersion: OUTBOX_SCHEMA_VERSION,
        baseRevision: existing?.state?.baseRevision ?? revisionRef.current,
        stateSnapshot: statsSnapshot,
        actions,
        ...(resolvedTransition ? { transition: resolvedTransition } : {}),
        ...(resolvedActivityEvents.length > 0
          ? { activityEvents: resolvedActivityEvents }
          : {}),
        hasUnreplayableChanges: Boolean(
          existing?.state?.hasUnreplayableChanges ||
          (updatedLogs ? nextActions.length === 0 || nextActions.some((action) => !action.safe) : true)
        ),
      },
    };
    try {
      const storedRecord = await outbox.putStateMutation(candidateRecord);
      return { ...storedRecord, localRecordIsDurable: true };
    } catch (error) {
      error.gameSaveFallbackRecord = candidateRecord;
      throw error;
    }
  }, [
    activityLogs,
    canStartGameplayWrite,
    clientInstanceId,
    digimonStats,
    getOutboxIdentity,
    outbox,
  ]);

  const persistStateSnapshotOperation = useCallback(async ({
    statsSnapshot,
    updatedLogs,
    nowMs,
    saveContext,
    commandId = null,
    transition = null,
    activityEvents = [],
    allowCareTransition = false,
  }) => {
    if (!canStartGameplayWrite(saveContext, { allowCareTransition })) {
      return commitStateRecordWithReceipt(null, {
        commandId,
        saveContext,
        allowCareTransition,
      });
    }
    setStateSyncStatus(GAME_SYNC_STATUS.SAVING);

    const transitionWithActivityEvents = transition?.transitionType && activityEvents.length > 0
      ? {
          ...transition,
          activityEvents: [
            ...(transition.activityEvents || []),
            ...activityEvents,
          ],
        }
      : transition;

    if (transitionWithActivityEvents?.transitionType && outbox?.enqueueTransition) {
      let transitionRecord = null;
      try {
        transitionRecord = await enqueueCareTransition({
          statsSnapshot,
          transition: transitionWithActivityEvents,
          nowMs,
          saveContext,
          allowCareTransition,
        });
        if (!transitionRecord) {
          return {
            receipt: createGameSaveReceipt({
              status: GAME_SAVE_RECEIPT_STATUS.BLOCKED,
              commandId,
              blockedReason: GAME_SAVE_BLOCKED_REASON.SLOT_CHANGED,
            }),
            error: null,
          };
        }
        setStateSyncStatus(GAME_SYNC_STATUS.LOCAL);
        const flushResult = await flushTransitionQueueInternal(saveContext, {
          allowCareTransition,
        });
        if (flushResult.status === "conflict") {
          setStateSyncStatus(GAME_SYNC_STATUS.CONFLICT);
          setStateSyncError("케어미스 전이 충돌을 해결해야 합니다.");
          return {
            receipt: createGameSaveReceipt({
              status: GAME_SAVE_RECEIPT_STATUS.CONFLICT,
              commandId,
              mutationId: null,
              errorCode: flushResult.error?.code || "game/transition-conflict",
            }),
            error: flushResult.error || null,
          };
        }
        const committed = await outbox.getTransition({
          uid: transitionRecord.uid,
          slotId: transitionRecord.slotId,
          slotInstanceId: transitionRecord.slotInstanceId,
          digimonInstanceId: transitionRecord.digimonInstanceId,
          transitionId: transitionRecord.transitionId,
        });
        const isCommitted = committed?.status === TRANSITION_STATUS.COMMITTED;
        if (isCommitted) {
          setStateSyncStatus(GAME_SYNC_STATUS.SYNCED);
          setLastStateSyncedAt(Date.now());
          setStateSyncError("");
        } else if (flushResult.error) {
          setStateSyncStatus(GAME_SYNC_STATUS.LOCAL);
          setStateSyncError(formatSyncError(flushResult.error));
        }
        return {
          receipt: {
            ...createGameSaveReceipt({
              status: isCommitted
                ? GAME_SAVE_RECEIPT_STATUS.SYNCED
                : GAME_SAVE_RECEIPT_STATUS.QUEUED,
              commandId,
            }),
            transitionId: transitionRecord.transitionId,
            revision: committed?.resultRevision ?? null,
            idempotent: flushResult.result?.idempotent === true,
          },
          error: isCommitted ? null : flushResult.error || null,
        };
      } catch (error) {
        if (transitionRecord) {
          setStateSyncStatus(GAME_SYNC_STATUS.LOCAL);
          setStateSyncError(formatSyncError(error));
          return {
            receipt: {
              ...createGameSaveReceipt({
                status: GAME_SAVE_RECEIPT_STATUS.QUEUED,
                commandId,
                errorCode: normalizeGameSaveErrorCode(error),
              }),
              transitionId: transitionRecord.transitionId,
            },
            error,
          };
        }
        throw error;
      }
    }

    let record = null;
    let localWriteFailed = false;
    if (outbox && currentUser?.uid && slotId) {
      try {
        record = await queueStateSnapshot({
          statsSnapshot,
          updatedLogs,
          nowMs,
          saveContext,
          transition: transitionWithActivityEvents,
          activityEvents,
          allowCareTransition,
        });
        setStateSyncStatus(GAME_SYNC_STATUS.LOCAL);
      } catch (error) {
        if (error?.code === "game/evolution-pending-conflict") {
          setStateSyncStatus(GAME_SYNC_STATUS.LOCAL);
          setStateSyncError(formatSyncError(error));
          return {
            receipt: createGameSaveReceipt({
              status: GAME_SAVE_RECEIPT_STATUS.CONFLICT,
              commandId,
              errorCode: error.code,
            }),
            error,
          };
        }
        localWriteFailed = true;
        record = error.gameSaveFallbackRecord || null;
        console.error("로컬 outbox 저장 오류:", error);
        setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.UNAVAILABLE);
        setStateSyncError(formatSyncError(error, "이 기기의 임시 저장소를 사용할 수 없습니다."));
        setStateSyncStatus(GAME_SYNC_STATUS.UNAVAILABLE);
      }
    }

    const identity = getOutboxIdentity();
    const fallbackTransition = transitionWithActivityEvents && identity
      ? transitionWithActivityEvents.transitionType
        ? buildCareTransitionEnvelopeForSnapshot({
            transition: transitionWithActivityEvents,
            statsSnapshot,
            nowMs,
            identity,
            baseRevision: transitionWithActivityEvents.baseRevision ?? revisionRef.current ?? 0,
            localSequence:
              transitionWithActivityEvents.localSequence || ++fallbackTransitionSequenceRef.current,
            parentTransitionId: transitionWithActivityEvents.parentTransitionId || null,
          })
        : buildEvolutionTransitionEnvelope({
            ...transitionWithActivityEvents,
            nowMs: transitionWithActivityEvents.createdAt ?? nowMs,
            identity,
          })
      : null;
    const recordToCommit = record || {
      ...(identity || {}),
      mutationId: createMutationId(nowMs),
      updatedAt: nowMs,
      state: {
        schemaVersion: OUTBOX_SCHEMA_VERSION,
        baseRevision: revisionRef.current,
        stateSnapshot: statsSnapshot,
        actions: [],
        ...(activityEvents.length > 0 ? { activityEvents } : {}),
        ...(fallbackTransition ? { transition: fallbackTransition } : {}),
        hasUnreplayableChanges: true,
      },
    };
    return commitStateRecordWithReceipt(recordToCommit, {
      commandId,
      saveContext,
      localRecordIsDurable: Boolean(record?.localRecordIsDurable),
      localWriteFailed,
      allowCareTransition: Boolean(
        allowCareTransition ||
        (recordToCommit.state?.transition?.transitionType &&
          recordToCommit.state.transition.transitionType !== "EVOLUTION")
      ),
    });
  }, [
    canStartGameplayWrite,
    buildCareTransitionEnvelopeForSnapshot,
    commitStateRecordWithReceipt,
    currentUser?.uid,
    enqueueCareTransition,
    fallbackTransitionSequenceRef,
    flushTransitionQueueInternal,
    getOutboxIdentity,
    outbox,
    queueStateSnapshot,
    slotId,
  ]);

  const persistStateSnapshotReceipt = useCallback(async (input) => {
    const outcome = await persistStateSnapshotOperation(input);
    return outcome.receipt;
  }, [persistStateSnapshotOperation]);

  const persistEvolutionTransitionReceipt = useCallback(async (input) => {
    const outcome = await persistStateSnapshotOperation(input);
    return outcome.receipt;
  }, [persistStateSnapshotOperation]);

  const persistStateSnapshot = useCallback(async (input) => {
    const outcome = await persistStateSnapshotOperation(input);
    if (outcome.receipt.status === GAME_SAVE_RECEIPT_STATUS.SYNCED) return true;
    if (
      outcome.receipt.status === GAME_SAVE_RECEIPT_STATUS.CONFLICT ||
      outcome.receipt.status === GAME_SAVE_RECEIPT_STATUS.BLOCKED
    ) return false;
    throw outcome.error || new Error("게임 상태 저장에 실패했습니다.");
  }, [persistStateSnapshotOperation]);

  const persistActivityLogOperation = useCallback(async ({
    logEntry,
    saveContext = null,
    commandId = null,
  }) => {
    if (
      !slotId ||
      !currentUser ||
      !isFirebaseAvailable ||
      !logEntry?.type ||
      !canStartGameplayWrite(saveContext)
    ) {
      return {
        receipt: {
          ...createGameSaveReceipt({
            status: GAME_SAVE_RECEIPT_STATUS.BLOCKED,
            commandId,
            blockedReason: resolveGameplayWriteBlockedReason({
              currentUid: currentUser?.uid || null,
              currentSlotId: slotId,
              currentGeneration: activeAccessRef.current?.generation,
              saveContext,
              isFirebaseAvailable,
            }),
          }),
          eventId: logEntry?.eventId || null,
        },
        remoteSucceeded: false,
      };
    }
    const identity = getOutboxIdentity();
    if (!identity) {
      return {
        receipt: {
          ...createGameSaveReceipt({
            status: GAME_SAVE_RECEIPT_STATUS.BLOCKED,
            commandId,
            blockedReason: GAME_SAVE_BLOCKED_REASON.SLOT_CHANGED,
          }),
          eventId: logEntry?.eventId || null,
        },
        remoteSucceeded: false,
      };
    }
    const payload = {
      ...buildPersistentActivityLogPayload({
      ...logEntry,
      timestamp: toEpochMs(logEntry?.timestamp) ?? Date.now(),
      }),
      slotInstanceId: identity.slotInstanceId,
      digimonInstanceId: identity.digimonInstanceId,
    };
    if (
      isCareMistakeActivityLog(payload) ||
      isCareMistakeResolutionActivityLog(payload)
    ) {
      const barrierError = new Error(
        "케어미스 기록은 상태 전이와 함께 저장해야 합니다."
      );
      barrierError.code = "game/care-transition-required";
      return {
        receipt: {
          ...createGameSaveReceipt({
            status: GAME_SAVE_RECEIPT_STATUS.BLOCKED,
            commandId,
            blockedReason: "CARE_TRANSITION_REQUIRED",
            errorCode: barrierError.code,
          }),
          eventId: getPersistentActivityLogDocId(payload),
        },
        remoteSucceeded: false,
        error: barrierError,
      };
    }
    const eventId = getPersistentActivityLogDocId(payload);
    let localRecordIsDurable = false;
    let activityOutboxRecord = null;

    if (outbox && eventId) {
      try {
        if (!canStartGameplayWrite(saveContext)) {
          return {
            receipt: {
              ...createGameSaveReceipt({
                status: GAME_SAVE_RECEIPT_STATUS.BLOCKED,
                commandId,
                blockedReason: resolveGameplayWriteBlockedReason({
                  currentUid: currentUser.uid,
                  currentSlotId: slotId,
                  currentGeneration: activeAccessRef.current?.generation,
                  saveContext,
                  isFirebaseAvailable,
                }),
              }),
              eventId,
            },
            remoteSucceeded: false,
          };
        }
        if (isFeedActivityLog(payload)) {
          await outbox.putFeedEvent({
            ...identity,
            eventId,
            occurredAt: payload.timestamp,
            eventType: "FEED",
            payload: buildFeedEventMetadata(payload),
          });
        }
        if (shouldPersistActivityLog(payload)) {
          activityOutboxRecord = await outbox.putActivityEvent({
            ...identity,
            eventId,
            occurredAt: payload.timestamp,
            eventType: payload.type,
            payload,
          });
        }
        localRecordIsDurable = true;
        await refreshOutboxStatus();
      } catch (error) {
        console.error("[appendLogToSubcollection] outbox 오류:", error);
        setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.UNAVAILABLE);
        setRecordSyncError(formatSyncError(error, "활동 기록 임시 저장에 실패했습니다."));
        setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      }
    }
    if (!shouldPersistActivityLog(payload)) {
      return {
        receipt: {
          ...createGameSaveReceipt({
            status: GAME_SAVE_RECEIPT_STATUS.SYNCED,
            commandId,
          }),
          eventId,
        },
        remoteSucceeded: true,
      };
    }
    if (!canStartGameplayWrite(saveContext)) {
      return {
        receipt: {
          ...createGameSaveReceipt({
            status: GAME_SAVE_RECEIPT_STATUS.BLOCKED,
            commandId,
            blockedReason: resolveGameplayWriteBlockedReason({
              currentUid: currentUser.uid,
              currentSlotId: slotId,
              currentGeneration: activeAccessRef.current?.generation,
              saveContext,
              isFirebaseAvailable,
            }),
          }),
          eventId,
        },
        remoteSucceeded: false,
      };
    }

    try {
      const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
      await setDoc(doc(collection(slotRef, "logs"), eventId), payload, { merge: true });
      let localCleanup = GAME_SAVE_LOCAL_CLEANUP.NOT_NEEDED;
      if (outbox && activityOutboxRecord) {
        try {
          const didDelete = await outbox.deleteActivityEvent({
            ...identity,
            eventId,
            recordVersion: activityOutboxRecord.recordVersion,
          });
          localCleanup = didDelete
            ? GAME_SAVE_LOCAL_CLEANUP.COMPLETE
            : GAME_SAVE_LOCAL_CLEANUP.FAILED;
        } catch (cleanupError) {
          localCleanup = GAME_SAVE_LOCAL_CLEANUP.FAILED;
          setRecordSyncError(formatSyncError(
            cleanupError,
            "원격 로그는 저장됐지만 이 기기의 대기 기록을 정리하지 못했습니다."
          ));
        }
      }
      setLastRecordSyncedAt(Date.now());
      if (localCleanup !== GAME_SAVE_LOCAL_CLEANUP.FAILED) setRecordSyncError("");
      await refreshOutboxStatus();
      return {
        receipt: {
          ...createGameSaveReceipt({
            status: GAME_SAVE_RECEIPT_STATUS.SYNCED,
            commandId,
            localCleanup,
          }),
          eventId,
        },
        remoteSucceeded: true,
      };
    } catch (error) {
      console.error("[appendLogToSubcollection] 오류:", error);
      setRecordSyncError(formatSyncError(error));
      setRecordSyncStatus(outbox ? GAME_RECORD_SYNC_STATUS.LOCAL : GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      return {
        receipt: {
          ...createGameSaveReceipt({
            status: localRecordIsDurable
              ? GAME_SAVE_RECEIPT_STATUS.QUEUED
              : GAME_SAVE_RECEIPT_STATUS.FAILED,
            commandId,
            errorCode: normalizeGameSaveErrorCode(error),
          }),
          eventId,
        },
        remoteSucceeded: false,
      };
    }
  }, [activeAccessRef, canStartGameplayWrite, currentUser, getOutboxIdentity, isFirebaseAvailable, outbox, refreshOutboxStatus, slotId]);

  const persistActivityLogReceipt = useCallback(async (input) => {
    const outcome = await persistActivityLogOperation(input);
    return outcome.receipt;
  }, [persistActivityLogOperation]);

  const appendLog = useCallback(async (logEntry) => {
    const outcome = await persistActivityLogOperation({
      logEntry,
      saveContext: captureSaveContext(),
    });
    if (!shouldPersistActivityLog(logEntry)) return;
    return outcome.remoteSucceeded;
  }, [captureSaveContext, persistActivityLogOperation]);

  const appendBattleLog = useCallback(async (entry) => {
    const saveContext = captureSaveContext();
    if (
      !slotId ||
      !currentUser ||
      !isFirebaseAvailable ||
      !entry?.mode ||
      !canStartGameplayWrite(saveContext)
    ) return false;
    const identity = getOutboxIdentity();
    if (!identity) return false;
    const payload = {
      ...buildPersistentBattleLogPayload(entry),
      slotInstanceId: identity.slotInstanceId,
      digimonInstanceId: identity.digimonInstanceId,
    };
    const eventId = payload.eventId;
    let battleOutboxRecord = null;
    if (outbox && eventId) {
      try {
        if (!canStartGameplayWrite(saveContext)) return false;
        battleOutboxRecord = await outbox.putBattleEvent({
          ...identity,
          eventId,
          occurredAt: payload.timestamp,
          eventType: "BATTLE",
          payload,
        });
        await refreshOutboxStatus();
      } catch (error) {
        console.error("[appendBattleLogToSubcollection] outbox 오류:", error);
        setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.UNAVAILABLE);
        setRecordSyncError(formatSyncError(error, "배틀 기록 임시 저장에 실패했습니다."));
        setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      }
    }
    if (!canStartGameplayWrite(saveContext)) return false;
    try {
      const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
      await setDoc(doc(collection(slotRef, "battleLogs"), eventId), payload, { merge: true });
      if (outbox && battleOutboxRecord) {
        await outbox.deleteBattleEvent({
          ...identity,
          eventId,
          recordVersion: battleOutboxRecord.recordVersion,
        });
      }
      setLastRecordSyncedAt(Date.now());
      setRecordSyncError("");
      await refreshOutboxStatus();
      return true;
    } catch (error) {
      console.error("[appendBattleLogToSubcollection] 오류:", error);
      setRecordSyncError(formatSyncError(error));
      setRecordSyncStatus(outbox ? GAME_RECORD_SYNC_STATUS.LOCAL : GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      return false;
    }
  }, [canStartGameplayWrite, captureSaveContext, currentUser, getOutboxIdentity, isFirebaseAvailable, outbox, refreshOutboxStatus, slotId]);

  const flushFeed = useCallback(async (slotRef) => {
    const identity = getOutboxIdentity();
    if (!outbox || !identity || !canStartGameplayWrite()) return;
    const feedEvents = await outbox.listFeedEvents(identity);
    const now = Date.now();
    const pendingEvents = feedEvents.filter(
      (event) =>
        event.syncStatus !== "synced" &&
        getFeedSummaryBucketEndAt(event.occurredAt) <= now
    );
    const bucketSizeMs = 15 * 60 * 1000;
    const buckets = new Map();
    pendingEvents.forEach((event) => {
      const bucketStartAt = Math.floor(event.occurredAt / bucketSizeMs) * bucketSizeMs;
      buckets.set(bucketStartAt, [...(buckets.get(bucketStartAt) || []), event]);
    });

    let syncedCount = 0;
    for (const [bucketStartAt, events] of buckets.entries()) {
      if (!canStartGameplayWrite()) return syncedCount;
      const eventId = `feed-summary:${bucketStartAt}`;
      const summaryRef = doc(collection(slotRef, "logs"), eventId);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(summaryRef);
        const update = buildFeedSummaryUpdate({
          existing: snapshot.exists() ? snapshot.data() : {},
          events,
          bucketStartAt,
          bucketSizeMs,
        });
        if (update) {
          transaction.set(summaryRef, {
            ...update.payload,
            slotInstanceId: identity.slotInstanceId,
            digimonInstanceId: identity.digimonInstanceId,
          }, { merge: true });
        }
      });

      for (const event of events) {
        if (!canStartGameplayWrite()) return syncedCount;
        await outbox.putFeedEvent({
          ...identity,
          eventId: event.eventId,
          occurredAt: event.occurredAt,
          eventType: event.eventType,
          payload: event.payload,
          feedQuantity: event.feedQuantity,
          syncStatus: "synced",
          syncedAt: Date.now(),
        });
        syncedCount += 1;
      }
    }
    await outbox.pruneSyncedFeedEvents(identity);
    return syncedCount;
  }, [canStartGameplayWrite, getOutboxIdentity, outbox]);

  const flushOutboxInternal = useCallback(async () => {
    const identity = getOutboxIdentity();
    if (!canStartGameplayWrite(null, { allowCareTransition: true })) return false;
    if (!outbox || !identity || !isFirebaseAvailable) {
      if (!outbox) {
        setStateSyncStatus(GAME_SYNC_STATUS.UNAVAILABLE);
        setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      }
      return !outbox;
    }
    const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
    let hasConflict = false;
    let stateRecord = null;
    let syncedRecordCount = 0;
    try {
      if (outbox.getNextTransition) {
        const transitionResult = await flushTransitionQueueInternal();
        syncedRecordCount += transitionResult.syncedCount || 0;
        if (transitionResult.status === "conflict") {
          setStateSyncStatus(GAME_SYNC_STATUS.CONFLICT);
          setStateSyncError("케어미스 전이 충돌을 해결해야 합니다.");
          return false;
        }
        if (transitionResult.status === "queued") {
          setStateSyncStatus(GAME_SYNC_STATUS.LOCAL);
          if (transitionResult.error) setStateSyncError(formatSyncError(transitionResult.error));
          return false;
        }
      }
      stateRecord = await outbox.getStateMutation(identity);
      if (stateRecord && conflictRef.current) {
        hasConflict = true;
      } else if (
        stateRecord &&
        cleanupFailedMutationIdsRef.current.has(stateRecord.mutationId)
      ) {
        setStateSyncError("원격 저장은 완료됐지만 이 기기의 이전 대기 항목을 정리하지 못했습니다.");
        setStateSyncStatus(GAME_SYNC_STATUS.LOCAL);
      } else if (stateRecord) {
        hasConflict = !(await commitStateRecord(stateRecord));
      }
      if (hasConflict || conflictRef.current) return false;

      const activityEvents = await outbox.listActivityEvents(identity);
      for (const event of activityEvents) {
        if (!canStartGameplayWrite()) return false;
        await setDoc(doc(collection(slotRef, "logs"), event.eventId), event.payload, { merge: true });
        await outbox.deleteActivityEvent({
          ...identity,
          eventId: event.eventId,
          recordVersion: event.recordVersion,
        });
        syncedRecordCount += 1;
      }
      const battleEvents = await outbox.listBattleEvents(identity);
      for (const event of battleEvents) {
        if (!canStartGameplayWrite()) return false;
        await setDoc(doc(collection(slotRef, "battleLogs"), event.eventId), event.payload, { merge: true });
        await outbox.deleteBattleEvent({
          ...identity,
          eventId: event.eventId,
          recordVersion: event.recordVersion,
        });
        syncedRecordCount += 1;
      }
      syncedRecordCount += await flushFeed(slotRef) || 0;
      if (syncedRecordCount > 0) {
        setLastRecordSyncedAt(Date.now());
        setRecordSyncError("");
      }
      if (!hasConflict) await refreshOutboxStatus();
      return true;
    } catch (error) {
      console.warn("[GameOutbox] 재전송 실패:", error);
      const message = formatSyncError(error);
      if (stateRecord) setStateSyncError(message);
      setRecordSyncError(message);
      try {
        await refreshOutboxStatus();
      } catch (_statusError) {
        setStateSyncStatus(GAME_SYNC_STATUS.UNAVAILABLE);
        setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      }
      return false;
    }
  }, [canStartGameplayWrite, commitStateRecord, currentUser, flushFeed, flushTransitionQueueInternal, getOutboxIdentity, isFirebaseAvailable, outbox, refreshOutboxStatus, slotId]);

  const flushOutbox = useCallback(
    () => saveQueue.enqueue(flushOutboxInternal),
    [flushOutboxInternal, saveQueue]
  );

  const { retryAt } = useGameOutboxSync({
    enabled: Boolean(
      slotId &&
      currentUser?.uid &&
      isFirebaseAvailable &&
      activeAccessRef.current?.phase === GAME_PERSISTENCE_PHASE.READY &&
      !syncConflict
    ),
    isLoadingSlot,
    flushOutbox,
    nextFlushAt: nextRecordSyncAt,
  });

  const resolveSyncConflict = useCallback(async (choice) => {
    const conflict = conflictRef.current;
    if (!conflict || !currentUser?.uid || !slotId) return false;
    if (choice !== "server") return false;
    if (!isCurrentConflictIdentity({
      conflict,
      access: activeAccessRef.current,
      currentUid: currentUser.uid,
      currentSlotId: slotId,
    })) return false;

    const recoveringConflict = {
      ...conflict,
      recoveryResult: "recovering",
      errorCode: null,
    };
    conflictRef.current = recoveringConflict;
    setSyncConflict(recoveringConflict);
    changePersistenceAccess({ phase: GAME_PERSISTENCE_PHASE.RECOVERING });

    return saveQueue.enqueue(async () => {
      const isRecoveryCurrent = () => isCurrentConflictIdentity({
        conflict: conflictRef.current,
        access: activeAccessRef.current,
        currentUid: currentUser.uid,
        currentSlotId: slotId,
      });
      const assertRecoveryCurrent = () => {
        if (isRecoveryCurrent()) return;
        const staleError = new Error("현재 슬롯과 충돌 정보가 일치하지 않습니다.");
        staleError.code = "game/stale-conflict";
        throw staleError;
      };

      try {
        const activeConflict = conflictRef.current;
        const recoveryIdentity = getOutboxIdentity();
        if (!recoveryIdentity) {
          const identityError = new Error("현재 슬롯의 저장 identity를 확인할 수 없습니다.");
          identityError.code = "game/stale-conflict";
          throw identityError;
        }
        assertRecoveryCurrent();

        const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
        const latestSnapshot = await getDoc(slotRef);
        assertRecoveryCurrent();
        if (!latestSnapshot.exists()) {
          const notFoundError = new Error("서버 슬롯을 찾을 수 없습니다.");
          notFoundError.code = "SLOT_NOT_FOUND";
          throw notFoundError;
        }
        const latestServerData = latestSnapshot.data() || {};
        revisionRef.current = normalizeGameRevision(latestServerData.revision);

        if (outbox) {
          const pendingState = await outbox.getStateMutation(recoveryIdentity);
          assertRecoveryCurrent();
          if (pendingState) {
            if (
              activeConflict.mutationId &&
              pendingState.mutationId !== activeConflict.mutationId
            ) {
              const mismatchError = new Error("현재 pending 상태가 충돌 정보와 일치하지 않습니다.");
              mismatchError.code = "game/pending-identity-mismatch";
              throw mismatchError;
            }
            const didDelete = await outbox.deleteStateMutation({
              ...recoveryIdentity,
              mutationId: pendingState.mutationId,
              recordVersion: pendingState.recordVersion,
            });
            const remainingState = await outbox.getStateMutation(recoveryIdentity);
            assertRecoveryCurrent();
            if (!didDelete || remainingState) {
              const deleteError = new Error("이 기기의 미전송 게임 상태를 정리하지 못했습니다.");
              deleteError.code = "game/pending-delete-failed";
              throw deleteError;
            }
          }
        }

        assertRecoveryCurrent();
        setStateSyncError("");
        if (typeof reloadPage === "function") reloadPage();
        else window.location.reload();
        return true;
      } catch (error) {
        if (isRecoveryCurrent()) {
          const failedConflict = {
            ...conflictRef.current,
            recoveryResult: "failed",
            errorCode: error?.code || "UNKNOWN",
          };
          conflictRef.current = failedConflict;
          setSyncConflict(failedConflict);
          changePersistenceAccess({ phase: GAME_PERSISTENCE_PHASE.READY });
          setStateSyncError(formatSyncError(error, "서버 상태 복구에 실패했습니다."));
        }
        throw error;
      }
    });
  }, [
    activeAccessRef,
    changePersistenceAccess,
    currentUser,
    getOutboxIdentity,
    outbox,
    reloadPage,
    saveQueue,
    slotId,
  ]);

  const refreshGameRevision = useCallback(async (statsSnapshot = null) => {
    if (!slotId || !currentUser?.uid || !isFirebaseAvailable) return null;
    const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
    const snapshot = await getDoc(slotRef);
    const slotData = snapshot.exists() ? snapshot.data() : {};
    const revision = normalizeGameRevision(slotData.revision);
    revisionRef.current = revision;
    lastSyncedStatsRef.current = statsSnapshot || normalizeStats(slotData.digimonStats || {});
    setStateSyncStatus(GAME_SYNC_STATUS.SYNCED);
    setNextStateSyncAt(getNextStateSyncAt());
    return revision;
  }, [currentUser?.uid, isFirebaseAvailable, normalizeStats, slotId]);

  const setLoadedRevision = useCallback((revision, statsSnapshot) => {
    revisionRef.current = revision == null ? null : normalizeGameRevision(revision);
    activeAccessRef.current = {
      ...activeAccessRef.current,
      loadedRevision: revisionRef.current,
    };
    lastSyncedStatsRef.current = statsSnapshot || null;
    setStateSyncStatus(GAME_SYNC_STATUS.SYNCED);
    setNextStateSyncAt(getNextStateSyncAt());
  }, [activeAccessRef]);

  const getPendingState = useCallback(async () => {
    const identity = getOutboxIdentity();
    if (!outbox || !identity) return null;
    try {
      const pendingState = await outbox.getStateMutation(identity);
      setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.AVAILABLE);
      if (pendingState) setStateSyncStatus(GAME_SYNC_STATUS.LOCAL);
      return pendingState;
    } catch (error) {
      setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.UNAVAILABLE);
      throw error;
    }
  }, [getOutboxIdentity, outbox]);

  const getPendingActivityLogs = useCallback(async () => {
    const identity = getOutboxIdentity();
    if (!outbox || !identity || typeof outbox.listActivityEvents !== "function") return [];
    const events = await outbox.listActivityEvents(identity);
    return events
      .map((event) => event?.payload)
      .filter((payload) => payload && typeof payload === "object");
  }, [getOutboxIdentity, outbox]);

  const getPendingCareTransitions = useCallback(async () => {
    const identity = getOutboxIdentity();
    if (!outbox || !identity || typeof outbox.listTransitions !== "function") return [];
    const records = await outbox.listTransitions(identity);
    return records.filter((record) =>
      (record.status === TRANSITION_STATUS.PENDING ||
        record.status === TRANSITION_STATUS.BLOCKED) &&
      record.transition?.transitionType
    );
  }, [getOutboxIdentity, outbox]);

  const clearDigimonLifeOutbox = useCallback(async ({
    slotInstanceId,
    digimonInstanceId,
  } = {}) => {
    if (
      !outbox ||
      !currentUser?.uid ||
      slotId == null ||
      !slotInstanceId ||
      !digimonInstanceId
    ) {
      return 0;
    }
    return outbox.clearDigimonLifeRecords({
      uid: currentUser.uid,
      slotId,
      slotInstanceId,
      digimonInstanceId,
    });
  }, [currentUser?.uid, outbox, slotId]);

  const getLatestStateSnapshot = useCallback(async (saveContext = null) => {
    if (!canStartGameplayWrite(saveContext)) return null;
    let pendingState = null;
    const identity = getOutboxIdentity();
    if (outbox && identity) {
      pendingState = await outbox.getStateMutation(identity);
    }
    if (!canStartGameplayWrite(saveContext)) return null;
    return {
      statsSnapshot:
        pendingState?.state?.stateSnapshot ||
        lastSyncedStatsRef.current ||
        digimonStats ||
        {},
      pendingState,
    };
  }, [canStartGameplayWrite, digimonStats, getOutboxIdentity, outbox]);

  const clearPendingStateAfterHydration = useCallback(async (record, { generation } = {}) => {
    const identity = getOutboxIdentity();
    if (!record || !record.recordVersion || !outbox || !identity) return false;
    const access = activeAccessRef.current;
    const isCurrentLoad =
      access?.phase === GAME_PERSISTENCE_PHASE.LOADING &&
      access.generation === generation &&
      (!record.uid || record.uid === currentUser.uid) &&
      (record.slotId == null || String(record.slotId) === String(slotId)) &&
      record.slotInstanceId === identity.slotInstanceId &&
      record.digimonInstanceId === identity.digimonInstanceId;
    if (!isCurrentLoad) return false;

    try {
      const didDelete = await outbox.deleteStateMutation({
        ...identity,
        mutationId: record.mutationId,
        recordVersion: record.recordVersion,
      });
      const remainingState = await outbox.getStateMutation(identity);
      if (!didDelete || remainingState?.recordVersion === record.recordVersion) {
        const deleteError = new Error("동일한 로컬 pending 상태를 정리하지 못했습니다.");
        deleteError.code = "game/pending-cleanup-failed";
        throw deleteError;
      }
      setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.AVAILABLE);
      return true;
    } catch (error) {
      setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.UNAVAILABLE);
      throw error;
    }
  }, [activeAccessRef, currentUser?.uid, getOutboxIdentity, outbox, slotId]);

  return {
    appendBattleLog,
    appendLog,
    canStartGameplayWrite,
    captureSaveContext,
    clearDigimonLifeOutbox,
    clearPendingStateAfterHydration,
    flushOutbox,
    getLatestStateSnapshot,
    getPendingState,
    getPendingActivityLogs,
    getPendingCareTransitions,
    persistStateSnapshot,
    persistStateSnapshotReceipt,
    persistEvolutionTransitionReceipt,
    persistActivityLogReceipt,
    quarantinePendingState,
    refreshGameRevision,
    resolveSyncConflict,
    setLoadedRevision,
    syncConflict,
    nextRecordSyncAt,
    nextStateSyncAt,
    pendingRecordCount,
    pendingSaveCount,
    oldestPendingAt,
    recordSyncStatus,
    retryAt,
    lastStateSyncedAt,
    lastRecordSyncedAt,
    stateSyncError,
    recordSyncError,
    stateSyncStatus,
    localPersistenceStatus,
  };
}
