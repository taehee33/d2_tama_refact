import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ImmersiveGameTopBar from "./ImmersiveGameTopBar";

describe("ImmersiveGameTopBar", () => {
  test("모바일에서는 이동 버튼과 세로/가로 토글, 스킨 변경 버튼을 렌더링한다", () => {
    const onOpenBaseView = jest.fn();
    const onOpenPlayHub = jest.fn();
    const onChangeLayoutMode = jest.fn();
    const onToggleSkinPicker = jest.fn();
    const onToggleChat = jest.fn();
    const onCycleLandscapeSide = jest.fn();
    const { container } = render(
      <ImmersiveGameTopBar
        isMobile
        layoutMode="portrait"
        unreadCount={3}
        presenceCount={5}
        showLandscapeSideToggle
        landscapeSidePreference="auto"
        effectiveLandscapeSide="left"
        onChangeLayoutMode={onChangeLayoutMode}
        onToggleChat={onToggleChat}
        onCycleLandscapeSide={onCycleLandscapeSide}
        onToggleSkinPicker={onToggleSkinPicker}
        onOpenBaseView={onOpenBaseView}
        onOpenPlayHub={onOpenPlayHub}
      />
    );

    expect(container.firstChild).toHaveClass("game-immersive-nav--mobile");
    expect(screen.getByText("몰입형 플레이")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "세로" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

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
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(onToggleChat).toHaveBeenCalledTimes(1);
    expect(onToggleSkinPicker).toHaveBeenCalledTimes(1);
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
    expect(screen.getByText("방향 오른쪽")).toBeInTheDocument();
  });
});
