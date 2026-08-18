import React from "react";
import { render, screen } from "@testing-library/react";
import ImmersivePortraitSection from "./ImmersivePortraitSection";
import { getImmersiveSkinById } from "../../utils/immersiveSettings";

jest.mock("./ImmersivePortraitPixelSection", () => function MockPixelSection({ skinId }) {
  return <div data-testid="pixel-section" data-skin-id={skinId} />;
});

describe("ImmersivePortraitSection", () => {
  it("기본 및 기존 스킨은 기존 화면 노드를 그대로 반환한다", () => {
    const { rerender } = render(
      <ImmersivePortraitSection
        skin={getImmersiveSkinById("tama-default-none")}
        legacyContent={<div data-testid="legacy-section">기존 UI</div>}
      />
    );
    expect(screen.getByTestId("legacy-section")).toBeInTheDocument();
    expect(screen.queryByTestId("pixel-section")).not.toBeInTheDocument();

    rerender(
      <ImmersivePortraitSection
        skin={getImmersiveSkinById("brick-ver1")}
        legacyContent={<div data-testid="legacy-section">기존 UI</div>}
      />
    );
    expect(screen.getByTestId("legacy-section")).toBeInTheDocument();
  });

  it("픽셀 스킨만 새 세로 화면을 선택한다", () => {
    render(
      <ImmersivePortraitSection
        skin={getImmersiveSkinById("pixel-dark-battle")}
        legacyContent={<div>기존 UI</div>}
        pixelSectionProps={{ skinId: "pixel-dark-battle" }}
      />
    );
    expect(screen.getByTestId("pixel-section")).toHaveAttribute(
      "data-skin-id",
      "pixel-dark-battle"
    );
  });
});
