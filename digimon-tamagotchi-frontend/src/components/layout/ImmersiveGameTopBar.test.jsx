import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ImmersiveGameTopBar from "./ImmersiveGameTopBar";

describe("ImmersiveGameTopBar", () => {
  test("모바일에서 접힘 상태면 메뉴 FAB만 렌더링한다", () => {
    const onToggleCollapsed = jest.fn();

    render(
      <ImmersiveGameTopBar
        isMobile
        isCollapsed
        unreadCount={3}
        onToggleCollapsed={onToggleCollapsed}
      />
    );

    expect(screen.getByRole("button", { name: "메뉴 열기" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.getByText("메뉴")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "가로" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  test("모바일에서 펼침 상태면 액션을 렌더링하고 실행 후 접는다", () => {
    const onOpenBaseView = jest.fn();
    const onOpenPlayHub = jest.fn();
    const onChangeLayoutMode = jest.fn();
    const onToggleSkinPicker = jest.fn();
    const onToggleChat = jest.fn();
    const onCycleLandscapeSide = jest.fn();
    const onToggleCollapsed = jest.fn();
    render(
      <ImmersiveGameTopBar
        isMobile
        isCollapsed={false}
        layoutMode="portrait"
        unreadCount={3}
        presenceCount={5}
        showLandscapeSideToggle
        landscapeSidePreference="auto"
        effectiveLandscapeSide="left"
        onToggleCollapsed={onToggleCollapsed}
        onChangeLayoutMode={onChangeLayoutMode}
        onToggleChat={onToggleChat}
        onCycleLandscapeSide={onCycleLandscapeSide}
        onToggleSkinPicker={onToggleSkinPicker}
        onOpenBaseView={onOpenBaseView}
        onOpenPlayHub={onOpenPlayHub}
      />
    );

    expect(screen.getByTestId("immersive-game-topbar")).toHaveClass(
      "game-immersive-nav--mobile"
    );
    expect(screen.getByRole("button", { name: "세로" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "메뉴 닫기" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByText("닫기")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "기본 화면" }));
    fireEvent.click(screen.getByRole("button", { name: "플레이 허브" }));
    fireEvent.click(screen.getByRole("button", { name: "가로" }));
    fireEvent.click(screen.getByRole("button", { name: "가로 방향 전환" }));
    fireEvent.click(screen.getByRole("button", { name: "채팅" }));
    fireEvent.click(screen.getByRole("button", { name: "스킨 변경" }));

    expect(onOpenBaseView).toHaveBeenCalledTimes(1);
    expect(onOpenPlayHub).toHaveBeenCalledTimes(1);
    expect(onChangeLayoutMode).toHaveBeenCalledWith("landscape");
    expect(screen.getByText("방향 자동(왼)")).toBeInTheDocument();
    expect(onCycleLandscapeSide).toHaveBeenCalledTimes(1);
    expect(screen.getByText("5명")).toBeInTheDocument();
    expect(screen.getAllByText("3")).toHaveLength(2);
    expect(onToggleChat).toHaveBeenCalledTimes(1);
    expect(onToggleSkinPicker).toHaveBeenCalledTimes(1);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(6);
  });

  test("데스크톱에서는 현재 레이아웃을 active 상태로 표시한다", () => {
    render(
      <ImmersiveGameTopBar
        layoutMode="landscape"
        isChatOpen
        unreadCount={0}
        presenceCount={2}
        showLandscapeSideToggle
        landscapeSidePreference="right"
        onChangeLayoutMode={() => {}}
        onToggleChat={() => {}}
        onCycleLandscapeSide={() => {}}
        onToggleSkinPicker={() => {}}
        onOpenBaseView={() => {}}
        onOpenPlayHub={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "가로" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "세로" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "채팅 닫기" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      screen.getByTestId("immersive-game-topbar-tools-surface")
    ).toBeInTheDocument();
    expect(screen.getByText("방향 오른쪽")).toBeInTheDocument();
  });
});
