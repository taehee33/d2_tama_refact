import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ImmersiveLandscapeActionViewer from "./ImmersiveLandscapeActionViewer";

describe("ImmersiveLandscapeActionViewer", () => {
  const statusPanelProps = {
    slotName: "슬롯 1",
    slotVersion: "Ver.2",
    digimonLabel: "뿔몬",
    currentTimeText: "2026. 04. 12. 오전 09:10:11",
    digimonStats: {
      fullness: 3,
      strength: 2,
      poopCount: 1,
      careMistakes: 2,
      injuries: 0,
      isInjured: false,
      timeToEvolveSeconds: 3600,
    },
    currentAnimation: "idle",
    feedType: null,
    canEvolve: true,
    sleepSchedule: { start: 22, end: 7 },
    wakeUntil: null,
    sleepLightOnStart: null,
    deathReason: null,
    sleepStatus: "AWAKE",
    currentTime: new Date("2026-04-12T09:10:11+09:00"),
  };

  test("상태 탭을 기본으로 열고 요약 카드와 상세 섹션을 보여준다", () => {
    render(
      <ImmersiveLandscapeActionViewer
        isOpen
        activeAction="status"
        statusPanelProps={statusPanelProps}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("뿔몬")).toBeInTheDocument();
    expect(screen.getByText("포만감")).toBeInTheDocument();
    expect(screen.getByText("진화까지")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "닫기" })).toBeInTheDocument();
  });

  test("닫기 버튼을 누르면 뷰어를 닫는다", () => {
    const onClose = jest.fn();

    render(
      <ImmersiveLandscapeActionViewer
        isOpen
        activeAction="communication"
        onClose={onClose}
        interactionPanelProps={{ onSelectAction: jest.fn() }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalled();
  });

  test("더보기 허브 카드를 누르면 대응 액션을 호출한다", () => {
    const onOpenMenu = jest.fn();

    render(
      <ImmersiveLandscapeActionViewer
        isOpen
        activeAction="extra"
        extraPanelProps={{ onOpenMenu }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /활동 로그/ }));
    expect(onOpenMenu).toHaveBeenCalledWith("activityLog");
  });
});
