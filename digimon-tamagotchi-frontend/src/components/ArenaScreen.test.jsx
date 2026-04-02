import { hasBattleReplayArchive } from "./ArenaScreen";

describe("hasBattleReplayArchive", () => {
  test("archiveId가 있으면 다시보기 가능으로 판단한다", () => {
    expect(hasBattleReplayArchive({ archiveId: "arena_1" })).toBe(true);
  });

  test("Firestore logs 배열만 있어도 archiveId가 없으면 다시보기 불가로 판단한다", () => {
    expect(
      hasBattleReplayArchive({
        logs: [{ type: "ATTACK", text: "이전 Firestore 상세 로그" }],
      })
    ).toBe(false);
  });

  test("archiveId가 없으면 기본적으로 다시보기 불가다", () => {
    expect(hasBattleReplayArchive(null)).toBe(false);
  });
});
