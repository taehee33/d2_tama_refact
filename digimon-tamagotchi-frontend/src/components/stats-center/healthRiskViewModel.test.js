import { DEATH_REASONS, DEATH_THRESHOLDS } from "../../logic/stats/death";
import { buildHealthRiskViewModel } from "./healthRiskViewModel";

const NOW = Date.parse("2026-08-13T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function getItem(result, key) {
  return result.healthRiskItems.find((item) => item.key === key);
}

function getDetail(item, label) {
  return item.details.find((detail) => detail.label === label)?.value;
}

describe("buildHealthRiskViewModel 위험 경계", () => {
  test.each([
    ["hunger-zero", { fullness: 0, lastHungerZeroAt: NOW - 12 * HOUR }],
    ["strength-zero", { strength: 0, lastStrengthZeroAt: NOW - 12 * HOUR }],
    ["injury-neglect", { isInjured: true, injuredAt: NOW - 6 * HOUR }],
  ])("%s 시간 임계값에 도달하면 사망 위험으로 표시한다", (key, stats) => {
    const result = buildHealthRiskViewModel(stats, NOW);
    const item = getItem(result, key);

    expect(item.state).toBe("danger");
    expect(item.statusText).toBe("사망 위험");
    expect(getDetail(item, "남은 시간")).toBe("0시간 0분 0초");
    expect(item.gauge.value).toBe(item.gauge.max);
  });

  test("누적 부상 15회에 도달하면 사망 위험으로 표시한다", () => {
    const item = getItem(buildHealthRiskViewModel({ injuries: 15 }, NOW), "injury-overload");

    expect(item.state).toBe("danger");
    expect(item.statusText).toBe("사망 위험");
    expect(getDetail(item, "현재 횟수")).toBe("15/15회");
    expect(getDetail(item, "사망까지")).toBe("0회");
    expect(item.gauge).toMatchObject({
      value: DEATH_THRESHOLDS.injuryOverloadCount,
      max: DEATH_THRESHOLDS.injuryOverloadCount,
    });
  });

  test("배변 8개 도달 직후 즉시 부상과 다음 8시간을 표시한다", () => {
    const item = getItem(buildHealthRiskViewModel({
      poopCount: 8,
      poopReachedMaxAt: NOW,
      lastPoopPenaltyAt: NOW,
    }, NOW), "poop");

    expect(item.state).toBe("active");
    expect(item.statusText).toBe("즉시 부상 발생 · 다음 부상 카운트 중");
    expect(getDetail(item, "다음 부상까지")).toBe("8시간 0분 0초");
    expect(item.gauge).toMatchObject({ value: 0, max: 8 * HOUR, filledSegments: 0 });
  });

  test("배변 페널티 기준 시각부터 다음 8시간 부상을 카운트다운한다", () => {
    const item = getItem(buildHealthRiskViewModel({
      poopCount: 8,
      poopReachedMaxAt: NOW - 10 * HOUR,
      lastPoopPenaltyAt: NOW - 2 * HOUR,
    }, NOW), "poop");

    expect(getDetail(item, "다음 부상까지")).toBe("6시간 0분 0초");
    expect(item.gauge.filledSegments).toBe(2);
  });
});

describe("buildHealthRiskViewModel 냉장고 시간 제외", () => {
  test("기존 냉장고 구간과 누적 제외 시간을 모든 시간 카운터에서 뺀다", () => {
    const startedAt = NOW - 5 * HOUR;
    const stats = {
      fullness: 0,
      strength: 0,
      isInjured: true,
      poopCount: 8,
      lastHungerZeroAt: startedAt,
      lastStrengthZeroAt: startedAt,
      injuredAt: startedAt,
      poopReachedMaxAt: startedAt,
      lastPoopPenaltyAt: startedAt,
      frozenAt: startedAt + HOUR,
      takeOutAt: startedAt + 2 * HOUR,
      hungerZeroFrozenDurationMs: 30 * 60 * 1000,
      strengthZeroFrozenDurationMs: 30 * 60 * 1000,
      injuryFrozenDurationMs: 30 * 60 * 1000,
      poopPenaltyFrozenDurationMs: 30 * 60 * 1000,
    };
    const result = buildHealthRiskViewModel(stats, NOW);

    expect(getDetail(getItem(result, "hunger-zero"), "남은 시간")).toBe("8시간 30분 0초");
    expect(getDetail(getItem(result, "strength-zero"), "남은 시간")).toBe("8시간 30분 0초");
    expect(getDetail(getItem(result, "injury-neglect"), "남은 시간")).toBe("2시간 30분 0초");
    expect(getDetail(getItem(result, "poop"), "다음 부상까지")).toBe("4시간 30분 0초");
  });

  test("냉장고 보관 중에는 진행된 시간을 유지하고 카운터를 일시정지한다", () => {
    const startedAt = NOW - 5 * HOUR;
    const result = buildHealthRiskViewModel({
      fullness: 0,
      lastHungerZeroAt: startedAt,
      frozenAt: NOW - 4 * HOUR,
      takeOutAt: null,
      isFrozen: true,
    }, NOW);
    const item = getItem(result, "hunger-zero");

    expect(item.state).toBe("paused");
    expect(item.statusText).toBe("수명·카운터 일시정지");
    expect(getDetail(item, "남은 시간")).toBe("11시간 0분 0초");
    expect(getDetail(item, "데드라인")).toBe("냉장고 해제 후 재계산");
  });
});

describe("buildHealthRiskViewModel 호환성과 불변성", () => {
  test.each([
    ["hunger-zero", DEATH_REASONS.starvation],
    ["strength-zero", DEATH_REASONS.exhaustion],
    ["injury-neglect", DEATH_REASONS.injuryNeglect],
    ["injury-overload", DEATH_REASONS.injuryOverload],
  ])("%s 사망 원인은 timestamp가 없어도 원인 정지 상태로 표시한다", (key, deathReason) => {
    const result = buildHealthRiskViewModel({ isDead: true, deathReason }, NOW);
    const item = getItem(result, key);

    expect(item.state).toBe("dead");
    expect(item.statusText).toBe("사망 원인 · 카운터 정지");
  });

  test("사망 시각을 기준으로 모든 당시 활성 카운터를 멈춘다", () => {
    const diedAt = NOW - HOUR;
    const stats = {
      isDead: true,
      deathReason: DEATH_REASONS.starvation,
      diedAt,
      fullness: 0,
      strength: 0,
      lastHungerZeroAt: NOW - 13 * HOUR,
      lastStrengthZeroAt: NOW - 13 * HOUR,
      poopCount: 8,
      poopReachedMaxAt: NOW - 4 * HOUR,
      lastPoopPenaltyAt: NOW - 4 * HOUR,
      lifespanSeconds: 127024,
    };
    const first = buildHealthRiskViewModel(stats, NOW);
    const later = buildHealthRiskViewModel(stats, NOW + 5 * HOUR);
    const hunger = getItem(first, "hunger-zero");
    const strength = getItem(first, "strength-zero");

    expect(hunger.statusText).toBe("사망 원인 · 카운터 정지");
    expect(strength.statusText).toBe("사망 · 카운터 정지");
    expect(getDetail(hunger, "정지 시각")).not.toBe("기록 없음");
    expect(getItem(first, "hunger-zero")).toEqual(getItem(later, "hunger-zero"));
    expect(getItem(first, "strength-zero")).toEqual(getItem(later, "strength-zero"));
    expect(getItem(first, "poop")).toEqual(getItem(later, "poop"));
    expect(first.lifespanInfo).toEqual(later.lifespanInfo);
  });

  test("사망 시각이 없는 레거시 데이터는 현재 시각으로 추정하지 않는다", () => {
    const result = buildHealthRiskViewModel({
      isDead: true,
      deathReason: DEATH_REASONS.starvation,
      fullness: 0,
      strength: 0,
      lastHungerZeroAt: NOW - 13 * HOUR,
      lastStrengthZeroAt: NOW - 3 * HOUR,
    }, NOW);
    const hunger = getItem(result, "hunger-zero");
    const strength = getItem(result, "strength-zero");

    expect(getDetail(hunger, "정지 시각")).toBe("기록 없음");
    expect(getDetail(strength, "남은 시간")).toBe("기록 없음");
    expect(strength.gauge.available).toBe(false);
  });

  test("사망 당시 조건값은 남아 있지만 발생 시각이 없으면 정지 상태와 기록 없음으로 표시한다", () => {
    const result = buildHealthRiskViewModel({
      isDead: true,
      diedAt: NOW,
      deathReason: DEATH_REASONS.starvation,
      fullness: 0,
      strength: 0,
      poopCount: 8,
    }, NOW + HOUR);
    const strength = getItem(result, "strength-zero");
    const poop = getItem(result, "poop");

    expect(strength.statusText).toBe("사망 · 카운터 정지");
    expect(getDetail(strength, "남은 시간")).toBe("기록 없음");
    expect(strength.gauge.available).toBe(false);
    expect(poop.statusText).toBe("사망 · 카운터 정지");
    expect(getDetail(poop, "다음 부상까지")).toBe("기록 없음");
    expect(poop.gauge.available).toBe(false);
  });

  test("누적 부상 사망 원인은 레거시 횟수가 없어도 임계값 도달로 표시한다", () => {
    const item = getItem(buildHealthRiskViewModel({
      isDead: true,
      deathReason: DEATH_REASONS.injuryOverload,
    }, NOW), "injury-overload");

    expect(getDetail(item, "현재 횟수")).toBe("15/15회");
    expect(getDetail(item, "사망까지")).toBe("0회");
    expect(item.gauge.value).toBe(DEATH_THRESHOLDS.injuryOverloadCount);
  });

  test("이미 지난 시간 임계값의 데드라인은 현재 시각이 바뀌어도 고정된다", () => {
    const stats = {
      fullness: 0,
      lastHungerZeroAt: NOW - 13 * HOUR,
    };
    const first = getItem(buildHealthRiskViewModel(stats, NOW), "hunger-zero");
    const later = getItem(buildHealthRiskViewModel(stats, NOW + 2 * HOUR), "hunger-zero");

    expect(getDetail(first, "데드라인")).toBe(getDetail(later, "데드라인"));
  });

  test("레거시 배변 timestamp를 발생·페널티 기준 시각으로 사용한다", () => {
    const legacyTimestamp = NOW - 2 * HOUR;
    const item = getItem(buildHealthRiskViewModel({
      poopCount: 8,
      lastMaxPoopTime: legacyTimestamp,
    }, NOW), "poop");

    expect(item.state).toBe("active");
    expect(getDetail(item, "8개 도달 시각")).not.toBe("없음");
    expect(getDetail(item, "다음 부상까지")).toBe("6시간 0분 0초");
  });

  test("누적 수명은 상한·진행률 없이 생존·냉장고·사망 상태를 구분한다", () => {
    const active = buildHealthRiskViewModel({ lifespanSeconds: 127024 }, NOW).lifespanInfo;
    const paused = buildHealthRiskViewModel({
      lifespanSeconds: 127024,
      isFrozen: true,
    }, NOW).lifespanInfo;
    const dead = buildHealthRiskViewModel({
      lifespanSeconds: 127024,
      isDead: true,
      diedAt: NOW,
      deathReason: DEATH_REASONS.exhaustion,
    }, NOW + HOUR).lifespanInfo;

    expect(active).toEqual({
      label: "누적 수명",
      value: "1일 11시간 17분 4초",
      state: "active",
      statusText: "상한 없이 누적 중",
    });
    expect(active).not.toHaveProperty("gauge");
    expect(active).not.toHaveProperty("max");
    expect(paused.statusText).toBe("수명 증가 일시정지");
    expect(dead).toMatchObject({
      value: "1일 11시간 17분 4초",
      state: "dead",
      statusText: "사망(힘 소진)",
      stoppedAtLabel: "사망 시각",
    });
    expect(dead.stoppedAtValue).not.toBe("기록 없음");
  });

  test("사망 원인이 없으면 누적 수명에 원인 확인 불가를 표시한다", () => {
    const lifespan = buildHealthRiskViewModel({ isDead: true }, NOW).lifespanInfo;

    expect(lifespan.statusText).toBe("사망(원인 확인 불가)");
    expect(lifespan.stoppedAtValue).toBe("기록 없음");
  });

  test("원본 stats를 변경하지 않는다", () => {
    const stats = Object.freeze({
      fullness: 0,
      lastHungerZeroAt: NOW - HOUR,
      lifespanSeconds: 10,
    });
    const before = JSON.stringify(stats);

    buildHealthRiskViewModel(stats, NOW);

    expect(JSON.stringify(stats)).toBe(before);
  });
});
