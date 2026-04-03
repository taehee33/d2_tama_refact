import React from "react";
import { render, screen } from "@testing-library/react";
import CommunitySnapshotScene from "./CommunitySnapshotScene";

describe("CommunitySnapshotScene", () => {
  const snapshot = {
    digimonDisplayName: "가브몬",
    stageLabel: "성숙기",
    version: "Ver.1",
    slotName: "슬롯4",
    visual: {
      spriteBasePath: "/images",
      spriteNumber: 45,
      backgroundNumber: 168,
      isLightsOn: false,
      sleepStatus: "TIRED",
      poopCount: 6,
      isFrozen: false,
      isDead: false,
      isInjured: true,
    },
  };

  it("card/detail 변형에서는 장면 위 오버레이를 렌더링하지 않는다", () => {
    render(
      <CommunitySnapshotScene snapshot={snapshot} variant="detail" />
    );

    expect(screen.getByAltText("가브몬")).toBeInTheDocument();
    expect(screen.queryByText("불 꺼줘!")).not.toBeInTheDocument();
    expect(screen.queryByText("치료 필요")).not.toBeInTheDocument();
    expect(screen.queryByText("똥 위험")).not.toBeInTheDocument();
    expect(screen.queryByText("성숙기 · Ver.1")).not.toBeInTheDocument();
    expect(screen.queryByText("슬롯4")).not.toBeInTheDocument();
  });

  it("composer 변형에서는 장면 위 오버레이를 유지한다", () => {
    render(
      <CommunitySnapshotScene snapshot={snapshot} variant="composer" />
    );

    expect(screen.getByText("불 꺼줘!")).toBeInTheDocument();
    expect(screen.getByText("치료 필요")).toBeInTheDocument();
    expect(screen.getByText("똥 위험")).toBeInTheDocument();
    expect(screen.getByText("성숙기 · Ver.1")).toBeInTheDocument();
    expect(screen.getByText("슬롯4")).toBeInTheDocument();
  });
});
