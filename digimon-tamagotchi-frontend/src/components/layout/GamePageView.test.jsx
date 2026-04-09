import React from "react";
import { render, screen } from "@testing-library/react";
import GamePageView from "./GamePageView";

describe("GamePageView", () => {
  it("renders the mobile header and immersive shell when requested", () => {
    render(
      <GamePageView
        isMobile
        isImmersive
        mobileHeaderNode={<div>모바일 헤더</div>}
        desktopToolbarNode={<div>데스크톱 툴바</div>}
        defaultShellNode={<div>기본 쉘</div>}
        immersiveShellNode={<div>몰입형 쉘</div>}
        adsNode={<div>광고</div>}
        accountSettingsNode={<div>계정 설정</div>}
      />
    );

    expect(screen.getByTestId("game-page-view")).toHaveAttribute("data-mobile", "true");
    expect(screen.getByTestId("game-page-view")).toHaveAttribute("data-immersive", "true");
    expect(screen.getByText("모바일 헤더")).toBeInTheDocument();
    expect(screen.queryByText("데스크톱 툴바")).not.toBeInTheDocument();
    expect(screen.getByText("몰입형 쉘")).toBeInTheDocument();
    expect(screen.queryByText("기본 쉘")).not.toBeInTheDocument();
    expect(screen.getByText("광고")).toBeInTheDocument();
    expect(screen.getByText("계정 설정")).toBeInTheDocument();
  });

  it("renders the desktop toolbar and default shell otherwise", () => {
    render(
      <GamePageView
        desktopToolbarNode={<div>데스크톱 툴바</div>}
        defaultShellNode={<div>기본 쉘</div>}
        immersiveShellNode={<div>몰입형 쉘</div>}
      />
    );

    expect(screen.getByTestId("game-page-view")).toHaveAttribute("data-mobile", "false");
    expect(screen.getByTestId("game-page-view")).toHaveAttribute("data-immersive", "false");
    expect(screen.getByText("데스크톱 툴바")).toBeInTheDocument();
    expect(screen.getByText("기본 쉘")).toBeInTheDocument();
    expect(screen.queryByText("몰입형 쉘")).not.toBeInTheDocument();
  });
});
