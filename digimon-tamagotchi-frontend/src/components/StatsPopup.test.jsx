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

describe("StatsPopup NEW 탭 케어미스/부상 안내", () => {
  test("Care Mistakes를 현재 활성 기준으로 안내한다", () => {
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
          careMistakes: 1,
          careMistakeLedger: [
            {
              id: "tease:1",
              occurredAt: 1,
              reasonKey: "tease",
              text: "케어미스(사유: 괜히 괴롭히기): 0 → 1",
              source: "interaction",
              resolvedAt: null,
              resolvedBy: null,
            },
          ],
          strength: 1,
          effort: 0,
          winRate: 0,
          energy: 0,
          poopCount: 0,
          isInjured: false,
          injuries: 0,
          hungerTimer: 60,
          strengthTimer: 60,
          poopTimer: 60,
        }}
        activityLogs={[]}
        digimonData={{ healDoses: 1 }}
        digimonDataMap={{}}
        selectedDigimonId="Agumon"
        slotVersion="Ver.1"
        onClose={jest.fn()}
        devMode={false}
        onChangeStats={jest.fn()}
        sleepStatus="AWAKE"
        isLightsOn={false}
      />
    );

    expect(screen.getByText("(현재 활성 기준, 감소 가능)")).toBeInTheDocument();
    expect(screen.getByText("현재 활성 케어미스 이력 (1건)")).toBeInTheDocument();
  });

  test("원본 이력과 현재 카운터가 어긋나면 비파괴 진단을 표시한다", () => {
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
          birthTime: Date.parse("2026-04-09T00:00:00.000Z"),
          careMistakes: 2,
          careMistakeLedger: [
            {
              id: "tease:1",
              occurredAt: Date.parse("2026-04-09T00:10:00.000Z"),
              reasonKey: "tease",
              text: "케어미스(사유: 괜히 괴롭히기): 0 → 1",
              source: "interaction",
              resolvedAt: null,
              resolvedBy: null,
            },
          ],
          strength: 1,
          effort: 0,
          winRate: 0,
          energy: 0,
          poopCount: 8,
          isInjured: true,
          injuries: 3,
          hungerTimer: 60,
          strengthTimer: 60,
          poopTimer: 60,
        }}
        activityLogs={[
          {
            type: "POOP",
            text: "Pooped (Total: 8) - Injury: Too much poop (8 piles)",
            timestamp: Date.parse("2026-04-09T00:20:00.000Z"),
          },
        ]}
        digimonData={{ healDoses: 1 }}
        digimonDataMap={{}}
        selectedDigimonId="Agumon"
        slotVersion="Ver.1"
        onClose={jest.fn()}
        devMode={false}
        onChangeStats={jest.fn()}
        sleepStatus="AWAKE"
        isLightsOn={false}
      />
    );

    expect(
      screen.getByText(/현재 케어미스 값과 원본 이력이 완전히 일치하지 않습니다/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/이번 생 누적 부상 횟수와 표시 이력이 완전히 일치하지 않습니다/)
    ).toBeInTheDocument();
  });
});
