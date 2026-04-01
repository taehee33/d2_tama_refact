import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import PlayChatDrawer from "./PlayChatDrawer";

const mockUsePresenceContext = jest.fn();
const mockChatRoom = jest.fn();

jest.mock("../../contexts/AblyContext", () => ({
  usePresenceContext: () => mockUsePresenceContext(),
}));

jest.mock("../ChatRoom", () => (props) => {
  mockChatRoom(props);
  return <div data-testid="play-chat-room">{`ChatRoom:${props.variant}`}</div>;
});

jest.mock("./PlayChatButton", () => () => <div data-testid="play-chat-button">채팅 버튼</div>);

describe("PlayChatDrawer", () => {
  const setIsChatOpen = jest.fn();
  const clearUnreadCount = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUsePresenceContext.mockReturnValue({
      isChatOpen: true,
      setIsChatOpen,
      unreadCount: 2,
      clearUnreadCount,
      presenceCount: 5,
    });
  });

  test("열림 상태에서 닫기 버튼을 헤더에 두고 상단 접속자 배지는 렌더링하지 않는다", () => {
    const { container } = render(<PlayChatDrawer />);

    const dialog = screen.getByRole("dialog");
    const header = container.querySelector(".play-chat-drawer__header");
    const content = container.querySelector(".play-chat-drawer__content");
    const backdrop = container.querySelector(".play-chat-backdrop");
    const closeButton = screen.getByRole("button", { name: "닫기" });
    const chatRoom = screen.getByTestId("play-chat-room");

    expect(dialog).toHaveAttribute("aria-labelledby", "play-chat-drawer-title");
    expect(dialog).toHaveAttribute("aria-hidden", "false");
    expect(backdrop).toHaveClass("play-chat-backdrop--open");
    expect(header).toContainElement(screen.getByText("테이머 채팅"));
    expect(screen.queryByText("접속 5명")).not.toBeInTheDocument();
    expect(header).toContainElement(closeButton);
    expect(content).not.toContainElement(closeButton);
    expect(content).toContainElement(chatRoom);
    expect(chatRoom).toHaveTextContent("ChatRoom:drawer");
    expect(mockChatRoom.mock.calls[0][0]).toEqual(
      expect.objectContaining({ variant: "drawer" })
    );

    fireEvent.click(closeButton);

    expect(setIsChatOpen).toHaveBeenCalledWith(false);
    expect(clearUnreadCount).toHaveBeenCalled();
  });
});
