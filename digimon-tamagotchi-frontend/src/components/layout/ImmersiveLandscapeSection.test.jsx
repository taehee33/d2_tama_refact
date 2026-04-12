import React from "react";
import { render, screen } from "@testing-library/react";
import ImmersiveLandscapeSection from "./ImmersiveLandscapeSection";

describe("ImmersiveLandscapeSection", () => {
  const immersiveSkin = {
    id: "tama-mint",
    name: "민트",
    landscapeFrameSrc: "/assets/frame.png",
    landscapeViewport: {
      leftPct: 10,
      topPct: 20,
      widthPct: 60,
      heightPct: 40,
    },
  };

  test("프레임 스킨이 있으면 프레임 스테이지와 양쪽 스트립 조작 패널만 기본으로 렌더한다", () => {
    const renderLandscapeGameScreen = jest.fn(() => <div>프레임 화면</div>);

    render(
      <ImmersiveLandscapeSection
        deviceShellProps={{
          layoutMode: "landscape",
          skinId: "tama-mint",
          isMobile: true,
          showRotateHint: true,
          landscapeSide: "left",
          landscapeSideMode: "auto",
        }}
        hasLandscapeFrameSkin
        immersiveSkin={immersiveSkin}
        controlsProps={{
          activeMenu: "feed",
          onMenuClick: jest.fn(),
          isFrozen: false,
          isLightsOn: true,
          isMobile: true,
        }}
        renderLandscapeGameScreen={renderLandscapeGameScreen}
        slotMeta={{
          slotId: 3,
          normalizedSlotVersion: "v2",
          slotName: "알파",
        }}
        statusNode={
          <div className="immersive-landscape-status">랜드스케이프 상태</div>
        }
        supportActionsNode={<div>지원 액션</div>}
      />
    );

    expect(screen.getByTestId("immersive-landscape-frame-stage")).toBeInTheDocument();
    expect(
      screen.getAllByRole("region", { name: /가로 조작$/ })
    ).toHaveLength(2);
    expect(screen.queryByText("랜드스케이프 상태")).not.toBeInTheDocument();
    expect(screen.queryByText("지원 액션")).not.toBeInTheDocument();
    expect(renderLandscapeGameScreen).toHaveBeenCalled();

    const layout = screen.getByTestId("immersive-landscape-layout");
    expect(layout).toHaveAttribute("data-slot-id", "3");
    expect(layout).toHaveAttribute("data-slot-version", "v2");
    expect(layout).toHaveAttribute("data-slot-name", "알파");
  });

  test("브릭 실제 가로처럼 회전 안내가 없으면 프레임 오른쪽에 5+5 조작 그룹을 배치한다", () => {
    render(
      <ImmersiveLandscapeSection
        deviceShellProps={{
          layoutMode: "landscape",
          skinId: "brick-ver1",
          isMobile: true,
          showRotateHint: false,
          landscapeSide: "right",
          landscapeSideMode: "auto",
        }}
        hasLandscapeFrameSkin
        immersiveSkin={immersiveSkin}
        controlsProps={{
          activeMenu: "status",
          onMenuClick: jest.fn(),
          isFrozen: false,
          isLightsOn: true,
          isMobile: true,
        }}
        renderLandscapeGameScreen={() => <div>브릭 실제 가로 화면</div>}
      />
    );

    expect(screen.getByText("브릭 실제 가로 화면")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "기본 조작" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "케어·도구" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "상태" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "더보기" })).toBeInTheDocument();
  });

  test("프레임 스킨이 없으면 LCD와 일반 조작 패널을 렌더한다", () => {
    const renderLandscapeGameScreen = jest.fn(() => <div>LCD 화면</div>);

    render(
      <ImmersiveLandscapeSection
        deviceShellProps={{
          layoutMode: "landscape",
          skinId: "tama-classic",
          landscapeSide: "right",
          landscapeSideMode: "manual",
        }}
        hasLandscapeFrameSkin={false}
        immersiveSkin={immersiveSkin}
        controlsProps={{
          activeMenu: "sleep",
          onMenuClick: jest.fn(),
          isFrozen: true,
          isLightsOn: false,
          isMobile: false,
        }}
        renderLandscapeGameScreen={renderLandscapeGameScreen}
        statusNode={<div className="immersive-landscape-status">일반 상태</div>}
        supportActionsNode={<div>일반 지원 액션</div>}
      />
    );

    expect(screen.queryByTestId("immersive-landscape-frame-stage")).toBeNull();
    expect(screen.getByText("디지바이스 버튼")).toBeInTheDocument();
    expect(screen.getByText("LCD 화면")).toBeInTheDocument();
    expect(screen.getByText("일반 상태")).toBeInTheDocument();
    expect(screen.getByText("일반 지원 액션")).toBeInTheDocument();
    expect(renderLandscapeGameScreen).toHaveBeenCalled();
  });
});
