import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UserDirectoryPanel from "./UserDirectoryPanel";

const mockFetchArenaUserDirectory = jest.fn();
const mockSetArenaUserOperatorRole = jest.fn();

jest.mock("../../utils/arenaApi", () => ({
  fetchArenaUserDirectory: (...args) => mockFetchArenaUserDirectory(...args),
  setArenaUserOperatorRole: (...args) => mockSetArenaUserOperatorRole(...args),
}));

function createCurrentUser(overrides = {}) {
  return {
    uid: "operator-1",
    email: "operator@example.com",
    getIdToken: jest.fn().mockResolvedValue("token"),
    ...overrides,
  };
}

describe("UserDirectoryPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn().mockReturnValue(true);
  });

  test("마지막 운영자 해제 버튼은 비활성화된다", async () => {
    mockFetchArenaUserDirectory.mockResolvedValue({
      summary: {
        totalUsers: 1,
        operatorCount: 1,
        generalUserCount: 0,
      },
      recentEvents: [],
      users: [
        {
          uid: "operator-1",
          tamerName: "운영자",
          email: "operator@example.com",
          displayName: "Operator",
          achievementCount: 3,
          maxSlots: 10,
          updatedAt: "2026-04-12T10:00:00.000Z",
          createdAt: "2026-04-10T10:00:00.000Z",
          roleUpdatedAt: "2026-04-12T11:00:00.000Z",
          isOperator: true,
          roleLabel: "운영자",
        },
      ],
    });

    render(<UserDirectoryPanel currentUser={createCurrentUser()} />);

    expect(await screen.findByText("마지막 운영자는 해제할 수 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "운영자 해제" })).toBeDisabled();
  });

  test("일반 사용자를 운영자로 지정하면 권한 변경 API를 호출하고 목록을 다시 불러온다", async () => {
    mockFetchArenaUserDirectory
      .mockResolvedValueOnce({
        summary: {
          totalUsers: 2,
          operatorCount: 1,
          generalUserCount: 1,
        },
        recentEvents: [
          {
            id: "event-1",
            targetUid: "user-1",
            targetEmail: "user@example.com",
            targetName: "일반 사용자",
            actedBy: "operator-1",
            actedByEmail: "operator@example.com",
            actedByName: "운영자",
            beforeIsOperator: false,
            afterIsOperator: true,
            actedAt: "2026-04-12T12:00:00.000Z",
            source: "user-directory",
            actionLabel: "운영자 지정",
          },
        ],
        users: [
          {
            uid: "operator-1",
            tamerName: "운영자",
            email: "operator@example.com",
            displayName: "Operator",
            achievementCount: 3,
            maxSlots: 10,
            updatedAt: "2026-04-12T10:00:00.000Z",
            createdAt: "2026-04-10T10:00:00.000Z",
            roleUpdatedAt: "2026-04-12T11:00:00.000Z",
            isOperator: true,
            roleLabel: "운영자",
          },
          {
            uid: "user-1",
            tamerName: "일반 사용자",
            email: "user@example.com",
            displayName: "User",
            achievementCount: 1,
            maxSlots: 10,
            updatedAt: "2026-04-11T10:00:00.000Z",
            createdAt: "2026-04-09T10:00:00.000Z",
            roleUpdatedAt: null,
            isOperator: false,
            roleLabel: "일반",
          },
        ],
      })
      .mockResolvedValueOnce({
        summary: {
          totalUsers: 2,
          operatorCount: 2,
          generalUserCount: 0,
        },
        recentEvents: [
          {
            id: "event-2",
            targetUid: "user-1",
            targetEmail: "user@example.com",
            targetName: "일반 사용자",
            actedBy: "operator-1",
            actedByEmail: "operator@example.com",
            actedByName: "운영자",
            beforeIsOperator: false,
            afterIsOperator: true,
            actedAt: "2026-04-12T12:30:00.000Z",
            source: "user-directory",
            actionLabel: "운영자 지정",
          },
        ],
        users: [
          {
            uid: "operator-1",
            tamerName: "운영자",
            email: "operator@example.com",
            displayName: "Operator",
            achievementCount: 3,
            maxSlots: 10,
            updatedAt: "2026-04-12T10:00:00.000Z",
            createdAt: "2026-04-10T10:00:00.000Z",
            roleUpdatedAt: "2026-04-12T11:00:00.000Z",
            isOperator: true,
            roleLabel: "운영자",
          },
          {
            uid: "user-1",
            tamerName: "일반 사용자",
            email: "user@example.com",
            displayName: "User",
            achievementCount: 1,
            maxSlots: 10,
            updatedAt: "2026-04-11T10:00:00.000Z",
            createdAt: "2026-04-09T10:00:00.000Z",
            roleUpdatedAt: "2026-04-12T12:00:00.000Z",
            isOperator: true,
            roleLabel: "운영자",
          },
        ],
      });
    mockSetArenaUserOperatorRole.mockResolvedValue({
      uid: "user-1",
      isOperator: true,
    });

    const currentUser = createCurrentUser();
    render(<UserDirectoryPanel currentUser={currentUser} />);

    fireEvent.click(await screen.findByRole("button", { name: "운영자 지정" }));

    await waitFor(() =>
      expect(mockSetArenaUserOperatorRole).toHaveBeenCalledWith(currentUser, {
        targetUid: "user-1",
        isOperator: true,
      })
    );
    await waitFor(() => expect(mockFetchArenaUserDirectory).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "운영자 지정" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "운영자 해제" })).toHaveLength(2);
    expect(screen.getByText("최근 권한 변경")).toBeInTheDocument();
    expect(screen.getByText("운영자 지정")).toBeInTheDocument();
    expect(screen.getByText("변경 전 / 후")).toBeInTheDocument();
  });
});
