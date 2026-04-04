import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminModal from "./AdminModal";

const mockUseAuth = jest.fn();
const mockGetDocs = jest.fn();
const mockSaveArenaAdminConfig = jest.fn();
const mockEndArenaSeason = jest.fn();
const mockDeleteArenaArchive = jest.fn();
const mockFetchArenaArchiveMonitoring = jest.fn();

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../firebase", () => ({
  db: {},
}));

jest.mock("../utils/arenaApi", () => ({
  saveArenaAdminConfig: (...args) => mockSaveArenaAdminConfig(...args),
  endArenaSeason: (...args) => mockEndArenaSeason(...args),
  deleteArenaArchive: (...args) => mockDeleteArenaArchive(...args),
  fetchArenaArchiveMonitoring: (...args) => mockFetchArenaArchiveMonitoring(...args),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((...args) => ({ type: "collection", args })),
  getDocs: (...args) => mockGetDocs(...args),
  orderBy: jest.fn((...args) => ({ type: "orderBy", args })),
  query: jest.fn((...args) => ({ type: "query", args })),
}));

function createMockDoc(id, data) {
  return {
    id,
    data: () => data,
  };
}

function renderAdminModal(props = {}) {
  return render(
    <AdminModal
      onClose={jest.fn()}
      currentSeasonId={2}
      seasonName="Season 2"
      seasonDuration="2026.04.01 ~ 04.30"
      onConfigUpdated={jest.fn()}
      {...props}
    />
  );
}

describe("AdminModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      currentUser: {
        uid: "admin-1",
        email: "admin@example.com",
        getIdToken: jest.fn().mockResolvedValue("token"),
      },
    });
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockFetchArenaArchiveMonitoring.mockResolvedValue({
      summary: {
        windowHours: 24,
        sources: {
          arena_archive_post: {
            counts: {
              success: 3,
              bad_request: 0,
              forbidden: 0,
              not_found: 0,
              error: 1,
            },
            totalCount: 4,
            failureCount: 1,
            lastSuccessAt: "2026-04-04T08:00:00.000Z",
            lastFailureAt: "2026-04-04T09:00:00.000Z",
          },
          arena_replay_get: {
            counts: {
              success: 4,
              bad_request: 1,
              forbidden: 0,
              not_found: 2,
              error: 0,
            },
            totalCount: 7,
            failureCount: 3,
            lastSuccessAt: "2026-04-04T10:00:00.000Z",
            lastFailureAt: "2026-04-04T11:00:00.000Z",
          },
          jogress_archive_post: {
            counts: {
              success: 2,
              bad_request: 0,
              forbidden: 1,
              not_found: 0,
              error: 0,
            },
            totalCount: 3,
            failureCount: 1,
            lastSuccessAt: "2026-04-04T12:00:00.000Z",
            lastFailureAt: "2026-04-04T13:00:00.000Z",
          },
        },
      },
      events: [
        {
          id: "monitor-1",
          source: "arena_replay_get",
          outcome: "not_found",
          statusCode: 404,
          archiveId: "arena-404",
          errorMessage: "배틀 다시보기를 찾을 수 없습니다.",
          createdAt: "2026-04-04T11:00:00.000Z",
        },
      ],
    });
  });

  test("시즌 설정 저장 시 관리자 API를 호출한다", async () => {
    const onConfigUpdated = jest.fn();
    mockSaveArenaAdminConfig.mockResolvedValue({
      currentSeasonId: 3,
      seasonName: "Season 3",
      seasonDuration: "2026.05.01 ~ 05.31",
    });
    window.alert = jest.fn();

    renderAdminModal({ onConfigUpdated });

    fireEvent.change(screen.getByLabelText("현재 시즌 ID"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("시즌 이름"), {
      target: { value: "Season 3" },
    });
    fireEvent.change(screen.getByLabelText("시즌 기간"), {
      target: { value: "2026.05.01 ~ 05.31" },
    });

    fireEvent.click(screen.getByRole("button", { name: "시즌 설정 저장" }));

    await waitFor(() =>
      expect(mockSaveArenaAdminConfig).toHaveBeenCalledWith(
        expect.objectContaining({ uid: "admin-1" }),
        {
          currentSeasonId: 3,
          seasonName: "Season 3",
          seasonDuration: "2026.05.01 ~ 05.31",
        }
      )
    );
    expect(onConfigUpdated).toHaveBeenCalledWith({
      currentSeasonId: 3,
      seasonName: "Season 3",
      seasonDuration: "2026.05.01 ~ 05.31",
    });
  });

  test("확인 문구가 맞으면 시즌 종료 API를 호출한다", async () => {
    const onConfigUpdated = jest.fn();
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        createMockDoc("entry-1", {
          tamerName: "테스터",
          digimonSnapshot: { digimonName: "Agumon" },
          record: {
            wins: 4,
            losses: 2,
            seasonWins: 2,
            seasonLosses: 1,
            seasonId: 2,
          },
        }),
      ],
    });
    mockEndArenaSeason.mockResolvedValue({
      archivedEntryCount: 1,
      currentSeasonId: 3,
      seasonName: "Season 3",
      seasonDuration: "2026.05.01 ~ 05.31",
    });
    window.alert = jest.fn();

    renderAdminModal({ onConfigUpdated });

    fireEvent.change(screen.getByLabelText("확인 문구 입력"), {
      target: { value: "SEASON 2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "시즌 종료 및 아카이브" }));

    await waitFor(() =>
      expect(mockEndArenaSeason).toHaveBeenCalledWith(
        expect.objectContaining({ uid: "admin-1" }),
        expect.objectContaining({
          currentSeasonId: 2,
          seasonName: "Season 2",
          seasonDuration: "2026.04.01 ~ 04.30",
        })
      )
    );
    expect(onConfigUpdated).toHaveBeenCalledWith({
      currentSeasonId: 3,
      seasonName: "Season 3",
      seasonDuration: "2026.05.01 ~ 05.31",
    });
  });

  test("아카이브 탭에서 soft delete API를 호출한다", async () => {
    mockGetDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          createMockDoc("season_2", {
            seasonId: 2,
            seasonName: "Season 2",
            seasonDuration: "2026.04.01 ~ 04.30",
            entryCount: 10,
            isDeleted: false,
          }),
        ],
      })
      .mockResolvedValueOnce({ docs: [] });
    mockDeleteArenaArchive.mockResolvedValue({
      id: "season_2",
      isDeleted: true,
    });
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);

    renderAdminModal();

    fireEvent.click(screen.getByRole("button", { name: "아카이브" }));

    await waitFor(() => expect(screen.getByText("Season 2")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "소프트 삭제" }));

    await waitFor(() =>
      expect(mockDeleteArenaArchive).toHaveBeenCalledWith(
        expect.objectContaining({ uid: "admin-1" }),
        "season_2"
      )
    );
  });

  test("로그 관측 탭에서 요약 카드와 최근 이벤트를 표시한다", async () => {
    renderAdminModal();

    fireEvent.click(screen.getByRole("button", { name: "로그 관측" }));

    await waitFor(() =>
      expect(mockFetchArenaArchiveMonitoring).toHaveBeenCalledWith(
        expect.objectContaining({ uid: "admin-1" }),
        {
          hours: 24,
          limit: 50,
        }
      )
    );

    expect(screen.getByText("아레나 archive")).toBeInTheDocument();
    expect(screen.getByText("아레나 replay")).toBeInTheDocument();
    expect(screen.getByText("조그레스 archive")).toBeInTheDocument();
    expect(screen.getByText("최신 이벤트 50건")).toBeInTheDocument();
    expect(screen.getByText("배틀 다시보기를 찾을 수 없습니다.")).toBeInTheDocument();
  });
});
