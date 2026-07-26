import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import StatsPopup from "../../StatsPopup";
import {
  createStats,
  createStatsPopupProps,
  STATS_POPUP_NOW_MS,
} from "./statsPopupFixtures";

function renderPopup(overrides = {}) {
  const props = createStatsPopupProps(overrides);
  const view = render(<StatsPopup {...props} />);
  return { ...view, props };
}

function openOldTab() {
  fireEvent.click(screen.getByRole("button", { name: "[ Old ]" }));
}

describe("StatsPopup 외부 동작 계약", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("NEW 탭이 기본이며 탭 전환과 닫기 callback을 유지한다", () => {
    const { props } = renderPopup();

    expect(screen.getByText("1. 종(Species) 고정 파라미터")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "[ Old ]" }));
    expect(screen.getByText("[Dev Mode] 스탯 수정")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "[ New ]" }));
    expect(screen.getByText("1. 종(Species) 고정 파라미터")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("닫기"));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  test.each([
    [false, true],
    [true, false],
  ])("개발자 편집 UI는 devMode=%s, callback=%s일 때 숨긴다", (devMode, hasCallback) => {
    renderPopup({ devMode, onChangeStats: hasCallback ? jest.fn() : undefined });
    openOldTab();
    expect(screen.queryByText("[Dev Mode] 스탯 수정")).not.toBeInTheDocument();
  });

  test("개발자 select의 현재 경계를 유지한다", () => {
    renderPopup();
    openOldTab();

    expect(screen.getByLabelText(/^Fullness:/)).toHaveDisplayValue("1");
    expect(within(screen.getByLabelText(/^Fullness:/)).getByRole("option", { name: "8" })).toBeInTheDocument();
    expect(within(screen.getByLabelText(/^Strength:/)).getByRole("option", { name: "33" })).toBeInTheDocument();
    expect(within(screen.getByLabelText(/^Energy:/)).getByRole("option", { name: "4" })).toBeInTheDocument();
    expect(within(screen.getByLabelText(/^injuries \(부상 횟수\):/)).getByRole("option", { name: "15" })).toBeInTheDocument();
  });

  test("poop 7 → 8은 같은 mutation 시각으로 연쇄 timestamp를 만든다", () => {
    jest.spyOn(Date, "now").mockReturnValue(STATS_POPUP_NOW_MS);
    const onChangeStats = jest.fn();
    renderPopup({ stats: { poopCount: 7 }, onChangeStats });
    openOldTab();

    fireEvent.change(screen.getByLabelText(/^PoopCount:/), { target: { value: "8" } });

    expect(onChangeStats).toHaveBeenCalledWith(expect.objectContaining({
      poopCount: 8,
      poopReachedMaxAt: STATS_POPUP_NOW_MS,
      lastPoopPenaltyAt: STATS_POPUP_NOW_MS,
    }));
  });

  test("poop 8 → 7은 연쇄 timestamp를 초기화한다", () => {
    const onChangeStats = jest.fn();
    renderPopup({
      stats: {
        poopCount: 8,
        poopReachedMaxAt: STATS_POPUP_NOW_MS - 1000,
        lastPoopPenaltyAt: STATS_POPUP_NOW_MS - 500,
      },
      onChangeStats,
    });
    openOldTab();

    fireEvent.change(screen.getByLabelText(/^PoopCount:/), { target: { value: "7" } });

    expect(onChangeStats).toHaveBeenCalledWith(expect.objectContaining({
      poopCount: 7,
      poopReachedMaxAt: null,
      lastPoopPenaltyAt: null,
    }));
  });

  test("명령 저장 실패를 표시하고 사용자가 같은 intent를 재시도할 수 있다", async () => {
    jest.spyOn(Date, "now").mockReturnValue(STATS_POPUP_NOW_MS);
    const onSaveCommand = jest.fn()
      .mockResolvedValueOnce({ status: "failed" })
      .mockResolvedValueOnce({ status: "synced" });
    renderPopup({ onSaveCommand });
    openOldTab();

    fireEvent.change(screen.getByLabelText(/^Fullness:/), { target: { value: "2" } });
    expect(await screen.findByText("저장 실패")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("저장 실패");
    expect(onSaveCommand).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("저장됨")).toBeInTheDocument();
    expect(onSaveCommand).toHaveBeenCalledTimes(2);
    expect(onSaveCommand.mock.calls[1][0]).toEqual(onSaveCommand.mock.calls[0][0]);
  });

  test("부상 ON은 timestamp를 만들고 OFF는 timestamp와 회복 투약 횟수를 초기화한다", () => {
    jest.spyOn(Date, "now").mockReturnValue(STATS_POPUP_NOW_MS);
    const onChangeStats = jest.fn();
    const { rerender, props } = renderPopup({ onChangeStats });
    openOldTab();

    fireEvent.click(screen.getByRole("button", { name: /isInjured \(부상 상태\)/i }));
    expect(onChangeStats).toHaveBeenLastCalledWith(expect.objectContaining({
      isInjured: true,
      injuredAt: STATS_POPUP_NOW_MS,
    }));

    rerender(
      <StatsPopup
        {...props}
        stats={createStats({
          isInjured: true,
          injuredAt: STATS_POPUP_NOW_MS,
          healedDosesCurrent: 3,
        })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /isInjured \(부상 상태\)/i }));
    expect(onChangeStats).toHaveBeenLastCalledWith(expect.objectContaining({
      isInjured: false,
      injuredAt: null,
      healedDosesCurrent: 0,
    }));
  });

  test("OLD 편집 중 외부 stats 변경은 반영하지 않고 NEW 왕복 뒤 동기화한다", () => {
    const { rerender, props } = renderPopup({ stats: { fullness: 1 } });
    openOldTab();
    expect(screen.getByLabelText(/^Fullness:/)).toHaveValue("1");

    rerender(<StatsPopup {...props} stats={createStats({ fullness: 4 })} />);
    expect(screen.getByLabelText(/^Fullness:/)).toHaveValue("1");

    fireEvent.click(screen.getByRole("button", { name: "[ New ]" }));
    fireEvent.click(screen.getByRole("button", { name: "[ Old ]" }));
    expect(screen.getByLabelText(/^Fullness:/)).toHaveValue("4");
  });

  test("모달 remount 시 editableStats가 최신 props로 초기화된다", () => {
    const view = renderPopup({ stats: { fullness: 1 } });
    openOldTab();
    fireEvent.change(screen.getByLabelText(/^Fullness:/), { target: { value: "2" } });
    view.unmount();

    renderPopup({ stats: { fullness: 5 } });
    openOldTab();
    expect(screen.getByLabelText(/^Fullness:/)).toHaveValue("5");
  });

  test("야행성 로그 append를 먼저 시작하고 기다리지 않은 채 stats callback을 호출한다", () => {
    const callOrder = [];
    const appendLogToSubcollection = jest.fn(() => {
      callOrder.push("append");
      return Promise.resolve();
    });
    const onChangeStats = jest.fn(() => callOrder.push("stats"));
    renderPopup({ appendLogToSubcollection, onChangeStats });

    fireEvent.click(screen.getByRole("button", { name: "OFF ☀️" }));

    expect(callOrder).toEqual(["append", "stats"]);
    expect(appendLogToSubcollection).toHaveBeenCalledWith(expect.objectContaining({
      type: "ACTION",
      text: "야행성 모드 ON: 수면/기상 시간이 3시간씩 미뤄집니다 🌙",
    }));
    expect(onChangeStats).toHaveBeenCalledWith(expect.objectContaining({
      isNocturnal: true,
      activityLogs: expect.arrayContaining([
        expect.objectContaining({ type: "ACTION" }),
      ]),
    }));
  });

  test("명령 경로의 야행성 부분 실패를 표시하고 legacy callback을 호출하지 않는다", async () => {
    jest.spyOn(Date, "now").mockReturnValue(STATS_POPUP_NOW_MS);
    const onChangeStats = jest.fn();
    const appendLogToSubcollection = jest.fn();
    const onSaveCommand = jest.fn().mockResolvedValue({
      status: "warning",
      retryable: true,
      state: { status: "synced" },
      log: { status: "failed" },
      _retry: { command: { commandId: "command-1" } },
    });
    renderPopup({ onChangeStats, appendLogToSubcollection, onSaveCommand });

    fireEvent.click(screen.getByRole("button", { name: "OFF ☀️" }));

    expect(await screen.findByText("일부만 저장됨")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(onSaveCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "setNocturnal",
      value: true,
      occurredAt: STATS_POPUP_NOW_MS,
    }));
    expect(onChangeStats).not.toHaveBeenCalled();
    expect(appendLogToSubcollection).not.toHaveBeenCalled();
  });

  test("야행성 로그 append rejection을 무시하고 stats callback 결과를 유지한다", async () => {
    const appendLogToSubcollection = jest.fn(() => Promise.reject(new Error("로그 저장 실패")));
    const onChangeStats = jest.fn();
    renderPopup({ appendLogToSubcollection, onChangeStats });

    fireEvent.click(screen.getByRole("button", { name: "OFF ☀️" }));

    expect(appendLogToSubcollection).toHaveBeenCalledTimes(1);
    expect(onChangeStats).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });

  test("굶주림·힘 부족 12시간, 부상 방치 6시간, 부상 15회 경계를 표시한다", () => {
    jest.spyOn(Date, "now").mockReturnValue(STATS_POPUP_NOW_MS);
    renderPopup({
      stats: {
        fullness: 0,
        strength: 0,
        lastHungerZeroAt: STATS_POPUP_NOW_MS - 12 * 60 * 60 * 1000,
        lastStrengthZeroAt: STATS_POPUP_NOW_MS - 12 * 60 * 60 * 1000,
        isInjured: true,
        injuredAt: STATS_POPUP_NOW_MS - 6 * 60 * 60 * 1000,
        injuries: 15,
      },
    });

    expect(screen.getAllByText("⚠️ 사망 위험!")).toHaveLength(3);
    expect(screen.getByText("⚠️ 사망 위험! (부상 15회 도달)")).toBeInTheDocument();
  });

  test("위험 경계 1초 전에는 남은 시간을 표시한다", () => {
    jest.spyOn(Date, "now").mockReturnValue(STATS_POPUP_NOW_MS);
    renderPopup({
      stats: {
        fullness: 0,
        strength: 0,
        lastHungerZeroAt: STATS_POPUP_NOW_MS - (12 * 60 * 60 - 1) * 1000,
        lastStrengthZeroAt: STATS_POPUP_NOW_MS - (12 * 60 * 60 - 1) * 1000,
        isInjured: true,
        injuredAt: STATS_POPUP_NOW_MS - (6 * 60 * 60 - 1) * 1000,
        injuries: 14,
      },
    });

    expect(screen.getAllByText(/0시간 0분 1초 남음/)).toHaveLength(3);
    expect(screen.queryByText("⚠️ 사망 위험! (부상 15회 도달)")).not.toBeInTheDocument();
  });

  test("수면·소등 상태와 냉장고 상태를 사용자 문구로 표시한다", () => {
    const view = renderPopup({
      sleepStatus: "SLEEPING",
      sleepSchedule: { start: "22:00", end: "06:00" },
      isLightsOn: false,
    });
    expect(screen.getByText("수면 상태: 수면 중 😴")).toBeInTheDocument();
    expect(screen.getByText("수면상태확인: 수면 중, 조명(꺼짐!) → 잠자는 중 ✓")).toBeInTheDocument();
    view.unmount();

    renderPopup({ stats: { isFrozen: true, frozenAt: STATS_POPUP_NOW_MS - 1000 } });
    expect(screen.getByText("4. 냉장고 상태")).toBeInTheDocument();
    expect(screen.getByText(/냉장고에 넣어서 얼어있음/)).toBeInTheDocument();
  });

  test("낮잠 중에는 남은 시간을 시·분 단위로 표시한다", () => {
    jest.spyOn(Date, "now").mockReturnValue(STATS_POPUP_NOW_MS);
    renderPopup({
      sleepStatus: "NAPPING",
      stats: { napUntil: STATS_POPUP_NOW_MS + 2 * 60 * 60 * 1000 + 5 * 60 * 1000 },
    });

    expect(screen.getByText(/2시간 5분 남음/)).toBeInTheDocument();
  });

  test("화면 갱신 interval을 하나 등록하고 unmount에서 정리한다", () => {
    const intervalToken = 9876;
    const setIntervalSpy = jest.spyOn(global, "setInterval").mockReturnValue(intervalToken);
    const clearIntervalSpy = jest.spyOn(global, "clearInterval").mockImplementation(() => {});
    const { unmount } = renderPopup();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    act(() => setIntervalSpy.mock.calls[0][0]());
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalToken);
  });

  test("케어미스·수면 방해·부상 이력 아코디언을 펼쳐 현재 이력을 표시한다", () => {
    const activityLogs = [
      {
        type: "SLEEP_DISTURBANCE",
        text: "수면 중 강제로 깨움",
        timestamp: STATS_POPUP_NOW_MS - 2000,
      },
      {
        type: "POOP",
        text: "Pooped (Total: 8) - Injury: Too much poop (8 piles)",
        timestamp: STATS_POPUP_NOW_MS - 1000,
        digimonId: "Agumon",
        digimonName: "아구몬",
      },
    ];
    renderPopup({
      activityLogs,
      stats: {
        birthTime: STATS_POPUP_NOW_MS - 10000,
        careMistakes: 1,
        careMistakeLedger: [{
          id: "tease:1",
          occurredAt: STATS_POPUP_NOW_MS - 3000,
          reasonKey: "tease",
          text: "케어미스(사유: 괜히 괴롭히기): 0 → 1",
          source: "interaction",
          resolvedAt: null,
          resolvedBy: null,
        }],
        sleepDisturbances: 1,
        injuries: 1,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /수면 방해 이력 \(1건\)/ }));
    expect(screen.getByText("수면 중 강제로 깨움")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /현재 활성 케어미스 이력 \(1건\)/ }));
    expect(screen.getByText("케어미스(사유: 괜히 괴롭히기): 0 → 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /부상 이력 \(1건\)/ }));
    expect(screen.getByText("💩 똥 8개로 인한 부상")).toBeInTheDocument();
    expect(screen.getByText("당시 디지몬: 아구몬")).toBeInTheDocument();
  });
});
