import React from "react";
import fs from "fs";
import path from "path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import ImmersivePortraitPixelSection from "./ImmersivePortraitPixelSection";
import { getImmersiveSkinById } from "../../utils/immersiveSettings";
import { PIXEL_SKIN_DEFAULT_APPEARANCE } from "../../data/immersiveSettings";

jest.mock("../GameScreen", () => function MockGameScreen(props) {
  return (
    <div
      data-testid="game-screen"
      data-background={props.backgroundNumber}
      data-width={props.width}
      data-height={props.height}
    />
  );
});

const MENU_LABELS = ["상태", "먹이", "훈련", "배틀", "교감", "화장실", "조명", "치료", "호출", "더보기"];
const MENU_IDS = ["status", "eat", "train", "battle", "communication", "bathroom", "electric", "heal", "callSign", "extra"];

function renderSection(overrides = {}) {
  const skinId = overrides.skinId || "pixel-split-brick";
  return render(
    <ImmersivePortraitPixelSection
      skin={getImmersiveSkinById(skinId)}
      skinId={skinId}
      appearance={PIXEL_SKIN_DEFAULT_APPEARANCE[skinId]}
      gameScreenProps={{ backgroundNumber: 162 }}
      activeMenu="status"
      onMenuClick={jest.fn()}
      isLightsOn
      currentTimeText="16:09"
      digimonLabel="코로몬"
      {...overrides}
    />
  );
}

describe("ImmersivePortraitPixelSection", () => {
  it("픽셀 스킨별 최종 게임 화면 이동값을 유지한다", () => {
    const stylesheet = fs.readFileSync(
      path.resolve(__dirname, "../../styles/ImmersivePortraitPixelSection.css"),
      "utf8"
    );

    expect(stylesheet).toContain(
      '[data-skin-id="pixel-split-brick"] .portrait-pixel-shell__screen {\n  transform: translateY(-8px);'
    );
    expect(stylesheet).toContain(
      '[data-skin-id="pixel-red-device"] .portrait-pixel-shell__screen {\n  transform: translate(-4px, -8px);'
    );
    expect(stylesheet).toContain(
      '[data-skin-id="pixel-dark-battle"] .portrait-pixel-shell__screen {\n  top: 20.45%;\n  left: 18.4%;\n  width: 44.6%;\n  transform: translate(-6px, -8px);'
    );
  });

  test.each(["pixel-split-brick", "pixel-red-device", "pixel-dark-battle"])("%s 스킨에 현재 게임 화면을 렌더링한다", (skinId) => {
    renderSection({
      skinId,
      gameScreenProps: { backgroundNumber: 162, width: 640, height: 480 },
    });
    expect(screen.getByRole("region", { name: /세로 디바이스/ })).toHaveAttribute("data-skin-id", skinId);
    expect(screen.getByTestId("game-screen")).toHaveAttribute("data-background", "162");
    expect(screen.getByTestId("game-screen")).toHaveAttribute("data-width", "250");
    expect(screen.getByTestId("game-screen")).toHaveAttribute("data-height", "250");
    expect(screen.getByText("16:09")).toBeInTheDocument();
    expect(screen.getByText("코로몬")).toBeInTheDocument();
  });

  it("10개 메뉴를 정의된 순서로 표시하고 같은 ID 콜백을 호출한다", () => {
    const onMenuClick = jest.fn();
    renderSection({ activeMenu: "battle", onMenuClick });
    const group = screen.getByRole("group", { name: "빠른 조작" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(MENU_LABELS);
    buttons.forEach((button) => fireEvent.click(button));
    expect(onMenuClick.mock.calls.map(([menuId]) => menuId)).toEqual(MENU_IDS);
    expect(screen.getByRole("button", { name: "배틀" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "상태" })).toHaveAttribute("aria-pressed", "false");
  });

  it("조명과 냉장고 잠금 정책을 기존 정의대로 적용한다", () => {
    const onMenuClick = jest.fn();
    renderSection({ isFrozen: true, isLightsOn: false, onMenuClick });
    expect(screen.getByRole("button", { name: "먹이" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "먹이" })).toHaveAttribute("title", expect.stringContaining("냉장고"));
    expect(screen.getByRole("button", { name: "배틀" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "배틀" })).toHaveAttribute("title", expect.stringContaining("조명"));
    expect(screen.getByRole("button", { name: "조명" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "더보기" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "먹이" }));
    expect(onMenuClick).not.toHaveBeenCalled();
  });

  it("첫 스킨에서만 외형 꾸미기 단축 버튼을 제공한다", () => {
    const onOpenAppearance = jest.fn();
    const { rerender } = renderSection({ onOpenAppearance });
    fireEvent.click(screen.getByRole("button", { name: "외형 꾸미기 열기" }));
    expect(onOpenAppearance).toHaveBeenCalledTimes(1);
    rerender(
      <ImmersivePortraitPixelSection
        skin={getImmersiveSkinById("pixel-red-device")}
        skinId="pixel-red-device"
        appearance={PIXEL_SKIN_DEFAULT_APPEARANCE["pixel-red-device"]}
        onMenuClick={jest.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: "외형 꾸미기 열기" })).not.toBeInTheDocument();
  });
});
