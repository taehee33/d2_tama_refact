import React from "react";
import { render, screen, within } from "@testing-library/react";
import MenuIconButtons from "./MenuIconButtons";

function getButtonLabels(container) {
  return within(container)
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"));
}

describe("MenuIconButtons", () => {
  test("데스크톱과 모바일 모두 5+5 메뉴 그룹을 같은 순서로 렌더링한다", () => {
    const onMenuClick = jest.fn();
    const expectedBasic = ["상태", "먹이", "훈련", "배틀", "교감"];
    const expectedCare = ["화장실", "조명", "치료", "호출", "더보기"];

    const { rerender } = render(
      <MenuIconButtons
        width={320}
        height={60}
        activeMenu={null}
        onMenuClick={onMenuClick}
        isLightsOn
      />
    );

    expect(getButtonLabels(screen.getByRole("group", { name: "기본 조작" }))).toEqual(
      expectedBasic
    );
    expect(getButtonLabels(screen.getByRole("group", { name: "케어·도구" }))).toEqual(
      expectedCare
    );

    rerender(
      <MenuIconButtons
        width={320}
        height={60}
        activeMenu={null}
        onMenuClick={onMenuClick}
        isLightsOn
        isMobile
      />
    );

    expect(getButtonLabels(screen.getByRole("group", { name: "기본 조작" }))).toEqual(
      expectedBasic
    );
    expect(getButtonLabels(screen.getByRole("group", { name: "케어·도구" }))).toEqual(
      expectedCare
    );
  });

  test("조명 꺼짐과 냉장고 상태에 따라 잠금 버튼과 안내 이유가 달라진다", () => {
    render(
      <MenuIconButtons
        width={320}
        height={60}
        activeMenu={null}
        onMenuClick={jest.fn()}
        isLightsOn={false}
        isFrozen
      />
    );

    expect(screen.getByRole("button", { name: "먹이" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "먹이" })).toHaveAttribute(
      "title",
      expect.stringContaining("냉장고")
    );
    expect(screen.getByRole("button", { name: "훈련" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "배틀" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "배틀" })).toHaveAttribute(
      "title",
      expect.stringContaining("조명")
    );
    expect(screen.getByRole("button", { name: "교감" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "화장실" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "치료" })).toBeDisabled();

    expect(screen.getByRole("button", { name: "상태" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "조명" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "호출" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "더보기" })).toBeEnabled();
  });
});
