import { act, renderHook } from "@testing-library/react";
import { useJogressRoomLifecycle } from "./useJogressRoomLifecycle";

const mockAddDoc = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockLimit = jest.fn();
const mockQuery = jest.fn();
const mockServerTimestamp = jest.fn();
const mockUpdateDoc = jest.fn();
const mockWhere = jest.fn();

jest.mock("firebase/firestore", () => ({
  addDoc: (...args) => mockAddDoc(...args),
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  limit: (...args) => mockLimit(...args),
  query: (...args) => mockQuery(...args),
  serverTimestamp: (...args) => mockServerTimestamp(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  where: (...args) => mockWhere(...args),
}));

jest.mock("../firebase", () => ({
  db: {},
}));

describe("useJogressRoomLifecycle", () => {
  let alertSpy;

  beforeEach(() => {
    mockAddDoc.mockReset();
    mockCollection.mockReset();
    mockDoc.mockReset();
    mockGetDoc.mockReset();
    mockGetDocs.mockReset();
    mockLimit.mockReset();
    mockQuery.mockReset();
    mockServerTimestamp.mockReset();
    mockUpdateDoc.mockReset();
    mockWhere.mockReset();

    mockCollection.mockImplementation((_db, ...segments) => segments.join("/"));
    mockDoc.mockImplementation((_db, ...segments) => segments.join("/"));
    mockWhere.mockImplementation((...args) => ({ type: "where", args }));
    mockLimit.mockImplementation((...args) => ({ type: "limit", args }));
    mockQuery.mockImplementation((...args) => ({ type: "query", args }));
    mockServerTimestamp.mockReturnValue("SERVER_TS");
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockUpdateDoc.mockResolvedValue(undefined);

    alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  function createParams(overrides = {}) {
    return {
      currentUser: {
        uid: "user-1",
        displayName: "테이머",
      },
      slotId: "1",
      selectedDigimon: "Agumon",
      version: "Ver.1",
      tamerName: "한태희",
      digimonNickname: "아구",
      slotEvolutionDataMap: {
        Agumon: {
          evolutions: [{ targetId: "Greymon", jogress: true }],
        },
      },
      resolveGuestDigimonName: jest.fn(() => "베타몬"),
      ...overrides,
    };
  }

  test("createJogressRoom은 room 문서와 host slot waiting 상태를 함께 저장한다", async () => {
    mockAddDoc.mockResolvedValue({ id: "room-1" });

    const { result } = renderHook(() =>
      useJogressRoomLifecycle(createParams())
    );

    let roomInfo = null;
    await act(async () => {
      roomInfo = await result.current.createJogressRoom();
    });

    expect(roomInfo).toEqual({ roomId: "room-1" });
    expect(mockAddDoc).toHaveBeenCalledWith(
      "jogress_rooms",
      expect.objectContaining({
        hostUid: "user-1",
        hostSlotId: "1",
        hostDigimonId: "Agumon",
        hostSlotVersion: "Ver.1",
        hostTamerName: "한태희",
        hostDigimonNickname: "아구",
        status: "waiting",
        createdAt: "SERVER_TS",
      })
    );
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      "users/user-1/slots/slot1",
      {
        jogressStatus: { isWaiting: true, roomId: "room-1" },
        updatedAt: "SERVER_TS",
      }
    );
  });

  test("cancelJogressRoom은 waiting 상태의 호스트 방만 취소하고 slot 상태를 비운다", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        hostUid: "user-1",
        status: "waiting",
        hostSlotId: 2,
      }),
    });

    const { result } = renderHook(() =>
      useJogressRoomLifecycle(createParams())
    );

    await act(async () => {
      await result.current.cancelJogressRoom("room-2");
    });

    expect(mockUpdateDoc).toHaveBeenNthCalledWith(1, "jogress_rooms/room-2", {
      status: "cancelled",
      updatedAt: "SERVER_TS",
    });
    expect(mockUpdateDoc).toHaveBeenNthCalledWith(2, "users/user-1/slots/slot2", {
      jogressStatus: {},
      updatedAt: "SERVER_TS",
    });
  });

  test("cancelOwnedWaitingJogressRoomsForSlot은 내 waiting 방 중 해당 슬롯만 취소한다", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: "room-2", data: () => ({ hostUid: "user-1", hostSlotId: 2 }) },
        { id: "room-3", data: () => ({ hostUid: "user-1", hostSlotId: 3 }) },
      ],
    });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        hostUid: "user-1",
        status: "waiting",
        hostSlotId: 2,
      }),
    });

    const { result } = renderHook(() =>
      useJogressRoomLifecycle(createParams())
    );

    let cancelledCount = 0;
    await act(async () => {
      cancelledCount = await result.current.cancelOwnedWaitingJogressRoomsForSlot(2);
    });

    expect(cancelledCount).toBe(1);
    expect(mockUpdateDoc).toHaveBeenNthCalledWith(1, "jogress_rooms/room-2", {
      status: "cancelled",
      updatedAt: "SERVER_TS",
    });
    expect(mockUpdateDoc).toHaveBeenNthCalledWith(2, "users/user-1/slots/slot2", {
      jogressStatus: {},
      updatedAt: "SERVER_TS",
    });
  });

  test("cancelOwnedWaitingJogressRoomsForSlot은 인덱스 쿼리 실패 시 fallback 목록으로 재시도한다", async () => {
    mockGetDocs
      .mockRejectedValueOnce(new Error("missing-index"))
      .mockResolvedValueOnce({
        docs: [
          { id: "room-4", data: () => ({ hostUid: "user-1", hostSlotId: "4" }) },
          { id: "room-x", data: () => ({ hostUid: "user-2", hostSlotId: "4" }) },
        ],
      });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        hostUid: "user-1",
        status: "waiting",
        hostSlotId: "4",
      }),
    });

    const { result } = renderHook(() =>
      useJogressRoomLifecycle(createParams())
    );

    let cancelledCount = 0;
    await act(async () => {
      cancelledCount = await result.current.cancelOwnedWaitingJogressRoomsForSlot("4");
    });

    expect(cancelledCount).toBe(1);
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(mockUpdateDoc).toHaveBeenNthCalledWith(1, "jogress_rooms/room-4", {
      status: "cancelled",
      updatedAt: "SERVER_TS",
    });
    expect(mockUpdateDoc).toHaveBeenNthCalledWith(2, "users/user-1/slots/slot4", {
      jogressStatus: {},
      updatedAt: "SERVER_TS",
    });
  });

  test("cancelOwnedWaitingJogressRoomsForSlot은 조회 오류를 삼키고 0을 반환한다", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockGetDocs
      .mockRejectedValueOnce(new Error("missing-index"))
      .mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() =>
      useJogressRoomLifecycle(createParams())
    );

    let cancelledCount = -1;
    await act(async () => {
      cancelledCount = await result.current.cancelOwnedWaitingJogressRoomsForSlot(5);
    });

    expect(cancelledCount).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("applyHostJogressStatusFromRoom은 paired room을 canEvolve payload로 변환한다", async () => {
    const resolveGuestDigimonName = jest.fn(() => "베타몬");

    const { result } = renderHook(() =>
      useJogressRoomLifecycle(
        createParams({
          resolveGuestDigimonName,
        })
      )
    );

    await act(async () => {
      await result.current.applyHostJogressStatusFromRoom(
        {
          hostUid: "user-1",
          hostSlotId: 7,
          hostSlotVersion: "Ver.1",
          guestUid: "user-2",
          guestSlotId: 3,
          guestSlotVersion: "Ver.2",
          guestTamerName: "게스트",
          guestDigimonId: "BetamonV2",
          status: "paired",
          targetId: "Omegamon",
        },
        "room-3"
      );
    });

    expect(resolveGuestDigimonName).toHaveBeenCalledWith({
      versionLabel: "Ver.2",
      digimonId: "BetamonV2",
    });
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      "users/user-1/slots/slot7",
      {
        jogressStatus: {
          canEvolve: true,
          roomId: "room-3",
          targetId: "Omegamon",
          partnerUserId: "user-2",
          partnerSlotId: 3,
          guestTamerName: "게스트",
          guestDigimonId: "BetamonV2",
          guestDigimonName: "베타몬",
        },
        updatedAt: "SERVER_TS",
      }
    );
  });
});
