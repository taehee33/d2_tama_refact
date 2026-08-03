import { getRealtimeArenaActionMatchupResult } from "./actionMatchup";

test.each([
  ["attack", "guard", "blocked"],
  ["attack", "special_attack", "hit"],
  ["special_attack", "attack", "interrupted"],
  ["special_attack", "guard", "hit"],
  ["guard", "attack", "guard_success"],
])("%s 대 %s의 공통 상성 결과는 %s이다", (action, opponentAction, expected) => {
  expect(getRealtimeArenaActionMatchupResult(action, opponentAction)).toBe(expected);
});

test("선택 정보가 없는 오래된 라운드는 no_action 기준으로 안전하게 처리한다", () => {
  expect(getRealtimeArenaActionMatchupResult(undefined, "guard")).toBe("none");
  expect(getRealtimeArenaActionMatchupResult("attack", undefined)).toBe("hit");
});
