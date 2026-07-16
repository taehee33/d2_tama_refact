import {
  buildAnimationCleanOutcome,
  buildAnimationFeedLogText,
  buildAnimationFeedOutcome,
  buildAnimationHealOutcome,
  buildHealTreatmentMessage,
  resolveAnimationSleepInteraction,
} from "./useGameAnimations";
import { getKstDateTimeMs } from "../utils/time";

const kstDate = (
  year,
  monthIndex,
  day,
  hours,
  minutes = 0,
  seconds = 0
) =>
  new Date(
    getKstDateTimeMs({
      year,
      month: monthIndex + 1,
      day,
      hours,
      minutes,
      seconds,
    })
  );

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

  test("resolveAnimationSleepInteraction는 비수면 상태에서는 기존 스탯을 유지한다", () => {
    const now = kstDate(2026, 3, 12, 12, 0, 0);
    const baseStats = {
      sleepDisturbances: 0,
      activityLogs: [],
    };

    const result = resolveAnimationSleepInteraction({
      baseStats,
      activityLogs: [],
      selectedDigimon: "Koromon",
      digimonData: {
        Koromon: {
          sleepSchedule: { start: 22, end: 6 },
        },
      },
      isLightsOn: false,
      wakeUntil: null,
      now,
    });

    expect(result.actionSleepState.isSleepingLike).toBe(false);
    expect(result.sleepDisturbanceDuplicate).toBe(false);
    expect(result.applySleepDisturbanceLog).toBe(false);
    expect(result.updatedStats).toBe(baseStats);
  });

  test("resolveAnimationSleepInteraction는 수면 중 상호작용이면 wake helper를 호출한다", () => {
    const now = kstDate(2026, 3, 12, 23, 0, 0);
    const setWakeUntil = jest.fn();
    const wakeInteraction = jest.fn(() => ({
      sleepDisturbances: 1,
      wakeUntil: now.getTime() + 10 * 60 * 1000,
    }));

    const result = resolveAnimationSleepInteraction({
      baseStats: {
        sleepDisturbances: 0,
        activityLogs: [],
      },
      activityLogs: [],
      selectedDigimon: "Agumon",
      digimonData: {
        Agumon: {
          sleepSchedule: { start: 22, end: 6 },
        },
      },
      isLightsOn: false,
      wakeUntil: null,
      now,
      setWakeUntil,
      wakeInteraction,
    });

    expect(result.actionSleepState.isSleepingLike).toBe(true);
    expect(result.sleepDisturbanceDuplicate).toBe(false);
    expect(result.applySleepDisturbanceLog).toBe(true);
    expect(wakeInteraction).toHaveBeenCalledWith(
      expect.objectContaining({ sleepDisturbances: 0, activityLogs: [] }),
      setWakeUntil,
      null,
      true,
      null
    );
    expect(result.updatedStats).toEqual({
      sleepDisturbances: 1,
      wakeUntil: now.getTime() + 10 * 60 * 1000,
    });
  });

  test("resolveAnimationSleepInteraction는 중복 수면 방해 로그가 있으면 wake helper를 건너뛴다", () => {
    const now = kstDate(2026, 3, 12, 23, 0, 0);
    const wakeInteraction = jest.fn();
    const duplicateLog = {
      type: "SLEEP_DISTURBANCE",
      text: "수면 방해(사유: 청소): 10분 동안 깨어있음",
      timestamp: now.getTime() - 60 * 1000,
    };
    const baseStats = {
      sleepDisturbances: 0,
      activityLogs: [duplicateLog],
    };

    const result = resolveAnimationSleepInteraction({
      baseStats,
      activityLogs: [duplicateLog],
      selectedDigimon: "Agumon",
      digimonData: {
        Agumon: {
          sleepSchedule: { start: 22, end: 6 },
        },
      },
      isLightsOn: false,
      wakeUntil: null,
      now,
      setWakeUntil: jest.fn(),
      wakeInteraction,
    });

    expect(result.actionSleepState.isSleepingLike).toBe(true);
    expect(result.sleepDisturbanceDuplicate).toBe(true);
    expect(result.applySleepDisturbanceLog).toBe(false);
    expect(wakeInteraction).not.toHaveBeenCalled();
    expect(result.updatedStats).toBe(baseStats);
  });

  test("buildAnimationFeedLogText는 오버피드 meat 로그를 유지한다", () => {
    const result = buildAnimationFeedLogText({
      type: "meat",
      eatResult: { isOverfeed: true },
      beforeStats: {
        weight: 10,
        overfeeds: 0,
        hungerCountdown: 120,
      },
      updatedStats: {
        weight: 10,
        overfeeds: 1,
        hungerCountdown: 120,
      },
    });

    expect(result).toBe("Overfeed! Hunger drop delayed (Wt +0g, HungerCycle +0min)");
  });

  test("buildAnimationFeedOutcome는 meat 섭취 후 hunger call을 리셋한다", () => {
    const result = buildAnimationFeedOutcome({
      type: "meat",
      baseStats: {
        fullness: 0,
        maxOverfeed: 0,
        weight: 10,
        callStatus: {
          hunger: { isActive: true, startedAt: 100, sleepStartAt: 200, isLogged: false },
        },
      },
    });

    expect(result.updatedStats.fullness).toBe(1);
    expect(result.updatedStats.callStatus.hunger).toMatchObject({
      isActive: false,
      startedAt: null,
    });
    expect(result.logText).toContain("Feed: Meat");
  });

  test("buildAnimationFeedOutcome는 protein bonus와 strength call reset을 유지한다", () => {
    const result = buildAnimationFeedOutcome({
      type: "protein",
      baseStats: {
        strength: 3,
        weight: 10,
        energy: 0,
        maxEnergy: 3,
        callStatus: {
          strength: { isActive: true, startedAt: 100, sleepStartAt: 200, isLogged: false },
        },
      },
    });

    expect(result.eatResult.energyRestored).toBe(true);
    expect(result.updatedStats.callStatus.strength).toMatchObject({
      isActive: false,
      startedAt: null,
    });
    expect(result.logText).toContain("Protein Bonus!");
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
