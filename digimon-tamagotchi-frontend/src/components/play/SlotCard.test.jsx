import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import SlotCard from "./SlotCard";

const mockFormatSlotCreatedAt = jest.fn();
const mockGetSlotDigimonData = jest.fn();
const mockGetSlotDisplayName = jest.fn();
const mockGetSlotSpriteSrc = jest.fn();
const mockGetSlotStageLabel = jest.fn();

jest.mock("../../utils/dateUtils", () => ({
  formatSlotCreatedAt: (...args) => mockFormatSlotCreatedAt(...args),
}));

jest.mock("../../utils/slotViewUtils", () => ({
  getSlotDigimonData: (...args) => mockGetSlotDigimonData(...args),
  getSlotDisplayName: (...args) => mockGetSlotDisplayName(...args),
  getSlotSpriteSrc: (...args) => mockGetSlotSpriteSrc(...args),
  getSlotStageLabel: (...args) => mockGetSlotStageLabel(...args),
}));

describe("SlotCard", () => {
  const slot = {
    id: 2,
    createdAt: "2026-04-04T09:00:00.000Z",
    slotName: "슬롯2",
    selectedDigimon: "Koromon",
    device: "Digital Monster Color 25th",
    version: "Ver.2",
  };

  beforeEach(() => {
    mockFormatSlotCreatedAt.mockReturnValue("2026. 4. 4. 오전 9:00:00");
    mockGetSlotDigimonData.mockReturnValue({ name: "뿔몬" });
    mockGetSlotDisplayName.mockReturnValue("뿔몬");
    mockGetSlotSpriteSrc.mockReturnValue("/images/225.png");
    mockGetSlotStageLabel.mockReturnValue("유아기");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("삭제와 별명 변경은 관리 메뉴 안에서만 노출한다", () => {
    const onDelete = jest.fn();
    const onToggleNickname = jest.fn();

    render(
      <SlotCard
        slot={slot}
        onToggleNickname={onToggleNickname}
        onNicknameChange={() => {}}
        onNicknameSave={() => {}}
        onNicknameReset={() => {}}
        onContinue={() => {}}
        onDelete={onDelete}
      />
    );

    expect(screen.queryByRole("menuitem", { name: "삭제" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "별명 변경" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "슬롯 2 관리 메뉴" }));

    const menu = screen.getByRole("menu");
    const deleteButton = screen.getByRole("menuitem", { name: "삭제" });
    const nicknameButton = screen.getByRole("menuitem", { name: "별명 변경" });

    expect(within(menu).getAllByRole("menuitem")[0]).toHaveTextContent("별명 변경");
    expect(within(menu).getAllByRole("menuitem")[1]).toHaveTextContent("삭제");
    expect(deleteButton).toHaveClass("service-slot-card__menu-item--danger");

    fireEvent.click(nicknameButton);
    expect(onToggleNickname).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "슬롯 2 관리 메뉴" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "삭제" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test("이어하기 액션을 유지한다", () => {
    const onContinue = jest.fn();

    render(
      <SlotCard
        slot={slot}
        onToggleNickname={() => {}}
        onNicknameChange={() => {}}
        onNicknameSave={() => {}}
        onNicknameReset={() => {}}
        onContinue={onContinue}
        onDelete={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "이어하기" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "몰입형 화면" })).not.toBeInTheDocument();
  });

  test("저장된 슬롯 상태 칩을 표시한다", () => {
    render(
      <SlotCard
        slot={{
          ...slot,
          digimonStats: {
            isInjured: true,
            poopCount: 6,
          },
        }}
        onToggleNickname={() => {}}
        onNicknameChange={() => {}}
        onNicknameSave={() => {}}
        onNicknameReset={() => {}}
        onContinue={() => {}}
        onDelete={() => {}}
      />
    );

    expect(screen.getByLabelText("슬롯 상태")).toBeInTheDocument();
    expect(screen.getByText("치료 필요: 부상 🏥")).toBeInTheDocument();
    expect(screen.getByText("똥 많음 💩")).toBeInTheDocument();
  });

  test("게임 화면과 같은 수면 조명 경고 상태 칩을 표시한다", () => {
    render(
      <SlotCard
        slot={{
          ...slot,
          selectedDigimon: "Punimon",
          version: "Ver.2",
          isLightsOn: true,
          projectedDigimonStats: {
            fullness: 2,
            strength: 1,
            sleepSchedule: { start: 0, end: 23, startMinute: 0, endMinute: 59 },
            sleepLightOnStart: Date.now() - 40 * 60 * 1000,
            callStatus: {
              hunger: { isActive: false },
              strength: { isActive: false },
              sleep: { isActive: true, isLogged: true },
            },
          },
        }}
        onToggleNickname={() => {}}
        onNicknameChange={() => {}}
        onNicknameSave={() => {}}
        onNicknameReset={() => {}}
        onContinue={() => {}}
        onDelete={() => {}}
      />
    );

    expect(screen.getByLabelText("슬롯 상태")).toBeInTheDocument();
    expect(screen.getByText("수면 중(불 켜짐 경고! · 케어미스 처리됨) 😴")).toBeInTheDocument();
    expect(screen.getByText("힘 낮음 💪")).toBeInTheDocument();
  });
});
