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

  test("resetDigimon은 초기화 후 저장과 모달 정리를 실행한다", async () => {
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
    const setDigimonStatsAndSave = jest.fn().mockResolvedValue(undefined);
    const setSelectedDigimonAndSave = jest.fn().mockResolvedValue(undefined);
    const toggleModal = jest.fn();
    const setHasSeenDeathPopup = jest.fn();
    const appendLogToSubcollection = jest.fn().mockResolvedValue(undefined);

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
        appendLogToSubcollection,
        setSelectedDigimon,
        setDigimonStatsAndSave,
        setSelectedDigimonAndSave,
        setHasSeenDeathPopup,
        confirmFn: () => true,
      })
    );

    await act(async () => {
      await result.current.resetDigimon();
    });

    expect(setSelectedDigimon).toHaveBeenCalledWith("Digitama");
    expect(setDigimonStats).toHaveBeenCalled();
    expect(setDigimonStatsAndSave).toHaveBeenCalled();
    expect(setSelectedDigimonAndSave).toHaveBeenCalledWith("Digitama");
    expect(toggleModal).toHaveBeenCalledWith("deathModal", false);
    expect(setHasSeenDeathPopup).toHaveBeenCalledWith(false);
    expect(appendLogToSubcollection).toHaveBeenCalled();
  });
});
