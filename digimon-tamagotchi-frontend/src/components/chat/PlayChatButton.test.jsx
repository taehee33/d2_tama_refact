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

    expect(screen.getByRole("button", { name: "채팅" })).toBeInTheDocument();
    expect(screen.getByText("채팅")).toBeInTheDocument();
    expect(screen.getByText("2명")).toBeInTheDocument();
  });

  test("열림 상태에서도 접속 수를 유지한다", () => {
    render(
      <PlayChatButton
        controlsId="drawer"
        isOpen={true}
        unreadCount={3}
        presenceCount={0}
        onClick={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "채팅 닫기" })).toBeInTheDocument();
    expect(screen.getByText("0명")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
