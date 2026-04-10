import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import GameHeaderPanel from "./GameHeaderPanel";

jest.mock("../GameHeaderMeta", () => {
  return function MockGameHeaderMeta(props) {
    return (
      <div
        data-testid="game-header-meta"
        data-slot-name={props.slotName || ""}
        data-slot-version={props.slotVersion || ""}
        data-current-time={props.currentTimeText || ""}
      />
    );
  };
});

jest.mock("../StatusHearts", () => {
  return function MockStatusHearts(props) {
    return (
      <div
        data-testid="status-hearts"
        data-show-labels={props.showLabels ? "true" : "false"}
        data-size={props.size || ""}
        data-position={props.position || ""}
        data-fullness={String(props.fullness || 0)}
      />
    );
  };
});

jest.mock("../DigimonStatusBadges", () => {
  return function MockDigimonStatusBadges(props) {
    return (
      <button
        type="button"
        data-testid="status-badges"
        onClick={() => props.onOpenStatusDetail?.(["상태"])}
      >
        상태 배지
      </button>
    );
  };
});

describe("GameHeaderPanel", () => {
  test("기본 헤더 메타와 상태 요약을 렌더한다", () => {
    const onOpenStatusDetail = jest.fn();

    render(
      <GameHeaderPanel
        className="game-header-shell"
        slotId="2"
        digimonLabel="아구몬"
        isFrozen
        metaProps={{
          slotName: "메인 슬롯",
          slotCreatedAtText: "2026-04-09",
          slotDevice: "디지바이스",
          slotVersion: "Ver.1",
          currentTimeText: "2026. 4. 9. 오후 1:23:45",
        }}
        statusHeartsProps={{
          fullness: 4,
          strength: 3,
          maxOverfeed: 2,
          proteinOverdose: 1,
          isFrozen: true,
        }}
        statusBadgesProps={{
          digimonStats: { poopCount: 1 },
          onOpenStatusDetail,
        }}
      />
    );

    expect(screen.getByTestId("game-header-panel")).toHaveClass("game-header-shell");
    expect(screen.getByText("슬롯 2 - 아구몬")).toBeInTheDocument();
    expect(screen.getByText("🧊 냉장고")).toBeInTheDocument();
    expect(screen.getByTestId("game-header-meta")).toHaveAttribute(
      "data-slot-name",
      "메인 슬롯"
    );
    expect(screen.getByTestId("game-header-meta")).toHaveAttribute(
      "data-slot-version",
      "Ver.1"
    );
    expect(screen.getByTestId("status-hearts")).toHaveAttribute(
      "data-show-labels",
      "true"
    );
    expect(screen.getByTestId("status-hearts")).toHaveAttribute("data-size", "sm");
    expect(screen.getByTestId("status-hearts")).toHaveAttribute(
      "data-position",
      "inline"
    );

    fireEvent.click(screen.getByTestId("status-badges"));

    expect(onOpenStatusDetail).toHaveBeenCalledWith(["상태"]);
  });
});
