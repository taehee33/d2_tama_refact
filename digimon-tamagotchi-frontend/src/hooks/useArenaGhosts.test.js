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
});
