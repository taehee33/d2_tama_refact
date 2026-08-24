import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NotificationCenterProvider } from "../../contexts/NotificationCenterContext";
import GlobalNotificationCenter from "./GlobalNotificationCenter";

const mockGetNotificationInbox = jest.fn();
const mockMarkNotificationsRead = jest.fn();
const mockNavigate = jest.fn();
const mockLocation = {
  pathname: "/play",
  search: "",
};
let mockCurrentUser = {
  uid: "user-1",
  getIdToken: jest.fn(),
};

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: mockCurrentUser,
  }),
}));

jest.mock("../../utils/notificationApi", () => ({
  getNotificationInbox: (...args) => mockGetNotificationInbox(...args),
  markNotificationsRead: (...args) => mockMarkNotificationsRead(...args),
}));

jest.mock("../../contexts/AblyContext", () => ({
  usePresenceContext: () => ({
    isChatOpen: false,
    setIsChatOpen: jest.fn(),
  }),
}));

jest.mock("react-router-dom", () => ({
  useLocation: () => mockLocation,
  useNavigate: () => mockNavigate,
}), { virtual: true });

function renderWithProvider(ui) {
  return render(
    <NotificationCenterProvider>
      {ui}
    </NotificationCenterProvider>
  );
}

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
          inApp: { status: "stored" },
          discord: { status: "sent" },
        },
      },
    ],
    ...overrides,
  };
}

describe("GlobalNotificationCenter", () => {
  beforeEach(() => {
    mockLocation.pathname = "/play";
    mockLocation.search = "";
    mockCurrentUser = {
      uid: "user-1",
      getIdToken: jest.fn(),
    };
    mockGetNotificationInbox.mockReset();
    mockMarkNotificationsRead.mockReset();
    mockNavigate.mockReset();
    mockMarkNotificationsRead.mockResolvedValue({
      notificationIds: ["n1"],
      markedCount: 1,
      readAt: Date.parse("2026-06-25T00:01:00.000Z"),
    });
  });

  test("모두확인 버튼으로 표시된 알림을 읽음 처리한다", async () => {
    mockGetNotificationInbox.mockResolvedValue(createStatus());

    renderWithProvider(<GlobalNotificationCenter />);

    expect(await screen.findByText("1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "알림" }));

    expect(await screen.findByRole("dialog", { name: "알림 목록" })).toBeInTheDocument();
    expect(mockMarkNotificationsRead).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "모두확인" }));
    await waitFor(() =>
      expect(mockMarkNotificationsRead).toHaveBeenCalledWith(
        mockCurrentUser,
        { notificationIds: ["n1"] }
      )
    );
    await waitFor(() => expect(screen.queryByText("1")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "모두확인" })).toBeDisabled();
  });

  test("알림 항목을 클릭하면 targetPath로 이동하고 패널을 닫는다", async () => {
    mockGetNotificationInbox.mockResolvedValue(createStatus({
      recentNotifications: [
        {
          ...createStatus().recentNotifications[0],
          readAt: Date.parse("2026-06-25T00:01:00.000Z"),
        },
      ],
    }));

    renderWithProvider(<GlobalNotificationCenter />);

    fireEvent.click(await screen.findByRole("button", { name: "알림" }));
    fireEvent.click(await screen.findByRole("button", {
      name: /자유게시판에 새 댓글이 달렸습니다/,
    }));

    expect(mockNavigate).toHaveBeenCalledWith("/community?board=free");
    expect(screen.queryByRole("dialog", { name: "알림 목록" })).not.toBeInTheDocument();
  });

  test("알림이 없으면 빈 상태를 표시한다", async () => {
    mockGetNotificationInbox.mockResolvedValue(createStatus({
      recentNotifications: [],
    }));

    renderWithProvider(<GlobalNotificationCenter />);

    fireEvent.click(screen.getByRole("button", { name: "알림" }));

    expect(await screen.findByText("새 알림이 없습니다.")).toBeInTheDocument();
  });

  test("readAt이 0인 알림도 읽은 상태로 처리한다", async () => {
    mockGetNotificationInbox.mockResolvedValue(createStatus({
      recentNotifications: [
        {
          ...createStatus().recentNotifications[0],
          readAt: 0,
        },
      ],
    }));

    renderWithProvider(<GlobalNotificationCenter />);

    await waitFor(() => expect(mockGetNotificationInbox).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  test("채널별 미연결 스킵 상태를 알림 항목에 표시한다", async () => {
    mockGetNotificationInbox.mockResolvedValue(createStatus({
      recentNotifications: [
        {
          ...createStatus().recentNotifications[0],
          readAt: Date.parse("2026-06-25T00:01:00.000Z"),
          channelState: {
            inApp: { status: "stored" },
            discord: { status: "skipped", reason: "missing_webhook" },
            webPush: { status: "skipped", reason: "missing_subscription" },
          },
        },
      ],
    }));

    renderWithProvider(<GlobalNotificationCenter />);

    fireEvent.click(await screen.findByRole("button", { name: "알림" }));

    expect(await screen.findByText("앱 알림함 · Discord 미연결 · 푸시 미연결")).toBeInTheDocument();
  });

  test("푸시 설정 누락 스킵 상태를 알림 항목에 표시한다", async () => {
    mockGetNotificationInbox.mockResolvedValue(createStatus({
      recentNotifications: [
        {
          ...createStatus().recentNotifications[0],
          readAt: Date.parse("2026-06-25T00:01:00.000Z"),
          channelState: {
            inApp: { status: "stored" },
            webPush: { status: "skipped", reason: "not_configured" },
          },
        },
      ],
    }));

    renderWithProvider(<GlobalNotificationCenter />);

    fireEvent.click(await screen.findByRole("button", { name: "알림" }));

    expect(await screen.findByText("앱 알림함 · 푸시 설정 누락")).toBeInTheDocument();
  });

  test("통합 전 Discord 전송 기록이 없는 알림은 기록 없음으로 표시한다", async () => {
    mockGetNotificationInbox.mockResolvedValue(createStatus({
      recentNotifications: [
        {
          ...createStatus().recentNotifications[0],
          readAt: Date.parse("2026-06-25T00:01:00.000Z"),
          channelState: {
            inApp: { status: "stored" },
            discord: { status: "skipped", reason: "not_requested" },
          },
        },
      ],
    }));

    renderWithProvider(<GlobalNotificationCenter />);

    fireEvent.click(await screen.findByRole("button", { name: "알림" }));

    expect(await screen.findByText("앱 알림함 · Discord 기록 없음")).toBeInTheDocument();
  });

  test("인증 화면에서는 렌더링하지 않는다", () => {
    mockLocation.pathname = "/auth";
    mockGetNotificationInbox.mockResolvedValue(createStatus());

    renderWithProvider(<GlobalNotificationCenter />);

    expect(screen.queryByRole("button", { name: "알림" })).not.toBeInTheDocument();
  });

  test("일반 게임 화면에서는 floating 알림을 렌더링하지 않는다", async () => {
    mockLocation.pathname = "/play/4";
    mockGetNotificationInbox.mockResolvedValue(createStatus());

    renderWithProvider(<GlobalNotificationCenter />);

    expect(screen.queryByRole("button", { name: "알림" })).not.toBeInTheDocument();
    await waitFor(() => expect(mockGetNotificationInbox).toHaveBeenCalled());
  });

  test("몰입형 게임 화면에서는 floating 알림을 렌더링하지 않는다", () => {
    mockLocation.pathname = "/play/4/full";
    mockGetNotificationInbox.mockResolvedValue(createStatus());

    renderWithProvider(<GlobalNotificationCenter />);

    expect(screen.queryByRole("button", { name: "알림" })).not.toBeInTheDocument();
  });

  test("초기 조회와 focus 및 열기 요청은 60초 캐시를 공유한다", async () => {
    mockGetNotificationInbox.mockResolvedValue(createStatus());
    renderWithProvider(<GlobalNotificationCenter />);

    expect(await screen.findByText("1")).toBeInTheDocument();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    fireEvent.click(screen.getByRole("button", { name: "알림" }));

    await waitFor(() => expect(mockGetNotificationInbox).toHaveBeenCalledTimes(1));
  });

  test("동시에 발생한 초기 조회와 focus 및 열기는 하나의 요청만 사용한다", async () => {
    let resolveInbox;
    mockGetNotificationInbox.mockImplementation(() => new Promise((resolve) => {
      resolveInbox = resolve;
    }));
    renderWithProvider(<GlobalNotificationCenter />);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    fireEvent.click(screen.getByRole("button", { name: "알림" }));
    expect(mockGetNotificationInbox).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveInbox(createStatus());
    });
    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  test("수동 새로고침은 60초 캐시를 무시한다", async () => {
    mockGetNotificationInbox.mockResolvedValue(createStatus());
    renderWithProvider(<GlobalNotificationCenter />);

    fireEvent.click(await screen.findByRole("button", { name: "알림" }));
    fireEvent.click(await screen.findByRole("button", { name: "새로고침" }));

    await waitFor(() => expect(mockGetNotificationInbox).toHaveBeenCalledTimes(2));
  });

  test("사용자 UID가 바뀌면 inbox 캐시를 초기화한다", async () => {
    let rejectSecondInbox;
    mockGetNotificationInbox
      .mockResolvedValueOnce(createStatus())
      .mockImplementationOnce(() => new Promise((resolve, reject) => {
        rejectSecondInbox = reject;
      }));
    const { rerender } = renderWithProvider(<GlobalNotificationCenter />);
    expect(await screen.findByText("1")).toBeInTheDocument();

    mockCurrentUser = {
      uid: "user-2",
      getIdToken: jest.fn(),
    };
    rerender(
      <NotificationCenterProvider>
        <GlobalNotificationCenter />
      </NotificationCenterProvider>
    );

    expect(screen.queryByText("1")).not.toBeInTheDocument();
    await waitFor(() => expect(mockGetNotificationInbox).toHaveBeenCalledTimes(2));
    expect(mockGetNotificationInbox.mock.calls[1][0].uid).toBe("user-2");

    await act(async () => {
      rejectSecondInbox(new Error("새 사용자 inbox 실패"));
    });
    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(mockMarkNotificationsRead).not.toHaveBeenCalled();
  });
});
