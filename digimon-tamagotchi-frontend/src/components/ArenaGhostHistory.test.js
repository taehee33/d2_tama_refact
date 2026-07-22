import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ArenaGhostHistory, { getArenaArchiveUi } from "./ArenaGhostHistory";
import {
  ARENA_HISTORY_PAGE_SIZE,
  buildArenaHistoryFilters,
  filterArenaBattleHistory,
  normalizeArenaBattleSummary,
  takeNextArenaHistoryPage,
  useArenaBattleHistory,
} from "../hooks/useArenaBattleHistory";

jest.mock("../hooks/useArenaBattleHistory", () => {
  const actual = jest.requireActual("../hooks/useArenaBattleHistory");
  return {
    ...actual,
    useArenaBattleHistory: jest.fn(),
  };
});

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

  test("공격·방어 기록을 시간순으로 병합해 최근 5건만 선택한다", () => {
    const createLog = (battleId, timestamp) => ({ battleId, occurredAt: new Date(timestamp) });
    const seenBattleIds = new Set();
    const result = takeNextArenaHistoryPage({
      attackQueue: [
        createLog("attack-5", "2026-07-22T05:00:00Z"),
        createLog("attack-3", "2026-07-22T03:00:00Z"),
        createLog("attack-1", "2026-07-22T01:00:00Z"),
      ],
      defenseQueue: [
        createLog("defense-4", "2026-07-22T04:00:00Z"),
        createLog("defense-2", "2026-07-22T02:00:00Z"),
        createLog("defense-0", "2026-07-22T00:00:00Z"),
      ],
      seenBattleIds,
    });

    expect(ARENA_HISTORY_PAGE_SIZE).toBe(5);
    expect(result.page.map((log) => log.battleId)).toEqual([
      "attack-5",
      "defense-4",
      "attack-3",
      "defense-2",
      "attack-1",
    ]);
    expect(result.defenseQueue.map((log) => log.battleId)).toEqual(["defense-0"]);
  });

  test("이미 표시한 battleId는 다음 페이지에서 중복 추가하지 않는다", () => {
    const duplicate = { battleId: "same-battle", occurredAt: new Date("2026-07-22T05:00:00Z") };
    const result = takeNextArenaHistoryPage({
      attackQueue: [duplicate],
      defenseQueue: [duplicate, { battleId: "defense-next", occurredAt: new Date("2026-07-22T04:00:00Z") }],
      seenBattleIds: new Set(),
    });

    expect(result.page.map((log) => log.battleId)).toEqual(["same-battle", "defense-next"]);
  });

  test("최근 기록 안내와 더보기 버튼을 표시하고 다음 페이지를 요청한다", () => {
    const loadMore = jest.fn();
    useArenaBattleHistory.mockReturnValue({
      logs: [{
        battleId: "battle-1",
        attackerName: "엔젤몬",
        defenderName: "안드로몬",
        isAttack: true,
        occurredAt: new Date("2026-07-22T05:00:00Z"),
        archiveStatus: "pending",
      }],
      loading: false,
      loadingMore: false,
      hasMore: true,
      error: "",
      refresh: jest.fn(),
      loadMore,
    });

    render(
      <ArenaGhostHistory
        currentUser={{ uid: "user-1" }}
        isOnline
        myGhosts={[]}
        currentCombatIdentityId="combat-1"
      />
    );

    expect(screen.getByText("최근 기록부터 5개씩 불러옵니다.")).toBeInTheDocument();
    expect(screen.getByText("엔젤몬 vs 안드로몬")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "기록 더보기" }));
    expect(loadMore).toHaveBeenCalledTimes(1);
  });
});
