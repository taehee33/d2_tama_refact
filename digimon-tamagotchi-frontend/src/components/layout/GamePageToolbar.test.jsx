import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import GamePageToolbar from "./GamePageToolbar";

const mockSetIsChatOpen = jest.fn();
const mockCloseNotification = jest.fn();

jest.mock("../../contexts/AblyContext", () => ({
  usePresenceContext: () => ({
    isChatOpen: false,
    setIsChatOpen: mockSetIsChatOpen,
    presenceCount: 3,
  }),
}));

jest.mock("../../contexts/NotificationCenterContext", () => ({
  useNotificationCenter: () => ({
    closeNotification: mockCloseNotification,
  }),
}));

jest.mock("../notifications/GameNotificationAction", () => () => (
  <button type="button" aria-label="알림">알림</button>
));

function buildProps(overrides = {}) {
  return {
    currentUser: {
      displayName: "테이머",
      email: "tamer@example.com",
      photoURL: "",
    },
    isFirebaseAvailable: true,
    tamerName: "용사",
    hasVer1Master: true,
    hasVer2Master: false,
    showProfileMenu: false,
    onToggleProfileMenu: jest.fn(),
    onCloseProfileMenu: jest.fn(),
    onOpenAccountSettings: jest.fn(),
    onOpenSettings: jest.fn(),
    onOpenPlayHub: jest.fn(),
    onOpenImmersiveView: jest.fn(),
    onlineUsersNode: <div>접속자 3명</div>,
    ...overrides,
  };
}

describe("GamePageToolbar", () => {
  beforeEach(() => {
    mockSetIsChatOpen.mockReset();
    mockCloseNotification.mockReset();
  });

  test("모바일 툴바는 핵심 액션 4개를 우선 렌더링하고 보조 액션은 더보기로 이동한다", () => {
    const props = buildProps();
    render(<GamePageToolbar {...props} isMobile />);

    expect(screen.getByText("← 허브")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /채팅 열기/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "알림" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "더보기" })).toBeInTheDocument();
    expect(screen.queryByText("접속자 3명")).not.toBeInTheDocument();
    expect(screen.queryByText("몰입형 플레이")).not.toBeInTheDocument();
    expect(screen.queryByText("설정")).not.toBeInTheDocument();
    expect(screen.getByText("테이머: 용사")).toBeInTheDocument();
    expect(screen.getAllByText("👑 Ver.1")).toHaveLength(1);

    fireEvent.click(screen.getByText("← 허브"));
    fireEvent.click(screen.getByRole("button", { name: /채팅 열기/ }));
    fireEvent.click(screen.getByRole("button", { name: "더보기" }));

    expect(screen.getByText("접속자 3명")).toBeInTheDocument();
    fireEvent.click(screen.getByText("몰입형 플레이"));
    fireEvent.click(screen.getByRole("button", { name: "더보기" }));
    fireEvent.click(screen.getByText("설정"));

    expect(props.onOpenPlayHub).toHaveBeenCalledTimes(1);
    expect(mockCloseNotification).toHaveBeenCalled();
    expect(mockSetIsChatOpen).toHaveBeenCalledWith(true);
    expect(props.onOpenImmersiveView).toHaveBeenCalledTimes(1);
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  test("데스크톱 툴바는 드롭다운 메뉴를 열고 계정 설정 액션을 호출한다", () => {
    const props = buildProps({
      showProfileMenu: true,
    });
    render(<GamePageToolbar {...props} />);

    expect(screen.getByText("몰입형 플레이")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /채팅 열기/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "알림" })).toBeInTheDocument();
    expect(screen.getAllByText("테이머: 용사").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("계정 설정/로그아웃")[0]).toBeInTheDocument();

    fireEvent.click(screen.getByText("← 플레이 허브"));
    fireEvent.click(screen.getByText("계정 설정/로그아웃"));
    fireEvent.click(screen.getByText("▼"));

    expect(props.onOpenPlayHub).toHaveBeenCalledTimes(1);
    expect(props.onOpenAccountSettings).toHaveBeenCalledTimes(1);
    expect(props.onToggleProfileMenu).toHaveBeenCalledTimes(1);
  });
});
