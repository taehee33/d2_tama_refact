import { act, renderHook } from "@testing-library/react";
import { useJogressRoomLifecycle } from "./useJogressRoomLifecycle";
import { cancelJogressRoomApi, createJogressRoomApi } from "../utils/jogressApi";

jest.mock("../utils/jogressApi", () => ({
  JogressApiError: class JogressApiError extends Error {},
  cancelJogressRoomApi: jest.fn(),
  createJogressRoomApi: jest.fn(),
}));

const currentUser = { uid: "host-uid", getIdToken: jest.fn() };
const evolutionMap = { source: { evolutions: [{ jogress: { partner: "partner" } }] } };

function params(overrides = {}) {
  return {
    currentUser,
    slotId: 1,
    selectedDigimon: "source",
    slotEvolutionDataMap: evolutionMap,
    flushOutbox: jest.fn().mockResolvedValue(true),
    refreshGameRevision: jest.fn().mockResolvedValue(7),
    ...overrides,
  };
}

describe("useJogressRoomLifecycle 서버 API 계약", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.alert = jest.fn();
  });

  test("현재 슬롯 outbox를 flush한 뒤 revision으로 방을 생성한다", async () => {
    createJogressRoomApi.mockResolvedValue({ room: { id: "room-1" }, alreadyRegistered: false });
    const input = params();
    const { result } = renderHook(() => useJogressRoomLifecycle(input));
    let response;
    await act(async () => { response = await result.current.createJogressRoom(); });
    expect(input.flushOutbox).toHaveBeenCalled();
    expect(input.refreshGameRevision).toHaveBeenCalled();
    expect(createJogressRoomApi).toHaveBeenCalledWith(currentUser, { slotId: 1, expectedRevision: 7 });
    expect(response).toEqual({ roomId: "room-1", room: { id: "room-1" }, alreadyRegistered: false });
  });

  test("다른 슬롯은 목록 스냅숏 revision으로 생성한다", async () => {
    createJogressRoomApi.mockResolvedValue({ room: { id: "room-2" }, alreadyRegistered: true });
    const input = params();
    const { result } = renderHook(() => useJogressRoomLifecycle(input));
    await act(async () => { await result.current.createJogressRoomForSlot({ id: 2, revision: 11 }); });
    expect(input.flushOutbox).not.toHaveBeenCalled();
    expect(createJogressRoomApi).toHaveBeenCalledWith(currentUser, { slotId: 2, expectedRevision: 11 });
  });

  test("취소는 방 문서를 직접 쓰지 않고 DELETE API를 호출한다", async () => {
    cancelJogressRoomApi.mockResolvedValue({ cancelledRoomId: "room-1" });
    const { result } = renderHook(() => useJogressRoomLifecycle(params()));
    await act(async () => { await result.current.cancelJogressRoom("room-1"); });
    expect(cancelJogressRoomApi).toHaveBeenCalledWith(currentUser, "room-1");
  });

  test("조그레스 불가 디지몬은 서버 요청 전에 차단한다", async () => {
    const { result } = renderHook(() => useJogressRoomLifecycle(params({ slotEvolutionDataMap: {} })));
    await act(async () => { await result.current.createJogressRoom(); });
    expect(createJogressRoomApi).not.toHaveBeenCalled();
    expect(global.alert).toHaveBeenCalledWith("현재 디지몬은 조그레스 진화가 불가능합니다.");
  });
});
