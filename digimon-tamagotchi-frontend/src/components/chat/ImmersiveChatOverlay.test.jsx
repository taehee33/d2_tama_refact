import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ImmersiveChatOverlay from "./ImmersiveChatOverlay";

const mockChatRoom = jest.fn();

jest.mock("ably/react", () => ({
  ChannelProvider: ({ children }) => <>{children}</>,
}));

jest.mock("../ChatRoom", () => (props) => {
  mockChatRoom(props);
  return <div data-testid="immersive-chat-room">{`ChatRoom:${props.variant}`}</div>;
});

describe("ImmersiveChatOverlay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("열림 상태에서는 backdrop, 닫기 버튼, drawer variant 채팅방을 렌더링한다", () => {
    const onClose = jest.fn();
    const { container } = render(
      <ImmersiveChatOverlay isOpen onClose={onClose} />
    );

    const dialog = screen.getByRole("dialog");
    const backdrop = container.querySelector(".immersive-chat-backdrop");
    const content = container.querySelector(".immersive-chat-overlay__content");
    const closeButton = screen.getByRole("button", { name: "닫기" });
    const chatRoom = screen.getByTestId("immersive-chat-room");

    expect(dialog).toHaveAttribute("aria-labelledby", "immersive-chat-overlay-title");
    expect(dialog).toHaveAttribute("aria-hidden", "false");
    expect(dialog).toHaveAttribute("data-landscape-side", "right");
    expect(backdrop).toHaveClass("immersive-chat-backdrop--open");
    expect(content).toContainElement(chatRoom);
    expect(chatRoom).toHaveTextContent("ChatRoom:drawer");
    expect(mockChatRoom.mock.calls[0][0]).toEqual(
      expect.objectContaining({ variant: "drawer" })
    );

    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledWith();
  });

  test("backdrop 클릭으로 overlay를 닫는다", () => {
    const onClose = jest.fn();
    const { container } = render(
      <ImmersiveChatOverlay
        isOpen
        isMobile
        landscapeSide="left"
        onClose={onClose}
      />
    );

    expect(container.querySelector(".immersive-chat-overlay")).toHaveAttribute(
      "data-landscape-side",
      "left"
    );
    fireEvent.click(container.querySelector(".immersive-chat-backdrop"));

    expect(onClose).toHaveBeenCalledWith();
  });

  test("rerender로 onClose 참조가 바뀌어도 자동으로 닫지 않는다", () => {
    const firstOnClose = jest.fn();
    const secondOnClose = jest.fn();
    const { rerender } = render(
      <ImmersiveChatOverlay isOpen onClose={firstOnClose} />
    );

    rerender(<ImmersiveChatOverlay isOpen onClose={secondOnClose} />);

    expect(firstOnClose).not.toHaveBeenCalled();
    expect(secondOnClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-hidden", "false");
  });
});
