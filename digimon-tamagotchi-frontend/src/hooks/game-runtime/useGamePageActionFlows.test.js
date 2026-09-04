import { act, renderHook } from "@testing-library/react";
import { useGamePageActionFlows } from "./useGamePageActionFlows";

jest.mock("../../utils/digimonLogSnapshot", () => ({
  buildDigimonLogSnapshot: jest.fn(() => ({ digimonId: "Digitama" })),
}));

describe("useGamePageActionFlows", () => {
  test("handleOverfeedConfirm은 먹기 애니메이션과 food 모달 오픈 흐름을 실행한다", async () => {
    const applyLazyUpdateBeforeAction = jest.fn().mockResolvedValue({ isDead: false });
    const eatCycleFromHook = jest.fn();
    const setCurrentAnimation = jest.fn();
    const setDigimonStats = jest.fn();
    const setFeedStep = jest.fn();
    const setFeedType = jest.fn();
    const toggleModal = jest.fn();
    const requestAnimationFrameFn = jest.fn((callback) => {
      callback();
      return 0;
    });

    const { result } = renderHook(() =>
      useGamePageActionFlows({
        applyLazyUpdateBeforeAction,
        eatCycleFromHook,
        setCurrentAnimation,
        setDigimonStats,
        setFeedStep,
        setFeedType,
        toggleModal,
        selectedDigimon: "Agumon",
        normalizedSlotVersion: "Ver.1",
        digimonDataForSlot: {},
        evolutionDataForSlot: {},
        appendLogToSubcollection: null,
        setSelectedDigimon: jest.fn(),
        setDigimonStatsAndSave: jest.fn(),
        setSelectedDigimonAndSave: jest.fn(),
        setHasSeenDeathPopup: jest.fn(),
        requestAnimationFrameFn,
      })
    );

    await act(async () => {
      await result.current.handleOverfeedConfirm();
    });

    expect(toggleModal).toHaveBeenNthCalledWith(1, "overfeedConfirm", false);
    expect(toggleModal).toHaveBeenNthCalledWith(2, "food", true);
    expect(setFeedType).toHaveBeenCalledWith("meat");
    expect(setCurrentAnimation).toHaveBeenCalledWith("eat");
    expect(setFeedStep).toHaveBeenCalledWith(0);
    expect(eatCycleFromHook).toHaveBeenCalledWith(0, "meat", false);
  });

  test("handleOverfeedCancel은 거절 애니메이션과 food 모달 닫기 흐름을 실행한다", async () => {
    const applyLazyUpdateBeforeAction = jest.fn().mockResolvedValue({ isDead: false });
    const eatCycleFromHook = jest.fn();
    const setCurrentAnimation = jest.fn();
    const setDigimonStats = jest.fn();
    const setFeedStep = jest.fn();
    const setFeedType = jest.fn();
    const toggleModal = jest.fn();

    const { result } = renderHook(() =>
      useGamePageActionFlows({
        applyLazyUpdateBeforeAction,
        eatCycleFromHook,
        setCurrentAnimation,
        setDigimonStats,
        setFeedStep,
        setFeedType,
        toggleModal,
        selectedDigimon: "Agumon",
        normalizedSlotVersion: "Ver.1",
        digimonDataForSlot: {},
        evolutionDataForSlot: {},
        appendLogToSubcollection: null,
        setSelectedDigimon: jest.fn(),
        setDigimonStatsAndSave: jest.fn(),
        setSelectedDigimonAndSave: jest.fn(),
        setHasSeenDeathPopup: jest.fn(),
        requestAnimationFrameFn: (callback) => {
          callback();
          return 0;
        },
      })
    );

    await act(async () => {
      await result.current.handleOverfeedCancel();
    });

    expect(toggleModal).toHaveBeenNthCalledWith(1, "overfeedConfirm", false);
    expect(toggleModal).toHaveBeenNthCalledWith(2, "food", false);
    expect(setCurrentAnimation).toHaveBeenCalledWith("foodRejectRefuse");
    expect(eatCycleFromHook).toHaveBeenCalledWith(0, "meat", true);
  });

  test("resetDigimon은 새 생애 저장을 요청하고 완료 상태 반영은 persistence에 위임한다", async () => {
    const applyLazyUpdateBeforeAction = jest.fn().mockResolvedValue({
      evolutionStage: "Adult",
      activityLogs: [],
      totalReincarnations: 0,
      normalReincarnations: 0,
      perfectReincarnations: 0,
      isDead: true,
    });
    const setSelectedDigimon = jest.fn();
    const setDigimonStats = jest.fn();
    const setActivityLogs = jest.fn();
    const saveNewLifeTransition = jest.fn().mockResolvedValue({ status: "synced" });
    const toggleModal = jest.fn();
    const setHasSeenDeathPopup = jest.fn();

    const { result } = renderHook(() =>
      useGamePageActionFlows({
        applyLazyUpdateBeforeAction,
        eatCycleFromHook: jest.fn(),
        setCurrentAnimation: jest.fn(),
        setDigimonStats,
        setFeedStep: jest.fn(),
        setFeedType: jest.fn(),
        toggleModal,
        selectedDigimon: "Agumon",
        normalizedSlotVersion: "Ver.1",
        digimonDataForSlot: {
          Digitama: { stage: "Egg", stats: {} },
        },
        evolutionDataForSlot: {
          Digitama: { stage: "Egg" },
        },
        setSelectedDigimon,
        setActivityLogs,
        saveNewLifeTransition,
        setHasSeenDeathPopup,
        confirmFn: () => true,
      })
    );

    let receipt;
    await act(async () => {
      receipt = await result.current.resetDigimon();
    });

    expect(receipt).toEqual({ status: "synced" });
    expect(setSelectedDigimon).not.toHaveBeenCalled();
    expect(setDigimonStats).not.toHaveBeenCalled();
    expect(setActivityLogs).not.toHaveBeenCalled();
    expect(saveNewLifeTransition).toHaveBeenCalledWith(expect.objectContaining({
      statsSnapshot: expect.objectContaining({
        selectedDigimon: "Digitama",
        battleLogs: [],
      }),
      transition: expect.objectContaining({
        sourceDigimon: "Agumon",
        targetDigimon: "Digitama",
        logEntry: expect.objectContaining({ type: "NEW_START" }),
      }),
    }));
    expect(toggleModal).not.toHaveBeenCalledWith("deathModal", false);
    expect(setHasSeenDeathPopup).not.toHaveBeenCalled();
  });

  test("NEW_LIFE가 queued이면 묘지 상태와 사망 모달을 유지한다", async () => {
    const setSelectedDigimon = jest.fn();
    const setDigimonStats = jest.fn();
    const setActivityLogs = jest.fn();
    const toggleModal = jest.fn();
    const setHasSeenDeathPopup = jest.fn();
    const saveNewLifeTransition = jest.fn().mockResolvedValue({
      status: "queued",
      transitionId: "new-life-pending",
    });
    const { result } = renderHook(() => useGamePageActionFlows({
      applyLazyUpdateBeforeAction: jest.fn().mockResolvedValue({
        evolutionStage: "Adult",
        activityLogs: [],
        isDead: true,
      }),
      setDigimonStats,
      toggleModal,
      selectedDigimon: "Ohakadamon1V3",
      normalizedSlotVersion: "Ver.3",
      digimonDataForSlot: { DigitamaV3: { stage: "Egg", stats: {} } },
      evolutionDataForSlot: { DigitamaV3: { stage: "Egg" } },
      setSelectedDigimon,
      setActivityLogs,
      saveNewLifeTransition,
      setHasSeenDeathPopup,
    }));

    let receipt;
    await act(async () => {
      receipt = await result.current.resetDigimon();
    });

    expect(receipt).toMatchObject({ status: "queued" });
    expect(setSelectedDigimon).not.toHaveBeenCalled();
    expect(setDigimonStats).not.toHaveBeenCalled();
    expect(setActivityLogs).not.toHaveBeenCalled();
    expect(toggleModal).not.toHaveBeenCalledWith("deathModal", false);
    expect(setHasSeenDeathPopup).not.toHaveBeenCalled();
  });
});
