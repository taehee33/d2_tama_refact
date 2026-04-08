import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TrainPopup from "./TrainPopup";

function renderStrictTrainPopup() {
  return render(
    <React.StrictMode>
      <TrainPopup
        onClose={jest.fn()}
        setDigimonStatsAndSave={jest.fn()}
        onTrainResult={jest.fn(async (roundResults) => ({
          updatedStats: {
            weight: 8,
            energy: 4,
            strength: 3,
            effort: 2,
            trainings: 4,
          },
          hits: roundResults.filter((result) => result.isHit).length,
          fails: roundResults.filter((result) => !result.isHit).length,
          isSuccess: true,
          message: "< 좋은 훈련이었다! >",
          roundResults,
        }))}
        digimonStats={{
          weight: 10,
          energy: 5,
          strength: 2,
          effort: 1,
          trainings: 0,
        }}
        selectedDigimon="Koromon"
        digimonNickname="바람"
        digimonDataForSlot={{
          Koromon: {
            id: "Koromon",
            name: "코로몬",
            sprite: 210,
            spriteBasePath: "/images",
          },
        }}
      />
    </React.StrictMode>
  );
}

describe("TrainPopup StrictMode", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    window.alert.mockRestore();
  });

  test("StrictMode에서도 첫 라운드 후 판정 연출이 멈추지 않고 다음 상태로 진행된다", async () => {
    renderStrictTrainPopup();

    fireEvent.click(screen.getByRole("button", { name: "시작" }));

    fireEvent.click(screen.getByRole("button", { name: /위/ }));

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByText(/2\s*\/\s*5/)).toBeInTheDocument();
    });
  });

  test("StrictMode에서도 남은 시간이 정상적으로 감소한다", async () => {
    renderStrictTrainPopup();

    fireEvent.click(screen.getByRole("button", { name: "시작" }));

    expect(screen.getByText(/5초/)).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByText(/4초/)).toBeInTheDocument();
    });
  });
});
