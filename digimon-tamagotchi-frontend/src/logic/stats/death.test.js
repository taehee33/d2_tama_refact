import {
  DEATH_REASONS,
  applyDeathEvaluationToStats,
  evaluateDeathConditions,
} from "./death";

const NOW_MS = Date.parse("2026-04-01T12:00:00.000Z");

function createStats(overrides = {}) {
  return {
    isDead: false,
    deathReason: null,
    fullness: 2,
    lastHungerZeroAt: null,
    strength: 2,
    lastStrengthZeroAt: null,
    injuries: 0,
    isInjured: false,
    injuredAt: null,
    frozenAt: null,
    takeOutAt: null,
    ...overrides,
  };
}

describe("evaluateDeathConditions", () => {
  test("배고픔 0 사망은 냉장고 시간을 제외해 계산한다", () => {
    const result = evaluateDeathConditions(
      createStats({
        fullness: 0,
        lastHungerZeroAt: Date.parse("2026-04-01T00:00:00.000Z"),
        frozenAt: Date.parse("2026-04-01T01:00:00.000Z"),
        takeOutAt: Date.parse("2026-04-01T04:00:00.000Z"),
      }),
      NOW_MS
    );

    expect(result).toEqual({
      isDead: false,
      reason: null,
      diedAt: null,
    });
  });

  test("힘 0 사망은 threshold를 넘기면 EXHAUSTION을 반환한다", () => {
    const result = evaluateDeathConditions(
      createStats({
        strength: 0,
        lastStrengthZeroAt: Date.parse("2026-04-01T00:00:00.000Z"),
      }),
      NOW_MS
    );

    expect(result).toEqual({
      isDead: true,
      reason: DEATH_REASONS.exhaustion,
      diedAt: NOW_MS,
    });
  });

  test("부상 과다는 다른 조건보다 우선하지 않고 정해진 순서대로 injury overload를 반환한다", () => {
    const result = evaluateDeathConditions(
      createStats({
        injuries: 15,
        isInjured: true,
        injuredAt: Date.parse("2026-04-01T10:00:00.000Z"),
      }),
      NOW_MS
    );

    expect(result).toEqual({
      isDead: true,
      reason: DEATH_REASONS.injuryOverload,
      diedAt: Date.parse("2026-04-01T10:00:00.000Z"),
    });
  });

  test("부상 방치는 냉장고 시간을 제외해 계산한다", () => {
    const result = evaluateDeathConditions(
      createStats({
        isInjured: true,
        injuredAt: Date.parse("2026-04-01T05:00:00.000Z"),
        frozenAt: Date.parse("2026-04-01T06:00:00.000Z"),
        takeOutAt: Date.parse("2026-04-01T09:30:00.000Z"),
      }),
      NOW_MS
    );

    expect(result).toEqual({
      isDead: false,
      reason: null,
      diedAt: null,
    });
  });

  test("냉장고에서 꺼낸 뒤 takeOutAt가 정리돼도 누적 제외 시간으로 배고픔 사망을 막는다", () => {
    const result = evaluateDeathConditions(
      createStats({
        fullness: 0,
        lastHungerZeroAt: Date.parse("2026-04-01T00:00:00.000Z"),
        frozenAt: null,
        takeOutAt: null,
        hungerZeroFrozenDurationMs: 3 * 60 * 60 * 1000,
      }),
      NOW_MS
    );

    expect(result).toEqual({
      isDead: false,
      reason: null,
      diedAt: null,
    });
  });

  test("이미 죽은 스탯은 기존 deathReason을 유지한다", () => {
    const result = evaluateDeathConditions(
      createStats({
        isDead: true,
        deathReason: DEATH_REASONS.starvation,
      }),
      NOW_MS
    );

    expect(result).toEqual({
      isDead: true,
      reason: DEATH_REASONS.starvation,
      diedAt: null,
    });
  });

  test("시간 기반 사망은 임계점을 통과한 실제 시각을 반환한다", () => {
    const result = evaluateDeathConditions(
      createStats({
        fullness: 0,
        lastHungerZeroAt: Date.parse("2026-03-31T23:00:00.000Z"),
      }),
      NOW_MS
    );

    expect(result).toEqual({
      isDead: true,
      reason: DEATH_REASONS.starvation,
      diedAt: Date.parse("2026-04-01T11:00:00.000Z"),
    });
  });
});

describe("applyDeathEvaluationToStats", () => {
  test("사망 판정 결과의 기존 merge 동작만 적용한다", () => {
    const stats = createStats({
      activityLogs: [{ type: "CALL" }],
      deathReason: "기존 사유",
    });
    const result = applyDeathEvaluationToStats(stats, {
      isDead: true,
      reason: DEATH_REASONS.injuryNeglect,
      diedAt: NOW_MS,
    });

    expect(result).toEqual({
      ...stats,
      isDead: true,
      deathReason: DEATH_REASONS.injuryNeglect,
      diedAt: NOW_MS,
    });
    expect(result).not.toBe(stats);
  });

  test("사망 판정이 아니면 입력 stats 의미를 그대로 유지한다", () => {
    const stats = createStats({ deathReason: null });
    const result = applyDeathEvaluationToStats(stats, {
      isDead: false,
      reason: null,
      diedAt: null,
    });

    expect(result).toBe(stats);
    expect(result).not.toHaveProperty("diedAt");
  });

  test("reason과 diedAt이 없으면 undefined 필드를 새로 주입하지 않는다", () => {
    const stats = createStats({ deathReason: "기존 사유" });
    const result = applyDeathEvaluationToStats(stats, {
      isDead: true,
      reason: null,
      diedAt: null,
    });

    expect(result.isDead).toBe(true);
    expect(result.deathReason).toBe("기존 사유");
    expect(result).not.toHaveProperty("diedAt");
  });
});
