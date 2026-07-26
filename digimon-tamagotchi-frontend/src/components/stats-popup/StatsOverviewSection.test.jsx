import React from "react";
import { render, screen } from "@testing-library/react";
import StatsOverviewSection from "./StatsOverviewSection";

const overview = {
  speciesData: { minWeight: 2, maxEnergy: 4 },
  sleepTime: "22:00 ~ 06:00",
  speciesHungerTimer: 60,
  speciesStrengthTimer: 70,
  speciesPower: 10,
  speciesHealDoses: 1,
  wakeEnergyRecoveryText: "4",
  nextEnergyRecoveryText: "29분 59초",
  hungerTimerDisplay: { label: "60 min", showCountdown: true, countdownLabel: "59분 59초" },
  strengthTimerDisplay: { label: "70 min", showCountdown: false, countdownLabel: "" },
  poopTimerDisplay: { label: "60 min", showCountdown: false, countdownLabel: "" },
};

const stats = {
  age: 2,
  weight: 3,
  fullness: 4,
  strength: 5,
  energy: 2,
  maxEnergy: 4,
  battles: 2,
  battlesWon: 1,
  totalBattles: 4,
  totalBattlesWon: 3,
  careMistakes: 1,
  lifespanSeconds: 60,
  timeToEvolveSeconds: 120,
};

describe("StatsOverviewSection", () => {
  test("summary 모드에서 1~3 섹션만 표시한다", () => {
    render(
      <StatsOverviewSection
        stats={stats}
        sourceStats={{ proteinOverdose: 1 }}
        overview={overview}
        isSleepingLikeStatus
        part="summary"
      />
    );

    expect(screen.getByText("1. 종(Species) 고정 파라미터")).toBeInTheDocument();
    expect(screen.getByText("2. 개체(Instance) 상태값")).toBeInTheDocument();
    expect(screen.getByText("3. 행동 델타 규칙 (Action Delta)")).toBeInTheDocument();
    expect(screen.getByText("- isSleeping: Yes")).toBeInTheDocument();
    expect(screen.queryByText("6. 진화 판정 카운터")).not.toBeInTheDocument();
  });

  test("counters 모드에서 진화와 내부 카운터만 표시한다", () => {
    render(
      <StatsOverviewSection
        stats={stats}
        sourceStats={{}}
        overview={overview}
        isSleepingLikeStatus={false}
        part="counters"
      />
    );

    expect(screen.getByText("6. 진화 판정 카운터")).toBeInTheDocument();
    expect(screen.getByText("7. 내부/고급 카운터")).toBeInTheDocument();
    expect(screen.getByText(/HungerTimer: 60 min/)).toHaveTextContent("남은 시간: 59분 59초");
    expect(screen.queryByText("1. 종(Species) 고정 파라미터")).not.toBeInTheDocument();
  });
});
