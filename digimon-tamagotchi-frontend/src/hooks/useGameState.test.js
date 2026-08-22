import { act, renderHook } from "@testing-library/react";
import {
  GAME_SCENE_SIZE_MIGRATION_KEY,
  GAME_SCENE_SIZE_MIGRATION_VERSION,
  useGameState,
} from "./useGameState";

describe("useGameState 스탯 모달 전환", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("기존 로컬 화면 설정을 기본 250×250으로 한 번 마이그레이션한다", () => {
    localStorage.setItem(
      "digimon_view_settings",
      JSON.stringify({ width: 300, height: 200 })
    );

    const { result } = renderHook(() => useGameState({
      slotId: "1",
      digimonDataVer1: { Digitama: { name: "Digitama" } },
    }));

    expect(result.current.ui.width).toBe(250);
    expect(result.current.ui.height).toBe(250);
    expect(JSON.parse(localStorage.getItem("digimon_view_settings"))).toEqual({
      width: 250,
      height: 250,
    });
    expect(localStorage.getItem(GAME_SCENE_SIZE_MIGRATION_KEY)).toBe(
      GAME_SCENE_SIZE_MIGRATION_VERSION
    );
  });

  test("기본 크기 마이그레이션 이후 사용자가 저장한 크기를 유지한다", () => {
    localStorage.setItem(
      GAME_SCENE_SIZE_MIGRATION_KEY,
      GAME_SCENE_SIZE_MIGRATION_VERSION
    );
    localStorage.setItem(
      "digimon_view_settings",
      JSON.stringify({ width: 400, height: 200 })
    );

    const { result } = renderHook(() => useGameState({
      slotId: "1",
      digimonDataVer1: { Digitama: { name: "Digitama" } },
    }));

    expect(result.current.ui.width).toBe(400);
    expect(result.current.ui.height).toBe(400);
    expect(JSON.parse(localStorage.getItem("digimon_view_settings"))).toEqual({
      width: 400,
      height: 400,
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
