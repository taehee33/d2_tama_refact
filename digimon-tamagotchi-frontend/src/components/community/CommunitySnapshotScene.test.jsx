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
      sleepStatus: "SLEEPING_LIGHT_ON",
      poopCount: 6,
      isFrozen: false,
      isDead: false,
      isInjured: true,
    },
  };

  it("card/detail 변형에서는 장면 위 오버레이를 렌더링하지 않는다", () => {
    const { container } = render(
      <CommunitySnapshotScene snapshot={snapshot} variant="detail" />
    );

    const scene = container.querySelector(".community-scene--detail");
    const background = screen.getByAltText("커뮤니티 배경");
    const sprite = screen.getByAltText("가브몬");

    expect(scene).toHaveStyle({ "--community-scene-aspect-ratio": "3 / 2" });
    expect(background).toHaveStyle({ objectFit: "fill" });
    expect(sprite.parentElement).toHaveStyle({
      left: "30%",
      top: "30%",
      width: "40%",
      height: "40%",
    });
    expect(sprite).toHaveStyle({ width: "100%", height: "100%" });
    expect(container.querySelector(".community-scene__lights-off")).toBeInTheDocument();
    expect(container.querySelector(".community-scene__poop")).not.toBeInTheDocument();
    expect(screen.queryByText("불 켜짐 경고!")).not.toBeInTheDocument();
    expect(screen.queryByText("치료 필요")).not.toBeInTheDocument();
    expect(screen.queryByText("똥 위험")).not.toBeInTheDocument();
    expect(screen.queryByText("성숙기 · Ver.1")).not.toBeInTheDocument();
    expect(screen.queryByText("슬롯4")).not.toBeInTheDocument();
  });

  it("composer 변형에서는 장면 위 오버레이를 유지한다", () => {
    render(
      <CommunitySnapshotScene snapshot={snapshot} variant="composer" />
    );

    expect(screen.getByText("불 켜짐 경고!")).toBeInTheDocument();
    expect(screen.getByText("치료 필요")).toBeInTheDocument();
    expect(screen.queryByText("똥 위험")).not.toBeInTheDocument();
    expect(screen.getByText("성숙기 · Ver.1")).toBeInTheDocument();
    expect(screen.getByText("슬롯4")).toBeInTheDocument();
  });

  it.each(["card", "detail", "composer"])(
    "%s 변형에서 같은 게임 장면 기하값을 사용한다",
    (variant) => {
      const { container } = render(
        <CommunitySnapshotScene snapshot={snapshot} variant={variant} />
      );

      const scene = container.querySelector(`.community-scene--${variant}`);
      const spriteShell = container.querySelector(".community-scene__sprite-shell");

      expect(scene).toHaveStyle({ "--community-scene-aspect-ratio": "3 / 2" });
      expect(spriteShell).toHaveStyle({
        left: "30%",
        top: "30%",
        width: "40%",
        height: "40%",
      });
    }
  );

  it("Ver.2 스냅샷의 저장된 스프라이트 경로를 그대로 유지한다", () => {
    render(
      <CommunitySnapshotScene
        snapshot={{
          ...snapshot,
          version: "Ver.2",
          visual: {
            ...snapshot.visual,
            spriteBasePath: "/Ver2_Mod_Kor",
            spriteNumber: 211,
          },
        }}
        variant="card"
      />
    );

    expect(screen.getByAltText("가브몬")).toHaveAttribute(
      "src",
      "/Ver2_Mod_Kor/211.png"
    );
  });
});
