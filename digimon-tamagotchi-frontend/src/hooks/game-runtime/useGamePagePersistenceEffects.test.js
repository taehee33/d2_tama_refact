import { act, renderHook } from "@testing-library/react";
import { useGamePagePersistenceEffects } from "./useGamePagePersistenceEffects";

const mockGetMasterDataSnapshotForSync = jest.fn();

jest.mock("../../utils/masterDataUtils", () => ({
  getMasterDataSnapshotForSync: (...args) =>
    mockGetMasterDataSnapshotForSync(...args),
}));

function createBaseOptions(overrides = {}) {
  return {
    slotId: "1",
    isLoadingSlot: false,
    selectedDigimon: "Agumon",
    digimonStats: {
      hungerCountdown: 550,
      strengthCountdown: 900,
      poopCountdown: 1700,
      timeToEvolveSeconds: 950,
    },
    activityLogs: [{ type: "SYNC" }],
    slotVersion: "Ver.1",
    masterDataRevision: 1,
    backgroundSettings: null,
    saveBackgroundSettings: jest.fn(),
    immersiveSettings: null,
    saveImmersiveSettings: jest.fn(),
    width: 320,
    height: 240,
    clearedQuestIndex: 3,
    setClearedQuestIndex: jest.fn(),
    setDigimonStats: jest.fn(),
    setDigimonStatsAndSave: jest.fn(),
    ...overrides,
  };
}

describe("useGamePagePersistenceEffects", () => {
  beforeEach(() => {
    mockGetMasterDataSnapshotForSync.mockReset();
    localStorage.clear();
    jest.useRealTimers();
  });

  test("master data snapshot이 바뀌면 countdown을 보정해 저장 경로를 우선 호출한다", () => {
    const snapshotV1 = {
      digimonId: "Agumon",
      versionLabel: "Ver.1",
      sprite: 100,
      hungerTimer: 10,
      strengthTimer: 20,
      poopTimer: 30,
      maxOverfeed: 4,
      minWeight: 10,
      maxEnergy: 100,
      basePower: 55,
      attackSprite: "atk-1",
      altAttackSprite: "atk-2",
      type: "Vaccine",
      timeToEvolveSeconds: 1000,
    };
    const snapshotV2 = {
      ...snapshotV1,
      hungerTimer: 20,
      strengthTimer: 40,
      poopTimer: 60,
      maxEnergy: 120,
      basePower: 60,
      timeToEvolveSeconds: 2000,
    };
    const options = createBaseOptions({
      setDigimonStatsAndSave: jest.fn(() => Promise.resolve()),
    });

    mockGetMasterDataSnapshotForSync
      .mockReturnValueOnce(snapshotV1)
      .mockReturnValueOnce(snapshotV2);

    const { rerender } = renderHook((props) => useGamePagePersistenceEffects(props), {
      initialProps: options,
    });

    expect(options.setDigimonStatsAndSave).not.toHaveBeenCalled();

    rerender({
      ...options,
      masterDataRevision: 2,
    });

    expect(options.setDigimonStatsAndSave).toHaveBeenCalledWith(
      expect.objectContaining({
        sprite: 100,
        hungerTimer: 20,
        strengthTimer: 40,
        poopTimer: 60,
        maxEnergy: 120,
        maxStamina: 120,
        power: 60,
        hungerCountdown: 1150,
        strengthCountdown: 2100,
        poopCountdown: 3500,
        timeToEvolveSeconds: 1950,
      }),
      options.activityLogs
    );
    expect(options.setDigimonStats).not.toHaveBeenCalled();
  });

  test("background save는 로딩 해제 후 100ms gate가 열린 다음 새 설정 변경에만 반응한다", () => {
    jest.useFakeTimers();
    const saveBackgroundSettings = jest.fn();
    const initialProps = createBaseOptions({
      isLoadingSlot: true,
      backgroundSettings: { backgroundNumber: 162 },
      saveBackgroundSettings,
    });

    const { rerender } = renderHook((props) => useGamePagePersistenceEffects(props), {
      initialProps,
    });

    expect(saveBackgroundSettings).not.toHaveBeenCalled();

    rerender({
      ...initialProps,
      isLoadingSlot: false,
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(saveBackgroundSettings).not.toHaveBeenCalled();

    rerender({
      ...initialProps,
      isLoadingSlot: false,
      backgroundSettings: { backgroundNumber: 200 },
    });

    expect(saveBackgroundSettings).toHaveBeenCalledWith({
      backgroundNumber: 200,
    });
  });

  test("slotId가 바뀌면 background gate를 다시 잠근다", () => {
    jest.useFakeTimers();
    const saveBackgroundSettings = jest.fn();
    const props = createBaseOptions({
      slotId: "1",
      isLoadingSlot: false,
      backgroundSettings: null,
      saveBackgroundSettings,
    });

    const { rerender } = renderHook((nextProps) => useGamePagePersistenceEffects(nextProps), {
      initialProps: props,
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({
      ...props,
      backgroundSettings: { backgroundNumber: 170 },
    });

    expect(saveBackgroundSettings).toHaveBeenCalledTimes(1);

    rerender({
      ...props,
      slotId: "2",
      backgroundSettings: { backgroundNumber: 171 },
    });

    expect(saveBackgroundSettings).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({
      ...props,
      slotId: "2",
      backgroundSettings: { backgroundNumber: 172 },
    });

    expect(saveBackgroundSettings).toHaveBeenCalledTimes(2);
    expect(saveBackgroundSettings).toHaveBeenLastCalledWith({
      backgroundNumber: 172,
    });
  });

  test("immersive save는 로드 직후 재저장하지 않고 사용자 변경 후에만 저장한다", () => {
    jest.useFakeTimers();
    const saveImmersiveSettings = jest.fn();
    const initialProps = createBaseOptions({
      isLoadingSlot: true,
      immersiveSettings: {
        layoutMode: "portrait",
        skinId: "tama-classic-pink",
      },
      saveImmersiveSettings,
    });

    const { rerender } = renderHook((props) => useGamePagePersistenceEffects(props), {
      initialProps,
    });

    rerender({
      ...initialProps,
      isLoadingSlot: false,
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(saveImmersiveSettings).not.toHaveBeenCalled();

    rerender({
      ...initialProps,
      isLoadingSlot: false,
      immersiveSettings: {
        layoutMode: "landscape",
        skinId: "tama-mint",
      },
    });

    expect(saveImmersiveSettings).toHaveBeenCalledWith({
      layoutMode: "landscape",
      skinId: "tama-mint",
    });
  });

  test("width/height와 clearedQuestIndex는 기존 localStorage key를 그대로 사용한다", () => {
    localStorage.setItem("slot3_clearedQuestIndex", "7");
    const setClearedQuestIndex = jest.fn();

    renderHook(() =>
      useGamePagePersistenceEffects(
        createBaseOptions({
          slotId: "3",
          width: 480,
          height: 320,
          clearedQuestIndex: 7,
          setClearedQuestIndex,
        })
      )
    );

    expect(setClearedQuestIndex).toHaveBeenCalledWith(7);
    expect(JSON.parse(localStorage.getItem("digimon_view_settings"))).toEqual({
      width: 480,
      height: 320,
    });
    expect(localStorage.getItem("slot3_clearedQuestIndex")).toBe("7");
  });
});
