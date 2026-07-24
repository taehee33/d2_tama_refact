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
import { buildActivityLogEventId } from "../../utils/activityLogEventId";
import {
  buildPersistentActivityLogPayload,
  getPersistentActivityLogDocId,
  isFeedActivityLog,
  shouldPersistActivityLog,
} from "../../utils/activityLogPersistence";
import { buildPersistentBattleLogPayload } from "../../utils/battleLogPersistence";
import { toEpochMs } from "../../utils/time";
import { useGameOutboxSync } from "../game-runtime/useGameOutboxSync";
import {
  getFeedSummaryBucketEndAt,
  getNextStateSyncAt,
} from "../game-runtime/gameSyncSchedule";

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
} = {}) {
  if (access?.phase !== GAME_PERSISTENCE_PHASE.READY || hasConflict) return false;
  if (loadedRevision == null) return false;
  if (!access?.loadedIdentity?.uid || access.loadedIdentity.slotId == null) return false;
  if (access.loadedIdentity.uid !== currentUid) return false;
  if (String(access.loadedIdentity.slotId) !== String(currentSlotId)) return false;
  if (!saveContext) return true;
  return saveContext.uid === currentUid &&
    String(saveContext.slotId) === String(currentSlotId) &&
    saveContext.generation === access.generation;
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
    identity.generation === access.generation
  );
}

const OUTBOX_SCHEMA_VERSION = 1;

function formatSyncError(error, fallback = "알 수 없는 동기화 오류") {
  const message = String(error?.message || error || fallback).trim();
  return message || fallback;
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

  const captureSaveContext = useCallback(() => ({
    uid: currentUser?.uid ?? null,
    slotId,
    generation: activeAccessRef.current?.generation,
    requestedAtRevision: revisionRef.current,
  }), [activeAccessRef, currentUser?.uid, slotId]);

  const canStartGameplayWrite = useCallback((saveContext = null) =>
    canUseGameplayPersistence({
      access: activeAccessRef.current,
      currentUid: currentUser?.uid,
      currentSlotId: slotId,
      saveContext,
      loadedRevision: revisionRef.current,
      hasConflict: Boolean(conflictRef.current),
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
    setLastStateSyncedAt(null);
    setLastRecordSyncedAt(null);
    setStateSyncError("");
    setRecordSyncError("");
    conflictRef.current = null;
    setSyncConflict(null);
  }, [currentUser?.uid, outbox, slotId]);

  const refreshOutboxStatus = useCallback(async () => {
    if (!outbox || !currentUser?.uid || !slotId) {
      setStateSyncStatus(GAME_SYNC_STATUS.UNAVAILABLE);
      setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      return GAME_SYNC_STATUS.UNAVAILABLE;
    }
    if (conflictRef.current) {
      setStateSyncStatus(GAME_SYNC_STATUS.CONFLICT);
      return GAME_SYNC_STATUS.CONFLICT;
    }

    const [stateRecord, activityEvents, battleEvents, feedEvents] = await Promise.all([
      outbox.getStateMutation({ uid: currentUser.uid, slotId }),
      outbox.listActivityEvents({ uid: currentUser.uid, slotId }),
      outbox.listBattleEvents({ uid: currentUser.uid, slotId }),
      outbox.listFeedEvents({ uid: currentUser.uid, slotId }),
    ]);
    const pendingFeedEvents = feedEvents.filter((event) => event.syncStatus !== "synced");
    const recordCount = activityEvents.length + battleEvents.length + pendingFeedEvents.length;
    setStateSyncStatus(stateRecord ? GAME_SYNC_STATUS.LOCAL : GAME_SYNC_STATUS.SYNCED);
    if (!stateRecord) setStateSyncError("");
    setPendingRecordCount(recordCount);
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
    return stateRecord ? GAME_SYNC_STATUS.LOCAL : GAME_SYNC_STATUS.SYNCED;
  }, [currentUser?.uid, outbox, slotId]);

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

  const commitStateRecord = useCallback(async (record) => {
    if (
      !record ||
      !currentUser?.uid ||
      !slotId ||
      !isFirebaseAvailable ||
      !canStartGameplayWrite()
    ) return false;
    const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
    const stateEnvelope = record.state || {};
    const localSnapshot = stateEnvelope.stateSnapshot || {};

    try {
      const result = await commitRevisionedSlot({
        db,
        slotRef,
        baseRevision: stateEnvelope.baseRevision,
        updateData: buildUpdateDataForSnapshot(localSnapshot, record.updatedAt),
        runTransaction,
      });
      revisionRef.current = result.revision;
      lastSyncedStatsRef.current = localSnapshot;
      setLastStateSyncedAt(Date.now());
      setStateSyncError("");
      setStateSyncStatus(GAME_SYNC_STATUS.SYNCED);
      setNextStateSyncAt(getNextStateSyncAt());
      if (outbox) {
        await outbox.deleteStateMutation({
          uid: currentUser.uid,
          slotId,
          mutationId: record.mutationId,
        });
      }
      conflictRef.current = null;
      setSyncConflict(null);
      await refreshOutboxStatus();
      return true;
    } catch (commitError) {
      if (!(commitError instanceof GameRevisionConflictError)) {
        setStateSyncError(formatSyncError(commitError));
        setStateSyncStatus(outbox ? GAME_SYNC_STATUS.LOCAL : GAME_SYNC_STATUS.UNAVAILABLE);
        throw commitError;
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
        return holdRevisionConflict(record, commitError);
      }

      const replayedSnapshot = {
        ...remoteRootFields,
        ...replayResult.stats,
        selectedDigimon:
          commitError.remoteData?.selectedDigimon ||
          replayResult.stats?.selectedDigimon ||
          selectedDigimon || null,
      };
      const replayCommit = await commitRevisionedSlot({
        db,
        slotRef,
        baseRevision: commitError.actualRevision,
        updateData: buildUpdateDataForSnapshot(replayedSnapshot),
        runTransaction,
      });
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
      if (outbox) {
        await outbox.deleteStateMutation({
          uid: currentUser.uid,
          slotId,
          mutationId: record.mutationId,
        });
      }
      conflictRef.current = null;
      setSyncConflict(null);
      await refreshOutboxStatus();
      return true;
    }
  }, [
    buildUpdateDataForSnapshot,
    canStartGameplayWrite,
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

  const queueStateSnapshot = useCallback(async ({ statsSnapshot, updatedLogs, nowMs, saveContext }) => {
    if (!outbox || !currentUser?.uid || !slotId || !canStartGameplayWrite(saveContext)) return null;
    const existing = await outbox.getStateMutation({ uid: currentUser.uid, slotId });
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

    if (!canStartGameplayWrite(saveContext)) return null;
    return outbox.putStateMutation({
      uid: currentUser.uid,
      slotId,
      mutationId: createMutationId(nowMs),
      updatedAt: nowMs,
      queuedAt: existing?.queuedAt ?? nowMs,
      state: {
        schemaVersion: OUTBOX_SCHEMA_VERSION,
        baseRevision: existing?.state?.baseRevision ?? revisionRef.current,
        stateSnapshot: statsSnapshot,
        actions,
        hasUnreplayableChanges: Boolean(
          existing?.state?.hasUnreplayableChanges ||
          (updatedLogs ? nextActions.length === 0 || nextActions.some((action) => !action.safe) : true)
        ),
      },
    });
  }, [activityLogs, canStartGameplayWrite, currentUser, digimonStats, outbox, slotId]);

  const persistStateSnapshot = useCallback(async ({ statsSnapshot, updatedLogs, nowMs, saveContext }) => {
    if (!canStartGameplayWrite(saveContext)) return false;
    setStateSyncStatus(GAME_SYNC_STATUS.SAVING);
    let record = null;
    if (outbox && currentUser?.uid && slotId) {
      try {
        record = await queueStateSnapshot({ statsSnapshot, updatedLogs, nowMs, saveContext });
        setStateSyncStatus(GAME_SYNC_STATUS.LOCAL);
      } catch (error) {
        console.error("로컬 outbox 저장 오류:", error);
        setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.UNAVAILABLE);
        setStateSyncError(formatSyncError(error, "이 기기의 임시 저장소를 사용할 수 없습니다."));
        setStateSyncStatus(GAME_SYNC_STATUS.UNAVAILABLE);
      }
    }

    const recordToCommit = record || {
      mutationId: createMutationId(nowMs),
      updatedAt: nowMs,
      state: {
        schemaVersion: OUTBOX_SCHEMA_VERSION,
        baseRevision: revisionRef.current,
        stateSnapshot: statsSnapshot,
        actions: [],
        hasUnreplayableChanges: true,
      },
    };
    return commitStateRecord(recordToCommit);
  }, [canStartGameplayWrite, commitStateRecord, currentUser?.uid, outbox, queueStateSnapshot, slotId]);

  const appendLog = useCallback(async (logEntry) => {
    const saveContext = captureSaveContext();
    if (
      !slotId ||
      !currentUser ||
      !isFirebaseAvailable ||
      !logEntry?.type ||
      !canStartGameplayWrite(saveContext)
    ) return false;
    const payload = buildPersistentActivityLogPayload({
      ...logEntry,
      timestamp: toEpochMs(logEntry?.timestamp) ?? Date.now(),
    });
    const eventId = getPersistentActivityLogDocId(payload);

    if (outbox && eventId) {
      try {
        if (!canStartGameplayWrite(saveContext)) return false;
        if (isFeedActivityLog(payload)) {
          await outbox.putFeedEvent({
            uid: currentUser.uid,
            slotId,
            eventId,
            occurredAt: payload.timestamp,
            eventType: "FEED",
            payload: buildFeedEventMetadata(payload),
          });
        }
        if (shouldPersistActivityLog(payload)) {
          await outbox.putActivityEvent({
            uid: currentUser.uid,
            slotId,
            eventId,
            occurredAt: payload.timestamp,
            eventType: payload.type,
            payload,
          });
        }
        await refreshOutboxStatus();
      } catch (error) {
        console.error("[appendLogToSubcollection] outbox 오류:", error);
        setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.UNAVAILABLE);
        setRecordSyncError(formatSyncError(error, "활동 기록 임시 저장에 실패했습니다."));
        setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      }
    }
    if (!shouldPersistActivityLog(payload)) return;
    if (!canStartGameplayWrite(saveContext)) return false;

    try {
      const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
      await setDoc(doc(collection(slotRef, "logs"), eventId), payload, { merge: true });
      if (outbox) {
        await outbox.deleteActivityEvent({ uid: currentUser.uid, slotId, eventId });
      }
      setLastRecordSyncedAt(Date.now());
      setRecordSyncError("");
      await refreshOutboxStatus();
      return true;
    } catch (error) {
      console.error("[appendLogToSubcollection] 오류:", error);
      setRecordSyncError(formatSyncError(error));
      setRecordSyncStatus(outbox ? GAME_RECORD_SYNC_STATUS.LOCAL : GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      return false;
    }
  }, [canStartGameplayWrite, captureSaveContext, currentUser, isFirebaseAvailable, outbox, refreshOutboxStatus, slotId]);

  const appendBattleLog = useCallback(async (entry) => {
    const saveContext = captureSaveContext();
    if (
      !slotId ||
      !currentUser ||
      !isFirebaseAvailable ||
      !entry?.mode ||
      !canStartGameplayWrite(saveContext)
    ) return false;
    const payload = buildPersistentBattleLogPayload(entry);
    const eventId = payload.eventId;
    if (outbox && eventId) {
      try {
        if (!canStartGameplayWrite(saveContext)) return false;
        await outbox.putBattleEvent({
          uid: currentUser.uid,
          slotId,
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
      if (outbox) {
        await outbox.deleteBattleEvent({ uid: currentUser.uid, slotId, eventId });
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
  }, [canStartGameplayWrite, captureSaveContext, currentUser, isFirebaseAvailable, outbox, refreshOutboxStatus, slotId]);

  const flushFeed = useCallback(async (slotRef) => {
    if (!outbox || !currentUser?.uid || !slotId || !canStartGameplayWrite()) return;
    const feedEvents = await outbox.listFeedEvents({ uid: currentUser.uid, slotId });
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
        if (update) transaction.set(summaryRef, update.payload, { merge: true });
      });

      for (const event of events) {
        if (!canStartGameplayWrite()) return syncedCount;
        await outbox.putFeedEvent({
          uid: currentUser.uid,
          slotId,
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
    await outbox.pruneSyncedFeedEvents({ uid: currentUser.uid, slotId });
    return syncedCount;
  }, [canStartGameplayWrite, currentUser, outbox, slotId]);

  const flushOutboxInternal = useCallback(async () => {
    if (!canStartGameplayWrite()) return false;
    if (!outbox || !currentUser?.uid || !slotId || !isFirebaseAvailable) {
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
      stateRecord = await outbox.getStateMutation({ uid: currentUser.uid, slotId });
      if (stateRecord && conflictRef.current) {
        hasConflict = true;
      } else if (stateRecord) {
        hasConflict = !(await commitStateRecord(stateRecord));
      }

      const activityEvents = await outbox.listActivityEvents({ uid: currentUser.uid, slotId });
      for (const event of activityEvents) {
        if (!canStartGameplayWrite()) return false;
        await setDoc(doc(collection(slotRef, "logs"), event.eventId), event.payload, { merge: true });
        await outbox.deleteActivityEvent({ uid: currentUser.uid, slotId, eventId: event.eventId });
        syncedRecordCount += 1;
      }
      const battleEvents = await outbox.listBattleEvents({ uid: currentUser.uid, slotId });
      for (const event of battleEvents) {
        if (!canStartGameplayWrite()) return false;
        await setDoc(doc(collection(slotRef, "battleLogs"), event.eventId), event.payload, { merge: true });
        await outbox.deleteBattleEvent({ uid: currentUser.uid, slotId, eventId: event.eventId });
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
  }, [canStartGameplayWrite, commitStateRecord, currentUser, flushFeed, isFirebaseAvailable, outbox, refreshOutboxStatus, slotId]);

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
          const pendingState = await outbox.getStateMutation({
            uid: currentUser.uid,
            slotId,
          });
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
              uid: currentUser.uid,
              slotId,
              mutationId: pendingState.mutationId,
            });
            const remainingState = await outbox.getStateMutation({
              uid: currentUser.uid,
              slotId,
            });
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
    if (!outbox || !currentUser?.uid || !slotId) return null;
    try {
      const pendingState = await outbox.getStateMutation({ uid: currentUser.uid, slotId });
      setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.AVAILABLE);
      if (pendingState) setStateSyncStatus(GAME_SYNC_STATUS.LOCAL);
      return pendingState;
    } catch (error) {
      setLocalPersistenceStatus(LOCAL_PERSISTENCE_STATUS.UNAVAILABLE);
      throw error;
    }
  }, [currentUser?.uid, outbox, slotId]);

  const clearPendingStateAfterHydration = useCallback(async (record, { generation } = {}) => {
    if (!record || !outbox || !currentUser?.uid || !slotId) return false;
    const access = activeAccessRef.current;
    const isCurrentLoad =
      access?.phase === GAME_PERSISTENCE_PHASE.LOADING &&
      access.generation === generation &&
      (!record.uid || record.uid === currentUser.uid) &&
      (record.slotId == null || String(record.slotId) === String(slotId));
    if (!isCurrentLoad) return false;

    try {
      const didDelete = await outbox.deleteStateMutation({
        uid: currentUser.uid,
        slotId,
        mutationId: record.mutationId,
      });
      const remainingState = await outbox.getStateMutation({ uid: currentUser.uid, slotId });
      if (!didDelete || remainingState?.mutationId === record.mutationId) {
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
  }, [activeAccessRef, currentUser?.uid, outbox, slotId]);

  return {
    appendBattleLog,
    appendLog,
    canStartGameplayWrite,
    captureSaveContext,
    clearPendingStateAfterHydration,
    flushOutbox,
    getPendingState,
    persistStateSnapshot,
    quarantinePendingState,
    refreshGameRevision,
    resolveSyncConflict,
    setLoadedRevision,
    syncConflict,
    nextRecordSyncAt,
    nextStateSyncAt,
    pendingRecordCount,
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
