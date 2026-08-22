import { act, renderHook, waitFor } from "@testing-library/react";
import { getDocs } from "firebase/firestore";
import {
  buildArenaHistoryStreamDefinitions,
  useArenaBattleHistory,
} from "./useArenaBattleHistory";

jest.mock("firebase/firestore", () => ({
  collection: (db, name) => ({ db, name }),
  getDocs: jest.fn(),
  limit: (value) => ({ type: "limit", value }),
  orderBy: (field, direction) => ({ type: "orderBy", field, direction }),
  query: (source, ...constraints) => ({ source, constraints }),
  startAfter: (cursor) => ({ type: "startAfter", cursor }),
  where: (field, operation, value) => ({ type: "where", field, operation, value }),
}));
jest.mock("../firebase", () => ({ db: { name: "history-test-db" } }));

function createDocument(id, occurredAt, extra = {}) {
  return {
    id,
    data: () => ({
      battleId: id,
      attackerId: "user-1",
      defenderId: "opponent",
      timestamp: { toDate: () => new Date(occurredAt) },
      ...extra,
    }),
  };
}

function getWhereValues(request) {
  return Object.fromEntries(
    request.constraints
      .filter((constraint) => constraint.type === "where")
      .map((constraint) => [constraint.field, constraint.value])
  );
}

function getCursorId(request) {
  return request.constraints.find((constraint) => constraint.type === "startAfter")?.cursor?.id || null;
}

describe("useArenaBattleHistory cursor 페이지", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("전체·현재 연결·Ghost 필터별 전용 스트림을 구성한다", () => {
    expect(buildArenaHistoryStreamDefinitions("all", "user-1")).toEqual([
      { key: "attack", conditions: [["attackerId", "user-1"]] },
      { key: "defense", conditions: [["defenderId", "user-1"]] },
    ]);
    expect(buildArenaHistoryStreamDefinitions("combat:combat-1", "user-1")).toEqual([
      { key: "combat", conditions: [["attackerCombatIdentityId", "combat-1"]] },
    ]);
    expect(buildArenaHistoryStreamDefinitions("ghost:ghost-1", "user-1")).toEqual([
      { key: "attack", conditions: [["attackerId", "user-1"], ["defenderGhostId", "ghost-1"]] },
      { key: "defense", conditions: [["defenderId", "user-1"], ["defenderGhostId", "ghost-1"]] },
    ]);
  });

  test("미방문 다음 페이지만 조회하고 이전·방문 페이지는 캐시한다", async () => {
    const firstAttackPage = Array.from({ length: 6 }, (_, index) =>
      createDocument(`attack-${index + 1}`, `2026-08-22T0${9 - index}:00:00Z`)
    );
    getDocs.mockImplementation(async (request) => {
      const whereValues = getWhereValues(request);
      if (whereValues.defenderId === "user-1") return { docs: [] };
      if (whereValues.attackerId === "user-1" && getCursorId(request) === "attack-6") {
        return { docs: [createDocument("attack-7", "2026-08-22T03:00:00Z")] };
      }
      return { docs: firstAttackPage };
    });

    const currentUser = { uid: "user-1" };
    const { result } = renderHook(() => useArenaBattleHistory({ currentUser, isOnline: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("");
    await waitFor(() => expect(result.current.logs).toHaveLength(5));
    expect(result.current.logs.map((log) => log.battleId)).toEqual([
      "attack-1", "attack-2", "attack-3", "attack-4", "attack-5",
    ]);
    expect(result.current.pageNumber).toBe(1);
    expect(result.current.hasPrevious).toBe(false);
    expect(result.current.hasMore).toBe(true);
    expect(getDocs).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.current.goToNextPage();
    });
    expect(result.current.logs.map((log) => log.battleId)).toEqual(["attack-6", "attack-7"]);
    expect(result.current.pageNumber).toBe(2);
    expect(result.current.hasPrevious).toBe(true);
    expect(result.current.hasMore).toBe(false);
    expect(getDocs).toHaveBeenCalledTimes(3);

    act(() => result.current.goToPreviousPage());
    expect(result.current.pageNumber).toBe(1);
    expect(getDocs).toHaveBeenCalledTimes(3);

    await act(async () => {
      await result.current.goToNextPage();
    });
    expect(result.current.pageNumber).toBe(2);
    expect(getDocs).toHaveBeenCalledTimes(3);
  });

  test("정확히 5건인 마지막 페이지에서는 다음 이동을 비활성화한다", async () => {
    const fiveLogs = Array.from({ length: 5 }, (_, index) =>
      createDocument(`only-${index + 1}`, `2026-08-22T0${9 - index}:00:00Z`)
    );
    getDocs.mockImplementation(async (request) => {
      const whereValues = getWhereValues(request);
      return { docs: whereValues.attackerId === "user-1" ? fiveLogs : [] };
    });

    const currentUser = { uid: "user-1" };
    const { result } = renderHook(() => useArenaBattleHistory({ currentUser, isOnline: true }));
    await waitFor(() => expect(result.current.logs).toHaveLength(5));

    expect(result.current.pageNumber).toBe(1);
    expect(result.current.hasMore).toBe(false);
    expect(await result.current.goToNextPage()).toBe(false);
    expect(getDocs).toHaveBeenCalledTimes(2);
  });

  test("연속 다음 클릭을 한 요청으로 제한하고 오류 후 같은 cursor에서 재시도한다", async () => {
    const firstAttackPage = Array.from({ length: 6 }, (_, index) =>
      createDocument(`retry-${index + 1}`, `2026-08-22T0${9 - index}:00:00Z`)
    );
    let nextAttempts = 0;
    getDocs.mockImplementation(async (request) => {
      const whereValues = getWhereValues(request);
      if (whereValues.defenderId === "user-1") return { docs: [] };
      if (getCursorId(request) === "retry-6") {
        nextAttempts += 1;
        if (nextAttempts === 1) throw new Error("일시적인 조회 오류");
        return { docs: [createDocument("retry-7", "2026-08-22T03:00:00Z")] };
      }
      return { docs: firstAttackPage };
    });

    const currentUser = { uid: "user-1" };
    const { result } = renderHook(() => useArenaBattleHistory({ currentUser, isOnline: true }));
    await waitFor(() => expect(result.current.logs).toHaveLength(5));

    let firstRequest;
    let duplicateRequest;
    act(() => {
      firstRequest = result.current.goToNextPage();
      duplicateRequest = result.current.goToNextPage();
    });
    await act(async () => {
      expect(await duplicateRequest).toBe(false);
      expect(await firstRequest).toBe(false);
    });
    expect(result.current.error).toBe("일시적인 조회 오류");
    expect(nextAttempts).toBe(1);

    await act(async () => {
      expect(await result.current.goToNextPage()).toBe(true);
    });
    expect(result.current.logs.map((log) => log.battleId)).toEqual(["retry-6", "retry-7"]);
    expect(result.current.pageNumber).toBe(2);
    expect(nextAttempts).toBe(2);
  });

  test("Ghost 필터는 전용 쿼리로 1페이지를 만들고 다시 선택하면 캐시를 사용한다", async () => {
    getDocs.mockImplementation(async (request) => {
      const whereValues = getWhereValues(request);
      if (whereValues.defenderGhostId === "ghost-1" && whereValues.attackerId === "user-1") {
        return { docs: [createDocument("filtered-attack", "2026-08-22T05:00:00Z", { defenderGhostId: "ghost-1" })] };
      }
      if (whereValues.defenderGhostId === "ghost-1" && whereValues.defenderId === "user-1") {
        return { docs: [createDocument("filtered-defense", "2026-08-22T04:00:00Z", {
          attackerId: "opponent",
          defenderId: "user-1",
          defenderGhostId: "ghost-1",
        })] };
      }
      if (whereValues.attackerId === "user-1") {
        return { docs: [createDocument("all-attack", "2026-08-22T06:00:00Z", { defenderGhostId: "ghost-1" })] };
      }
      return { docs: [] };
    });

    const currentUser = { uid: "user-1" };
    const { result } = renderHook(() => useArenaBattleHistory({ currentUser, isOnline: true }));
    await waitFor(() => expect(result.current.logs).toHaveLength(1));

    act(() => result.current.changeFilter("ghost:ghost-1"));
    await waitFor(() => expect(result.current.filter).toBe("ghost:ghost-1"));
    await waitFor(() => expect(result.current.logs).toHaveLength(2));
    expect(result.current.logs.map((log) => log.battleId)).toEqual(["filtered-attack", "filtered-defense"]);
    expect(getDocs).toHaveBeenCalledTimes(4);

    act(() => result.current.changeFilter("all"));
    await waitFor(() => expect(result.current.filter).toBe("all"));
    await waitFor(() => expect(result.current.logs[0]?.battleId).toBe("all-attack"));
    expect(getDocs).toHaveBeenCalledTimes(4);

    act(() => result.current.changeFilter("ghost:ghost-1"));
    await waitFor(() => expect(result.current.logs[0]?.battleId).toBe("filtered-attack"));
    expect(result.current.pageNumber).toBe(1);
    expect(getDocs).toHaveBeenCalledTimes(4);
  });

  test("새로고침은 현재 필터의 캐시를 비우고 1페이지를 다시 조회한다", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    const currentUser = { uid: "user-1" };
    const { result } = renderHook(() => useArenaBattleHistory({ currentUser, isOnline: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getDocs).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.pageNumber).toBe(0);
    expect(getDocs).toHaveBeenCalledTimes(4);
  });
});
