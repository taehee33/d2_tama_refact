import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import CareHistorySection from "./CareHistorySection";

const baseProps = {
  fullness: 1,
  strength: 1,
  lastHungerZeroAt: null,
  lastStrengthZeroAt: null,
  isFrozen: false,
  visibleSleepStatus: "AWAKE",
  activeCallMap: new Map(),
  isSleepLightCareMistakeProcessed: false,
  sleepStatusLabel: "깨어있음",
  isLightsOn: false,
  careMistakeHistoryEntries: [],
  careMistakeDiagnosticMessage: null,
  formatTimestamp: (timestamp) => `시각:${timestamp}`,
};

function renderSection(overrides = {}) {
  return render(<CareHistorySection {...baseProps} {...overrides} />);
}

describe("CareHistorySection", () => {
  test("호출 조건 미충족 상태를 전달받은 문구로 표시한다", () => {
    renderSection();

    expect(screen.getByText("✓ 조건 미충족 (Fullness: 1)")).toBeInTheDocument();
    expect(screen.getByText("✓ 조건 미충족 (Strength: 1)")).toBeInTheDocument();
    expect(screen.getByText("✓ 조건 미충족 (수면 상태: 깨어있음, 불: 꺼짐)")).toBeInTheDocument();
  });

  test("활성 Hunger Call의 상태·이유·기한·위험 문구를 표시한다", () => {
    renderSection({
      fullness: 0,
      activeCallMap: new Map([["hunger", {
        type: "hunger",
        statusLabel: "5분 0초 남음",
        reason: "포만감이 0입니다.",
        deadlineText: "기한: 12:05",
        riskText: "10분을 넘기면 케어미스가 증가합니다.",
        isPaused: false,
      }]]),
    });

    expect(screen.getByText("호출 진행 중")).toBeInTheDocument();
    expect(screen.getByText("5분 0초 남음")).toBeInTheDocument();
    expect(screen.getByText("포만감이 0입니다.")).toBeInTheDocument();
    expect(screen.getByText("기한: 12:05")).toBeInTheDocument();
    expect(screen.getByText("10분을 넘기면 케어미스가 증가합니다.")).toBeInTheDocument();
  });

  test("처리된 호출과 수면 조명 케어미스 상태를 표시한다", () => {
    renderSection({
      fullness: 0,
      strength: 0,
      lastHungerZeroAt: 1,
      lastStrengthZeroAt: 1,
      visibleSleepStatus: "SLEEPING_LIGHT_ON",
      isLightsOn: true,
      isSleepLightCareMistakeProcessed: true,
    });

    expect(screen.getAllByText(/케어미스 반영 후 호출 종료/)).toHaveLength(2);
    expect(screen.getByText("케어미스 처리됨 · 불은 아직 켜져 있음")).toBeInTheDocument();
  });

  test("냉장고 상태에서는 수면 조명 호출 대신 냉장고 문구를 표시한다", () => {
    renderSection({ isFrozen: true });
    expect(screen.getByText("🧊 냉장고 상태에서는 수면 개념이 없습니다")).toBeInTheDocument();
  });

  test("케어미스 이력을 최신순으로 펼치고 진단 문구를 표시한다", () => {
    renderSection({
      careMistakeHistoryEntries: [
        { occurredAt: 1, text: "첫 번째", source: "interaction" },
        { occurredAt: 2, text: "두 번째", source: "sync" },
      ],
      careMistakeDiagnosticMessage: "진단 문구",
    });

    expect(screen.getByText("진단 문구")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /현재 활성 케어미스 이력 \(2건\)/ }));
    expect(screen.getByText("첫 번째")).toBeInTheDocument();
    expect(screen.getByText("두 번째")).toBeInTheDocument();
    expect(screen.getByText("시각:1")).toBeInTheDocument();
    expect(screen.getByText("시각:2")).toBeInTheDocument();
  });

  test("legacy recovery는 synthetic timestamp 대신 실제 시각 미상으로 표시한다", () => {
    const formatTimestamp = jest.fn((timestamp) => `시각:${timestamp}`);
    renderSection({
      formatTimestamp,
      careMistakeHistoryEntries: [{
        occurredAt: 123456,
        text: "복구된 케어미스 기록",
        source: "legacy_recovery",
        originalOccurredAtKnown: false,
      }],
    });

    fireEvent.click(screen.getByRole("button", { name: /현재 활성 케어미스 이력/ }));
    expect(screen.getByText("복구된 기록 · 실제 시각 알 수 없음")).toBeInTheDocument();
    expect(formatTimestamp).not.toHaveBeenCalled();
  });
});
