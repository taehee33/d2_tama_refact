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

  test("삭제 버튼이 왼쪽에 오고 danger 스타일을 사용한다", () => {
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
        onImmersive={() => {}}
        onDelete={onDelete}
      />
    );

    const deleteButton = screen.getByRole("button", { name: "삭제" });
    const nicknameButton = screen.getByRole("button", { name: "별명 변경" });
    const actionGroup = deleteButton.closest(".service-inline-actions");
    const actionButtons = within(actionGroup).getAllByRole("button");

    expect(actionButtons[0]).toHaveClass("service-button--danger");
    expect(actionButtons[1]).toHaveClass("service-button--ghost");
    expect(actionButtons[0]).toHaveTextContent("삭제");
    expect(actionButtons[1]).toHaveTextContent("별명 변경");

    fireEvent.click(deleteButton);
    fireEvent.click(nicknameButton);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onToggleNickname).toHaveBeenCalledTimes(1);
  });
});
