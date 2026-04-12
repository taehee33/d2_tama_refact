import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import InteractionModal from "./InteractionModal";

describe("InteractionModal", () => {
  test("상단 닫기 버튼으로 모달을 닫을 수 있다", () => {
    const onClose = jest.fn();

    render(
      <InteractionModal
        onClose={onClose}
        onDiet={jest.fn()}
        onDetox={jest.fn()}
        onRest={jest.fn()}
        onPlayOrSnack={jest.fn()}
        onTease={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "교감 닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
