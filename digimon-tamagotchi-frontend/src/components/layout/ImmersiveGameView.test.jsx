import React, { createRef } from "react";
import { render, screen } from "@testing-library/react";
import ImmersiveGameView from "./ImmersiveGameView";

describe("ImmersiveGameView", () => {
  it("renders the immersive chrome and portrait content by default", () => {
    render(
      <ImmersiveGameView
        layoutMode="portrait"
        topBarNode={<div>상단 바</div>}
        orientationStatusNode={<div>방향 상태</div>}
        chatOverlayNode={<div>채팅 오버레이</div>}
        skinPickerNode={<div>스킨 피커</div>}
        portraitContentNode={<div>세로 콘텐츠</div>}
        landscapeContentNode={<div>가로 콘텐츠</div>}
      />
    );

    expect(screen.getByTestId("immersive-game-view")).toHaveAttribute("data-layout-mode", "portrait");
    expect(screen.getByText("상단 바")).toBeInTheDocument();
    expect(screen.getByText("방향 상태")).toBeInTheDocument();
    expect(screen.getByText("세로 콘텐츠")).toBeInTheDocument();
    expect(screen.queryByText("가로 콘텐츠")).not.toBeInTheDocument();
    expect(screen.getByText("채팅 오버레이")).toBeInTheDocument();
    expect(screen.getByText("스킨 피커")).toBeInTheDocument();
  });

  it("switches to landscape content and forwards the root ref", () => {
    const rootRef = createRef();

    render(
      <ImmersiveGameView
        ref={rootRef}
        layoutMode="landscape"
        portraitContentNode={<div>세로 콘텐츠</div>}
        landscapeContentNode={<div>가로 콘텐츠</div>}
      />
    );

    expect(screen.getByTestId("immersive-game-view")).toHaveAttribute("data-layout-mode", "landscape");
    expect(screen.getByText("가로 콘텐츠")).toBeInTheDocument();
    expect(screen.queryByText("세로 콘텐츠")).not.toBeInTheDocument();
    expect(rootRef.current).toBeInstanceOf(HTMLElement);
  });

  it("renders virtual landscape stage and prompt when requested", () => {
    render(
      <ImmersiveGameView
        isMobile
        layoutMode="landscape"
        isVirtualLandscapeActive
        virtualLandscapeDirection="left"
        showVirtualLandscapePrompt
        virtualLandscapePromptMessage="가상 가로로 돌릴까요?"
        onConfirmVirtualLandscape={() => {}}
        onDismissVirtualLandscape={() => {}}
        landscapeContentNode={<div>가로 콘텐츠</div>}
      />
    );

    expect(screen.getByTestId("immersive-game-view")).toHaveAttribute(
      "data-virtual-landscape",
      "true"
    );
    expect(
      screen.getByTestId("immersive-game-view-virtual-stage-surface")
    ).toHaveAttribute("data-virtual-direction", "left");
    expect(screen.getByRole("dialog", { name: "가상 가로 모드 확인" })).toBeInTheDocument();
    expect(screen.getByText("가상 가로 시작")).toBeInTheDocument();
  });
});
