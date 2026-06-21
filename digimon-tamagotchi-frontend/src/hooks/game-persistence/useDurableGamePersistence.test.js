import { act, renderHook } from "@testing-library/react";
import {
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
  return {
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
  };
}

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
