import { act, renderHook } from "@testing-library/react";
import { getDoc, setDoc } from "firebase/firestore";
import {
  canUseGameplayPersistence,
  GAME_PERSISTENCE_PHASE,
  isCurrentConflictIdentity,
  normalizeStateActivityEvents,
  resolveNewReplayActions,
  useDurableGamePersistence,
} from "./useDurableGamePersistence";

const mockRunTransaction = jest.fn();
const mockCommitGameTransition = jest.fn();
const mockCommitCareMistakeV2ApiCommand = jest.fn();
const TEST_SLOT_INSTANCE_ID = "slot-instance-1";
const TEST_DIGIMON_INSTANCE_ID = "digimon-instance-1";
const TEST_PERSISTENCE_IDENTITY = Object.freeze({
  uid: "user-1",
  slotId: 1,
  slotInstanceId: TEST_SLOT_INSTANCE_ID,
  digimonInstanceId: TEST_DIGIMON_INSTANCE_ID,
});

jest.mock("firebase/firestore", () => ({
  collection: (...args) => args.join("/"),
  doc: (...args) => args.join("/"),
  getDoc: jest.fn(),
  runTransaction: (...args) => mockRunTransaction(...args),
  setDoc: jest.fn(),
}));

jest.mock("../../firebase", () => ({ db: "DB" }));

jest.mock("../../persistence/careMistakeTransition", () => ({
  ...jest.requireActual("../../persistence/careMistakeTransition"),
  commitGameTransition: (...args) => mockCommitGameTransition(...args),
}));

jest.mock("../../persistence/careMistakeV2Api", () => ({
  ...jest.requireActual("../../persistence/careMistakeV2Api"),
  commitCareMistakeV2ApiCommand: (...args) => mockCommitCareMistakeV2ApiCommand(...args),
}));

function createMemoryOutbox(order) {
  let stateRecord = null;
  let feedEvents = [];
  let recordSequence = 0;
  return {
    async getStateMutation() { return stateRecord; },
    async putStateMutation(input) {
      order.push("outbox:put");
      stateRecord = {
        ...TEST_PERSISTENCE_IDENTITY,
        ...input,
        recordVersion: `state-record-${recordSequence += 1}`,
        state: JSON.parse(JSON.stringify(input.state)),
      };
      return stateRecord;
    },
    async deleteStateMutation({ mutationId, recordVersion }) {
      if (
        stateRecord?.mutationId !== mutationId ||
        (recordVersion && stateRecord?.recordVersion !== recordVersion)
      ) return false;
      order.push("outbox:delete");
      stateRecord = null;
      return true;
    },
    async listActivityEvents() { return []; },
    async listBattleEvents() { return []; },
    async listFeedEvents() { return feedEvents; },
    async putActivityEvent(input) {
      return { ...input, recordVersion: `activity-record-${recordSequence += 1}` };
    },
    async deleteActivityEvent() { return true; },
    async putBattleEvent(input) {
      return { ...input, recordVersion: `battle-record-${recordSequence += 1}` };
    },
    async deleteBattleEvent() { return true; },
    async putFeedEvent(input) {
      const next = { ...input, recordVersion: `feed-record-${recordSequence += 1}` };
      feedEvents = [...feedEvents.filter((event) => event.eventId !== input.eventId), next];
      return next;
    },
    async deleteFeedEvent({ eventId }) {
      feedEvents = feedEvents.filter((event) => event.eventId !== eventId);
    },
    async pruneSyncedFeedEvents() {},
  };
}

function createHookParams(outboxOverride) {
  const persistenceAccessRef = {
    current: {
      phase: GAME_PERSISTENCE_PHASE.READY,
      generation: 1,
      loadedIdentity: { ...TEST_PERSISTENCE_IDENTITY },
      loadedRevision: 0,
    },
  };
  const params = {
    slotId: 1,
    currentUser: { uid: "user-1" },
    isFirebaseAvailable: true,
    isLoadingSlot: true,
    digimonStats: { fullness: 2, activityLogs: [] },
    activityLogs: [],
    selectedDigimon: "Agumon",
    isLightsOn: true,
    wakeUntil: null,
    setDigimonStats: jest.fn(),
    setSelectedDigimon: jest.fn(),
    setIsLightsOn: jest.fn(),
    setWakeUntil: jest.fn(),
    buildUpdateDataForSnapshot: (stats) => ({ digimonStats: stats }),
    normalizeStats: (stats) => stats,
    saveQueue: { enqueue: (task) => task() },
    outboxOverride,
    persistenceAccessRef,
    onPersistenceAccessChange: (patch) => {
      persistenceAccessRef.current = { ...persistenceAccessRef.current, ...patch };
    },
    reloadPage: jest.fn(),
  };
  return params;
}

describe("canUseGameplayPersistence", () => {
  const readyAccess = {
    phase: GAME_PERSISTENCE_PHASE.READY,
    generation: 3,
    loadedIdentity: { ...TEST_PERSISTENCE_IDENTITY },
  };

  test("ready·identity·generation·revision이 모두 일치할 때만 저장을 허용한다", () => {
    expect(canUseGameplayPersistence({
      access: readyAccess,
      currentUid: "user-1",
      currentSlotId: 1,
      loadedRevision: 4,
      saveContext: {
        ...TEST_PERSISTENCE_IDENTITY,
        generation: 3,
        requestedAtRevision: 4,
      },
    })).toBe(true);
  });

  test("reconciliation이 끝나지 않은 동안 gameplay mutation을 막고 대기 전이만 허용한다", () => {
    const saveContext = {
      ...TEST_PERSISTENCE_IDENTITY,
      generation: 3,
    };
    expect(canUseGameplayPersistence({
      access: { ...readyAccess, careMistakeReconciliationStatus: "in_progress" },
      currentUid: "user-1",
      currentSlotId: 1,
      loadedRevision: 4,
      saveContext,
    })).toBe(false);
    expect(canUseGameplayPersistence({
      access: { ...readyAccess, careMistakeReconciliationStatus: "in_progress" },
      currentUid: "user-1",
      currentSlotId: 1,
      loadedRevision: 4,
      saveContext,
      allowCareTransition: true,
    })).toBe(true);
    expect(canUseGameplayPersistence({
      access: { ...readyAccess, careMistakeReconciliationStatus: "ambiguous" },
      currentUid: "user-1",
      currentSlotId: 1,
      loadedRevision: 4,
      saveContext,
      allowCareTransition: true,
    })).toBe(false);
    expect(canUseGameplayPersistence({
      access: { ...readyAccess, careMistakeReconciliationStatus: "failed" },
      currentUid: "user-1",
      currentSlotId: 1,
      loadedRevision: 4,
      saveContext,
      allowCareTransition: true,
    })).toBe(false);
  });

  test.each([
    ["loading", { access: { ...readyAccess, phase: GAME_PERSISTENCE_PHASE.LOADING } }],
    ["conflict", { hasConflict: true }],
    ["stale generation", { saveContext: { uid: "user-1", slotId: 1, generation: 2 } }],
    ["identity mismatch", { currentSlotId: 2 }],
    ["revision 미확인", { loadedRevision: null }],
  ])("%s 상태에서는 저장을 거부한다", (_label, override) => {
    expect(canUseGameplayPersistence({
      access: readyAccess,
      currentUid: "user-1",
      currentSlotId: 1,
      loadedRevision: 4,
      saveContext: { ...TEST_PERSISTENCE_IDENTITY, generation: 3 },
      ...override,
    })).toBe(false);
  });
});

describe("normalizeStateActivityEvents", () => {
  test("outbox 유무와 관계없이 eventId와 현재 생애 identity를 보강한다", () => {
    const events = normalizeStateActivityEvents([{
      type: "CLEAN",
      text: "Cleaned Poop (Full flush, 1 → 0)",
      timestamp: 1000,
    }], TEST_PERSISTENCE_IDENTITY);

    expect(events).toEqual([expect.objectContaining({
      type: "CLEAN",
      eventId: expect.any(String),
      slotInstanceId: TEST_SLOT_INSTANCE_ID,
      digimonInstanceId: TEST_DIGIMON_INSTANCE_ID,
    })]);
  });

  test("같은 eventId는 하나로 중복 제거한다", () => {
    const event = {
      eventId: "clean:1000",
      type: "CLEAN",
      text: "Cleaned Poop",
      timestamp: 1000,
    };

    expect(normalizeStateActivityEvents([event, event], TEST_PERSISTENCE_IDENTITY))
      .toHaveLength(1);
  });
});

describe("isCurrentConflictIdentity", () => {
  test("uid·slotId·generation이 모두 같은 충돌만 현재 슬롯 복구에 사용한다", () => {
    const access = {
      generation: 4,
      loadedIdentity: { ...TEST_PERSISTENCE_IDENTITY },
    };
    const conflict = {
      identity: { ...TEST_PERSISTENCE_IDENTITY, generation: 4 },
    };

    expect(isCurrentConflictIdentity({
      conflict,
      access,
      currentUid: "user-1",
      currentSlotId: 1,
    })).toBe(true);
    expect(isCurrentConflictIdentity({
      conflict,
      access: { ...access, generation: 5 },
      currentUid: "user-1",
      currentSlotId: 1,
    })).toBe(false);
  });
});

describe("useDurableGamePersistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunTransaction.mockReset();
    mockCommitCareMistakeV2ApiCommand.mockReset();
    getDoc.mockReset();
    setDoc.mockReset();
    setDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("활동 로그 receipt는 고정 eventId로 원격 저장 결과를 반환한다", async () => {
    const outbox = createMemoryOutbox([]);
    outbox.putActivityEvent = jest.fn().mockResolvedValue({
      recordVersion: "activity-record-1",
    });
    outbox.deleteActivityEvent = jest.fn().mockResolvedValue(undefined);
    setDoc.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );

    let receipt;
    await act(async () => {
      receipt = await result.current.persistActivityLogReceipt({
        logEntry: {
          type: "ACTION",
          text: "야행성 모드 ON 변경 요청",
          timestamp: 100,
          eventId: "stats-popup:command-1:activity",
        },
        commandId: "command-1",
      });
    });

    expect(receipt).toMatchObject({
      status: "synced",
      commandId: "command-1",
      eventId: "stats-popup:command-1:activity",
    });
    expect(outbox.putActivityEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventId: "stats-popup:command-1:activity",
    }));
    expect(outbox.deleteActivityEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventId: "stats-popup:command-1:activity",
    }));
  });

  test("로그 원격 실패는 outbox 성공 여부에 따라 queued와 failed를 구분한다", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const durableOutbox = createMemoryOutbox([]);
    durableOutbox.putActivityEvent = jest.fn().mockResolvedValue(undefined);
    setDoc.mockRejectedValue(new Error("offline"));
    const durable = renderHook(() =>
      useDurableGamePersistence(createHookParams(durableOutbox))
    );

    let queued;
    await act(async () => {
      queued = await durable.result.current.persistActivityLogReceipt({
        logEntry: { type: "ACTION", text: "요청", timestamp: 100, eventId: "event-1" },
      });
    });
    expect(queued.status).toBe("queued");

    const brokenOutbox = createMemoryOutbox([]);
    brokenOutbox.putActivityEvent = jest.fn().mockRejectedValue(new Error("indexeddb offline"));
    const broken = renderHook(() =>
      useDurableGamePersistence(createHookParams(brokenOutbox))
    );
    let failed;
    await act(async () => {
      failed = await broken.result.current.persistActivityLogReceipt({
        logEntry: { type: "ACTION", text: "요청", timestamp: 100, eventId: "event-1" },
      });
    });
    expect(failed.status).toBe("failed");
    expect(consoleSpy).toHaveBeenCalled();
  });

  test("로그 재시도는 같은 eventId의 문서를 멱등하게 다시 사용한다", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const outbox = createMemoryOutbox([]);
    outbox.putActivityEvent = jest.fn().mockResolvedValue(undefined);
    outbox.deleteActivityEvent = jest.fn().mockResolvedValue(undefined);
    setDoc
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );
    const input = {
      logEntry: {
        type: "ACTION",
        text: "야행성 모드 ON 변경 요청",
        timestamp: 100,
        eventId: "stats-popup:command-1:activity",
      },
      commandId: "command-1",
    };

    let first;
    let second;
    await act(async () => {
      first = await result.current.persistActivityLogReceipt(input);
      second = await result.current.persistActivityLogReceipt(input);
    });

    expect(first).toMatchObject({ status: "queued", eventId: input.logEntry.eventId });
    expect(second).toMatchObject({ status: "synced", eventId: input.logEntry.eventId });
    expect(setDoc.mock.calls[0][0]).toBe(setDoc.mock.calls[1][0]);
    expect(outbox.putActivityEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ eventId: input.logEntry.eventId })
    );
  });

  test("동기화 정보에 전체 pending 수와 가장 오래된 대기 시각을 노출한다", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const outbox = createMemoryOutbox([]);
    const pendingEvents = [
      { eventId: "event-old", occurredAt: 1_000, payload: {} },
      { eventId: "event-new", occurredAt: 2_000, payload: {} },
    ];
    outbox.listActivityEvents = jest.fn().mockResolvedValue(pendingEvents);
    outbox.putActivityEvent = jest.fn().mockResolvedValue(undefined);
    setDoc.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );

    await act(async () => {
      await result.current.persistActivityLogReceipt({
        logEntry: { type: "ACTION", text: "요청", timestamp: 2_000, eventId: "event-new" },
      });
    });

    expect(result.current.pendingRecordCount).toBe(2);
    expect(result.current.pendingSaveCount).toBe(2);
    expect(result.current.oldestPendingAt).toBe(1_000);
  });

  test("로그 receipt도 state와 같은 저장 context가 오래되면 write 없이 blocked된다", async () => {
    const outbox = createMemoryOutbox([]);
    outbox.putActivityEvent = jest.fn();
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );

    let receipt;
    await act(async () => {
      receipt = await result.current.persistActivityLogReceipt({
        logEntry: { type: "ACTION", text: "요청", timestamp: 100, eventId: "event-1" },
        saveContext: { uid: "user-1", slotId: 1, generation: 0 },
      });
    });

    expect(receipt).toMatchObject({ status: "blocked", blockedReason: "generation-changed" });
    expect(outbox.putActivityEvent).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  test("명령 reducer의 기준 상태로 메모리보다 최신인 pending 스냅샷을 우선한다", async () => {
    const outbox = createMemoryOutbox([]);
    await outbox.putStateMutation({
      uid: "user-1",
      slotId: 1,
      mutationId: "pending-command-base",
      updatedAt: 100,
      state: {
        baseRevision: 0,
        stateSnapshot: { fullness: 4, strength: 3, lastSavedAt: 100 },
        actions: [],
      },
    });
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );

    let latest;
    await act(async () => {
      latest = await result.current.getLatestStateSnapshot();
    });

    expect(latest.statsSnapshot).toEqual({ fullness: 4, strength: 3, lastSavedAt: 100 });
    expect(latest.pendingState.mutationId).toBe("pending-command-base");
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(getDoc).not.toHaveBeenCalled();
  });

  test("Firestore transaction 전에 상태를 outbox에 기록하고 성공 후 같은 mutation을 삭제한다", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000);
    const order = [];
    const outbox = createMemoryOutbox(order);
    mockRunTransaction.mockImplementation(async (_db, callback) => {
      order.push("firestore:transaction");
      return callback({
        get: async () => ({ exists: () => true, data: () => ({ revision: 0 }) }),
        update: jest.fn(),
      });
    });
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );

    await act(async () => {
      await result.current.persistStateSnapshot({
        statsSnapshot: { fullness: 3, activityLogs: [] },
        updatedLogs: [{ type: "FEED", text: "Feed: Meat", timestamp: 100 }],
        nowMs: 100,
      });
    });

    expect(order).toEqual([
      "outbox:put",
      "firestore:transaction",
      "outbox:delete",
    ]);
    expect(await outbox.getStateMutation()).toBeNull();
    expect(result.current.stateSyncStatus).toBe("synced");
    expect(result.current.nextStateSyncAt).toBe(901_000);
    expect(result.current.lastStateSyncedAt).toBe(1_000);
    expect(result.current.stateSyncError).toBe("");
  });

  test("receipt API는 원격 성공과 exact local cleanup 결과를 반환한다", async () => {
    const outbox = createMemoryOutbox([]);
    mockRunTransaction.mockImplementation(async (_db, callback) => callback({
      get: async () => ({ exists: () => true, data: () => ({ revision: 0 }) }),
      update: jest.fn(),
    }));
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );

    let receipt;
    await act(async () => {
      receipt = await result.current.persistStateSnapshotReceipt({
        statsSnapshot: { fullness: 3 },
        nowMs: 100,
        commandId: "command-1",
      });
    });

    expect(receipt).toEqual({
      status: "synced",
      commandId: "command-1",
      mutationId: expect.any(String),
      blockedReason: null,
      localCleanup: "complete",
      errorCode: null,
    });
  });

  test("원격 실패 시 durable outbox가 있으면 queued, 없으면 failed receipt를 반환한다", async () => {
    mockRunTransaction.mockRejectedValue(new Error("offline"));
    const durableOutbox = createMemoryOutbox([]);
    const durable = renderHook(() =>
      useDurableGamePersistence(createHookParams(durableOutbox))
    );
    const unavailable = renderHook(() =>
      useDurableGamePersistence(createHookParams(null))
    );

    let queuedReceipt;
    let failedReceipt;
    await act(async () => {
      queuedReceipt = await durable.result.current.persistStateSnapshotReceipt({
        statsSnapshot: { fullness: 4 },
        nowMs: 200,
        commandId: "queued-command",
      });
      failedReceipt = await unavailable.result.current.persistStateSnapshotReceipt({
        statsSnapshot: { fullness: 5 },
        nowMs: 300,
        commandId: "failed-command",
      });
    });

    expect(queuedReceipt).toMatchObject({
      status: "queued",
      commandId: "queued-command",
      localCleanup: "not-needed",
      errorCode: "UNKNOWN",
    });
    expect(failedReceipt).toMatchObject({
      status: "failed",
      commandId: "failed-command",
      localCleanup: "not-needed",
      errorCode: "UNKNOWN",
    });
    expect(await durableOutbox.getStateMutation()).not.toBeNull();
  });

  test("stale generation command는 blocked receipt로 구분한다", async () => {
    const outbox = createMemoryOutbox([]);
    const params = createHookParams(outbox);
    const { result } = renderHook(() => useDurableGamePersistence(params));
    const staleContext = result.current.captureSaveContext();
    params.persistenceAccessRef.current = {
      ...params.persistenceAccessRef.current,
      generation: 2,
    };

    let receipt;
    await act(async () => {
      receipt = await result.current.persistStateSnapshotReceipt({
        statsSnapshot: { fullness: 5 },
        nowMs: 300,
        commandId: "stale-command",
        saveContext: staleContext,
      });
    });

    expect(receipt).toMatchObject({
      status: "blocked",
      commandId: "stale-command",
      mutationId: null,
      blockedReason: "generation-changed",
    });
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  test("revision 충돌은 conflict receipt로 반환하고 pending을 보존한다", async () => {
    const outbox = createMemoryOutbox([]);
    mockRunTransaction.mockImplementation(async (_db, callback) => callback({
      get: async () => ({
        exists: () => true,
        data: () => ({ revision: 2, digimonStats: { fullness: 2 } }),
      }),
      update: jest.fn(),
    }));
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );

    let receipt;
    await act(async () => {
      receipt = await result.current.persistStateSnapshotReceipt({
        statsSnapshot: { fullness: 5 },
        nowMs: 300,
        commandId: "conflict-command",
      });
    });

    expect(receipt).toMatchObject({
      status: "conflict",
      commandId: "conflict-command",
      localCleanup: "not-needed",
    });
    expect(await outbox.getStateMutation()).not.toBeNull();
  });

  test("기존 pending 위 put 실패 fallback은 같은 mutationId와 baseRevision으로 원격 저장한다", async () => {
    const outbox = createMemoryOutbox([]);
    await outbox.putStateMutation({
      uid: "user-1",
      slotId: 1,
      mutationId: "pending-existing",
      updatedAt: 100,
      queuedAt: 100,
      state: {
        baseRevision: 4,
        stateSnapshot: { fullness: 2 },
        actions: [],
        hasUnreplayableChanges: true,
      },
    });
    outbox.putStateMutation = jest.fn().mockRejectedValue(new Error("indexeddb unavailable"));
    const update = jest.fn();
    mockRunTransaction.mockImplementation(async (_db, callback) => callback({
      get: async () => ({ exists: () => true, data: () => ({ revision: 4 }) }),
      update,
    }));
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );

    let receipt;
    await act(async () => {
      receipt = await result.current.persistStateSnapshotReceipt({
        statsSnapshot: { fullness: 5 },
        nowMs: 400,
        commandId: "fallback-command",
      });
    });

    expect(receipt).toMatchObject({
      status: "synced",
      commandId: "fallback-command",
      mutationId: "pending-existing",
      localCleanup: "failed",
    });
    expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      revision: 5,
      digimonStats: { fullness: 5 },
    }));
    expect(await outbox.getStateMutation()).toBeNull();
  });

  test("원격 성공 후 exact cleanup 실패 mutation은 같은 세션 자동 flush에서 제외한다", async () => {
    const outbox = createMemoryOutbox([]);
    outbox.deleteStateMutation = jest.fn().mockResolvedValue(false);
    mockRunTransaction.mockImplementation(async (_db, callback) => callback({
      get: async () => ({ exists: () => true, data: () => ({ revision: 0 }) }),
      update: jest.fn(),
    }));
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );

    let receipt;
    await act(async () => {
      receipt = await result.current.persistStateSnapshotReceipt({
        statsSnapshot: { fullness: 5 },
        nowMs: 500,
        commandId: "cleanup-command",
      });
    });
    expect(receipt).toMatchObject({ status: "synced", localCleanup: "failed" });
    expect(await outbox.getStateMutation()).not.toBeNull();

    await act(async () => {
      await result.current.flushOutbox();
    });

    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(result.current.stateSyncError).toContain("이전 대기 항목");
  });

  test("Firestore 검증 commit 성공 후 IndexedDB cleanup 실패여도 playable을 유지한다", async () => {
    const outbox = createMemoryOutbox([]);
    outbox.deleteStateMutation = jest.fn().mockResolvedValue(false);
    mockCommitGameTransition.mockResolvedValue({
      revision: 1,
      idempotent: false,
      projection: {
        careMistakes: 1,
        unresolvedCareMistakeCount: 1,
        latestUnresolvedCareMistakeIncidentId: "incident-1",
        latestCareMistakeAt: 100,
        careMistakeSchemaVersion: 1,
        careMistakeReconciliationVersion: 1,
        careMistakeReconciliationStatus: "verified",
        evolutionStageInstanceId: "stage-1",
      },
    });
    const params = createHookParams(outbox);
    params.persistenceAccessRef.current.careMistakeReconciliationStatus = "in_progress";
    const { result } = renderHook(() => useDurableGamePersistence(params));

    let receipt;
    await act(async () => {
      receipt = await result.current.persistStateSnapshotReceipt({
        statsSnapshot: {
          fullness: 5,
          evolutionStageInstanceId: "stage-1",
        },
        nowMs: 500,
        commandId: "care-commit-cleanup-failure",
        allowCareTransition: true,
        transition: {
          transitionType: "CARE_MISTAKE_OCCURRED",
          evolutionStageInstanceId: "stage-1",
          reasonKey: "hunger_call",
          occurredAt: 100,
        },
      });
    });

    expect(receipt).toMatchObject({ status: "synced", localCleanup: "failed" });
    expect(params.persistenceAccessRef.current.careMistakeReconciliationStatus).toBe(
      "verified"
    );
    expect(params.setDigimonStats).toHaveBeenCalled();
    expect(result.current.canStartGameplayWrite()).toBe(true);
  });

  test("V2 NEW_LIFE는 클라이언트 Firestore transaction 대신 trusted command로 identity를 전달한다", async () => {
    const outbox = createMemoryOutbox([]);
    const params = createHookParams(outbox);
    params.persistenceAccessRef.current = {
      ...params.persistenceAccessRef.current,
      loadedRevision: 1,
      careMistakeReconciliationStatus: "verified",
      careMistakeState: {
        schemaVersion: 2,
        rootReceiptId: "root-a",
        receiptId: "receipt-a",
        evolutionStageInstanceId: "stage-a",
      },
    };
    mockCommitCareMistakeV2ApiCommand.mockResolvedValue({
      revision: 2,
      idempotent: false,
      careMistakeState: {
        ...params.persistenceAccessRef.current.careMistakeState,
        rootReceiptId: "root-b",
        receiptId: "root-b",
        evolutionStageInstanceId: "stage-b",
      },
      projection: { careMistakes: 0, careMistakeReconciliationStatus: "verified" },
    });
    const { result } = renderHook(() => useDurableGamePersistence(params));

    let receipt;
    await act(async () => {
      receipt = await result.current.persistStateSnapshotReceipt({
        statsSnapshot: {
          selectedDigimon: "Punimon",
          evolutionStageInstanceId: "stage-b",
          digimonInstanceId: "digimon-life-b",
        },
        nowMs: 700,
        commandId: "new-life-command",
        allowCareTransition: true,
        transition: {
          transitionId: "new-life-command",
          transitionType: "NEW_LIFE",
          newLife: true,
          targetDigimon: "Punimon",
          nextDigimonInstanceId: "digimon-life-b",
          nextEvolutionStageInstanceId: "stage-b",
          logEntry: { eventId: "new-life-log", type: "NEW_START", text: "new life" },
        },
      });
    });

    expect(receipt).toMatchObject({ status: "synced", revision: 2 });
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(mockCommitCareMistakeV2ApiCommand).toHaveBeenCalledWith(
      params.currentUser,
      1,
      expect.objectContaining({
        commandId: "new-life-command",
        commandType: "NEW_LIFE",
        expectedRevision: 1,
        payload: expect.objectContaining({
          nextDigimonInstanceId: "digimon-life-b",
          nextEvolutionStageInstanceId: "stage-b",
          updateData: expect.objectContaining({ selectedDigimon: "Punimon" }),
        }),
      })
    );
  });

  test("같은 generation의 저장 A·B는 실행 시점 최신 revision으로 연속 커밋한다", async () => {
    const order = [];
    const outbox = createMemoryOutbox(order);
    let serverRevision = 0;
    mockRunTransaction.mockImplementation(async (_db, callback) => callback({
      get: async () => ({
        exists: () => true,
        data: () => ({ revision: serverRevision }),
      }),
      update: (_ref, payload) => {
        serverRevision = payload.revision;
      },
    }));
    const params = createHookParams(outbox);
    const { result } = renderHook(() => useDurableGamePersistence(params));
    const firstContext = result.current.captureSaveContext();
    const secondContext = result.current.captureSaveContext();

    await act(async () => {
      await result.current.persistStateSnapshot({
        statsSnapshot: { fullness: 3 },
        nowMs: 100,
        saveContext: firstContext,
      });
      await result.current.persistStateSnapshot({
        statsSnapshot: { fullness: 4 },
        nowMs: 200,
        saveContext: secondContext,
      });
    });

    expect(serverRevision).toBe(2);
    expect(mockRunTransaction).toHaveBeenCalledTimes(2);
  });

  test("슬롯 변경 뒤 실행된 과거 generation 저장은 outbox와 Firestore 모두 건드리지 않는다", async () => {
    const order = [];
    const outbox = createMemoryOutbox(order);
    const params = createHookParams(outbox);
    const { result } = renderHook(() => useDurableGamePersistence(params));
    const staleContext = result.current.captureSaveContext();
    params.persistenceAccessRef.current = {
      ...params.persistenceAccessRef.current,
      generation: 2,
      loadedIdentity: { uid: "user-1", slotId: 2 },
    };

    await act(async () => {
      await expect(result.current.persistStateSnapshot({
        statsSnapshot: { fullness: 5 },
        nowMs: 300,
        saveContext: staleContext,
      })).resolves.toBe(false);
    });

    expect(order).toEqual([]);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  test("일반 먹이 기록은 다음 15분 bucket까지 별도 대기 상태로 표시한다", async () => {
    jest.useFakeTimers();
    const now = new Date("2026-06-21T15:07:30+09:00").getTime();
    jest.setSystemTime(now);
    const outbox = createMemoryOutbox([]);
    mockRunTransaction.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );

    await act(async () => {
      await result.current.appendLog({
        type: "FEED",
        text: "Feed: Meat",
        timestamp: now,
      });
    });

    expect(result.current.recordSyncStatus).toBe("feed_pending");
    expect(result.current.pendingRecordCount).toBe(1);
    expect(result.current.nextRecordSyncAt).toBe(
      new Date("2026-06-21T15:15:00+09:00").getTime()
    );
  });

  test("Firestore 실패 시 outbox 상태를 유지하고 기기 저장 상태를 표시한다", async () => {
    const order = [];
    const outbox = createMemoryOutbox(order);
    mockRunTransaction.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );

    await act(async () => {
      await expect(result.current.persistStateSnapshot({
        statsSnapshot: { fullness: 4, activityLogs: [] },
        updatedLogs: [{ type: "FEED", text: "Feed: Meat", timestamp: 200 }],
        nowMs: 200,
      })).rejects.toThrow("offline");
    });

    expect(await outbox.getStateMutation()).not.toBeNull();
    expect(result.current.stateSyncStatus).toBe("local");
    expect(result.current.nextStateSyncAt).toBeNull();
    expect(result.current.stateSyncError).toBe("offline");
  });

  test("진화 transaction 실패는 전이 envelope를 outbox에 보존하고 flush에서 원자적으로 재시도한다", async () => {
    const outbox = createMemoryOutbox([]);
    mockRunTransaction.mockRejectedValueOnce(new Error("offline"));
    const update = jest.fn();
    const set = jest.fn();
    const params = createHookParams(outbox);
    const { result } = renderHook(() => useDurableGamePersistence(params));
    const transition = {
      transitionId: "evolution-transition-1",
      sourceDigimon: "Agumon",
      targetDigimon: "Greymon",
      createdAt: 400,
      logEntry: {
        type: "EVOLUTION",
        text: "Agumon evolved into Greymon",
        timestamp: 400,
        eventId: "activity:evolution:evolution-transition-1",
      },
    };

    let queuedReceipt;
    await act(async () => {
      queuedReceipt = await result.current.persistEvolutionTransitionReceipt({
        statsSnapshot: { fullness: 5, selectedDigimon: "Greymon", activityLogs: [] },
        updatedLogs: [transition.logEntry],
        transition,
        nowMs: 400,
      });
    });

    const pending = await outbox.getStateMutation();
    expect(queuedReceipt).toMatchObject({
      status: "queued",
      errorCode: "UNKNOWN",
    });
    expect(pending.state.transition).toMatchObject({
      transitionId: "evolution-transition-1",
      sourceDigimon: "Agumon",
      targetDigimon: "Greymon",
      slotInstanceId: TEST_SLOT_INSTANCE_ID,
      digimonInstanceId: TEST_DIGIMON_INSTANCE_ID,
    });
    expect(pending.state.transition.requestFingerprint).toEqual(expect.any(String));

    mockRunTransaction.mockImplementationOnce(async (_db, callback) => callback({
      get: async (ref) => String(ref).includes("/logs/")
        ? { exists: () => false, data: () => ({}) }
        : {
            exists: () => true,
            data: () => ({
              revision: 0,
              selectedDigimon: "Agumon",
              slotInstanceId: TEST_SLOT_INSTANCE_ID,
              digimonInstanceId: TEST_DIGIMON_INSTANCE_ID,
              arenaIdentitySchemaVersion: 1,
              combatRevision: 3,
            }),
          },
      update,
      set,
    }));

    await act(async () => {
      await result.current.flushOutbox();
    });

    expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      selectedDigimon: "Greymon",
      revision: 1,
      combatRevision: 4,
      digimonStats: expect.objectContaining({ fullness: 5 }),
    }));
    expect(set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventId: "activity:evolution:evolution-transition-1",
      revisionBefore: 0,
      revisionAfter: 1,
      requestFingerprint: pending.state.transition.requestFingerprint,
    }));
    expect(await outbox.getStateMutation()).toBeNull();
  });

  test("사망 같은 위험 전이의 revision 충돌은 자동 덮어쓰지 않고 보류한다", async () => {
    const order = [];
    const outbox = createMemoryOutbox(order);
    const update = jest.fn();
    mockRunTransaction.mockImplementation(async (_db, callback) => callback({
      get: async () => ({
        exists: () => true,
        data: () => ({ revision: 2, digimonStats: { isDead: false } }),
      }),
      update,
    }));
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );

    let didPersist;
    await act(async () => {
      didPersist = await result.current.persistStateSnapshot({
        statsSnapshot: { isDead: true, activityLogs: [] },
        updatedLogs: [{ type: "DEATH", text: "사망", timestamp: 300 }],
        nowMs: 300,
      });
    });

    expect(didPersist).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(result.current.stateSyncStatus).toBe("conflict");
    expect(result.current.syncConflict).toMatchObject({
      expectedRevision: 0,
      actualRevision: 2,
    });
    expect(await outbox.getStateMutation()).not.toBeNull();
  });

  test("hydration에서 격리한 pending state는 background flush가 자동 업로드하지 않는다", async () => {
    const order = [];
    const outbox = createMemoryOutbox(order);
    await outbox.putStateMutation({
      uid: "user-1",
      slotId: 1,
      mutationId: "pending-1",
      updatedAt: 100,
      state: {
        baseRevision: 0,
        stateSnapshot: { isDead: false },
        actions: [],
      },
    });
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );
    const pendingState = await outbox.getStateMutation();

    act(() => {
      result.current.quarantinePendingState(pendingState, {
        expectedRevision: 0,
        actualRevision: 1,
        remoteData: { revision: 1, digimonStats: { isDead: true } },
        reason: "terminal_state_regression",
      });
    });
    await act(async () => {
      await result.current.flushOutbox();
    });

    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(await outbox.getStateMutation()).not.toBeNull();
    expect(result.current.syncConflict).toMatchObject({
      reason: "terminal_state_regression",
    });
  });

  test("같은 canonical snapshot의 hydration cleanup은 state pending만 삭제한다", async () => {
    const order = [];
    const outbox = createMemoryOutbox(order);
    await outbox.putStateMutation({
      uid: "user-1",
      slotId: 1,
      mutationId: "pending-same",
      updatedAt: 100,
      state: { baseRevision: 4, stateSnapshot: { fullness: 4 }, actions: [] },
    });
    const deleteActivitySpy = jest.spyOn(outbox, "deleteActivityEvent");
    const params = createHookParams(outbox);
    params.persistenceAccessRef.current.phase = GAME_PERSISTENCE_PHASE.LOADING;
    const { result } = renderHook(() => useDurableGamePersistence(params));
    const pendingState = await outbox.getStateMutation();

    await act(async () => {
      await expect(result.current.clearPendingStateAfterHydration(
        pendingState,
        { generation: 1 }
      )).resolves.toBe(true);
    });

    expect(await outbox.getStateMutation()).toBeNull();
    expect(deleteActivitySpy).not.toHaveBeenCalled();
  });

  test("local 충돌 복구 직접 호출은 Firestore transaction 없이 즉시 거부한다", async () => {
    const outbox = createMemoryOutbox([]);
    const { result } = renderHook(() =>
      useDurableGamePersistence(createHookParams(outbox))
    );

    act(() => {
      result.current.quarantinePendingState({
        mutationId: "pending-1",
        state: { stateSnapshot: { fullness: 4 } },
      }, {
        expectedRevision: 0,
        actualRevision: 1,
        remoteData: { revision: 1 },
      });
    });

    await act(async () => {
      await expect(result.current.resolveSyncConflict("local")).resolves.toBe(false);
    });

    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(result.current.syncConflict).not.toBeNull();
  });

  test("서버 복구는 최신 서버를 조회하고 state pending만 삭제한 뒤 reload한다", async () => {
    const order = [];
    const outbox = createMemoryOutbox(order);
    await outbox.putStateMutation({
      uid: "user-1",
      slotId: 1,
      mutationId: "pending-1",
      updatedAt: 100,
      state: { baseRevision: 4, stateSnapshot: { fullness: 1 }, actions: [] },
    });
    const deleteActivitySpy = jest.spyOn(outbox, "deleteActivityEvent");
    const deleteBattleSpy = jest.spyOn(outbox, "deleteBattleEvent");
    const deleteFeedSpy = jest.spyOn(outbox, "deleteFeedEvent");
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ revision: 6, digimonStats: { fullness: 5 } }),
    });
    const params = createHookParams(outbox);
    const { result } = renderHook(() => useDurableGamePersistence(params));
    const pendingState = await outbox.getStateMutation();

    act(() => {
      result.current.quarantinePendingState(pendingState, {
        expectedRevision: 4,
        actualRevision: 5,
        remoteData: { revision: 5 },
      });
    });
    await act(async () => {
      await expect(result.current.resolveSyncConflict("server")).resolves.toBe(true);
    });

    expect(getDoc).toHaveBeenCalledTimes(1);
    expect(await outbox.getStateMutation()).toBeNull();
    expect(deleteActivitySpy).not.toHaveBeenCalled();
    expect(deleteBattleSpy).not.toHaveBeenCalled();
    expect(deleteFeedSpy).not.toHaveBeenCalled();
    expect(params.reloadPage).toHaveBeenCalledTimes(1);
    expect(params.persistenceAccessRef.current.phase).toBe(GAME_PERSISTENCE_PHASE.RECOVERING);
    expect(result.current.captureSaveContext().requestedAtRevision).toBe(6);
    expect(params.setDigimonStats).not.toHaveBeenCalled();
  });

  test("서버 최신 조회가 실패하면 pending과 conflict를 유지하고 ready로 돌아간다", async () => {
    const outbox = createMemoryOutbox([]);
    await outbox.putStateMutation({
      uid: "user-1",
      slotId: 1,
      mutationId: "pending-1",
      updatedAt: 100,
      state: { baseRevision: 1, stateSnapshot: { fullness: 1 }, actions: [] },
    });
    getDoc.mockRejectedValue(new Error("offline"));
    const params = createHookParams(outbox);
    const { result } = renderHook(() => useDurableGamePersistence(params));
    const pendingState = await outbox.getStateMutation();
    act(() => {
      result.current.quarantinePendingState(pendingState, {
        expectedRevision: 1,
        actualRevision: 2,
      });
    });

    await act(async () => {
      await expect(result.current.resolveSyncConflict("server")).rejects.toThrow("offline");
    });

    expect(await outbox.getStateMutation()).not.toBeNull();
    expect(result.current.syncConflict).not.toBeNull();
    expect(result.current.syncConflict).toMatchObject({
      recoveryResult: "failed",
      errorCode: "UNKNOWN",
    });
    expect(params.persistenceAccessRef.current.phase).toBe(GAME_PERSISTENCE_PHASE.READY);
    expect(params.reloadPage).not.toHaveBeenCalled();
  });

  test("state pending 삭제 확인이 실패하면 reload하지 않고 pending을 유지한다", async () => {
    const outbox = createMemoryOutbox([]);
    await outbox.putStateMutation({
      uid: "user-1",
      slotId: 1,
      mutationId: "pending-1",
      updatedAt: 100,
      state: { baseRevision: 1, stateSnapshot: { fullness: 1 }, actions: [] },
    });
    outbox.deleteStateMutation = jest.fn().mockResolvedValue(false);
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ revision: 3 }) });
    const params = createHookParams(outbox);
    const { result } = renderHook(() => useDurableGamePersistence(params));
    const pendingState = await outbox.getStateMutation();
    act(() => {
      result.current.quarantinePendingState(pendingState, {
        expectedRevision: 1,
        actualRevision: 2,
      });
    });

    await act(async () => {
      await expect(result.current.resolveSyncConflict("server")).rejects.toMatchObject({
        code: "game/pending-delete-failed",
      });
    });

    expect(await outbox.getStateMutation()).not.toBeNull();
    expect(params.reloadPage).not.toHaveBeenCalled();
    expect(result.current.syncConflict).not.toBeNull();
  });

  test("서버 조회 중 슬롯 generation이 바뀌면 늦은 복구 응답을 폐기한다", async () => {
    const outbox = createMemoryOutbox([]);
    await outbox.putStateMutation({
      uid: "user-1",
      slotId: 1,
      mutationId: "pending-1",
      updatedAt: 100,
      state: { baseRevision: 1, stateSnapshot: { fullness: 1 }, actions: [] },
    });
    let resolveServerRead;
    getDoc.mockImplementation(() => new Promise((resolve) => {
      resolveServerRead = resolve;
    }));
    const params = createHookParams(outbox);
    const { result } = renderHook(() => useDurableGamePersistence(params));
    const pendingState = await outbox.getStateMutation();
    act(() => {
      result.current.quarantinePendingState(pendingState, {
        expectedRevision: 1,
        actualRevision: 2,
      });
    });

    let recoveryPromise;
    act(() => {
      recoveryPromise = result.current.resolveSyncConflict("server");
    });
    params.persistenceAccessRef.current = {
      ...params.persistenceAccessRef.current,
      phase: GAME_PERSISTENCE_PHASE.LOADING,
      generation: 2,
      loadedIdentity: null,
    };
    resolveServerRead({ exists: () => true, data: () => ({ revision: 3 }) });

    await act(async () => {
      await expect(recoveryPromise).rejects.toMatchObject({ code: "game/stale-conflict" });
    });
    expect(await outbox.getStateMutation()).not.toBeNull();
    expect(params.reloadPage).not.toHaveBeenCalled();
    expect(params.persistenceAccessRef.current.phase).toBe(GAME_PERSISTENCE_PHASE.LOADING);
  });
});

describe("resolveNewReplayActions", () => {
  test("한 저장에 새 로그가 여러 개면 발생 순서대로 모두 보존한다", () => {
    const actions = resolveNewReplayActions({
      previousLogs: [],
      updatedLogs: [
        { type: "TRAIN", text: "훈련", timestamp: 200 },
        { type: "SLEEP_DISTURBANCE", text: "수면 방해", timestamp: 100 },
      ],
      beforeStats: { strength: 1 },
      afterStats: { strength: 2 },
    });

    expect(actions.map((action) => action.type)).toEqual([
      "SLEEP_DISTURBANCE",
      "TRAIN",
    ]);
    expect(actions[0].safe).toBe(false);
  });
});
