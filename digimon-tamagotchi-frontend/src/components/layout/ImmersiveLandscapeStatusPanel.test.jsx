import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ImmersiveLandscapeStatusPanel from "./ImmersiveLandscapeStatusPanel";

jest.mock("../StatusHearts", () => {
  return function MockStatusHearts(props) {
    return (
      <div
        data-testid="status-hearts"
        data-show-labels={props.showLabels ? "true" : "false"}
        data-size={props.size || ""}
        data-position={props.position || ""}
        data-strength={String(props.strength || 0)}
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
        onClick={() => props.onOpenStatusDetail?.(["상세"])}
      >
        상태 배지
      </button>
    );
  };
});

describe("ImmersiveLandscapeStatusPanel", () => {
  test("가로 몰입형 상태 패널에 슬롯 정보와 상태 요약을 렌더한다", () => {
    const onOpenStatusDetail = jest.fn();

    render(
      <ImmersiveLandscapeStatusPanel
        slotId="3"
        slotVersion="Ver.2"
        digimonLabel="그레이몬"
        slotName="알파"
        slotDevice="컬러"
        currentTimeText="2026. 4. 9. 오후 2:00:00"
        isFrozen
        statusHeartsProps={{
          fullness: 5,
          strength: 4,
          maxOverfeed: 0,
          proteinOverdose: 0,
          isFrozen: true,
        }}
        statusBadgesProps={{
          digimonStats: { poopCount: 0 },
          onOpenStatusDetail,
        }}
      />
    );

    expect(screen.getByTestId("immersive-landscape-status-panel")).toBeInTheDocument();
    expect(screen.getByText("슬롯 3 · Ver.2")).toBeInTheDocument();
    expect(screen.getByText("그레이몬")).toBeInTheDocument();
    expect(screen.getByText("알파 · 컬러")).toBeInTheDocument();
    expect(screen.getByText("현재 시간 2026. 4. 9. 오후 2:00:00")).toBeInTheDocument();
    expect(screen.getByText("🧊 냉장고")).toBeInTheDocument();
    expect(screen.getByTestId("status-hearts")).toHaveAttribute(
      "data-show-labels",
      "false"
    );
    expect(screen.getByTestId("status-hearts")).toHaveAttribute("data-size", "sm");

    fireEvent.click(screen.getByTestId("status-badges"));

    expect(onOpenStatusDetail).toHaveBeenCalledWith(["상세"]);
  });

  test("slotName과 slotDevice가 없으면 fallback 텍스트를 사용한다", () => {
    render(
      <ImmersiveLandscapeStatusPanel
        slotId="4"
        slotVersion="Ver.3"
        digimonLabel="반쵸레오몬"
        currentTimeText="오후 3:33:33"
        statusHeartsProps={{}}
        statusBadgesProps={{}}
      />
    );

    expect(screen.getByText("슬롯4 · 디지바이스")).toBeInTheDocument();
  });
});
