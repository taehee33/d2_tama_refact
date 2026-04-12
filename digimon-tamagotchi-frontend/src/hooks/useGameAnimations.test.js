import {
  buildAnimationCleanOutcome,
  buildAnimationHealOutcome,
  buildHealTreatmentMessage,
} from "./useGameAnimations";

describe("useGameAnimations helpers", () => {
  test("buildAnimationCleanOutcome는 일반 청소 결과를 조립한다", () => {
    const result = buildAnimationCleanOutcome({
      prevStats: {
        poopCount: 3,
        isInjured: true,
      },
      oldPoopCount: 3,
      now: new Date("2026-04-12T10:00:00.000Z"),
      applySleepDisturbanceLog: false,
    });

    expect(result.logType).toBe("CLEAN");
    expect(result.logText).toBe("Cleaned Poop (Full flush, 3 → 0)");
    expect(result.updatedStats.poopCount).toBe(0);
    expect(result.updatedStats.isInjured).toBe(true);
  });

  test("buildAnimationCleanOutcome는 수면 방해 청소 로그를 조립한다", () => {
    const result = buildAnimationCleanOutcome({
      prevStats: {
        poopCount: 2,
      },
      oldPoopCount: 2,
      applySleepDisturbanceLog: true,
    });

    expect(result.logType).toBe("SLEEP_DISTURBANCE");
    expect(result.logText).toContain("수면 방해");
    expect(result.updatedStats.poopCount).toBe(0);
  });

  test("buildHealTreatmentMessage는 random value에 따라 치료 문구를 고른다", () => {
    expect(buildHealTreatmentMessage(0)).toBe("수술 치료 성공");
    expect(buildHealTreatmentMessage(0.999)).toBe("통합 치료 성공");
  });

  test("buildAnimationHealOutcome는 완치 전 치료 상태를 유지한다", () => {
    const result = buildAnimationHealOutcome({
      prevStats: {
        isInjured: true,
        healedDosesCurrent: 0,
      },
      requiredDoses: 2,
      treatmentMessage: "약물 치료 성공",
      applySleepDisturbanceLog: false,
    });

    expect(result.isFullyHealed).toBe(false);
    expect(result.logType).toBe("HEAL");
    expect(result.logText).toBe("약물 치료 성공");
    expect(result.updatedStats.healedDosesCurrent).toBe(1);
    expect(result.updatedStats.isInjured).toBe(true);
  });

  test("buildAnimationHealOutcome는 완치 시 부상을 해제하고 수면 방해 로그도 유지한다", () => {
    const result = buildAnimationHealOutcome({
      prevStats: {
        isInjured: true,
        healedDosesCurrent: 0,
        injuredAt: 1000,
        injuryFrozenDurationMs: 2000,
      },
      requiredDoses: 1,
      treatmentMessage: "심리 치료 성공",
      applySleepDisturbanceLog: true,
    });

    expect(result.isFullyHealed).toBe(true);
    expect(result.logType).toBe("SLEEP_DISTURBANCE");
    expect(result.logText).toContain("수면 방해");
    expect(result.updatedStats.isInjured).toBe(false);
    expect(result.updatedStats.injuredAt).toBeNull();
  });
});
