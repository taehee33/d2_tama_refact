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

const OUTBOX_SCHEMA_VERSION = 1;

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
  setSelectedDigimon,
  setIsLightsOn,
  setWakeUntil,
  buildUpdateDataForSnapshot,
  normalizeStats,
  saveQueue,
  outboxOverride,
}) {
  const [stateSyncStatus, setStateSyncStatus] = useState(GAME_SYNC_STATUS.SYNCED);
  const [recordSyncStatus, setRecordSyncStatus] = useState(GAME_RECORD_SYNC_STATUS.SYNCED);
  const [nextStateSyncAt, setNextStateSyncAt] = useState(null);
  const [nextRecordSyncAt, setNextRecordSyncAt] = useState(null);
  const [pendingRecordCount, setPendingRecordCount] = useState(0);
  const [syncConflict, setSyncConflict] = useState(null);
  const [outbox] = useState(() => {
    if (outboxOverride !== undefined) return outboxOverride;
    try {
      return createIndexedDbOutbox();
    } catch (_error) {
      return null;
    }
  });
  const revisionRef = useRef(0);
  const lastSyncedStatsRef = useRef(null);
  const conflictRef = useRef(null);

  useEffect(() => {
    if (!outbox) {
      setStateSyncStatus(GAME_SYNC_STATUS.UNAVAILABLE);
      setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
    }
  }, [outbox]);

  useEffect(() => {
    setStateSyncStatus(outbox ? GAME_SYNC_STATUS.SYNCED : GAME_SYNC_STATUS.UNAVAILABLE);
    setRecordSyncStatus(outbox ? GAME_RECORD_SYNC_STATUS.SYNCED : GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
    setNextStateSyncAt(null);
    setNextRecordSyncAt(null);
    setPendingRecordCount(0);
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
    setPendingRecordCount(recordCount);
    if (activityEvents.length || battleEvents.length) {
      setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.LOCAL);
    } else if (pendingFeedEvents.length) {
      setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.FEED_PENDING);
    } else {
      setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.SYNCED);
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
    };
    conflictRef.current = conflict;
    setSyncConflict(conflict);
    setStateSyncStatus(GAME_SYNC_STATUS.CONFLICT);
    return false;
  }, []);

  const commitStateRecord = useCallback(async (record) => {
    if (!record || !currentUser?.uid || !slotId || !isFirebaseAvailable) return false;
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

  const queueStateSnapshot = useCallback(async ({ statsSnapshot, updatedLogs, nowMs }) => {
    if (!outbox || !currentUser?.uid || !slotId) return null;
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
  }, [activityLogs, currentUser, digimonStats, outbox, slotId]);

  const persistStateSnapshot = useCallback(async ({ statsSnapshot, updatedLogs, nowMs }) => {
    setStateSyncStatus(GAME_SYNC_STATUS.SAVING);
    let record = null;
    if (outbox && currentUser?.uid && slotId) {
      try {
        record = await queueStateSnapshot({ statsSnapshot, updatedLogs, nowMs });
        setStateSyncStatus(GAME_SYNC_STATUS.LOCAL);
      } catch (error) {
        console.error("로컬 outbox 저장 오류:", error);
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
  }, [commitStateRecord, currentUser?.uid, outbox, queueStateSnapshot, slotId]);

  const appendLog = useCallback(async (logEntry) => {
    if (!slotId || !currentUser || !isFirebaseAvailable || !logEntry?.type) return;
    const payload = buildPersistentActivityLogPayload({
      ...logEntry,
      timestamp: toEpochMs(logEntry?.timestamp) ?? Date.now(),
    });
    const eventId = getPersistentActivityLogDocId(payload);

    if (outbox && eventId) {
      try {
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
        setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      }
    }
    if (!shouldPersistActivityLog(payload)) return;

    try {
      const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
      await setDoc(doc(collection(slotRef, "logs"), eventId), payload, { merge: true });
      if (outbox) {
        await outbox.deleteActivityEvent({ uid: currentUser.uid, slotId, eventId });
      }
      await refreshOutboxStatus();
      return true;
    } catch (error) {
      console.error("[appendLogToSubcollection] 오류:", error);
      setRecordSyncStatus(outbox ? GAME_RECORD_SYNC_STATUS.LOCAL : GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      return false;
    }
  }, [currentUser, isFirebaseAvailable, outbox, refreshOutboxStatus, slotId]);

  const appendBattleLog = useCallback(async (entry) => {
    if (!slotId || !currentUser || !isFirebaseAvailable || !entry?.mode) return;
    const payload = buildPersistentBattleLogPayload(entry);
    const eventId = payload.eventId;
    if (outbox && eventId) {
      try {
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
        setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      }
    }
    try {
      const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
      await setDoc(doc(collection(slotRef, "battleLogs"), eventId), payload, { merge: true });
      if (outbox) {
        await outbox.deleteBattleEvent({ uid: currentUser.uid, slotId, eventId });
      }
      await refreshOutboxStatus();
      return true;
    } catch (error) {
      console.error("[appendBattleLogToSubcollection] 오류:", error);
      setRecordSyncStatus(outbox ? GAME_RECORD_SYNC_STATUS.LOCAL : GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      return false;
    }
  }, [currentUser, isFirebaseAvailable, outbox, refreshOutboxStatus, slotId]);

  const flushFeed = useCallback(async (slotRef) => {
    if (!outbox || !currentUser?.uid || !slotId) return;
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

    for (const [bucketStartAt, events] of buckets.entries()) {
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
      }
    }
    await outbox.pruneSyncedFeedEvents({ uid: currentUser.uid, slotId });
  }, [currentUser, outbox, slotId]);

  const flushOutboxInternal = useCallback(async () => {
    if (!outbox || !currentUser?.uid || !slotId || !isFirebaseAvailable) {
      if (!outbox) {
        setStateSyncStatus(GAME_SYNC_STATUS.UNAVAILABLE);
        setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      }
      return !outbox;
    }
    const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
    let hasConflict = false;
    try {
      const stateRecord = await outbox.getStateMutation({ uid: currentUser.uid, slotId });
      if (stateRecord) hasConflict = !(await commitStateRecord(stateRecord));

      const activityEvents = await outbox.listActivityEvents({ uid: currentUser.uid, slotId });
      for (const event of activityEvents) {
        await setDoc(doc(collection(slotRef, "logs"), event.eventId), event.payload, { merge: true });
        await outbox.deleteActivityEvent({ uid: currentUser.uid, slotId, eventId: event.eventId });
      }
      const battleEvents = await outbox.listBattleEvents({ uid: currentUser.uid, slotId });
      for (const event of battleEvents) {
        await setDoc(doc(collection(slotRef, "battleLogs"), event.eventId), event.payload, { merge: true });
        await outbox.deleteBattleEvent({ uid: currentUser.uid, slotId, eventId: event.eventId });
      }
      await flushFeed(slotRef);
      if (!hasConflict) await refreshOutboxStatus();
      return true;
    } catch (error) {
      console.warn("[GameOutbox] 재전송 실패:", error);
      try {
        await refreshOutboxStatus();
      } catch (_statusError) {
        setStateSyncStatus(GAME_SYNC_STATUS.UNAVAILABLE);
        setRecordSyncStatus(GAME_RECORD_SYNC_STATUS.UNAVAILABLE);
      }
      return false;
    }
  }, [commitStateRecord, currentUser, flushFeed, isFirebaseAvailable, outbox, refreshOutboxStatus, slotId]);

  const flushOutbox = useCallback(
    () => saveQueue.enqueue(flushOutboxInternal),
    [flushOutboxInternal, saveQueue]
  );

  const { retryAt } = useGameOutboxSync({
    enabled: Boolean(slotId && currentUser?.uid && isFirebaseAvailable),
    isLoadingSlot,
    flushOutbox,
    nextFlushAt: nextRecordSyncAt,
  });

  const discardPendingEvents = useCallback(async () => {
    if (!outbox || !currentUser?.uid || !slotId) return;
    const [activityEvents, battleEvents, feedEvents] = await Promise.all([
      outbox.listActivityEvents({ uid: currentUser.uid, slotId }),
      outbox.listBattleEvents({ uid: currentUser.uid, slotId }),
      outbox.listFeedEvents({ uid: currentUser.uid, slotId }),
    ]);
    for (const event of activityEvents) {
      await outbox.deleteActivityEvent({ uid: currentUser.uid, slotId, eventId: event.eventId });
    }
    for (const event of battleEvents) {
      await outbox.deleteBattleEvent({ uid: currentUser.uid, slotId, eventId: event.eventId });
    }
    for (const event of feedEvents.filter((entry) => entry.syncStatus !== "synced")) {
      await outbox.deleteFeedEvent({ uid: currentUser.uid, slotId, eventId: event.eventId });
    }
  }, [currentUser?.uid, outbox, slotId]);

  const resolveSyncConflict = useCallback(async (choice) => {
    const conflict = conflictRef.current;
    if (!conflict || !currentUser?.uid || !slotId) return false;

    return saveQueue.enqueue(async () => {
      if (choice === "server") {
        const remoteData = conflict.remoteData || {};
        const selected = remoteData.selectedDigimon || selectedDigimon || null;
        const remoteStats = {
          ...normalizeStats(remoteData.digimonStats || {}),
          isLightsOn: remoteData.isLightsOn ?? true,
          wakeUntil: toEpochMs(remoteData.wakeUntil),
          ...(selected ? { selectedDigimon: selected } : {}),
          activityLogs: digimonStats?.activityLogs || activityLogs || [],
          battleLogs: digimonStats?.battleLogs || [],
        };
        revisionRef.current = normalizeGameRevision(conflict.actualRevision);
        lastSyncedStatsRef.current = remoteStats;
        setDigimonStats(remoteStats);
        setIsLightsOn(remoteStats.isLightsOn);
        setWakeUntil(remoteStats.wakeUntil);
        if (selected) setSelectedDigimon(selected);
        if (outbox && conflict.mutationId) {
          await outbox.deleteStateMutation({
            uid: currentUser.uid,
            slotId,
            mutationId: conflict.mutationId,
          });
        }
        await discardPendingEvents();
      } else if (choice === "local") {
        const stateRecord = outbox
          ? await outbox.getStateMutation({ uid: currentUser.uid, slotId })
          : null;
        const localSnapshot = stateRecord?.state?.stateSnapshot || conflict.localState;
        if (!localSnapshot) return false;
        const slotRef = doc(db, "users", currentUser.uid, "slots", `slot${slotId}`);
        try {
          const result = await commitRevisionedSlot({
            db,
            slotRef,
            baseRevision: conflict.actualRevision,
            updateData: buildUpdateDataForSnapshot(localSnapshot),
            runTransaction,
          });
          revisionRef.current = result.revision;
          lastSyncedStatsRef.current = localSnapshot;
          if (outbox && stateRecord) {
            await outbox.deleteStateMutation({
              uid: currentUser.uid,
              slotId,
              mutationId: stateRecord.mutationId,
            });
          }
        } catch (error) {
          if (error instanceof GameRevisionConflictError) {
            holdRevisionConflict(stateRecord || {
              mutationId: conflict.mutationId,
              state: { stateSnapshot: localSnapshot, actions: conflict.actions },
            }, error);
            return false;
          }
          throw error;
        }
      } else {
        return false;
      }
      conflictRef.current = null;
      setSyncConflict(null);
      setNextStateSyncAt(getNextStateSyncAt());
      await refreshOutboxStatus();
      return true;
    });
  }, [
    activityLogs,
    buildUpdateDataForSnapshot,
    currentUser,
    discardPendingEvents,
    digimonStats?.activityLogs,
    digimonStats?.battleLogs,
    holdRevisionConflict,
    normalizeStats,
    outbox,
    refreshOutboxStatus,
    saveQueue,
    selectedDigimon,
    setDigimonStats,
    setIsLightsOn,
    setSelectedDigimon,
    setWakeUntil,
    slotId,
  ]);

  const refreshGameRevision = useCallback(async (statsSnapshot = null) => {
    if (!slotId || !currentUser?.uid || !isFirebaseAvailable) return 0;
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
    revisionRef.current = normalizeGameRevision(revision);
    lastSyncedStatsRef.current = statsSnapshot || null;
    setStateSyncStatus(GAME_SYNC_STATUS.SYNCED);
    setNextStateSyncAt(getNextStateSyncAt());
  }, []);

  const getPendingState = useCallback(async () => {
    if (!outbox || !currentUser?.uid || !slotId) return null;
    const pendingState = await outbox.getStateMutation({ uid: currentUser.uid, slotId });
    if (pendingState) setStateSyncStatus(GAME_SYNC_STATUS.LOCAL);
    return pendingState;
  }, [currentUser?.uid, outbox, slotId]);

  return {
    appendBattleLog,
    appendLog,
    flushOutbox,
    getPendingState,
    persistStateSnapshot,
    refreshGameRevision,
    resolveSyncConflict,
    setLoadedRevision,
    syncConflict,
    nextRecordSyncAt,
    nextStateSyncAt,
    pendingRecordCount,
    recordSyncStatus,
    retryAt,
    stateSyncStatus,
  };
}
