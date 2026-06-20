import {
  buildBattleLogEventId,
  buildPersistentBattleLogPayload,
} from "./battleLogPersistence";

describe("battleLogPersistence", () => {
  test("동일한 배틀 결과는 같은 eventId를 사용한다", () => {
    const entry = {
      timestamp: 123456789,
      mode: "quest",
      text: "아구몬에게 승리",
      win: true,
      enemyName: "아구몬",
      injury: false,
      digimonId: "Gabumon",
    };

    expect(buildBattleLogEventId(entry)).toBe(
      buildBattleLogEventId({ ...entry })
    );
  });

  test("payload에 재전송용 eventId와 선택 필드를 유지한다", () => {
    const payload = buildPersistentBattleLogPayload({
      eventId: "battle:fixed",
      timestamp: new Date("2026-06-21T00:00:00.000Z"),
      mode: "arena",
      text: "승리",
      win: true,
      enemyName: "상대",
      injury: false,
    });

    expect(payload).toMatchObject({
      eventId: "battle:fixed",
      timestamp: Date.parse("2026-06-21T00:00:00.000Z"),
      mode: "arena",
      win: true,
      enemyName: "상대",
      injury: false,
    });
  });
});
