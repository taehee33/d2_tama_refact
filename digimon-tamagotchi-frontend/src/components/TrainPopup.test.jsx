import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TrainPopup from "./TrainPopup";

function renderTrainPopup(extraProps = {}) {
  const baseProps = {
    onClose: jest.fn(),
    setDigimonStatsAndSave: jest.fn(),
    onTrainResult: jest.fn(async (roundResults) => ({
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
    })),
    digimonStats: {
      weight: 10,
      energy: 5,
      strength: 2,
      effort: 1,
      trainings: 0,
    },
    selectedDigimon: "Koromon",
    digimonNickname: "바람",
    digimonDataForSlot: {
      Koromon: {
        id: "Koromon",
        name: "코로몬",
        sprite: 210,
        spriteBasePath: "/images",
        stats: {
          attackSprite: 211,
        },
      },
    },
  };

  return render(<TrainPopup {...baseProps} {...extraProps} />);
}

describe("TrainPopup UI", () => {
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

  test("새 UI는 내 디지몬, 퍼펫 상대, ? 가림, 공격함/막음 흐름을 보여준다", async () => {
    renderTrainPopup();

    fireEvent.click(screen.getByRole("button", { name: "시작" }));

    expect(screen.getByText(/원작풍 상하 공격 훈련/)).toBeInTheDocument();
    expect(screen.getByText(/내 디지몬/)).toBeInTheDocument();
    expect(screen.getByLabelText("내 디지몬과 공격 패드")).toBeInTheDocument();
    expect(screen.getByText(/상대 퍼펫/)).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /위/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /아래/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /위/ }));

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getByLabelText("방패 방어")).toBeInTheDocument();
    expect(screen.getAllByText(/막음/).length).toBeGreaterThan(0);
    expect(screen.getByText(/방어당함/)).toBeInTheDocument();
    expect(screen.getByAltText("공격 스프라이트")).toHaveAttribute("src", "/images/211.png");
  });

  test("명중하면 공격 스프라이트가 끝까지 날아가고 퍼펫이 피격 반응을 보인다", async () => {
    renderTrainPopup();

    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    fireEvent.click(screen.getByRole("button", { name: /아래/ }));

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getByText(/명중 성공/)).toBeInTheDocument();
    expect(screen.getAllByText(/피격/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("방패 방어")).not.toBeInTheDocument();
  });

  test("입력 대기 중 남은 시간은 1초마다 감소한다", async () => {
    renderTrainPopup();

    fireEvent.click(screen.getByRole("button", { name: "시작" }));

    expect(screen.getByText(/5초/)).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByText(/4초/)).toBeInTheDocument();
    });
  });

  test("5라운드가 끝나면 최종 훈련 결과 팝업과 한번 더/닫기 버튼이 열린다", async () => {
    renderTrainPopup();

    fireEvent.click(screen.getByRole("button", { name: "시작" }));

    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: /위/ }));

      await act(async () => {
        jest.advanceTimersByTime(700);
      });
    }

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "최종 훈련 결과 팝업" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "한번 더" })).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "닫기" })[0]).toBeInTheDocument();
    });
  });
});
