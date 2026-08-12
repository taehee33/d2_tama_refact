import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import StatsPanel from "./StatsPanel";

function openAdvancedSection() {
  fireEvent.click(screen.getByRole("button", { name: /스탯 패널/i }));
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

    expect(screen.getByText("배고픔 감소 주기: 비활성")).toBeInTheDocument();
    expect(screen.getByText("힘 감소 주기: 비활성")).toBeInTheDocument();
    expect(screen.getByText("배변 주기: 알 단계 전용")).toBeInTheDocument();
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
      screen.getByText("배변 주기: 60분 (남은 시간: 2분 5초)")
    ).toBeInTheDocument();
  });

  test("기본 스탯과 개발 정보의 라벨·상태 문구를 한글로 표시한다", () => {
    render(
      <StatsPanel
        stats={{
          age: 4,
          weight: 101,
          strength: 8,
          energy: 20,
          winRate: 25,
          effort: 3,
          careMistakes: 6,
          proteinOverdose: 2,
          overfeeds: 1,
          battles: 5,
          battlesWon: 3,
          battlesLost: 2,
        }}
        sleepStatus="SLEEPING"
      />
    );

    const panelButton = screen.getByRole("button", { name: /스탯 패널/i });
    expect(panelButton).toHaveAttribute("aria-expanded", "false");
    expect(panelButton).toHaveAttribute("aria-controls", "stats-panel-content");

    fireEvent.click(panelButton);

    expect(panelButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("나이: 4")).toBeInTheDocument();
    expect(screen.getByText("몸무게: 101")).toBeInTheDocument();
    expect(screen.getByText("힘: 5(+3)")).toBeInTheDocument();
    expect(screen.getByText("에너지 (DP): 20")).toBeInTheDocument();
    expect(screen.getByText("승률: 25%")).toBeInTheDocument();
    expect(screen.getByText("노력치: 3")).toBeInTheDocument();
    expect(screen.getByText("케어 미스: 6")).toBeInTheDocument();
    expect(screen.getByText("수면 상태: 수면 중")).toBeInTheDocument();

    const devInfoButton = screen.getByRole("button", { name: /3. 개발 정보/i });
    expect(devInfoButton).toHaveAttribute("aria-expanded", "false");
    expect(devInfoButton).toHaveAttribute("aria-controls", "stats-panel-dev-info");

    fireEvent.click(devInfoButton);

    expect(
      screen.getByRole("button", { name: /3. 개발 정보/i })
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("프로틴 과다: 2")).toBeInTheDocument();
    expect(screen.getByText("과식 횟수: 1")).toBeInTheDocument();
    expect(screen.getByText("배틀 횟수: 5")).toBeInTheDocument();
    expect(screen.getByText("승리: 3 / 패배: 2")).toBeInTheDocument();
    expect(window.localStorage.getItem("statsPanel_showDevInfo")).toBe("true");
  });

  test("내부 시간과 값이 없는 상태 문구도 한글 표시를 유지한다", () => {
    render(
      <StatsPanel
        stats={{
          evolutionStage: "Child",
          hungerTimer: 60,
          hungerCountdown: 3600,
          strengthTimer: 60,
          strengthCountdown: 3600,
          poopTimer: 60,
          poopCountdown: 60,
          lifespanSeconds: 90061,
          timeToEvolveSeconds: 3661,
        }}
      />
    );

    openAdvancedSection();

    expect(screen.getByText("배변 최대 도달 시각: 기록 없음")).toBeInTheDocument();
    expect(screen.getByText("최근 배변 페널티 시각: 기록 없음")).toBeInTheDocument();
    expect(screen.getByText("부상 발생 시각: 기록 없음")).toBeInTheDocument();
    expect(screen.getByText("사망 원인: 없음")).toBeInTheDocument();
    expect(screen.getByText("수명: 1일 1시간 1분 1초")).toBeInTheDocument();
    expect(screen.getByText("진화까지 남은 시간: 0일 1시간 1분 1초")).toBeInTheDocument();
  });
});
