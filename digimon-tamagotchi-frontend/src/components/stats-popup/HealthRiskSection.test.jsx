import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import HealthRiskSection from "./HealthRiskSection";

const now = Date.parse("2026-07-26T12:00:00.000Z");
const baseStats = {
  fullness: 1,
  strength: 1,
  poopCount: 0,
  isDead: false,
  isInjured: false,
  injuries: 0,
  lifespanSeconds: 0,
};

const baseProps = {
  currentStats: baseStats,
  stats: baseStats,
  displayActivityLogs: [],
  currentLifeStartedAt: now - 10000,
  selectedDigimonId: "Agumon",
  slotVersion: "Ver.1",
  digimonDataMap: {},
  injuryHistoryEntries: [],
  injuryDiagnosticMessage: null,
};

function renderSection(overrides = {}) {
  return render(<HealthRiskSection {...baseProps} {...overrides} />);
}

describe("HealthRiskSection", () => {
  afterEach(() => jest.restoreAllMocks());

  test("위험 조건이 없을 때 모든 기본 카운터를 표시한다", () => {
    renderSection();
    expect(screen.getByText("🍖 배고픔 0 지속:")).toBeInTheDocument();
    expect(screen.getByText("💪 힘 0 지속:")).toBeInTheDocument();
    expect(screen.getByText("🏥 부상 방치 (6시간):")).toBeInTheDocument();
    expect(screen.getByText("0 / 15 회")).toBeInTheDocument();
    expect(screen.getAllByText((_, node) => node?.textContent === "현재 수명: 0 day 0 hour 0 min 0 sec").length).toBeGreaterThan(0);
  });

  test("굶주림·힘 부족·부상 방치와 부상 과다 경계를 표시한다", () => {
    jest.spyOn(Date, "now").mockReturnValue(now);
    const currentStats = {
      ...baseStats,
      fullness: 0,
      strength: 0,
      lastHungerZeroAt: now - 12 * 60 * 60 * 1000,
      lastStrengthZeroAt: now - 12 * 60 * 60 * 1000,
      isInjured: true,
      injuredAt: now - 6 * 60 * 60 * 1000,
      injuries: 15,
    };
    renderSection({ currentStats, stats: currentStats });

    expect(screen.getAllByText("⚠️ 사망 위험!")).toHaveLength(3);
    expect(screen.getByText("⚠️ 사망 위험! (부상 15회 도달)")).toBeInTheDocument();
  });

  test("냉장고 상태에서 진행 중 위험 타이머가 멈춘 문구를 표시한다", () => {
    jest.spyOn(Date, "now").mockReturnValue(now);
    const currentStats = {
      ...baseStats,
      fullness: 0,
      lastHungerZeroAt: now - 1000,
      isFrozen: true,
      frozenAt: now - 500,
    };
    renderSection({ currentStats, stats: currentStats });
    expect(screen.getAllByText("🧊 냉장고에 넣어서 얼어서 멈춤").length).toBeGreaterThan(0);
  });

  test("정규화된 부상 이력과 진단 문구를 표시한다", () => {
    renderSection({
      currentStats: { ...baseStats, injuries: 1 },
      injuryHistoryEntries: [{
        timestamp: now - 1000,
        normalizedReason: "battle",
        text: "배틀 패배로 부상",
        digimonName: "아구몬",
      }],
      injuryDiagnosticMessage: "부상 이력 진단",
    });

    expect(screen.getByText("부상 이력 진단")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /부상 이력 \(1건\)/ }));
    expect(screen.getByText("⚔️ 배틀로 인한 부상")).toBeInTheDocument();
    expect(screen.getByText("당시 디지몬: 아구몬")).toBeInTheDocument();
  });

  test("사망 원인에 맞춰 카운터 정지 상태를 표시한다", () => {
    const currentStats = {
      ...baseStats,
      isDead: true,
      deathReason: "STARVATION (굶주림)",
      lastHungerZeroAt: now - 12 * 60 * 60 * 1000,
    };
    renderSection({ currentStats, stats: currentStats });
    expect(screen.getByText("💀 사망 (카운터 정지)")).toBeInTheDocument();
  });
});
