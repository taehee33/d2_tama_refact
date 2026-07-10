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

  test("여러 개발자 진화 후보 중 선택한 대상만 전달한다", () => {
    const handleConfirm = jest.fn();

    render(
      <EvolutionConfirmModal
        onConfirm={handleConfirm}
        onOpenGuide={() => {}}
        onClose={() => {}}
        evolutionCandidates={[
          { targetId: "Greymon", label: "그레이몬" },
          { targetId: "Tyrannomon", label: "티라노몬" },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "티라노몬로 진화" }));

    expect(handleConfirm).toHaveBeenCalledWith("Tyrannomon");
  });
});
