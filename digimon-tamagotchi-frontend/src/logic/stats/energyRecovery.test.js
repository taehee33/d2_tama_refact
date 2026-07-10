import { recoverEnergy } from "./energyRecovery";
import { handleEnergyRecovery } from "./stats";

const schedule = { start: 22, end: 7, startMinute: 0, endMinute: 0 };
const at = (hour, minute = 0) => new Date(2026, 2, 31, hour, minute, 0).getTime();
const nextDayAt = (hour, minute = 0) => new Date(2026, 3, 1, hour, minute, 0).getTime();

function createStats(overrides = {}) {
  return {
    isDead: false,
    energy: 1,
    lastEnergyRecoveryAt: null,
    isLightsOn: false,
    isFrozen: false,
    frozenAt: null,
    takeOutAt: null,
    fastSleepStart: null,
    napUntil: null,
    wakeUntil: null,
    ...overrides,
  };
}

describe("recoverEnergy", () => {
  test("활동 시간의 00/30분 경계만 회복하고 최대치를 넘지 않는다", () => {
    const recovered = recoverEnergy(createStats({ energy: 3 }), {
      startMs: at(10, 29), endMs: at(11, 1), sleepSchedule: schedule, maxEnergy: 5,
    });
    const noBoundary = recoverEnergy(createStats({ energy: 3 }), {
      startMs: at(10, 31), endMs: at(10, 59), sleepSchedule: schedule, maxEnergy: 5,
    });

    expect(recovered.energy).toBe(5);
    expect(recovered.lastEnergyRecoveryAt).toBe(at(11));
    expect(noBoundary.energy).toBe(3);
  });

  test("정규 수면 중에는 경계 회복하지 않고 기상 시 최대치까지 회복한다", () => {
    const sleeping = recoverEnergy(createStats(), {
      startMs: at(23, 10), endMs: nextDayAt(6, 50), sleepSchedule: schedule, maxEnergy: 5,
    });
    const woke = recoverEnergy(createStats(), {
      startMs: at(23, 10), endMs: nextDayAt(7, 10), sleepSchedule: schedule, maxEnergy: 5,
    });

    expect(sleeping.energy).toBe(1);
    expect(woke.energy).toBe(5);
    expect(woke.lastEnergyRecoveryAt).toBe(nextDayAt(7));
  });

  test("00/30분이 아닌 정규 기상 시각도 최대치 회복을 적용한다", () => {
    const result = recoverEnergy(createStats(), {
      startMs: at(23, 10),
      endMs: nextDayAt(7, 20),
      sleepSchedule: { start: 22, end: 7, startMinute: 0, endMinute: 15 },
      maxEnergy: 5,
    });

    expect(result.energy).toBe(5);
    expect(result.lastEnergyRecoveryAt).toBe(nextDayAt(7, 15));
  });

  test("낮잠과 수면 중 불 켜짐 상태에서는 회복하지 않는다", () => {
    const napping = recoverEnergy(createStats({
      isLightsOn: true,
      fastSleepStart: at(10),
      napUntil: at(13, 15),
    }), {
      startMs: at(10, 10), endMs: at(11, 5), sleepSchedule: schedule, maxEnergy: 5,
    });
    const sleepingWithLightsOn = recoverEnergy(createStats({ isLightsOn: true }), {
      startMs: at(23, 10), endMs: nextDayAt(6, 50), sleepSchedule: schedule, maxEnergy: 5,
    });

    expect(napping.energy).toBe(1);
    expect(sleepingWithLightsOn.energy).toBe(1);
  });

  test("냉장고 구간은 기상 회복과 경계 회복에서 제외하고 꺼낸 뒤 새 경계부터 재개한다", () => {
    const frozenBeforeWake = recoverEnergy(createStats({ frozenAt: nextDayAt(6, 50) }), {
      startMs: at(23, 10), endMs: nextDayAt(8), sleepSchedule: schedule, maxEnergy: 5,
    });
    const frozenAfterBoundary = recoverEnergy(createStats({ frozenAt: at(10, 45) }), {
      startMs: at(10, 10), endMs: at(11, 40), sleepSchedule: schedule, maxEnergy: 5,
    });
    const resumed = recoverEnergy(createStats({ frozenAt: at(10, 15), takeOutAt: at(11, 15) }), {
      startMs: at(10, 10), endMs: at(11, 40), sleepSchedule: schedule, maxEnergy: 5,
    });

    expect(frozenBeforeWake.energy).toBe(1);
    expect(frozenAfterBoundary.energy).toBe(2);
    expect(resumed.energy).toBe(2);
    expect(resumed.lastEnergyRecoveryAt).toBe(at(11, 30));
  });

  test.each([null, 0, "invalid"])("유효하지 않은 maxEnergy(%p)에서는 상태를 바꾸지 않는다", (maxEnergy) => {
    const stats = createStats();
    expect(recoverEnergy(stats, {
      startMs: at(10, 29), endMs: at(10, 31), sleepSchedule: schedule, maxEnergy,
    })).toEqual(stats);
  });

  test("실시간 handler와 lazy recovery가 같은 결과를 만든다", () => {
    const stats = createStats({ energy: 2, lastEnergyRecoveryAt: at(10, 29) });
    const now = new Date(at(11, 1));

    expect(handleEnergyRecovery(stats, schedule, 5, now)).toEqual(recoverEnergy(stats, {
      startMs: at(10, 29), endMs: at(11, 1), sleepSchedule: schedule, maxEnergy: 5,
    }));
  });
});
