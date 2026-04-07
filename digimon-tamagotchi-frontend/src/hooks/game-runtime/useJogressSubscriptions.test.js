import React from "react";
import { act, renderHook } from "@testing-library/react";
import { useJogressSubscriptions } from "./useJogressSubscriptions";

const mockDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock("firebase/firestore", () => ({
  doc: (...args) => mockDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
}));

jest.mock("../../firebase", () => ({
  db: {},
}));

describe("useJogressSubscriptions", () => {
  beforeEach(() => {
    mockDoc.mockReset();
    mockOnSnapshot.mockReset();
    delete window.__DIGIMON_RUNTIME_METRICS__;
  });

  test("동일한 jogress payload가 다시 오면 불필요한 state update를 만들지 않는다", () => {
    const callbacks = [];
    const unsubscribe = jest.fn();
    const applyHostJogressStatusFromRoom = jest.fn();

    mockDoc.mockImplementation((...segments) => segments.join("/"));
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      callbacks.push(onNext);
      return unsubscribe;
    });

    const { result } = renderHook(() => {
      const [slotJogressStatus, setSlotJogressStatus] = React.useState(null);
      const [myJogressRoomId, setMyJogressRoomId] = React.useState(null);

      useJogressSubscriptions({
        currentUserUid: "user-1",
        slotId: "1",
        slotJogressStatus,
        myJogressRoomId,
        setSlotJogressStatus,
        setMyJogressRoomId,
        applyHostJogressStatusFromRoom,
      });

      return slotJogressStatus;
    });

    const slotSnapshotCallback = callbacks[0];

    act(() => {
      slotSnapshotCallback({
        data: () => ({
          jogressStatus: {
            roomId: "room-1",
            isWaiting: true,
          },
        }),
      });
    });

    expect(result.current).toEqual({
      roomId: "room-1",
      isWaiting: true,
    });
    expect(window.__DIGIMON_RUNTIME_METRICS__.counters).toMatchObject({
      slot_jogress_snapshot_wakeups: 1,
      slot_jogress_state_updates: 1,
    });

    act(() => {
      slotSnapshotCallback({
        data: () => ({
          jogressStatus: {
            roomId: "room-1",
            isWaiting: true,
          },
        }),
      });
    });

    expect(result.current).toEqual({
      roomId: "room-1",
      isWaiting: true,
    });
    expect(window.__DIGIMON_RUNTIME_METRICS__.counters).toMatchObject({
      slot_jogress_snapshot_wakeups: 2,
      slot_jogress_state_updates: 1,
    });
  });
});
