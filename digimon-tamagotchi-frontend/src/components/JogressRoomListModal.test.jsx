import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import JogressRoomListModal from "./JogressRoomListModal";
import { fetchJogressRooms } from "../utils/jogressApi";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({ collection: jest.fn(), getDocs: jest.fn() }));
jest.mock("../utils/jogressApi", () => ({ fetchJogressRooms: jest.fn() }));

describe("JogressRoomListModal Ghost 표시", () => {
  test("live와 Ghost 계약을 구분하고 Ghost에는 호스트 진화 버튼을 표시하지 않는다", async () => {
    fetchJogressRooms.mockImplementation((_user, scope) => Promise.resolve(scope === "mine" ? {
      rooms: [
        {
          id: "live-room", status: "waiting", linkStatus: "live", hostSlotId: 1,
          hostDigimonId: "BanchoLeomon", hostSlotVersion: "Ver.3", hostTamerName: "한태희",
        },
        {
          id: "ghost-room", status: "paired", linkStatus: "ghost", hostSlotId: 2,
          hostDigimonId: "BlitzGreymon", hostSlotVersion: "Ver.1", hostTamerName: "한태희",
          guestDigimonId: "CresGarurumon", guestSlotVersion: "Ver.2",
        },
      ],
    } : { rooms: [] }));

    render(
      <JogressRoomListModal
        currentUser={{ uid: "host" }}
        onClose={jest.fn()}
        onHostEvolveFromRoom={jest.fn()}
      />
    );

    expect(await screen.findByText("현재 형태 · 양쪽 진화")).toBeInTheDocument();
    expect(screen.getByText("등록 형태 Ghost · 참가자만 진화 · 1회용")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: "진화" })).not.toBeInTheDocument());
  });
});
