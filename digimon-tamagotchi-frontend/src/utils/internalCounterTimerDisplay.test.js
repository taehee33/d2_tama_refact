import { getInternalCounterTimerDisplay } from "./internalCounterTimerDisplay";

describe("getInternalCounterTimerDisplay", () => {
  test("0분 타이머는 비활성으로 표시하고 countdown을 숨긴다", () => {
    expect(getInternalCounterTimerDisplay({
      evolutionStage: "Child",
      timerKind: "hunger",
      timerMinutes: 0,
      countdownSeconds: 300,
    })).toEqual({
      label: "비활성",
      countdownLabel: "",
      showCountdown: false,
    });
  });

  test("디지타마 poop sentinel은 알 단계 전용으로 표시한다", () => {
    expect(getInternalCounterTimerDisplay({
      evolutionStage: "Digitama",
      timerKind: "poop",
      timerMinutes: 999,
      countdownSeconds: 58477,
    })).toEqual({
      label: "알 단계 전용",
      countdownLabel: "",
      showCountdown: false,
    });
  });

  test("일반 타이머는 분과 countdown을 기존 형식으로 표시한다", () => {
    expect(getInternalCounterTimerDisplay({
      evolutionStage: "Child",
      timerKind: "poop",
      timerMinutes: 60,
      countdownSeconds: 125,
    })).toEqual({
      label: "60 min",
      countdownLabel: "2m 5s",
      showCountdown: true,
    });
  });
});
