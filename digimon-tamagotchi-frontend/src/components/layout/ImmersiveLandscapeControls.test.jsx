import React from "react";
import { render, screen } from "@testing-library/react";
import ImmersiveLandscapeControls from "./ImmersiveLandscapeControls";

describe("ImmersiveLandscapeControls", () => {
  test("가로모드 큰 버튼도 기존 메뉴 잠금 규칙을 그대로 따른다", () => {
    render(
      <ImmersiveLandscapeControls
        activeMenu={null}
        onMenuClick={jest.fn()}
        isLightsOn={false}
        isFrozen
      />
    );

    expect(screen.getByRole("button", { name: "먹이" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "배틀" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "상태" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "조명" })).toBeEnabled();
  });

  test("브릭 스트립 레이아웃은 5개 버튼을 가로 스크롤 줄로 렌더링한다", () => {
    const { container } = render(
      <ImmersiveLandscapeControls
        layout="strip"
        groupId="basic"
        activeMenu="status"
        onMenuClick={jest.fn()}
      />
    );

    expect(container.firstChild).toHaveClass("immersive-landscape-control-strip");
    expect(screen.getByRole("group", { name: "기본 조작" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "상태" })).toHaveAttribute(
      "aria-label",
      "상태"
    );
    expect(
      screen.queryByRole("button", { name: "더보기" })
    ).not.toBeInTheDocument();
  });
});
