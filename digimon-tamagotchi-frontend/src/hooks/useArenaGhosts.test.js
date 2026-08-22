import { act, renderHook, waitFor } from "@testing-library/react";
import { fetchArenaGhosts } from "../utils/arenaApi";
import { useArenaGhosts } from "./useArenaGhosts";

jest.mock("../utils/arenaApi", () => ({
  deleteArenaGhost: jest.fn(),
  fetchArenaGhosts: jest.fn(),
  registerArenaGhost: jest.fn(),
}));

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("useArenaGhosts loading state", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("내 Ghost와 도전 상대 응답을 각각 완료되는 즉시 반영한다", async () => {
    const mine = createDeferred();
    const opponents = createDeferred();
    fetchArenaGhosts.mockImplementation((currentUser, options) =>
      options.scope === "mine" ? mine.promise : opponents.promise
    );

    const currentUser = { uid: "user-1" };
    const { result } = renderHook(() => useArenaGhosts({
      currentUser,
      isOnline: true,
      currentSlotId: 2,
    }));

    expect(result.current.myGhostsLoading).toBe(true);
    expect(result.current.opponentsLoading).toBe(true);

    await act(async () => {
      mine.resolve({
        ghosts: [{ ghostId: "mine-1", status: "active" }],
        capacity: { used: 1, limit: 3 },
      });
      await mine.promise;
    });

    await waitFor(() => expect(result.current.myGhostsLoading).toBe(false));
    expect(result.current.myGhosts).toHaveLength(1);
    expect(result.current.opponentsLoading).toBe(true);
    expect(result.current.loading).toBe(true);

    await act(async () => {
      opponents.resolve({ ghosts: [{ ghostId: "opponent-1", status: "active" }] });
      await opponents.promise;
    });

    await waitFor(() => expect(result.current.opponentsLoading).toBe(false));
    expect(result.current.opponents).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });

  test("상대는 6명 단위로 더 불러오고 중복 ID를 제거한다", async () => {
    fetchArenaGhosts.mockImplementation((currentUser, options) => {
      if (options.scope === "mine") {
        return Promise.resolve({ ghosts: [], capacity: { used: 0, limit: 3 } });
      }
      if (options.cursor === "cursor-2") {
        return Promise.resolve({
          ghosts: [{ ghostId: "opponent-2" }, { ghostId: "opponent-3" }],
          nextCursor: null,
        });
      }
      return Promise.resolve({
        ghosts: [{ ghostId: "opponent-1" }, { ghostId: "opponent-2" }],
        nextCursor: "cursor-2",
      });
    });

    const currentUser = { uid: "user-1" };
    const { result } = renderHook(() => useArenaGhosts({
      currentUser,
      isOnline: true,
      currentSlotId: 2,
    }));

    await waitFor(() => expect(result.current.opponents).toHaveLength(2));
    expect(fetchArenaGhosts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: "opponents", limit: 6, sort: "registered_desc", cursor: null })
    );
    expect(result.current.hasMoreOpponents).toBe(true);

    await act(async () => {
      await result.current.loadMoreOpponents();
    });

    expect(result.current.opponents.map((ghost) => ghost.ghostId)).toEqual([
      "opponent-1", "opponent-2", "opponent-3",
    ]);
    expect(result.current.hasMoreOpponents).toBe(false);
  });

  test("정렬 변경 시 기존 상대와 cursor를 초기화해 첫 페이지를 다시 조회한다", async () => {
    fetchArenaGhosts.mockImplementation((currentUser, options) => {
      if (options.scope === "mine") {
        return Promise.resolve({ ghosts: [], capacity: { used: 0, limit: 3 } });
      }
      return Promise.resolve({
        ghosts: [{ ghostId: options.sort }],
        nextCursor: options.sort === "registered_desc" ? "old-cursor" : null,
      });
    });

    const currentUser = { uid: "user-1" };
    const { result } = renderHook(() => useArenaGhosts({
      currentUser,
      isOnline: true,
      currentSlotId: 2,
    }));
    await waitFor(() => expect(result.current.hasMoreOpponents).toBe(true));

    act(() => result.current.changeOpponentSort("defense_wins_desc"));

    await waitFor(() => expect(result.current.opponents).toEqual([{ ghostId: "defense_wins_desc" }]));
    expect(result.current.opponentSort).toBe("defense_wins_desc");
    expect(result.current.hasMoreOpponents).toBe(false);
    expect(fetchArenaGhosts).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ sort: "defense_wins_desc", cursor: null })
    );
  });

  test("더보기 요청 중 연속 호출을 차단하고 실패한 cursor는 재시도할 수 있게 유지한다", async () => {
    const more = createDeferred();
    fetchArenaGhosts.mockImplementation((currentUser, options) => {
      if (options.scope === "mine") {
        return Promise.resolve({ ghosts: [], capacity: { used: 0, limit: 3 } });
      }
      if (options.cursor) return more.promise;
      return Promise.resolve({ ghosts: [{ ghostId: "opponent-1" }], nextCursor: "cursor-2" });
    });
    const currentUser = { uid: "user-1" };
    const { result } = renderHook(() => useArenaGhosts({ currentUser, isOnline: true, currentSlotId: 2 }));
    await waitFor(() => expect(result.current.hasMoreOpponents).toBe(true));

    let firstRequest;
    await act(async () => {
      firstRequest = result.current.loadMoreOpponents();
      const secondResult = await result.current.loadMoreOpponents();
      expect(secondResult).toBe(false);
      more.reject(new Error("network error"));
      await firstRequest;
    });

    expect(fetchArenaGhosts.mock.calls.filter(([, options]) => options.cursor === "cursor-2")).toHaveLength(1);
    expect(result.current.opponents).toEqual([{ ghostId: "opponent-1" }]);
    expect(result.current.hasMoreOpponents).toBe(true);
    expect(result.current.opponentsError).toBe("network error");
  });
});
