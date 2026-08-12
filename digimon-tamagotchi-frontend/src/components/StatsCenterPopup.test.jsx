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
  isInjured: false,
  battles: 4,
  battlesWon: 2,
  battlesLost: 2,
  hungerTimer: 48,
  hungerCountdown: 30,
  careMistakeLedger: [{ id: "care-1" }],
  revision: 7,
};

function createProps(overrides = {}) {
  return {
    stats: BASE_STATS,
    digimonData: { stats: { energy: 20 } },
    sleepStatus: "AWAKE",
    canViewDiagnostics: false,
    isOperatorStatusLoading: false,
    onClose: jest.fn(),
    onOpenLegacy: jest.fn(),
    onSaveOperatorStats: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("StatsCenterPopup 공개 상태", () => {
  test("일반 사용자에게 상태 탭과 고정된 10개 핵심 필드만 표시한다", () => {
    render(<StatsCenterPopup {...createProps()} />);

    expect(screen.getByRole("dialog", { name: "디지몬 상태" })).toHaveAttribute(
      "aria-modal",
      "true"
    );
    expect(screen.getByRole("tab", { name: "[ 상태 ]" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
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
      "수면",
      "부상",
    ].forEach((label) => {
      expect(within(panel).getByText(label)).toBeInTheDocument();
    });
    expect(within(panel).queryByText("리비전")).not.toBeInTheDocument();
    expect(within(panel).queryByText("케어 미스 상세 기록")).not.toBeInTheDocument();
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

  test("방향키로 운영자 탭을 이동하고 선택한다", () => {
    render(<StatsCenterPopup {...createProps({ canViewDiagnostics: true })} />);
    const statusTab = screen.getByRole("tab", { name: "[ 상태 ]" });
    const diagnosticsTab = screen.getByRole("tab", { name: "[ 고급·진단 ]" });

    fireEvent.keyDown(statusTab, { key: "ArrowRight" });

    expect(diagnosticsTab).toHaveFocus();
    expect(diagnosticsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("내부 카운터")).toBeInTheDocument();

    fireEvent.keyDown(diagnosticsTab, { key: "ArrowLeft" });

    expect(statusTab).toHaveFocus();
    expect(statusTab).toHaveAttribute("aria-selected", "true");
  });
});

describe("StatsCenterPopup 대화상자 동작", () => {
  test("첫 탭에 포커스하고 Escape로 닫는다", () => {
    const props = createProps();
    render(<StatsCenterPopup {...props} />);

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
