import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TrainPopup from "./TrainPopup";

const DEFAULT_VIEWPORT_WIDTH = 1024;
const DEFAULT_VIEWPORT_HEIGHT = 768;

function setViewportSize(width, height = DEFAULT_VIEWPORT_HEIGHT) {
  act(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: width,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: height,
    });
    window.dispatchEvent(new Event("resize"));
  });
}

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
    setViewportSize(DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    setViewportSize(DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT);
    jest.useRealTimers();
    window.alert.mockRestore();
  });

  test("새 UI는 내 디지몬, 샌드백 상대, ? 가림, 공격함/막음 흐름을 보여준다", async () => {
    renderTrainPopup();

    fireEvent.click(screen.getByRole("button", { name: "시작" }));

    expect(screen.getByText(/원작풍 상하 공격 훈련/)).toBeInTheDocument();
    expect(screen.getByText(/내 디지몬/)).toBeInTheDocument();
    expect(screen.getByLabelText("내 디지몬과 공격 패드")).toBeInTheDocument();
    expect(screen.getByText(/샌드백/)).toBeInTheDocument();
    expect(screen.getByAltText("훈련 샌드백 스프라이트")).toHaveAttribute("src", "/images/567.png");
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
    expect(screen.queryByTestId("train-hit-effect")).not.toBeInTheDocument();
  });

  test("하단 명중이면 122/123 피격 이펙트가 샌드백 하단에 표시된다", async () => {
    renderTrainPopup();

    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    fireEvent.click(screen.getByRole("button", { name: /아래/ }));

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    const hitEffect = screen.getByTestId("train-hit-effect");

    expect(screen.getByText(/명중 성공/)).toBeInTheDocument();
    expect(screen.getAllByText(/피격/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("방패 방어")).not.toBeInTheDocument();
    expect(hitEffect).toHaveClass("is-lower");
    expect(screen.getByTestId("train-hit-effect-122")).toHaveAttribute("src", "/images/122.png");
    expect(screen.getByTestId("train-hit-effect-123")).toHaveAttribute("src", "/images/123.png");
  });

  test("상단 명중이면 122/123 피격 이펙트가 샌드백 상단에 표시된다", async () => {
    renderTrainPopup({
      digimonStats: {
        weight: 10,
        energy: 5,
        strength: 2,
        effort: 1,
        trainings: 1,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    fireEvent.click(screen.getByRole("button", { name: /위/ }));

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getByTestId("train-hit-effect")).toHaveClass("is-upper");
  });

  test("모바일에서는 공격 버튼이 내 디지몬 아래 패널로 이동한다", async () => {
    setViewportSize(390, 844);
    renderTrainPopup();

    fireEvent.click(screen.getByRole("button", { name: "시작" }));

    const playerPanel = screen.getByLabelText("내 디지몬");
    const mobileControls = screen.getByLabelText("모바일 입력 패드");
    const dummyCard = screen.getByText("샌드백").closest("article");

    expect(playerPanel).toBeInTheDocument();
    expect(screen.queryByLabelText("내 디지몬과 공격 패드")).not.toBeInTheDocument();
    expect(mobileControls).toBeInTheDocument();
    expect(playerPanel).toContainElement(mobileControls);
    expect(dummyCard).not.toContainElement(mobileControls);
    expect(screen.getAllByRole("button", { name: /위/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /아래/ })).toHaveLength(1);
  });

  test("짧은 가로 화면에서도 모바일 입력 패드를 유지한다", async () => {
    setViewportSize(844, 390);
    renderTrainPopup();

    fireEvent.click(screen.getByRole("button", { name: "시작" }));

    expect(screen.getByLabelText("내 디지몬")).toContainElement(
      screen.getByLabelText("모바일 입력 패드")
    );
    expect(screen.queryByLabelText("내 디지몬과 공격 패드")).not.toBeInTheDocument();
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

  test("남은 시간이 3초 이하가 되면 빨간색 긴급 표시 클래스를 붙인다", async () => {
    renderTrainPopup();

    fireEvent.click(screen.getByRole("button", { name: "시작" }));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByText(/3초/)).toHaveClass("is-urgent");
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
