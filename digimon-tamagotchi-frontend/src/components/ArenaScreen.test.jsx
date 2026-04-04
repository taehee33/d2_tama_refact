import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ArenaScreen, {
  getLeaderboardStats,
  getBattleReplayUiState,
  hasBattleReplayArchive,
  normalizeArenaLeaderboardEntry,
} from "./ArenaScreen";

const mockUseAuth = jest.fn();
const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockGetTamerName = jest.fn();
const mockGetArenaBattleReplay = jest.fn();

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../firebase", () => ({
  db: {},
}));

jest.mock("../utils/tamerNameUtils", () => ({
  getTamerName: (...args) => mockGetTamerName(...args),
}));

jest.mock("../utils/logArchiveApi", () => ({
  getArenaBattleReplay: (...args) => mockGetArenaBattleReplay(...args),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((...args) => ({ type: "collection", args })),
  getDocs: (...args) => mockGetDocs(...args),
  query: jest.fn((...args) => ({ type: "query", args })),
  where: jest.fn((...args) => ({ type: "where", args })),
  orderBy: jest.fn((...args) => ({ type: "orderBy", args })),
  addDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn((...args) => ({ type: "doc", args })),
  serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
  limit: jest.fn((...args) => ({ type: "limit", args })),
  getDoc: (...args) => mockGetDoc(...args),
}));

function createMockDoc(id, data) {
  return {
    id,
    data: () => data,
  };
}

function createMockTimestamp(isoString) {
  return {
    toDate: () => new Date(isoString),
  };
}

function queueArenaScreenLoad(logDocs) {
  mockGetDocs
    .mockResolvedValueOnce({ docs: [] })
    .mockResolvedValueOnce({ docs: [] })
    .mockResolvedValueOnce({ docs: [] })
    .mockResolvedValueOnce({ docs: [] })
    .mockResolvedValueOnce({ docs: [] })
    .mockResolvedValueOnce({ docs: logDocs })
    .mockResolvedValueOnce({ docs: [] });
}

function renderArenaScreen() {
  return render(
    <ArenaScreen
      onClose={jest.fn()}
      onStartBattle={jest.fn()}
      currentSlotId={null}
    />
  );
}

describe("ArenaScreen replay 상태", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.scrollTo = jest.fn();

    mockUseAuth.mockReturnValue({
      currentUser: {
        uid: "user-1",
        displayName: "테스터",
      },
      isFirebaseAvailable: true,
    });

    mockGetTamerName.mockResolvedValue("테스터");
    mockGetArenaBattleReplay.mockResolvedValue({
      replayLogs: [{ message: "첫 타격", attacker: "user", hit: true }],
    });
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });
  });

  test("archiveId가 있으면 다시보기 가능으로 판단한다", () => {
    expect(hasBattleReplayArchive({ archiveId: "arena_1" })).toBe(true);
    expect(getBattleReplayUiState({ archiveId: "arena_1" })).toEqual({
      status: "available",
      hasReplay: true,
      badge: null,
      description: "📖 배틀 로그 다시보기",
    });
  });

  test("archiveId가 없으면 구버전 로그 상태로 판단한다", () => {
    expect(
      getBattleReplayUiState({
        logs: [{ type: "ATTACK", text: "이전 Firestore 상세 로그" }],
      })
    ).toEqual({
      status: "legacy",
      hasReplay: false,
      badge: "구버전 로그",
      description: "이 기록은 이전 저장 방식으로 생성되어 상세 다시보기를 지원하지 않습니다.",
    });
    expect(hasBattleReplayArchive(null)).toBe(false);
  });

  test("archiveStatus가 failed이면 다시보기를 숨기고 실패 배지를 표시한다", () => {
    expect(hasBattleReplayArchive({ archiveId: "arena_2", archiveStatus: "failed" })).toBe(false);
    expect(
      getBattleReplayUiState({ archiveId: "arena_2", archiveStatus: "failed" })
    ).toEqual({
      status: "failed",
      hasReplay: false,
      badge: "보관 실패",
      description: "상세 다시보기를 저장하지 못해 요약 로그만 확인할 수 있습니다.",
    });
  });

  test("archiveId 없는 로그는 구버전 안내를 표시하고 클릭해도 다시보기 모달이 열리지 않는다", async () => {
    queueArenaScreenLoad([
      createMockDoc("legacy-log", {
        attackerId: "user-1",
        attackerName: "테스터",
        attackerDigimonName: "Agumon",
        defenderId: "user-2",
        defenderName: "상대",
        defenderDigimonName: "Gabumon",
        winnerId: "user-1",
        timestamp: createMockTimestamp("2026-04-04T10:00:00.000Z"),
      }),
    ]);

    renderArenaScreen();

    await waitFor(() => expect(screen.getByText("테이머: 테스터")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "배틀 로그" }));

    await waitFor(() => expect(screen.getByText("구버전 로그")).toBeInTheDocument());
    expect(
      screen.getByText("이 기록은 이전 저장 방식으로 생성되어 상세 다시보기를 지원하지 않습니다.")
    ).toBeInTheDocument();
    expect(screen.queryByText("📖 배틀 로그 다시보기")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("battle-log-card-legacy-log"));

    expect(screen.queryByText("배틀 로그 리뷰")).not.toBeInTheDocument();
    expect(mockGetArenaBattleReplay).not.toHaveBeenCalled();
  });

  test("archiveId 있는 로그는 다시보기 문구를 표시하고 클릭 시 모달을 연다", async () => {
    queueArenaScreenLoad([
      createMockDoc("archive-log", {
        archiveId: "arena_archive_1",
        attackerId: "user-1",
        attackerName: "테스터",
        attackerDigimonName: "Agumon",
        defenderId: "user-2",
        defenderName: "상대",
        defenderDigimonName: "Gabumon",
        winnerId: "user-1",
        timestamp: createMockTimestamp("2026-04-04T10:00:00.000Z"),
      }),
    ]);

    renderArenaScreen();

    await waitFor(() => expect(screen.getByText("테이머: 테스터")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "배틀 로그" }));

    await waitFor(() => expect(screen.getByText("📖 배틀 로그 다시보기")).toBeInTheDocument());
    expect(screen.queryByText("구버전 로그")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("battle-log-card-archive-log"));

    await waitFor(() => expect(screen.getByText("배틀 로그 리뷰")).toBeInTheDocument());
    await waitFor(() =>
      expect(mockGetArenaBattleReplay).toHaveBeenCalledWith(
        expect.objectContaining({ uid: "user-1" }),
        "arena_archive_1"
      )
    );
  });
});

describe("ArenaScreen 리더보드 DTO 정규화", () => {
  test("과거 시즌의 평탄한 archive 엔트리를 현재 DTO로 정규화한다", () => {
    const normalizedEntry = normalizeArenaLeaderboardEntry(
      {
        id: "season_1_user_1",
        tamerName: "테스터",
        digimonName: "Agumon",
        seasonWins: 9,
        seasonLosses: 2,
        wins: 14,
        losses: 4,
      },
      2
    );

    expect(normalizedEntry).toMatchObject({
      id: "season_1_user_1",
      tamerName: "테스터",
      digimonSnapshot: {
        digimonId: "Agumon",
        digimonName: "Agumon",
      },
      record: {
        wins: 14,
        losses: 4,
        seasonWins: 9,
        seasonLosses: 2,
        seasonId: 2,
      },
    });
  });

  test("현재 시즌과 전체 누적 모드가 서로 다른 record 필드를 사용한다", () => {
    const entry = normalizeArenaLeaderboardEntry({
      tamerName: "테스터",
      digimonSnapshot: {
        digimonName: "Agumon",
      },
      record: {
        wins: 20,
        losses: 10,
        seasonWins: 3,
        seasonLosses: 1,
        seasonId: 5,
      },
    });

    expect(getLeaderboardStats(entry, "current")).toMatchObject({
      wins: 3,
      losses: 1,
      winRate: 75,
    });
    expect(getLeaderboardStats(entry, "past")).toMatchObject({
      wins: 3,
      losses: 1,
      winRate: 75,
    });
    expect(getLeaderboardStats(entry, "all")).toMatchObject({
      wins: 20,
      losses: 10,
      winRate: 67,
    });
  });
});
