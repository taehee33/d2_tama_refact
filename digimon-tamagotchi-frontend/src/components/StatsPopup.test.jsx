import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import StatsPopup from "./StatsPopup";

function renderStatsPopup(overrides = {}) {
  const onChangeStats = jest.fn();

  render(
    <StatsPopup
      stats={{
        fullness: 1,
        maxOverfeed: 3,
        timeToEvolveSeconds: 3600,
        lifespanSeconds: 0,
        age: 0,
        sprite: 100,
        evolutionStage: "child",
        weight: 3,
        careMistakes: 0,
        strength: 1,
        effort: 0,
        winRate: 0,
        energy: 0,
        poopCount: 0,
        isInjured: false,
        injuredAt: null,
        injuries: 0,
        healedDosesCurrent: 0,
        hungerTimer: 60,
        strengthTimer: 60,
        poopTimer: 60,
        maxEnergy: 0,
        maxStamina: 0,
        minWeight: 0,
        healing: 1,
        attribute: "Vaccine",
        power: 10,
        ...overrides.stats,
      }}
      activityLogs={[]}
      digimonData={{ healDoses: 1 }}
      digimonDataMap={{}}
      selectedDigimonId="Agumon"
      slotVersion="Ver.1"
      onClose={jest.fn()}
      devMode
      onChangeStats={onChangeStats}
      sleepStatus="AWAKE"
      isLightsOn={false}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "[ Old ]" }));

  return { onChangeStats };
}

describe("StatsPopup OLD 탭 부상 상태 토글", () => {
  test("부상 상태 버튼을 누르면 isInjured가 true로 전달된다", () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(123456789);
    const { onChangeStats } = renderStatsPopup();
    const toggleButton = screen.getByRole("button", {
      name: /isInjured \(부상 상태\)/i,
    });

    expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("OFF")).toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(onChangeStats).toHaveBeenCalledWith(
      expect.objectContaining({
        isInjured: true,
        injuredAt: 123456789,
      })
    );
    expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("ON")).toBeInTheDocument();

    nowSpy.mockRestore();
  });
});
