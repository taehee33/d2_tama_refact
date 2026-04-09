import {
  buildPersistentActivityLogPayload,
  getPersistentActivityLogDocId,
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

  test("반복성 높은 일반 액션 로그는 Firestore에 저장하지 않는다", () => {
    expect(shouldPersistActivityLog({ type: "FEED" })).toBe(false);
    expect(shouldPersistActivityLog({ type: "TRAIN" })).toBe(false);
    expect(shouldPersistActivityLog({ type: "CLEAN" })).toBe(false);
    expect(shouldPersistActivityLog({ type: "ACTION" })).toBe(false);
    expect(shouldPersistActivityLog({ type: "PLAY_OR_SNACK" })).toBe(false);
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
});
