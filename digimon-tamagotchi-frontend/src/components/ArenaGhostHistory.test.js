import { getArenaArchiveUi } from "./ArenaGhostHistory";
import {
  buildArenaHistoryFilters,
  filterArenaBattleHistory,
  normalizeArenaBattleSummary,
} from "../hooks/useArenaBattleHistory";

describe("Arena Ghost 배틀 기록", () => {
  test("V2 immutable snapshot을 화면 요약으로 정규화한다", () => {
    const summary = normalizeArenaBattleSummary({
      id: "battle-1",
      attackerId: "user-1",
      attackerSnapshot: { digimonName: "그레이몬", sprite: 2 },
      defenderGhostSnapshot: { digimonName: "엔젤몬", sprite: 3 },
      defenderGhostId: "ghost-old",
      archiveId: "battle-1",
      archiveStatus: "pending",
      timestamp: { toDate: () => new Date("2026-07-22T00:00:00Z") },
    }, "user-1");

    expect(summary).toEqual(expect.objectContaining({
      battleId: "battle-1",
      isAttack: true,
      attackerName: "그레이몬",
      defenderName: "엔젤몬",
      archiveStatus: "pending",
    }));
  });

  test("현재 목록에 없는 Ghost도 삭제된 기록 필터로 보존한다", () => {
    const logs = [
      { battleId: "a", defenderGhostId: "ghost-live", defenderName: "엔젤몬" },
      { battleId: "b", defenderGhostId: "ghost-deleted", defenderName: "가루다몬" },
    ];
    const filters = buildArenaHistoryFilters(logs, [{ ghostId: "ghost-live" }], "combat-current");

    expect(filters.map((item) => item.label)).toEqual(expect.arrayContaining([
      "현재 연결 · 공격 기록",
      "엔젤몬 · 내 Ghost",
      "가루다몬 · 삭제된 Ghost 또는 이전 아레나 기록",
    ]));
    expect(filterArenaBattleHistory(logs, "ghost:ghost-deleted")).toEqual([logs[1]]);
  });

  test("archive 상태별 안내를 구분한다", () => {
    expect(getArenaArchiveUi("ready")).toEqual(expect.objectContaining({ disabled: false, label: "상세 기록 보기" }));
    expect(getArenaArchiveUi("pending").label).toBe("상세 기록 준비 중");
    expect(getArenaArchiveUi("failed").label).toBe("요약만 확인 가능");
  });
});
