import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import GameScreen from "./GameScreen";

jest.mock("./Canvas", () => function CanvasMock(props) {
  return (
    <div
      data-testid="canvas"
      data-class-name={props.className || ""}
      data-animation-style={props.style?.animation || ""}
      data-filter-style={props.style?.filter || ""}
      data-transition-style={props.style?.transition || ""}
    />
  );
});

function createCallStatus(overrides = {}) {
  return {
    hunger: { isActive: false, startedAt: null, isLogged: false },
    strength: { isActive: false, startedAt: null, isLogged: false },
    sleep: { isActive: false, startedAt: null },
    ...overrides,
  };
}

function renderGameScreen(props = {}) {
  const now = new Date("2026-04-07T12:00:00.000Z").getTime();

  return render(
    <GameScreen
      width={320}
      height={240}
      digimonStats={{
        fullness: 3,
        strength: 3,
        activityLogs: [],
        callStatus: createCallStatus(),
        ...props.digimonStats,
      }}
      sleepStatus="AWAKE"
      isLightsOn
      onCallIconClick={jest.fn()}
      onCallModalClose={jest.fn()}
      onResolveCallAction={jest.fn()}
      showCallModal={false}
      currentTime={props.currentTime ?? now}
      {...props}
    />
  );
}

describe("GameScreen 호출 UI", () => {
  test("배고픔 호출 모달에서 한국어 안내와 먹이 액션 버튼을 보여준다", () => {
    const onResolveCallAction = jest.fn();

    renderGameScreen({
      showCallModal: true,
      onResolveCallAction,
      digimonStats: {
        fullness: 0,
        hungerMistakeDeadline: Date.now() + 9 * 60 * 1000,
        callStatus: createCallStatus({
          hunger: {
            isActive: true,
            startedAt: Date.now() - 60 * 1000,
            isLogged: false,
          },
        }),
      },
    });

    expect(screen.getByText("📣 호출 상태")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "현재 호출" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("배고픔 호출")).toBeInTheDocument();
    expect(screen.getByText("10분을 넘기면 케어미스가 1 증가합니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "먹이 메뉴 열기" }));
    expect(onResolveCallAction).toHaveBeenCalledWith("open-feed");
  });

  test("수면 조명 경고 모달에서 경고 전용 문구와 조명 액션 버튼을 보여준다", () => {
    const onResolveCallAction = jest.fn();

    renderGameScreen({
      showCallModal: true,
      sleepStatus: "SLEEPING_LIGHT_ON",
      isLightsOn: true,
      onResolveCallAction,
      digimonStats: {
        callStatus: createCallStatus({
          sleep: {
            isActive: true,
            startedAt: Date.now() - 5 * 60 * 1000,
          },
        }),
      },
    });

    expect(screen.getByText("수면 조명 경고")).toBeInTheDocument();
    expect(screen.getByText("30분을 넘기면 케어미스가 1 증가합니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "조명 설정 열기" }));
    expect(onResolveCallAction).toHaveBeenCalledWith("open-lights");
  });

  test("활성 호출이 없으면 최근 호출/케어미스 기록을 한국어로 보여준다", () => {
    renderGameScreen({
      showCallModal: true,
      digimonStats: {
        activityLogs: [
          { type: "CALL", text: "Call: Hungry!", timestamp: Date.now() - 5000 },
          {
            type: "CARE_MISTAKE",
            text: "케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]",
            timestamp: Date.now() - 3000,
          },
          { type: "CALL", text: "Call: Sleepy!", timestamp: Date.now() - 1000 },
        ],
      },
    });

    expect(screen.getByRole("tab", { name: "최근 호출/케어미스 기록" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("현재 활성 호출이 없습니다.")).toBeInTheDocument();
    expect(screen.getAllByText("최근 호출/케어미스 기록").length).toBeGreaterThan(0);
    expect(screen.getByText("배고픔 호출이 시작되었습니다.")).toBeInTheDocument();
    expect(screen.getByText("수면 조명 경고가 시작되었습니다.")).toBeInTheDocument();
    expect(screen.getByText("배고픔 호출이 케어미스로 처리되었습니다.")).toBeInTheDocument();
    expect(screen.queryByText(/과거 재구성/)).not.toBeInTheDocument();
  });

  test("활성 호출이 있으면 화면 내 호출 아이콘으로 같은 모달 진입 콜백을 호출한다", () => {
    const onCallIconClick = jest.fn();

    renderGameScreen({
      onCallIconClick,
      digimonStats: {
        fullness: 0,
        hungerMistakeDeadline: Date.now() + 9 * 60 * 1000,
        callStatus: createCallStatus({
          hunger: {
            isActive: true,
            startedAt: Date.now() - 60 * 1000,
            isLogged: false,
          },
        }),
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "호출 상태 열기" }));
    expect(onCallIconClick).toHaveBeenCalledTimes(1);
  });

  test("활성 호출이 없고 최근 기록만 있으면 최근 호출 아이콘으로 모달 진입 콜백을 호출한다", () => {
    const onCallIconClick = jest.fn();

    renderGameScreen({
      onCallIconClick,
      digimonStats: {
        activityLogs: [
          { type: "CALL", text: "Call: Hungry!", timestamp: Date.now() - 5000 },
        ],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "최근 호출 열기" }));
    expect(onCallIconClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "최근 호출 열기" })).toHaveTextContent("🕘📣");
  });

  test("확인된 최근 호출만 있으면 최근 호출 아이콘을 숨긴다", () => {
    const timestamp = Date.now() - 5000;

    renderGameScreen({
      digimonStats: {
        acknowledgedRecentCallIds: [`call:hunger:logged:${timestamp}`],
        activityLogs: [
          { type: "CALL", text: "Call: Hungry!", timestamp },
        ],
      },
    });

    expect(screen.queryByRole("button", { name: "최근 호출 열기" })).not.toBeInTheDocument();
  });

  test("최근 호출 탭은 확인 상태 배지와 모두 확인 버튼을 보여준다", () => {
    const timestamp = Date.now() - 5000;
    const onAcknowledgeRecentCalls = jest.fn();

    renderGameScreen({
      showCallModal: true,
      onAcknowledgeRecentCalls,
      digimonStats: {
        activityLogs: [
          { type: "CALL", text: "Call: Hungry!", timestamp },
        ],
      },
    });

    expect(screen.getByText("미확인")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "모두 확인" }));

    expect(onAcknowledgeRecentCalls).toHaveBeenCalledWith([`call:hunger:logged:${timestamp}`]);
  });

  test("모두 확인된 최근 호출은 확인됨 배지로 표시하고 모두 확인 버튼을 숨긴다", () => {
    const timestamp = Date.now() - 5000;

    renderGameScreen({
      showCallModal: true,
      digimonStats: {
        acknowledgedRecentCallIds: [`call:hunger:logged:${timestamp}`],
        activityLogs: [
          { type: "CALL", text: "Call: Hungry!", timestamp },
        ],
      },
    });

    expect(screen.getByText("확인됨")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "모두 확인" })).not.toBeInTheDocument();
  });

  test("최근 호출 탭과 현재 호출 탭을 전환해 내용을 분리해서 보여준다", () => {
    renderGameScreen({
      showCallModal: true,
      digimonStats: {
        fullness: 0,
        hungerMistakeDeadline: Date.now() + 9 * 60 * 1000,
        activityLogs: [
          { type: "CALL", text: "Call: Sleepy!", timestamp: Date.now() - 5000 },
        ],
        callStatus: createCallStatus({
          hunger: {
            isActive: true,
            startedAt: Date.now() - 60 * 1000,
            isLogged: false,
          },
        }),
      },
    });

    expect(screen.getByRole("tab", { name: "현재 호출" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("배고픔 호출")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "최근 호출/케어미스 기록" }));

    expect(screen.getByRole("tab", { name: "최근 호출/케어미스 기록" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("수면 조명 경고가 시작되었습니다.")).toBeInTheDocument();
  });
});

describe("GameScreen 부상 이모지 오버레이", () => {
  test("부상 상태면 1시와 7시에 주사기 이모지가 고정 표시된다", () => {
    renderGameScreen({
      digimonStats: {
        isInjured: true,
        isDead: false,
      },
    });

    const syringeOverlays = screen.getAllByText("💉");

    expect(syringeOverlays).toHaveLength(2);
    expect(
      syringeOverlays.some(
        (element) => element.style.top === "62%" && element.style.left === "10%"
      )
    ).toBe(true);
    expect(
      syringeOverlays.some(
        (element) => element.style.top === "22%" && element.style.right === "10%"
      )
    ).toBe(true);
  });

  test("사망 상태면 주사기 이모지 오버레이를 숨긴다", () => {
    renderGameScreen({
      digimonStats: {
        isInjured: true,
        isDead: true,
      },
    });

    expect(screen.queryAllByText("💉")).toHaveLength(0);
  });

  test("부상 상태가 아니면 주사기 이모지 오버레이를 표시하지 않는다", () => {
    renderGameScreen({
      digimonStats: {
        isInjured: false,
        isDead: false,
      },
    });

    expect(screen.queryAllByText("💉")).toHaveLength(0);
  });
});

describe("GameScreen 수면 상태 라벨", () => {
  test("잠들기 준비 중이면 우상단 라벨에 남은 초를 표시한다", () => {
    const now = new Date("2026-04-07T12:00:05.000Z").getTime();

    renderGameScreen({
      sleepStatus: "FALLING_ASLEEP",
      isLightsOn: false,
      currentTime: now,
      digimonStats: {
        fastSleepStart: now - 5 * 1000,
      },
    });

    expect(screen.getByText("잠들기 준비 10초")).toBeInTheDocument();
  });

  test("낮잠 중이면 우상단 라벨에 남은 낮잠 시간을 표시한다", () => {
    const now = new Date("2026-04-07T12:00:05.000Z").getTime();

    renderGameScreen({
      sleepStatus: "NAPPING",
      isLightsOn: false,
      currentTime: now,
      digimonStats: {
        napUntil: now + 65 * 1000,
      },
    });

    expect(screen.getByText("낮잠 1분 5초 남음")).toBeInTheDocument();
  });
});

describe("GameScreen 진화 연출", () => {
  test("디지타마 flashing 단계에서는 화면 전체 플래시 오버레이를 적용한다", () => {
    renderGameScreen({
      selectedDigimon: "Digitama",
      evolutionStage: "flashing",
    });

    const canvas = screen.getByTestId("canvas");

    expect(canvas).toHaveAttribute("data-class-name", "");
    expect(canvas).toHaveAttribute("data-filter-style", "none");
    expect(canvas).toHaveAttribute("data-transition-style", "none");
    expect(screen.getByTestId("evolution-flash-overlay")).toHaveClass(
      "evolution-screen-flash"
    );
  });

  test("일반 디지몬 flashing 단계에서도 화면 전체 플래시 오버레이를 적용한다", () => {
    renderGameScreen({
      selectedDigimon: "Agumon",
      evolutionStage: "flashing",
    });

    const canvas = screen.getByTestId("canvas");

    expect(canvas).toHaveAttribute("data-class-name", "");
    expect(canvas).toHaveAttribute("data-filter-style", "none");
    expect(canvas).toHaveAttribute("data-transition-style", "none");
    expect(screen.getByTestId("evolution-flash-overlay")).toBeInTheDocument();
  });

  test("진화 shaking 단계에서도 캔버스 위치 흔들림을 적용하지 않는다", () => {
    renderGameScreen({
      selectedDigimon: "Agumon",
      evolutionStage: "shaking",
    });

    const canvas = screen.getByTestId("canvas");

    expect(canvas).toHaveAttribute("data-animation-style", "");
  });

  test("idle 단계에서는 화면 전체 플래시 오버레이를 표시하지 않는다", () => {
    renderGameScreen({
      selectedDigimon: "Agumon",
      evolutionStage: "idle",
    });

    expect(screen.queryByTestId("evolution-flash-overlay")).not.toBeInTheDocument();
  });
});
