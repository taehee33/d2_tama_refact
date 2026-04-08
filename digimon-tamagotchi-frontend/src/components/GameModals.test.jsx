import { applyStatsPopupChange } from "./GameModals";

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
