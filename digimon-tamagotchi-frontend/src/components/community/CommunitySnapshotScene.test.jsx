import React from "react";
import { render, screen } from "@testing-library/react";
import CommunitySnapshotScene from "./CommunitySnapshotScene";

describe("CommunitySnapshotScene", () => {
  it("상태에 맞는 장면 배지와 캡션을 렌더링한다", () => {
    render(
      <CommunitySnapshotScene
        snapshot={{
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
        }}
      />
    );

    expect(screen.getByAltText("가브몬")).toBeInTheDocument();
    expect(screen.getByText("불 꺼줘!")).toBeInTheDocument();
    expect(screen.getByText("치료 필요")).toBeInTheDocument();
    expect(screen.getByText("똥 위험")).toBeInTheDocument();
    expect(screen.getByText("성숙기 · Ver.1")).toBeInTheDocument();
    expect(screen.getByText("슬롯4")).toBeInTheDocument();
  });
});
