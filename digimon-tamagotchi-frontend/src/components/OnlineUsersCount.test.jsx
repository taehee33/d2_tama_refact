import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import OnlineUsersCount from "./OnlineUsersCount";

const mockUsePresenceContext = jest.fn();
const mockGetPresenceDisplayName = jest.fn((member) => member.clientId || "테이머");

jest.mock("../contexts/AblyContext", () => ({
  usePresenceContext: () => mockUsePresenceContext(),
}));

jest.mock("../utils/presenceUtils", () => ({
  getPresenceDisplayName: (...args) => mockGetPresenceDisplayName(...args),
}));

describe("OnlineUsersCount", () => {
  const setIsChatOpen = jest.fn();

  const makeContext = (overrides = {}) => ({
    presenceData: [
      {
        clientId: "한태희",
        connectionId: "conn-1",
        data: { status: "online" },
      },
    ],
    presenceCount: 4,
    unreadCount: 2,
    setIsChatOpen,
    markChatRead: jest.fn(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePresenceContext.mockReturnValue(makeContext());
  });

  test("팝업을 열어도 unread 카운트를 즉시 초기화하지 않는다", () => {
    render(<OnlineUsersCount />);

    fireEvent.click(screen.getByText("4명").closest("button"));

    expect(
      screen.getByRole("heading", { name: /접속 중인 테이머 \(4명\)/ })
    ).toBeInTheDocument();
  });

  test("채팅 컨테이너가 있으면 스크롤로 이동하고 drawer를 직접 열지는 않는다", () => {
    const scrollIntoView = jest.fn();
    const chatContainer = { scrollIntoView };
    const querySelectorSpy = jest.spyOn(document, "querySelector").mockReturnValue(chatContainer);

    render(<OnlineUsersCount />);

    fireEvent.click(screen.getByTitle("채팅으로 이동"));

    expect(querySelectorSpy).toHaveBeenCalledWith(".tamer-chat-container");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "end" });
    expect(setIsChatOpen).not.toHaveBeenCalled();

    querySelectorSpy.mockRestore();
  });

  test("채팅 컨테이너가 없으면 drawer를 연다", () => {
    const querySelectorSpy = jest.spyOn(document, "querySelector").mockReturnValue(null);

    render(<OnlineUsersCount />);

    fireEvent.click(screen.getByTitle("채팅으로 이동"));

    expect(setIsChatOpen).toHaveBeenCalledWith(true);

    querySelectorSpy.mockRestore();
  });
});
