import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import SleepSection from "./SleepSection";

const now = Date.parse("2026-07-26T12:00:00.000Z");
const baseProps = {
  stats: { sleepDisturbances: 0 },
  currentTime: now,
  currentSleepSchedule: { start: "22:00", end: "06:00" },
  visibleSleepStatus: "AWAKE",
  sleepStatusLabel: "깨어있음",
  isLightsOn: false,
  wakeUntil: null,
  sleepLightOnStart: null,
  activityLogs: [],
  currentStageStartedAt: null,
  onToggleNocturnal: jest.fn(),
};

function renderSection(overrides = {}) {
  return render(<SleepSection {...baseProps} {...overrides} />);
}

describe("SleepSection", () => {
  test("깨어있는 수면 상태와 야행성 변경 의도를 표시한다", () => {
    const onToggleNocturnal = jest.fn();
    renderSection({ onToggleNocturnal });

    expect(screen.getByText("수면 상태: 깨어있음")).toBeInTheDocument();
    expect(screen.getByText("수면상태확인: 수면 시간이 아님")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "OFF ☀️" }));
    expect(onToggleNocturnal).toHaveBeenCalledTimes(1);
  });

  test("낮잠과 빠른 잠들기의 남은 시간을 표시한다", () => {
    const view = renderSection({
      stats: { napUntil: now + 65 * 60 * 1000 },
      visibleSleepStatus: "NAPPING",
      sleepStatusLabel: "낮잠 중",
    });
    expect(screen.getByText(/1시간 5분 남음/)).toBeInTheDocument();
    view.unmount();

    renderSection({
      stats: { fastSleepStart: now - 5000 },
      visibleSleepStatus: "FALLING_ASLEEP",
      sleepStatusLabel: "잠들기 준비 중",
    });
    expect(screen.getByText("10초 후 잠들어요")).toBeInTheDocument();
    expect(screen.getByText("💡 빠른 잠들기: 10초 후 자동으로 잠듭니다")).toBeInTheDocument();
  });

  test.each([
    [5 * 60 * 1000 + 5000, "5분 5초 남음"],
    [5000, "5초 남음"],
  ])("낮잠 남은 시간 형식 경계를 유지한다", (remainingMs, expected) => {
    renderSection({
      stats: { napUntil: now + remainingMs },
      visibleSleepStatus: "NAPPING",
      sleepStatusLabel: "낮잠 중",
    });
    expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
  });

  test("빠른 잠들기 기한이 지나면 즉시 가능 문구를 표시한다", () => {
    renderSection({
      stats: { fastSleepStart: now - 16000 },
      visibleSleepStatus: "FALLING_ASLEEP",
      sleepStatusLabel: "잠들기 준비 중",
    });
    expect(screen.getByText("즉시 잠들 수 있음")).toBeInTheDocument();
    expect(screen.getByText(/빠른 잠들기: 즉시 잠들 수 있습니다/)).toBeInTheDocument();
  });

  test("강제 기상 중 남은 시간과 조명 상태를 표시한다", () => {
    renderSection({
      visibleSleepStatus: "AWAKE_INTERRUPTED",
      sleepStatusLabel: "강제 기상 중",
      isLightsOn: true,
      wakeUntil: now + 65000,
    });
    expect(screen.getByText(/수면 방해 중: 1분 5초/)).toBeInTheDocument();
    expect(screen.getByText("수면상태확인: 강제 기상 중 (1분 5초 남음)")).toBeInTheDocument();
  });

  test("정규 수면과 낮잠 기상 정보를 각각 표시한다", () => {
    const view = renderSection({
      visibleSleepStatus: "SLEEPING",
      sleepStatusLabel: "수면 중",
    });
    expect(screen.getByText(/기상까지:/)).toBeInTheDocument();
    view.unmount();

    renderSection({
      stats: { napUntil: now + 65000 },
      visibleSleepStatus: "SLEEPING",
      sleepStatusLabel: "수면 중",
    });
    expect(screen.getByText("낮잠 중: 1분 5초 후 기상")).toBeInTheDocument();
  });

  test("수면 조명 케어미스 카운트다운과 초과 상태를 구분한다", () => {
    const view = renderSection({
      visibleSleepStatus: "SLEEPING_LIGHT_ON",
      sleepStatusLabel: "수면 중(불 켜짐 경고!)",
      isLightsOn: true,
      sleepLightOnStart: now - 29 * 60 * 1000,
    });
    expect(screen.getByText(/1분 0초 남음/)).toBeInTheDocument();
    view.unmount();

    renderSection({
      visibleSleepStatus: "SLEEPING_LIGHT_ON",
      sleepStatusLabel: "수면 중(불 켜짐 경고!)",
      isLightsOn: true,
      sleepLightOnStart: now - 31 * 60 * 1000,
    });
    expect(screen.getByText("수면상태확인: 케어 미스 발생! (불을 30분 이상 켜둠)")).toBeInTheDocument();
  });

  test("현재 진화 구간의 수면 방해 이력만 펼쳐 표시한다", () => {
    renderSection({
      stats: { sleepDisturbances: 2 },
      currentStageStartedAt: now - 5000,
      activityLogs: [
        { type: "SLEEP_DISTURBANCE", text: "현재 구간", timestamp: now - 1000 },
        { type: "SLEEP_DISTURBANCE", text: "이전 구간", timestamp: now - 10000 },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /수면 방해 이력 \(1건\)/ }));
    expect(screen.getByText("현재 구간")).toBeInTheDocument();
    expect(screen.queryByText("이전 구간")).not.toBeInTheDocument();
  });

  test("냉장고 상태에서도 야행성 제어는 같은 위치에 유지한다", () => {
    renderSection({ stats: { isFrozen: true, isNocturnal: true } });
    expect(screen.getByText("4. 냉장고 상태")).toBeInTheDocument();
    expect(screen.getByText(/냉장고에 넣어서 얼어있음/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ON 🌙" })).toBeInTheDocument();
  });
});
