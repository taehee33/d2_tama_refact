import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import StatsCenterPopup from "./StatsCenterPopup";

const BASE_STATS = {
  age: 4,
  weight: 101,
  fullness: 2,
  strength: 2,
  energy: 20,
  maxEnergy: 20,
  winRate: 50,
  effort: 3,
  careMistakes: 1,
  sleepDisturbances: 2,
  isInjured: false,
  battles: 4,
  battlesWon: 2,
  battlesLost: 2,
  hungerTimer: 48,
  hungerCountdown: 30,
  careMistakeLedger: [{ id: "care-1" }],
  revision: 7,
};
const CURRENT_TIME = new Date("2026-08-13T12:00:00.000Z");

function createProps(overrides = {}) {
  return {
    stats: BASE_STATS,
    activityLogs: [],
    digimonData: { stats: { energy: 20 } },
    sleepStatus: "AWAKE",
    currentTime: CURRENT_TIME,
    canViewDiagnostics: false,
    isOperatorStatusLoading: false,
    onClose: jest.fn(),
    onOpenLegacy: jest.fn(),
    onSaveOperatorStats: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("StatsCenterPopup 공개 상태", () => {
  test("일반 사용자에게 상태·위험 탭과 11개 핵심 필드를 표시한다", () => {
    render(<StatsCenterPopup {...createProps()} />);

    expect(screen.getByRole("dialog", { name: "디지몬 상태" })).toHaveAttribute(
      "aria-modal",
      "true"
    );
    expect(screen.getByRole("tab", { name: "[ 상태 ]" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "[ 위험 ]" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "[ 고급·진단 ]" })).not.toBeInTheDocument();

    const panel = screen.getByRole("tabpanel");
    [
      "나이",
      "몸무게",
      "배고픔",
      "힘",
      "에너지(DP)",
      "승률",
      "노력치",
      "케어 미스",
      "수면 방해",
      "수면",
      "부상",
    ].forEach((label) => {
      expect(within(panel).getByText(label)).toBeInTheDocument();
    });
    expect(within(panel).getByText("2회")).toBeInTheDocument();
    expect(within(panel).queryByText("리비전")).not.toBeInTheDocument();
    expect(within(panel).queryByText("케어 미스 상세 기록")).not.toBeInTheDocument();
  });

  test("수면 방해 행에서 현재 진화 구간 이력을 최신순으로 펼치고 접는다", () => {
    render(<StatsCenterPopup {...createProps({
      stats: {
        ...BASE_STATS,
        evolutionStageStartedAt: 2000,
      },
      activityLogs: [
        { type: "SLEEP_DISTURBANCE", text: "최신 기록", timestamp: 4000 },
        { type: "SLEEP_DISTURBANCE", text: "현재 구간 기록", timestamp: 3000 },
        { type: "SLEEP_START", text: "잠듦", timestamp: 2500 },
        { type: "SLEEP_DISTURBANCE", text: "이전 구간 기록", timestamp: 1000 },
      ],
    })} />);

    const historyButton = screen.getByRole("button", { name: /수면 방해.*2회/ });
    expect(historyButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(historyButton);

    expect(historyButton).toHaveAttribute("aria-expanded", "true");
    const history = screen.getByRole("region", { name: "수면 방해 이력" });
    const cards = within(history).getAllByRole("article");
    expect(cards[0]).toHaveTextContent("최신 기록");
    expect(cards[1]).toHaveTextContent("현재 구간 기록");
    expect(within(history).queryByText("이전 구간 기록")).not.toBeInTheDocument();
    expect(within(history).queryByText("잠듦")).not.toBeInTheDocument();

    fireEvent.click(historyButton);
    expect(screen.queryByRole("region", { name: "수면 방해 이력" })).not.toBeInTheDocument();
  });

  test("카운트만 남은 레거시 슬롯에 상세 기록 부재와 범위를 안내한다", () => {
    render(<StatsCenterPopup {...createProps({ activityLogs: [] })} />);

    fireEvent.click(screen.getByRole("button", { name: /수면 방해.*2회/ }));

    expect(screen.getByText("카운트 2회 · 상세 기록 0건")).toBeInTheDocument();
    expect(screen.getByText(/단계 시작 시각이 없어/)).toBeInTheDocument();
    expect(screen.getByText(/수면 방해 상세 기록이 없습니다/)).toBeInTheDocument();
  });

  test("수면 방해가 0회이면 행을 펼침 버튼으로 만들지 않는다", () => {
    render(<StatsCenterPopup {...createProps({
      stats: { ...BASE_STATS, sleepDisturbances: 0 },
    })} />);

    expect(screen.queryByRole("button", { name: /수면 방해/ })).not.toBeInTheDocument();
    expect(screen.getByText("수면 방해")).toBeInTheDocument();
    expect(screen.getByText("0회")).toBeInTheDocument();
  });

  test("위험 탭에 5개 위험 카드와 상한 없는 누적 수명을 읽기 전용으로 표시한다", () => {
    const props = createProps({
      stats: {
        ...BASE_STATS,
        lifespanSeconds: 127024,
        fullness: 0,
        lastHungerZeroAt: CURRENT_TIME.getTime() - 60 * 60 * 1000,
      },
    });
    render(<StatsCenterPopup {...props} />);

    fireEvent.click(screen.getByRole("tab", { name: "[ 위험 ]" }));

    [
      "배고픔 0 지속",
      "힘 0 지속",
      "배변 8개",
      "부상 방치",
      "누적 부상",
    ].forEach((title) => {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    });
    const lifespan = screen.getByLabelText("누적 수명 참고 정보");
    expect(within(lifespan).getByText("1일 11시간 17분 4초")).toBeInTheDocument();
    expect(within(lifespan).getByText("상한 없이 누적 중")).toBeInTheDocument();
    expect(within(lifespan).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(5);
    expect(props.onSaveOperatorStats).not.toHaveBeenCalled();
  });

  test("기존 게임 시계가 바뀌면 저장 없이 위험 남은 시간만 갱신한다", () => {
    const startAt = CURRENT_TIME.getTime() - 60 * 60 * 1000;
    const props = createProps({
      stats: { ...BASE_STATS, fullness: 0, lastHungerZeroAt: startAt },
    });
    const { rerender } = render(<StatsCenterPopup {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: "[ 위험 ]" }));

    expect(screen.getByText("11시간 0분 0초")).toBeInTheDocument();

    rerender(
      <StatsCenterPopup
        {...props}
        currentTime={new Date(CURRENT_TIME.getTime() + 60 * 60 * 1000)}
      />
    );

    expect(screen.getByText("10시간 0분 0초")).toBeInTheDocument();
    expect(props.onSaveOperatorStats).not.toHaveBeenCalled();
  });

  test("사망 후 위험 탭은 사망 원인과 정지된 누적 수명을 표시한다", () => {
    const diedAt = CURRENT_TIME.getTime() - 60 * 60 * 1000;
    render(<StatsCenterPopup {...createProps({
      stats: {
        ...BASE_STATS,
        isDead: true,
        diedAt,
        deathReason: "STARVATION (굶주림)",
        lifespanSeconds: 127024,
        fullness: 0,
        strength: 0,
        lastHungerZeroAt: diedAt - 12 * 60 * 60 * 1000,
        lastStrengthZeroAt: diedAt - 12 * 60 * 60 * 1000,
      },
    })} />);

    fireEvent.click(screen.getByRole("tab", { name: "[ 위험 ]" }));

    expect(screen.getByText("사망 원인 · 카운터 정지")).toBeInTheDocument();
    expect(screen.getByText("사망 · 카운터 정지")).toBeInTheDocument();
    const lifespan = screen.getByLabelText("누적 수명 참고 정보");
    expect(within(lifespan).getByText("사망(굶주림)")).toBeInTheDocument();
    expect(within(lifespan).getByText("사망 시각")).toBeInTheDocument();
    expect(within(lifespan).queryByText("상한 없이 누적 중")).not.toBeInTheDocument();
  });

  test.each([
    {
      name: "운영자 확인 중",
      canViewDiagnostics: true,
      isOperatorStatusLoading: true,
    },
    {
      name: "운영자 권한 없음",
      canViewDiagnostics: false,
      isOperatorStatusLoading: false,
    },
  ])("$name에는 고급·진단 탭을 노출하지 않는다", (permission) => {
    render(<StatsCenterPopup {...createProps(permission)} />);

    expect(screen.queryByRole("tab", { name: "[ 고급·진단 ]" })).not.toBeInTheDocument();
  });
});

describe("StatsCenterPopup 운영자 진단", () => {
  test("확인된 운영자에게만 진단 탭과 제한된 수정 진입점을 표시한다", () => {
    const { container } = render(
      <StatsCenterPopup
        {...createProps({
          canViewDiagnostics: true,
          isOperatorStatusLoading: false,
        })}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "[ 고급·진단 ]" }));

    expect(screen.getByRole("tab", { name: "[ 고급·진단 ]" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("운영자용 진단 정보입니다. 스탯 수정은 1차 허용 항목으로만 제한됩니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "스탯 수정" })).toBeInTheDocument();
    expect(screen.getByText("내부 카운터")).toBeInTheDocument();
    expect(screen.getByText("리비전")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(container.querySelector("input, select, textarea")).toBeNull();
  });

  test("운영자 편집기는 1차 허용 항목만 보여주고 변경 patch를 저장한다", async () => {
    const onSaveOperatorStats = jest.fn().mockResolvedValue([]);
    render(<StatsCenterPopup {...createProps({
      canViewDiagnostics: true,
      onSaveOperatorStats,
    })} />);

    fireEvent.click(screen.getByRole("tab", { name: "[ 고급·진단 ]" }));
    fireEvent.click(screen.getByRole("button", { name: "스탯 수정" }));

    [
      "배고픔",
      "힘",
      "에너지(DP)",
      "체중",
      "배변 횟수",
      "케어 미스",
      "훈련 횟수",
      "과식 횟수",
      "프로틴 과다 횟수",
      "부상 횟수",
      "승리 횟수",
      "패배 횟수",
      "부상 상태",
    ].forEach((label) => {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("누적 수명")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("수면 상태")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("배고픔"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("승리 횟수"), { target: { value: "3" } });
    fireEvent.click(screen.getByLabelText("부상 상태"));
    fireEvent.click(screen.getByRole("button", { name: "변경 저장" }));

    await waitFor(() => expect(onSaveOperatorStats).toHaveBeenCalledWith({
      fullness: 5,
      battlesWon: 3,
      isInjured: true,
    }));
    expect(await screen.findByText("허용된 스탯을 저장했습니다.")).toBeInTheDocument();
  });

  test("편집 중 외부 상태가 갱신돼도 운영자가 건드린 필드만 저장한다", async () => {
    const onSaveOperatorStats = jest.fn().mockResolvedValue([]);
    const initialProps = createProps({ canViewDiagnostics: true, onSaveOperatorStats });
    const { rerender } = render(<StatsCenterPopup {...initialProps} />);

    fireEvent.click(screen.getByRole("tab", { name: "[ 고급·진단 ]" }));
    fireEvent.click(screen.getByRole("button", { name: "스탯 수정" }));

    rerender(
      <StatsCenterPopup
        {...initialProps}
        stats={{ ...BASE_STATS, fullness: 1 }}
      />
    );
    fireEvent.change(screen.getByLabelText("체중"), { target: { value: "105" } });
    fireEvent.click(screen.getByRole("button", { name: "변경 저장" }));

    await waitFor(() => expect(onSaveOperatorStats).toHaveBeenCalledWith({ weight: 105 }));
  });

  test("진단 탭을 보는 중 권한이 사라지면 즉시 상태 탭으로 복귀한다", () => {
    const initialProps = createProps({ canViewDiagnostics: true });
    const { rerender } = render(<StatsCenterPopup {...initialProps} />);

    fireEvent.click(screen.getByRole("tab", { name: "[ 고급·진단 ]" }));
    expect(screen.getByText("내부 카운터")).toBeInTheDocument();

    rerender(
      <StatsCenterPopup
        {...initialProps}
        canViewDiagnostics={false}
        isOperatorStatusLoading={false}
      />
    );

    expect(screen.queryByRole("tab", { name: "[ 고급·진단 ]" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "[ 상태 ]" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("현재 상태")).toBeInTheDocument();
  });

  test("위험 탭은 운영자 권한이 사라져도 그대로 유지한다", () => {
    const initialProps = createProps({ canViewDiagnostics: true });
    const { rerender } = render(<StatsCenterPopup {...initialProps} />);

    fireEvent.click(screen.getByRole("tab", { name: "[ 위험 ]" }));
    rerender(
      <StatsCenterPopup
        {...initialProps}
        canViewDiagnostics={false}
        isOperatorStatusLoading={false}
      />
    );

    expect(screen.getByRole("tab", { name: "[ 위험 ]" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("사망·질병 위험")).toBeInTheDocument();
  });

  test("팝업을 unmount한 뒤 다시 열면 상태 탭으로 초기화된다", () => {
    const props = createProps({ canViewDiagnostics: true });
    const firstView = render(<StatsCenterPopup {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: "[ 고급·진단 ]" }));
    expect(screen.getByRole("tab", { name: "[ 고급·진단 ]" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    firstView.unmount();
    render(<StatsCenterPopup {...props} />);

    expect(screen.getByRole("tab", { name: "[ 상태 ]" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("현재 상태")).toBeInTheDocument();
  });

  test("방향키와 Home·End로 운영자 3개 탭을 이동하고 선택한다", () => {
    render(<StatsCenterPopup {...createProps({ canViewDiagnostics: true })} />);
    const statusTab = screen.getByRole("tab", { name: "[ 상태 ]" });
    const riskTab = screen.getByRole("tab", { name: "[ 위험 ]" });
    const diagnosticsTab = screen.getByRole("tab", { name: "[ 고급·진단 ]" });

    fireEvent.keyDown(statusTab, { key: "ArrowRight" });

    expect(riskTab).toHaveFocus();
    expect(riskTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("사망·질병 위험")).toBeInTheDocument();

    fireEvent.keyDown(riskTab, { key: "ArrowRight" });

    expect(diagnosticsTab).toHaveFocus();
    expect(diagnosticsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("내부 카운터")).toBeInTheDocument();

    fireEvent.keyDown(diagnosticsTab, { key: "ArrowLeft" });

    expect(riskTab).toHaveFocus();
    expect(riskTab).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(riskTab, { key: "Home" });

    expect(statusTab).toHaveFocus();
    expect(statusTab).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(statusTab, { key: "End" });

    expect(diagnosticsTab).toHaveFocus();
    expect(diagnosticsTab).toHaveAttribute("aria-selected", "true");
  });
});

describe("StatsCenterPopup 대화상자 동작", () => {
  test("첫 탭에 포커스하고 Escape로 닫는다", () => {
    const props = createProps();
    const { container } = render(<StatsCenterPopup {...props} />);

    expect(container.querySelector(".stats-center-popup__surface")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "[ 상태 ]" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  test("기존 화면 보기는 전환 handler만 호출한다", () => {
    const props = createProps();
    render(<StatsCenterPopup {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "기존 Old/New 화면 보기" }));

    expect(props.onOpenLegacy).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
