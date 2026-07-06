import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import EvolutionConfirmModal from "./EvolutionConfirmModal";

describe("EvolutionConfirmModal", () => {
  test("하단 닫기 버튼으로 모달을 닫을 수 있다", () => {
    const handleClose = jest.fn();

    render(
      <EvolutionConfirmModal
        onConfirm={() => {}}
        onOpenGuide={() => {}}
        onClose={handleClose}
      />
    );

    const closeButton = screen.getByRole("button", { name: "닫기" });

    expect(closeButton).toBeInTheDocument();
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
