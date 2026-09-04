import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DeathPopup from "./DeathPopup";

describe("DeathPopup", () => {
  test.each([
    "Ohakadamon1V4",
    "Ohakadamon2V4",
    "Ohakadamon1V5",
    "Ohakadamon2V5",
  ])("%s 사망 폼에서는 새로운 시작 버튼으로 환생한다", async (selectedDigimon) => {
    const onConfirm = jest.fn();
    const onNewStart = jest.fn().mockResolvedValue({ status: "synced" });

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

    await waitFor(() => expect(onNewStart).toHaveBeenCalledTimes(1));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("새 생애가 서버에 확정된 때만 팝업을 닫는다", async () => {
    const onClose = jest.fn();
    render(
      <DeathPopup
        isOpen
        onClose={onClose}
        onNewStart={jest.fn().mockResolvedValue({ status: "synced" })}
        selectedDigimon="Ohakadamon1V3"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "🥚 새로운 시작" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  test("새 생애가 queued이면 팝업을 유지하고 같은 전환 재시도를 제공한다", async () => {
    const onClose = jest.fn();
    const onNewStart = jest.fn()
      .mockResolvedValueOnce({ status: "queued" })
      .mockResolvedValueOnce({ status: "synced" });
    render(
      <DeathPopup
        isOpen
        onClose={onClose}
        onNewStart={onNewStart}
        selectedDigimon="Ohakadamon1V3"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "🥚 새로운 시작" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("아직 서버에 확정되지 않았습니다");
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(onNewStart).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
