import { updateLifespan } from "../../data/stats";
import { handleHungerTick } from "./hunger";
import { handleStrengthTick } from "./strength";

describe("실시간 catch-up 기준 시각", () => {
  const processedThroughMs = Date.parse("2026-04-01T12:01:00.000Z");

  test("배고픔과 힘의 zero 시각은 실제 현재가 아닌 처리 구간 안에서 계산한다", () => {
    const baseStats = {
      isDead: false,
      isFrozen: false,
      fullness: 1,
      strength: 1,
      hungerTimer: 60,
      strengthTimer: 60,
      hungerCountdown: 10,
      strengthCountdown: 20,
      lastHungerZeroAt: null,
      lastStrengthZeroAt: null,
    };

    const hunger = handleHungerTick(baseStats, {}, 60, false, processedThroughMs);
    const strength = handleStrengthTick(baseStats, {}, 60, false, processedThroughMs);

    expect(hunger.lastHungerZeroAt).toBe(processedThroughMs - (50 * 1000));
    expect(strength.lastStrengthZeroAt).toBe(processedThroughMs - (40 * 1000));
  });

  test("사망 판정도 아직 처리하지 않은 catch-up 미래 구간을 미리 소비하지 않는다", () => {
    const result = updateLifespan(
      {
        isDead: false,
        fullness: 0,
        strength: 2,
        lastHungerZeroAt: Date.parse("2026-04-01T00:02:00.000Z"),
        lastStrengthZeroAt: null,
        lifespanSeconds: 0,
        timeToEvolveSeconds: 100,
        poopTimer: 0,
        poopCount: 0,
      },
      60,
      false,
      processedThroughMs
    );

    expect(result.isDead).toBe(false);
  });
});
