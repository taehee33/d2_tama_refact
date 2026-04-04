import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import SlotOrderModal from "./SlotOrderModal";

const mockFormatSlotCreatedAt = jest.fn();
const mockGetSlotDisplayName = jest.fn();
const mockGetSlotSpriteSrc = jest.fn();

jest.mock("../../utils/dateUtils", () => ({
  formatSlotCreatedAt: (...args) => mockFormatSlotCreatedAt(...args),
}));

jest.mock("../../utils/slotViewUtils", () => ({
  getSlotDisplayName: (...args) => mockGetSlotDisplayName(...args),
  getSlotSpriteSrc: (...args) => mockGetSlotSpriteSrc(...args),
}));

describe("SlotOrderModal", () => {
  const orderedSlots = [
    {
      id: 3,
      createdAt: "2026-04-03T08:34:03.000Z",
      device: "Digital Monster Color 25th",
      version: "Ver.2",
      selectedDigimon: "Koromon",
    },
    {
      id: 7,
      createdAt: "2026-04-02T10:00:00.000Z",
      device: "Pendulum Color",
      version: "Ver.1",
      selectedDigimon: "Agumon",
    },
  ];

  beforeEach(() => {
    mockFormatSlotCreatedAt.mockImplementation((value) =>
      value === orderedSlots[0].createdAt ? "2026. 4. 3. 오전 8:34:03" : "2026. 4. 2. 오전 10:00:00"
    );
    mockGetSlotDisplayName.mockImplementation((slot) => (slot.id === 3 ? "뿔몬" : "아구몬"));
    mockGetSlotSpriteSrc.mockImplementation((slot) => (slot.id === 3 ? "/images/225.png" : "/images/240.png"));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("정렬 순번, 슬롯 번호, 썸네일을 함께 보여 준다", () => {
    render(
      <SlotOrderModal
        open
        orderedSlots={orderedSlots}
        highlightedSlotId={null}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    expect(screen.getByText("정렬 1")).toBeInTheDocument();
    expect(screen.getByText("정렬 2")).toBeInTheDocument();
    expect(screen.getByText("슬롯 3")).toBeInTheDocument();
    expect(screen.getByText("슬롯 7")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "뿔몬 썸네일" })).toHaveAttribute("src", "/images/225.png");
    expect(screen.getByRole("img", { name: "아구몬 썸네일" })).toHaveAttribute("src", "/images/240.png");
  });

  test("위아래 이동 콜백과 비활성 상태를 올바르게 유지한다", () => {
    const onMoveUp = jest.fn();
    const onMoveDown = jest.fn();

    render(
      <SlotOrderModal
        open
        orderedSlots={orderedSlots}
        highlightedSlotId={7}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    const moveUpButtons = screen.getAllByRole("button", { name: /위로 이동/ });
    const moveDownButtons = screen.getAllByRole("button", { name: /아래로 이동/ });
    const highlightedCard = screen.getByText("슬롯 7").closest(".service-order-item");

    expect(moveUpButtons[0]).toBeDisabled();
    expect(moveDownButtons[1]).toBeDisabled();
    expect(moveUpButtons[1]).toHaveClass("service-order-action--up");
    expect(moveDownButtons[0]).toHaveClass("service-order-action--down");
    expect(highlightedCard).toHaveClass("service-order-item--highlighted");

    fireEvent.click(moveDownButtons[0]);
    fireEvent.click(moveUpButtons[1]);

    expect(onMoveDown).toHaveBeenCalledWith(0);
    expect(onMoveUp).toHaveBeenCalledWith(1);
  });
});
