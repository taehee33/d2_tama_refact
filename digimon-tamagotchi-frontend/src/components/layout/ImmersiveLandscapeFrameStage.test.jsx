import React from "react";
import { render, screen } from "@testing-library/react";
import ImmersiveLandscapeFrameStage from "./ImmersiveLandscapeFrameStage";
import { getImmersiveSkinById } from "../../utils/immersiveSettings";

describe("ImmersiveLandscapeFrameStage", () => {
  test("벽돌 Ver.1 스킨에서는 이미지 프레임 위에 게임 화면을 올린다", () => {
    const brickSkin = getImmersiveSkinById("brick-ver1");
    const renderScreen = jest.fn(({ width, height }) => (
      <div data-testid="brick-frame-screen">{`${width}x${height}`}</div>
    ));

    render(
      <ImmersiveLandscapeFrameStage
        skin={brickSkin}
        renderScreen={renderScreen}
      />
    );

    expect(
      screen.getByRole("img", { name: "벽돌 Ver.1 디바이스 프레임" })
    ).toHaveAttribute("src", brickSkin.landscapeFrameSrc);
    expect(screen.getByTestId("immersive-landscape-frame-stage")).toHaveAttribute(
      "data-skin-id",
      "brick-ver1"
    );
    expect(screen.getByTestId("immersive-landscape-frame-viewport")).toBeInTheDocument();
    expect(screen.getByTestId("brick-frame-screen")).toHaveTextContent("300x200");
    expect(renderScreen).toHaveBeenCalledWith(
      expect.objectContaining({ width: 300, height: 200 })
    );
  });
});
