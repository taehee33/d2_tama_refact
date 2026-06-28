import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import GlobalNotificationCenter from "./GlobalNotificationCenter";

const mockGetNotificationStatus = jest.fn();
const mockMarkNotificationsRead = jest.fn();
const mockNavigate = jest.fn();
const mockLocation = {
  pathname: "/play/1",
  search: "",
};
const mockCurrentUser = {
  uid: "user-1",
  getIdToken: jest.fn(),
};

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: mockCurrentUser,
  }),
}));

jest.mock("../../utils/notificationApi", () => ({
  getNotificationStatus: (...args) => mockGetNotificationStatus(...args),
  markNotificationsRead: (...args) => mockMarkNotificationsRead(...args),
}));

jest.mock("react-router-dom", () => ({
  useLocation: () => mockLocation,
  useNavigate: () => mockNavigate,
}), { virtual: true });

function createStatus(overrides = {}) {
  return {
    recentNotifications: [
      {
        id: "n1",
        type: "community_comment",
        title: "자유게시판에 새 댓글이 달렸습니다.",
        body: '한솔님이 자유게시판의 "첫 글" 글에 댓글을 남겼습니다.',
        targetPath: "/community?board=free",
        readAt: null,
        createdAt: Date.parse("2026-06-25T00:00:00.000Z"),
        channelState: {
          discord: { status: "sent" },
        },
      },
    ],
    ...overrides,
  };
}

describe("GlobalNotificationCenter", () => {
  beforeEach(() => {
    mockLocation.pathname = "/play/1";
    mockLocation.search = "";
    mockGetNotificationStatus.mockReset();
    mockMarkNotificationsRead.mockReset();
    mockNavigate.mockReset();
    mockMarkNotificationsRead.mockResolvedValue({
      notificationIds: ["n1"],
      markedCount: 1,
      readAt: Date.parse("2026-06-25T00:01:00.000Z"),
    });
  });

  test("읽지 않은 알림이 있으면 배지를 표시하고 패널 열림 시 읽음 처리한다", async () => {
    mockGetNotificationStatus
      .mockResolvedValueOnce(createStatus())
      .mockResolvedValueOnce(createStatus({
        recentNotifications: [
          {
            ...createStatus().recentNotifications[0],
            readAt: Date.parse("2026-06-25T00:01:00.000Z"),
          },
        ],
      }));

    render(<GlobalNotificationCenter />);

    expect(await screen.findByText("1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "알림" }));

    expect(await screen.findByRole("dialog", { name: "알림 목록" })).toBeInTheDocument();
    await waitFor(() =>
      expect(mockMarkNotificationsRead).toHaveBeenCalledWith(
        mockCurrentUser,
        { allVisible: true }
      )
    );
    await waitFor(() => expect(screen.queryByText("1")).not.toBeInTheDocument());
  });

  test("알림 항목을 클릭하면 targetPath로 이동하고 패널을 닫는다", async () => {
    mockGetNotificationStatus.mockResolvedValue(createStatus({
      recentNotifications: [
        {
          ...createStatus().recentNotifications[0],
          readAt: Date.parse("2026-06-25T00:01:00.000Z"),
        },
      ],
    }));

    render(<GlobalNotificationCenter />);

    fireEvent.click(await screen.findByRole("button", { name: "알림" }));
    fireEvent.click(await screen.findByRole("button", {
      name: /자유게시판에 새 댓글이 달렸습니다/,
    }));

    expect(mockNavigate).toHaveBeenCalledWith("/community?board=free");
    expect(screen.queryByRole("dialog", { name: "알림 목록" })).not.toBeInTheDocument();
  });

  test("알림이 없으면 빈 상태를 표시한다", async () => {
    mockGetNotificationStatus.mockResolvedValue(createStatus({
      recentNotifications: [],
    }));

    render(<GlobalNotificationCenter />);

    fireEvent.click(screen.getByRole("button", { name: "알림" }));

    expect(await screen.findByText("새 알림이 없습니다.")).toBeInTheDocument();
  });

  test("채널별 전송 스킵 상태를 알림 항목에 표시한다", async () => {
    mockGetNotificationStatus.mockResolvedValue(createStatus({
      recentNotifications: [
        {
          ...createStatus().recentNotifications[0],
          readAt: Date.parse("2026-06-25T00:01:00.000Z"),
          channelState: {
            inApp: { status: "stored" },
            discord: { status: "skipped", reason: "webhook_missing" },
            webPush: { status: "skipped", reason: "no_active_subscription" },
          },
        },
      ],
    }));

    render(<GlobalNotificationCenter />);

    fireEvent.click(await screen.findByRole("button", { name: "알림" }));

    expect(await screen.findByText("앱 알림함 · Discord 미연결 · 푸시 미연결")).toBeInTheDocument();
  });

  test("인증 화면에서는 렌더링하지 않는다", () => {
    mockLocation.pathname = "/auth";
    mockGetNotificationStatus.mockResolvedValue(createStatus());

    render(<GlobalNotificationCenter />);

    expect(screen.queryByRole("button", { name: "알림" })).not.toBeInTheDocument();
  });
});
