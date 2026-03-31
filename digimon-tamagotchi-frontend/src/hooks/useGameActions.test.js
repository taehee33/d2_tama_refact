import { wakeForInteraction } from "./useGameActions";

describe("wakeForInteraction", () => {
  test("자는 중 액션 1회는 sleepDisturbances를 올리고 wakeUntil을 설정하지만 careMistakes는 올리지 않는다", () => {
    const setWakeUntil = jest.fn();
    const onSleepDisturbance = jest.fn();
    const stats = {
      careMistakes: 3,
      sleepDisturbances: 1,
      napUntil: null,
    };

    const before = Date.now();
    const result = wakeForInteraction(stats, setWakeUntil, jest.fn(), true, onSleepDisturbance);
    const after = Date.now();

    expect(result.sleepDisturbances).toBe(2);
    expect(result.careMistakes).toBe(3);
    expect(result.wakeUntil).toBeGreaterThanOrEqual(before + 10 * 60 * 1000);
    expect(result.wakeUntil).toBeLessThanOrEqual(after + 10 * 60 * 1000);
    expect(setWakeUntil).toHaveBeenCalledWith(result.wakeUntil);
    expect(onSleepDisturbance).toHaveBeenCalledTimes(1);
  });

  test("낮잠 중 강제 깨움은 wakeUntil만 설정하고 sleepDisturbances는 올리지 않는다", () => {
    const setWakeUntil = jest.fn();
    const onSleepDisturbance = jest.fn();
    const stats = {
      careMistakes: 1,
      sleepDisturbances: 4,
      napUntil: Date.now() + 5 * 60 * 1000,
    };

    const result = wakeForInteraction(stats, setWakeUntil, jest.fn(), true, onSleepDisturbance);

    expect(result.sleepDisturbances).toBe(4);
    expect(result.careMistakes).toBe(1);
    expect(setWakeUntil).toHaveBeenCalledTimes(1);
    expect(onSleepDisturbance).not.toHaveBeenCalled();
  });
});
