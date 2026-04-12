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
        actionViewerNode={<div>가로 액션 뷰어</div>}
        landscapeInfoOverlayNode={<div>가로 정보 오버레이</div>}
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
    expect(screen.getByText("가로 액션 뷰어")).toBeInTheDocument();
    expect(screen.getByText("가로 정보 오버레이")).toBeInTheDocument();
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

  it("가로 모드에서도 별도 가상 스테이지 없이 콘텐츠를 바로 렌더한다", () => {
    render(
      <ImmersiveGameView
        layoutMode="landscape"
        landscapeContentNode={<div>가로 콘텐츠</div>}
      />
    );

    expect(screen.getByTestId("immersive-game-view-stage")).toBeInTheDocument();
    expect(
      screen.queryByTestId("immersive-game-view-virtual-stage-shell")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("immersive-game-view-virtual-prompt")
    ).not.toBeInTheDocument();
  });
});
