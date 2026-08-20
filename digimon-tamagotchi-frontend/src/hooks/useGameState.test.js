import { act, renderHook } from "@testing-library/react";
import { useGameState } from "./useGameState";

describe("useGameState 스탯 모달 전환", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("기존 300×200 로컬 화면 설정을 300×300으로 정규화한다", () => {
    localStorage.setItem(
      "digimon_view_settings",
      JSON.stringify({ width: 300, height: 200 })
    );

    const { result } = renderHook(() => useGameState({
      slotId: "1",
      digimonDataVer1: { Digitama: { name: "Digitama" } },
    }));

    expect(result.current.ui.width).toBe(300);
    expect(result.current.ui.height).toBe(300);
    expect(JSON.parse(localStorage.getItem("digimon_view_settings"))).toEqual({
      width: 300,
      height: 300,
    });
  });

  test("기존 Old/New 화면으로 전환할 때 statsCenter를 닫고 stats를 하나의 handler로 연다", () => {
    const { result } = renderHook(() => useGameState({
      slotId: "1",
      digimonDataVer1: {
        Digitama: {
          name: "Digitama",
        },
      },
    }));

    act(() => result.current.toggleModal("stats", true));
    act(() => result.current.openStatsCenter());
    expect(result.current.modals).toMatchObject({
      statsCenter: true,
      stats: false,
    });

    act(() => {
      result.current.openLegacyStats();
    });

    expect(result.current.modals).toMatchObject({
      statsCenter: false,
      stats: true,
    });
  });
});
