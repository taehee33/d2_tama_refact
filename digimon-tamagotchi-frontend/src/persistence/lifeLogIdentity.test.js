import {
  LIFE_LOG_CLASSIFICATION,
  buildCurrentLifeLogIdentityPatch,
  classifyLifeLogEntry,
  selectCurrentLifeLogs,
} from "./lifeLogIdentity";

const identity = {
  slotInstanceId: "slot-life-1",
  digimonInstanceId: "digimon-life-2",
  currentLifeStartedAt: 200,
  slotCreatedAt: 50,
};

test("identity가 일치하는 로그만 현재 생애로 분류한다", () => {
  expect(classifyLifeLogEntry({ ...identity, timestamp: 300 }, identity))
    .toBe(LIFE_LOG_CLASSIFICATION.CURRENT);
  expect(classifyLifeLogEntry({
    slotInstanceId: "slot-life-1",
    digimonInstanceId: "digimon-life-old",
    timestamp: 300,
  }, identity)).toBe(LIFE_LOG_CLASSIFICATION.OTHER);
});

test("legacy 로그는 schema 전환 중이며 현재 birthTime 이후일 때만 backfill 대상으로 삼는다", () => {
  expect(classifyLifeLogEntry({ timestamp: 250 }, { ...identity, allowLegacy: true }))
    .toBe(LIFE_LOG_CLASSIFICATION.LEGACY_CURRENT);
  expect(classifyLifeLogEntry({ timestamp: 199 }, { ...identity, allowLegacy: true }))
    .toBe(LIFE_LOG_CLASSIFICATION.OTHER);
  expect(classifyLifeLogEntry({ timestamp: 250 }, { ...identity, allowLegacy: false }))
    .toBe(LIFE_LOG_CLASSIFICATION.OTHER);
});

test("현재 생애 로그는 입력 순서를 유지하며 최대 50건만 노출한다", () => {
  const entries = Array.from({ length: 60 }, (_, index) => ({
    ...identity,
    id: `log-${index}`,
    timestamp: 1000 - index,
  }));
  const result = selectCurrentLifeLogs(entries, { ...identity, maxCount: 50 });

  expect(result.currentEntries).toHaveLength(50);
  expect(result.currentEntries[0].id).toBe("log-0");
  expect(result.currentEntries[49].id).toBe("log-49");
  expect(result.legacyEntries).toEqual([]);
});

test("로그 identity patch는 schema와 두 생애 ID를 함께 기록한다", () => {
  expect(buildCurrentLifeLogIdentityPatch(identity)).toEqual({
    logIdentitySchemaVersion: 1,
    slotInstanceId: "slot-life-1",
    digimonInstanceId: "digimon-life-2",
  });
});
