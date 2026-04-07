import React from "react";
import { render, screen } from "@testing-library/react";
import PlayChatButton from "./PlayChatButton";

describe("PlayChatButton", () => {
  test("닫힘 상태에서 채팅 라벨과 접속 수를 함께 보여준다", () => {
    render(
      <PlayChatButton
        controlsId="drawer"
        isOpen={false}
        unreadCount={0}
        presenceCount={2}
        onClick={() => {}}
      />
    );

    const button = screen.getByRole("button", { name: "채팅" });

    expect(button).toBeInTheDocument();
    expect(screen.getByText("채팅")).toBeInTheDocument();
    expect(screen.getByText("2명")).toBeInTheDocument();
    expect(button.querySelector(".play-chat-fab__icon-wrap")).not.toBeNull();
  });

  test("열림 상태에서도 접속 수를 유지하고 배지를 아이콘 위에 렌더한다", () => {
    render(
      <PlayChatButton
        controlsId="drawer"
        isOpen={true}
        unreadCount={3}
        presenceCount={0}
        onClick={() => {}}
      />
    );

    const button = screen.getByRole("button", { name: "채팅 닫기" });
    const iconWrap = button.querySelector(".play-chat-fab__icon-wrap");
    const badge = button.querySelector(".play-chat-fab__badge");

    expect(button).toBeInTheDocument();
    expect(screen.getByText("0명")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(iconWrap).not.toBeNull();
    expect(badge).not.toBeNull();
    expect(iconWrap).toContainElement(badge);
  });
});
