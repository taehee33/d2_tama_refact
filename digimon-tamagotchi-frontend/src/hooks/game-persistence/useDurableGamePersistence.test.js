import { act, renderHook } from "@testing-library/react";
import { getDoc } from "firebase/firestore";
import {
  canUseGameplayPersistence,
  GAME_PERSISTENCE_PHASE,
  isCurrentConflictIdentity,
  resolveNewReplayActions,
  useDurableGamePersistence,
} from "./useDurableGamePersistence";

const mockRunTransaction = jest.fn();

jest.mock("firebase/firestore", () => ({
  collection: (...args) => args.join("/"),
  doc: (...args) => args.join("/"),
  getDoc: jest.fn(),
  runTransaction: (...args) => mockRunTransaction(...args),
  setDoc: jest.fn(),
}));

jest.mock("../../firebase", () => ({ db: "DB" }));

function createMemoryOutbox(order) {
  let stateRecord = null;
  let feedEvents = [];
  return {
    async getStateMutation() { return stateRecord; },
    async putStateMutation(input) {
      order.push("outbox:put");
      stateRecord = {
        ...input,
        state: JSON.parse(JSON.stringify(input.state)),
      };
      return stateRecord;
    },
    async deleteStateMutation({ mutationId }) {
      if (stateRecord?.mutationId !== mutationId) return false;
      order.push("outbox:delete");
      stateRecord = null;
      return true;
    },
    async listActivityEvents() { return []; },
    async listBattleEvents() { return []; },
    async listFeedEvents() { return feedEvents; },
    async putActivityEvent() {},
    async deleteActivityEvent() {},
    async putBattleEvent() {},
    async deleteBattleEvent() {},
    async putFeedEvent(input) {
      const next = { ...input };
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
      loadedIdentity: { uid: "user-1", slotId: 1 },
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
    loadedIdentity: { uid: "user-1", slotId: 1 },
  };

  test("ready·identity·generation·revision이 모두 일치할 때만 저장을 허용한다", () => {
    expect(canUseGameplayPersistence({
      access: readyAccess,
      currentUid: "user-1",
      currentSlotId: 1,
      loadedRevision: 4,
      saveContext: { uid: "user-1", slotId: 1, generation: 3, requestedAtRevision: 4 },
    })).toBe(true);
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
      saveContext: { uid: "user-1", slotId: 1, generation: 3 },
      ...override,
    })).toBe(false);
  });
});

describe("isCurrentConflictIdentity", () => {
  test("uid·slotId·generation이 모두 같은 충돌만 현재 슬롯 복구에 사용한다", () => {
    const access = {
      generation: 4,
      loadedIdentity: { uid: "user-1", slotId: 1 },
    };
    const conflict = { identity: { uid: "user-1", slotId: 1, generation: 4 } };

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
  });

  afterEach(() => {
    jest.useRealTimers();
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
