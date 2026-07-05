import {
  buildPersistentActivityLogPayload,
  getPersistentActivityLogDocId,
  isImportantFeedActivityLog,
  PERSISTED_ACTIVITY_LOG_TYPES,
  shouldPersistActivityLog,
} from "./activityLogPersistence";

describe("activityLogPersistence", () => {
  test("핵심 케어/수면/생명 주기 로그는 Firestore에 유지한다", () => {
    expect(shouldPersistActivityLog({ type: "CAREMISTAKE" })).toBe(true);
    expect(shouldPersistActivityLog({ type: "SLEEP_DISTURBANCE" })).toBe(true);
    expect(shouldPersistActivityLog({ type: "EVOLUTION" })).toBe(true);
    expect(shouldPersistActivityLog({ type: "DEATH" })).toBe(true);
    expect(PERSISTED_ACTIVITY_LOG_TYPES.has("FRIDGE")).toBe(true);
  });

  test("확정된 사용자 액션 로그를 Firestore에 저장한다", () => {
    expect(shouldPersistActivityLog({ type: "TRAIN" })).toBe(true);
    expect(shouldPersistActivityLog({ type: "CLEAN" })).toBe(true);
    expect(shouldPersistActivityLog({ type: "ACTION" })).toBe(true);
    expect(shouldPersistActivityLog({ type: "PLAY_OR_SNACK" })).toBe(true);
    expect(shouldPersistActivityLog({ type: "NAP_START" })).toBe(true);
    expect(shouldPersistActivityLog({ type: "NAP_END" })).toBe(true);
  });

  test("일반 FEED는 요약 대상으로 두고 중요한 FEED만 개별 저장한다", () => {
    expect(shouldPersistActivityLog({ type: "FEED", text: "Feed: Meat" })).toBe(false);
    expect(isImportantFeedActivityLog({ type: "FEED", text: "Feed: Refused" })).toBe(true);
    expect(isImportantFeedActivityLog({ type: "FEED", text: "Overfeed!" })).toBe(true);
  });

  test("잘못된 로그 입력은 저장 대상이 아니다", () => {
    expect(shouldPersistActivityLog(null)).toBe(false);
    expect(shouldPersistActivityLog({})).toBe(false);
    expect(shouldPersistActivityLog({ type: "" })).toBe(false);
  });

  test("eventId가 계산되는 로그는 Firestore 문서 키도 같은 값으로 고정한다", () => {
    const careMistakeLog = {
      type: "CAREMISTAKE",
      text: "케어미스(사유: 배고픔 콜 10분 무시) [과거 재구성]",
      timestamp: Date.parse("2026-04-09T00:54:00.000Z"),
    };

    const firstPayload = buildPersistentActivityLogPayload(careMistakeLog);
    const secondPayload = buildPersistentActivityLogPayload({ ...careMistakeLog });

    const persistedDocs = new Map();
    persistedDocs.set(getPersistentActivityLogDocId(firstPayload), firstPayload);
    persistedDocs.set(getPersistentActivityLogDocId(secondPayload), secondPayload);

    expect(firstPayload.eventId).toBe(secondPayload.eventId);
    expect(persistedDocs.size).toBe(1);
  });

  test("일반 영구 로그도 내용 기반 eventId가 안정적으로 생성된다", () => {
    const log = {
      type: "TRAIN",
      text: "훈련 성공",
      timestamp: 123456789,
      digimonId: "Agumon",
    };

    const first = buildPersistentActivityLogPayload(log);
    const second = buildPersistentActivityLogPayload({ ...log });

    expect(first.eventId).toBe(second.eventId);
    expect(getPersistentActivityLogDocId(first)).toBe(first.eventId);
  });

  test("EVOLUTION 로그는 명시 eventId와 transitionId를 영구 저장 payload에 보존한다", () => {
    const log = {
      type: "EVOLUTION",
      text: "Evolution: Evolved to 그레이몬!",
      timestamp: 1700000000000,
      transitionId: "evolution:1700000000000:Agumon:Greymon:abc123",
      eventId:
        "activity:evolution:evolution:1700000000000:Agumon:Greymon:abc123",
      digimonId: "Greymon",
      digimonName: "그레이몬",
    };

    expect(buildPersistentActivityLogPayload(log)).toMatchObject({
      type: "EVOLUTION",
      transitionId: "evolution:1700000000000:Agumon:Greymon:abc123",
      eventId:
        "activity:evolution:evolution:1700000000000:Agumon:Greymon:abc123",
      digimonId: "Greymon",
      digimonName: "그레이몬",
    });
  });

  test("non-EVOLUTION 로그의 transitionId는 영구 저장 payload에 추가하지 않는다", () => {
    const payload = buildPersistentActivityLogPayload({
      type: "TRAIN",
      text: "훈련 성공",
      timestamp: 123456789,
      transitionId: "evolution:unused",
    });

    expect(payload.transitionId).toBeUndefined();
    expect(payload.eventId).toMatch(/^activity:train:123456789:/);
  });
});
