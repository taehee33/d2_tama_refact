import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import StatsPanel from "./StatsPanel";

function openAdvancedSection() {
  fireEvent.click(screen.getByRole("button", { name: /StatsPanel/i }));
  fireEvent.click(screen.getByRole("button", { name: /4. 내부\/고급 카운터/i }));
}

describe("StatsPanel 내부/고급 카운터 표시", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("디지타마 센티널 타이머를 사람이 읽는 상태 문구로 바꿔 보여준다", () => {
    render(
      <StatsPanel
        stats={{
          evolutionStage: "Digitama",
          hungerTimer: 0,
          hungerCountdown: 0,
          strengthTimer: 0,
          strengthCountdown: 0,
          poopTimer: 999,
          poopCountdown: 58477,
          poopCount: 0,
          lifespanSeconds: 0,
          timeToEvolveSeconds: 0,
        }}
        sleepStatus="AWAKE"
      />
    );

    openAdvancedSection();

    expect(screen.getByText("HungerTimer: 비활성")).toBeInTheDocument();
    expect(screen.getByText("StrengthTimer: 비활성")).toBeInTheDocument();
    expect(screen.getByText("PoopTimer: 알 단계 전용")).toBeInTheDocument();
    expect(screen.queryByText(/974m 37s/)).not.toBeInTheDocument();
  });

  test("일반 단계 타이머는 기존 분/초 형식으로 유지한다", () => {
    render(
      <StatsPanel
        stats={{
          evolutionStage: "Child",
          hungerTimer: 60,
          hungerCountdown: 3600,
          strengthTimer: 60,
          strengthCountdown: 3600,
          poopTimer: 60,
          poopCountdown: 125,
          poopCount: 1,
          lifespanSeconds: 0,
          timeToEvolveSeconds: 0,
        }}
        sleepStatus="AWAKE"
      />
    );

    openAdvancedSection();

    expect(
      screen.getByText("PoopTimer: 60 min (남은 시간: 2m 5s)")
    ).toBeInTheDocument();
  });
});
