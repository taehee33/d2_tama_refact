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
