import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NotificationCenterProvider } from "../../contexts/NotificationCenterContext";
import GameNotificationAction from "./GameNotificationAction";

const mockGetNotificationStatus = jest.fn();
const mockMarkNotificationsRead = jest.fn();
const mockSetIsChatOpen = jest.fn();
const mockNavigate = jest.fn();
const mockLocation = {
  pathname: "/play/4",
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

jest.mock("../../contexts/AblyContext", () => ({
  usePresenceContext: () => ({
    isChatOpen: true,
    setIsChatOpen: mockSetIsChatOpen,
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
        title: "새 알림",
        body: "확인할 내용이 있습니다.",
        targetPath: "/play",
        readAt: null,
        createdAt: Date.parse("2026-06-25T00:00:00.000Z"),
        channelState: {},
      },
    ],
    ...overrides,
  };
}

function renderAction() {
  return render(
    <NotificationCenterProvider>
      <GameNotificationAction />
    </NotificationCenterProvider>
  );
}

describe("GameNotificationAction", () => {
  beforeEach(() => {
    mockLocation.pathname = "/play/4";
    mockGetNotificationStatus.mockReset();
    mockMarkNotificationsRead.mockReset();
    mockSetIsChatOpen.mockReset();
    mockNavigate.mockReset();
    mockGetNotificationStatus.mockResolvedValue(createStatus());
    mockMarkNotificationsRead.mockResolvedValue({
      notificationIds: ["n1"],
      markedCount: 1,
      readAt: Date.now(),
    });
  });

  test("일반 게임 화면 toolbar 알림 버튼과 unread count를 렌더링한다", async () => {
    renderAction();

    expect(await screen.findByText("1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "알림" })).toBeInTheDocument();
  });

  test("알림을 열면 채팅 패널을 닫고 알림 패널을 표시한다", async () => {
    renderAction();

    fireEvent.click(await screen.findByRole("button", { name: "알림" }));

    expect(mockSetIsChatOpen).toHaveBeenCalledWith(false);
    expect(await screen.findByRole("dialog", { name: "알림 목록" })).toBeInTheDocument();
    await waitFor(() => expect(mockMarkNotificationsRead).toHaveBeenCalled());
  });

  test("서비스 화면에서는 toolbar 알림 액션을 렌더링하지 않는다", async () => {
    mockLocation.pathname = "/play";

    renderAction();

    expect(screen.queryByRole("button", { name: "알림" })).not.toBeInTheDocument();
    await waitFor(() => expect(mockGetNotificationStatus).toHaveBeenCalled());
  });
});
