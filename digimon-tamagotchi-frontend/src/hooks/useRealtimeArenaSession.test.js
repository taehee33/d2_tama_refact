import { act, renderHook, waitFor } from "@testing-library/react";
import { onSnapshot } from "firebase/firestore";
import useRealtimeArenaSession from "./useRealtimeArenaSession";
import { listRealtimeArenaBattles, sendRealtimeArenaCommand } from "../utils/realtimeArenaApi";

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((db, collection, battleId) => ({ db, collection, battleId })),
  onSnapshot: jest.fn(() => jest.fn()),
}));
jest.mock("../firebase", () => ({ db: { name: "test-db" } }));
jest.mock("../utils/realtimeArenaApi", () => ({
  createRealtimeArenaBattle: jest.fn(),
  listRealtimeArenaBattles: jest.fn(async () => ({ rooms: [] })),
  sendRealtimeArenaCommand: jest.fn(),
}));

beforeEach(() => {
  sessionStorage.clear();
  jest.clearAllMocks();
  listRealtimeArenaBattles.mockResolvedValue({ rooms: [] });
});

test("게스트는 참가 API 성공 후에만 참가자 전용 Firestore 구독을 시작한다", async () => {
  sessionStorage.clear();
  let resolveJoin;
  const joinResponse = new Promise((resolve) => { resolveJoin = resolve; });
  sendRealtimeArenaCommand
    .mockImplementationOnce(() => joinResponse)
    .mockResolvedValueOnce({ battle: null, viewer: { role: "guest", hasSubmitted: false } });
  const currentUser = { uid: "guest", getIdToken: jest.fn() };
  const { result } = renderHook(() => useRealtimeArenaSession({ currentUser, slotId: "slot2" }));

  let joinPromise;
  act(() => {
    joinPromise = result.current.joinBattle("rtb_invited_battle");
  });

  expect(result.current.battleId).toBe("");
  expect(onSnapshot).not.toHaveBeenCalled();

  await act(async () => {
    resolveJoin({
      battle: { battleId: "rtb_invited_battle", status: "waiting", round: 0, resolvedRounds: [] },
      viewer: { role: "guest", hasSubmitted: false },
    });
    await joinPromise;
  });

  expect(result.current.battleId).toBe("rtb_invited_battle");
  await waitFor(() => expect(onSnapshot).toHaveBeenCalledTimes(1));
});

test("로비에 진입하면 대기방 목록을 불러온다", async () => {
  sessionStorage.clear();
  listRealtimeArenaBattles.mockResolvedValue({ rooms: [{ battleId: "rtb_room", digimonName: "레오몬", stage: "Adult" }] });
  const currentUser = { uid: "guest", getIdToken: jest.fn() };

  const { result } = renderHook(() => useRealtimeArenaSession({ currentUser, slotId: "slot2" }));

  await waitFor(() => expect(result.current.rooms).toHaveLength(1));
  expect(listRealtimeArenaBattles).toHaveBeenCalledWith(currentUser);
});

test("복구 응답의 내 선택을 강조하고 다음 selectionRevision으로 변경한다", async () => {
  sessionStorage.setItem("realtime_arena_active_battle_id", "rtb_active");
  const battle = {
    battleId: "rtb_active",
    status: "selecting",
    round: 1,
    stateVersion: 4,
    deadlineAt: new Date(Date.now() + 7000).toISOString(),
    selectionOpensAt: new Date(Date.now() - 1000).toISOString(),
    resolvedRounds: [],
  };
  sendRealtimeArenaCommand
    .mockResolvedValueOnce({ battle, viewer: { role: "host", hasSubmitted: true, selectedAction: "guard", selectionRevision: 2 } })
    .mockResolvedValueOnce({ battle, viewer: { role: "host", hasSubmitted: true, selectedAction: "attack", selectionRevision: 3 } });
  const currentUser = { uid: "host", getIdToken: jest.fn() };
  const { result, unmount } = renderHook(() => useRealtimeArenaSession({ currentUser, slotId: "slot1" }));

  await waitFor(() => expect(result.current.selectedAction).toBe("guard"));
  await act(async () => {
    await result.current.selectAction("attack");
  });

  expect(sendRealtimeArenaCommand).toHaveBeenLastCalledWith(currentUser, "rtb_active", expect.objectContaining({
    command: "submit-action",
    action: "attack",
    selectionRevision: 3,
  }));
  expect(result.current.selectedAction).toBe("attack");
  unmount();
});

test("마감 판정 명령은 재시도 대상을 식별할 현재 라운드를 포함한다", async () => {
  sessionStorage.setItem("realtime_arena_active_battle_id", "rtb_timeout");
  const battle = {
    battleId: "rtb_timeout",
    status: "selecting",
    round: 3,
    stateVersion: 8,
    deadlineAt: new Date(Date.now() - 1000).toISOString(),
    selectionOpensAt: new Date(Date.now() - 8000).toISOString(),
    resolvedRounds: [],
  };
  sendRealtimeArenaCommand.mockResolvedValue({
    battle,
    viewer: { role: "host", hasSubmitted: false, selectedAction: null, selectionRevision: 0 },
  });
  const currentUser = { uid: "host", getIdToken: jest.fn() };

  const { unmount } = renderHook(() => useRealtimeArenaSession({ currentUser, slotId: "slot1" }));

  await waitFor(() => expect(sendRealtimeArenaCommand).toHaveBeenCalledWith(
    currentUser,
    "rtb_timeout",
    expect.objectContaining({ command: "resolve-timeout", round: 3 })
  ));
  unmount();
});

test("구버전 운영 API가 round를 거부하면 기존 마감 요청으로 재시도한다", async () => {
  sessionStorage.setItem("realtime_arena_active_battle_id", "rtb_legacy_timeout");
  const expiredBattle = {
    battleId: "rtb_legacy_timeout",
    status: "selecting",
    round: 2,
    stateVersion: 5,
    deadlineAt: new Date(Date.now() - 1000).toISOString(),
    selectionOpensAt: new Date(Date.now() - 8000).toISOString(),
    resolvedRounds: [],
  };
  const resolvedBattle = {
    ...expiredBattle,
    round: 3,
    stateVersion: 6,
    deadlineAt: new Date(Date.now() + 7000).toISOString(),
  };
  const legacyContractError = Object.assign(
    new Error("허용되지 않은 요청 필드가 있습니다."),
    { code: "ARENA_INVALID_REQUEST" }
  );
  sendRealtimeArenaCommand
    .mockResolvedValueOnce({
      battle: expiredBattle,
      viewer: { role: "host", hasSubmitted: true, selectedAction: "guard", selectionRevision: 1 },
    })
    .mockRejectedValueOnce(legacyContractError)
    .mockResolvedValueOnce({
      battle: resolvedBattle,
      viewer: { role: "host", hasSubmitted: false, selectedAction: null, selectionRevision: 0 },
    });
  const currentUser = { uid: "host", getIdToken: jest.fn() };

  const { result, unmount } = renderHook(() => useRealtimeArenaSession({ currentUser, slotId: "slot1" }));

  await waitFor(() => expect(sendRealtimeArenaCommand).toHaveBeenCalledTimes(3));
  const modernRequest = sendRealtimeArenaCommand.mock.calls[1][2];
  const legacyRequest = sendRealtimeArenaCommand.mock.calls[2][2];
  expect(modernRequest).toEqual(expect.objectContaining({ command: "resolve-timeout", round: 2 }));
  expect(legacyRequest).toEqual({ command: "resolve-timeout", requestId: modernRequest.requestId });
  await waitFor(() => expect(result.current.error).toBe(""));
  unmount();
});
