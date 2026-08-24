import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import RecentSlotPresenter from "./RecentSlotPresenter";

const mockGetSlotDisplayName = jest.fn();
const mockGetSlotPrimaryInfo = jest.fn();
const mockGetSlotSpriteSrc = jest.fn();
const mockGetSlotStatusChips = jest.fn();

jest.mock("../../utils/slotInfoUtils", () => ({
  getSlotPrimaryInfo: (...args) => mockGetSlotPrimaryInfo(...args),
}));

jest.mock("../../utils/slotStatusChips", () => ({
  getSlotStatusChips: (...args) => mockGetSlotStatusChips(...args),
}));

jest.mock("../../utils/slotViewUtils", () => ({
  getSlotDisplayName: (...args) => mockGetSlotDisplayName(...args),
  getSlotSpriteSrc: (...args) => mockGetSlotSpriteSrc(...args),
}));

describe("RecentSlotPresenter", () => {
  const slot = { id: 2 };

  beforeEach(() => {
    mockGetSlotDisplayName.mockReturnValue("아구몬");
    mockGetSlotPrimaryInfo.mockReturnValue("성장기 · Ver.1");
    mockGetSlotSpriteSrc.mockReturnValue("/images/1.png");
    mockGetSlotStatusChips.mockReturnValue([
      { id: "care", label: "치료 필요", tone: "danger" },
    ]);
  });

  test("최근 슬롯 정보와 상태 칩, 두 CTA를 함께 표시한다", () => {
    const onContinue = jest.fn();
    const onImmersive = jest.fn();

    render(
      <RecentSlotPresenter
        slot={slot}
        supplementaryInfo={["생성일 2026. 8. 24."]}
        onContinue={onContinue}
        onImmersive={onImmersive}
      />
    );

    expect(screen.getByRole("img", { name: "아구몬 대표 스프라이트" })).toHaveAttribute(
      "src",
      "/images/1.png"
    );
    expect(screen.getByText("성장기 · Ver.1")).toBeInTheDocument();
    expect(screen.getByText("생성일 2026. 8. 24.")).toBeInTheDocument();
    expect(screen.getByLabelText("최근 슬롯 상태")).toHaveTextContent("치료 필요");

    fireEvent.click(screen.getByRole("button", { name: "이어하기" }));
    fireEvent.click(screen.getByRole("button", { name: "몰입형 화면" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onImmersive).toHaveBeenCalledTimes(1);
  });

  test("몰입형 핸들러가 없으면 보조 CTA를 표시하지 않는다", () => {
    render(
      <RecentSlotPresenter
        slot={slot}
        supplementaryInfo={[]}
        onContinue={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "이어하기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "몰입형 화면" })).not.toBeInTheDocument();
  });
});
