import {
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
});
