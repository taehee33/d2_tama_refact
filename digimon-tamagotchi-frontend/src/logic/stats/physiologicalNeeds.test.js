import {
  cleanupInapplicablePhysiologicalNeeds,
  cleanupPhysiologicalNeedsState,
} from "./physiologicalNeeds";
import { isPhysiologicalNeedsApplicable } from "../../utils/digimonVersionUtils";
import { evaluateDeathConditions } from "./death";

const STALE_STATS = {
  fullness: 0,
  strength: 0,
  lastHungerZeroAt: 1,
  lastStrengthZeroAt: 1,
  hungerMistakeDeadline: 2,
  strengthMistakeDeadline: 2,
  hungerZeroFrozenDurationMs: 10,
  strengthZeroFrozenDurationMs: 10,
  fastSleepStart: 3,
  napUntil: 4,
  sleepLightOnStart: 5,
  careMistakes: 7,
  careMistakeLedger: [{ id: "historic" }],
  callStatus: {
    hunger: { isActive: true, startedAt: 1, isLogged: false },
    strength: { isActive: true, startedAt: 1, isLogged: false },
    sleep: { isActive: true, startedAt: 1, isLogged: false },
  },
};

describe("디지타마 생리 요구사항 불변식", () => {
  test.each(["Digitama", "DigitamaV2", "DigitamaV3", "DigitamaV4", "DigitamaV5"])(
    "%s에는 생리 요구사항을 적용하지 않는다",
    (digimonId) => {
      expect(isPhysiologicalNeedsApplicable(digimonId)).toBe(false);
    }
  );

  test("stale 생리 상태만 정리하고 감사용 케어 기록은 보존한다", () => {
    const result = cleanupPhysiologicalNeedsState({
      stats: STALE_STATS,
      rootSlotFields: { isLightsOn: true, wakeUntil: 9 },
      needsApplicable: false,
    });

    expect(result.changed).toBe(true);
    expect(result.stats.careMistakes).toBe(7);
    expect(result.stats.careMistakeLedger).toBe(STALE_STATS.careMistakeLedger);
    expect(result.stats.callStatus.hunger.isActive).toBe(false);
    expect(result.stats.lastHungerZeroAt).toBeNull();
    expect(result.stats.napUntil).toBeNull();
    expect(result.rootSlotFields.wakeUntil).toBeNull();
  });

  test("이미 정리된 입력은 원본 참조와 changed:false를 유지한다", () => {
    const input = {
      ...STALE_STATS,
      lastHungerZeroAt: null,
      lastStrengthZeroAt: null,
      hungerMistakeDeadline: null,
      strengthMistakeDeadline: null,
      hungerZeroFrozenDurationMs: null,
      strengthZeroFrozenDurationMs: null,
      fastSleepStart: null,
      napUntil: null,
      sleepLightOnStart: null,
      wakeUntil: null,
      callStatus: {
        hunger: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
        strength: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
        sleep: { isActive: false, startedAt: null, sleepStartAt: null, isLogged: false },
      },
    };
    const clean = cleanupInapplicablePhysiologicalNeeds(input, false);
    expect(clean.changed).toBe(false);
    expect(clean.stats).toBe(input);
  });

  test("생리 요구사항이 없으면 굶주림·탈진만 사망 원인에서 제외한다", () => {
    expect(evaluateDeathConditions(STALE_STATS, 13 * 60 * 60 * 1000, false).isDead).toBe(false);
    expect(evaluateDeathConditions({ injuries: 15 }, 1, false).reason).toMatch(/부상 과다/);
  });
});
