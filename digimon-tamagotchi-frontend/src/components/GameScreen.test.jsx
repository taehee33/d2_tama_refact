import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import GameScreen from "./GameScreen";

jest.mock("./Canvas", () => function CanvasMock() {
  return <div data-testid="canvas" />;
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
      {...props}
      currentTime={now}
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

    expect(screen.getByText("현재 활성 호출이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("최근 호출/케어미스 기록")).toBeInTheDocument();
    expect(screen.getByText("배고픔 호출이 시작되었습니다.")).toBeInTheDocument();
    expect(screen.getByText("수면 조명 경고가 시작되었습니다.")).toBeInTheDocument();
    expect(screen.getByText(/배고픔 호출 10분 무시/)).toBeInTheDocument();
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
        (element) => element.style.top === "70%" && element.style.left === "10%"
      )
    ).toBe(true);
    expect(
      syringeOverlays.some(
        (element) => element.style.top === "30%" && element.style.right === "10%"
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
