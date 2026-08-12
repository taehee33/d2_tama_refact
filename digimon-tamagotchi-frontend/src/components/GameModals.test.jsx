import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import GameModals, { applyStatsPopupChange } from "./GameModals";

jest.mock("./StatsPopup", () => function MockStatsPopup() {
  return <div data-testid="legacy-stats-popup">Old/New</div>;
});

jest.mock("./StatsCenterPopup", () => function MockStatsCenterPopup({
  canViewDiagnostics,
  isOperatorStatusLoading,
  onClose,
  onOpenLegacy,
  onSaveOperatorStats,
}) {
  return (
    <div data-testid="stats-center-popup">
      <span>{`${canViewDiagnostics}:${isOperatorStatusLoading}`}</span>
      <button type="button" onClick={onClose}>닫기</button>
      <button type="button" onClick={onOpenLegacy}>기존 화면</button>
      <span>{typeof onSaveOperatorStats === "function" ? "운영자 저장 연결" : "운영자 저장 없음"}</span>
    </div>
  );
});

function renderGameModals({
  modals,
  handlers = {},
  flags = {},
  toggleModal = jest.fn(),
} = {}) {
  const view = render(
    <GameModals
      modals={modals || {}}
      toggleModal={toggleModal}
      gameState={{
        selectedDigimon: "Koromon",
        digimonStats: { age: 1 },
        activityLogs: [],
        slotVersion: "Ver.1",
      }}
      handlers={handlers}
      data={{
        newDigimonDataVer1: { Koromon: {} },
        digimonDataVer1: { Koromon: {} },
      }}
      ui={{ sleepStatus: "AWAKE" }}
      flags={flags}
    />
  );

  return { ...view, toggleModal };
}

describe("applyStatsPopupChange", () => {
  test("OLD 탭 스탯 편집은 저장 전에도 메모리 상태에 즉시 반영한다", () => {
    const setDigimonStats = jest.fn();
    const setDigimonStatsAndSave = jest.fn(() => Promise.resolve());
    const nextStats = {
      isInjured: true,
      injuredAt: 123456789,
    };

    applyStatsPopupChange(nextStats, setDigimonStats, setDigimonStatsAndSave);

    expect(setDigimonStats).toHaveBeenCalledTimes(1);
    expect(setDigimonStatsAndSave).toHaveBeenCalledWith(nextStats);

    const stateUpdater = setDigimonStats.mock.calls[0][0];
    expect(
      stateUpdater({
        fullness: 3,
        isInjured: false,
        injuredAt: null,
      })
    ).toEqual({
      fullness: 3,
      isInjured: true,
      injuredAt: 123456789,
    });
  });

  test("setter가 없어도 저장 함수만 있으면 그대로 저장을 호출한다", () => {
    const setDigimonStatsAndSave = jest.fn(() => Promise.resolve());
    const nextStats = {
      isInjured: true,
    };

    applyStatsPopupChange(nextStats, undefined, setDigimonStatsAndSave);

    expect(setDigimonStatsAndSave).toHaveBeenCalledWith(nextStats);
  });
});

describe("GameModals 스탯 화면 경계", () => {
  test("기존 stats 직접 진입은 Old/New StatsPopup을 그대로 렌더한다", () => {
    renderGameModals({ modals: { stats: true, statsCenter: false } });

    expect(screen.getByTestId("legacy-stats-popup")).toBeInTheDocument();
    expect(screen.queryByTestId("stats-center-popup")).not.toBeInTheDocument();
  });

  test("신규 스탯 센터에 운영자 권한 상태와 로딩 상태를 전달한다", () => {
    const saveOperatorStatsPatch = jest.fn();
    renderGameModals({
      modals: { stats: false, statsCenter: true },
      handlers: { saveOperatorStatsPatch },
      flags: {
        canViewDiagnostics: true,
        isOperatorStatusLoading: false,
      },
    });

    expect(screen.getByTestId("stats-center-popup")).toHaveTextContent("true:false");
    expect(screen.getByTestId("stats-center-popup")).toHaveTextContent("운영자 저장 연결");
    expect(screen.queryByTestId("legacy-stats-popup")).not.toBeInTheDocument();
  });

  test("신규 화면에서 기존 화면으로 갈 때 단일 전환 handler만 호출한다", () => {
    const openLegacyStats = jest.fn();
    const { toggleModal } = renderGameModals({
      modals: { stats: false, statsCenter: true },
      handlers: { openLegacyStats },
    });

    fireEvent.click(screen.getByRole("button", { name: "기존 화면" }));

    expect(openLegacyStats).toHaveBeenCalledTimes(1);
    expect(toggleModal).not.toHaveBeenCalled();
  });

  test("스탯 센터 닫기는 statsCenter만 닫는다", () => {
    const { toggleModal } = renderGameModals({
      modals: { stats: false, statsCenter: true },
    });

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(toggleModal).toHaveBeenCalledTimes(1);
    expect(toggleModal).toHaveBeenCalledWith("statsCenter", false);
  });
});
