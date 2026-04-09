import React from "react";
import { render, screen } from "@testing-library/react";
import GameDefaultSection from "./GameDefaultSection";

jest.mock("../GameScreen", () => {
  return function MockGameScreen(props) {
    return (
      <div
        data-testid="game-screen"
        data-screen-mode={props.screenMode || ""}
      />
    );
  };
});

jest.mock("../ControlPanel", () => {
  return function MockControlPanel(props) {
    return (
      <div
        data-testid="control-panel"
        data-panel-mode={props.panelMode || ""}
        data-active-menu={props.activeMenu || ""}
        data-is-mobile={props.isMobile ? "true" : "false"}
      />
    );
  };
});

describe("GameDefaultSection", () => {
  it("renders the header, GameScreen, ControlPanel, and support actions", () => {
    render(
      <GameDefaultSection
        headerNode={<div>기본 헤더</div>}
        gameScreenProps={{ screenMode: "default" }}
        controlPanelProps={{ panelMode: "default" }}
        activeMenu="status"
        onMenuClick={jest.fn()}
        stats={{ hunger: 3 }}
        isMobile={false}
        supportActionsNode={<div>지원 액션</div>}
      />
    );

    expect(screen.getByText("기본 헤더")).toBeInTheDocument();
    expect(screen.getByTestId("game-screen")).toHaveAttribute(
      "data-screen-mode",
      "default"
    );
    expect(screen.getByTestId("control-panel")).toHaveAttribute(
      "data-panel-mode",
      "default"
    );
    expect(screen.getByTestId("control-panel")).toHaveAttribute(
      "data-active-menu",
      "status"
    );
    expect(screen.getByText("지원 액션")).toBeInTheDocument();
  });

  it("applies the mobile class branch and forwards mobile state to ControlPanel", () => {
    render(
      <GameDefaultSection
        headerNode={<div>기본 헤더</div>}
        gameScreenProps={{}}
        controlPanelProps={{}}
        activeMenu="status"
        onMenuClick={jest.fn()}
        stats={{}}
        isMobile
      />
    );

    expect(screen.getByTestId("game-default-screen-column")).toHaveClass(
      "game-screen-mobile"
    );
    expect(screen.getByTestId("control-panel")).toHaveAttribute(
      "data-is-mobile",
      "true"
    );
  });
});
