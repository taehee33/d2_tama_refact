import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import DeathPopup from "./DeathPopup";

describe("DeathPopup", () => {
  test.each([
    "Ohakadamon1V4",
    "Ohakadamon2V4",
    "Ohakadamon1V5",
    "Ohakadamon2V5",
  ])("%s 사망 폼에서는 새로운 시작 버튼으로 환생한다", (selectedDigimon) => {
    const onConfirm = jest.fn();
    const onNewStart = jest.fn();

    render(
      <DeathPopup
        isOpen
        onConfirm={onConfirm}
        onClose={jest.fn()}
        onNewStart={onNewStart}
        selectedDigimon={selectedDigimon}
        reason="OLD AGE (수명 다함)"
      />
    );

    const newStartButton = screen.getByRole("button", {
      name: "🥚 새로운 시작",
    });
    fireEvent.click(newStartButton);

    expect(onNewStart).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
