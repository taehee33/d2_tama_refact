import React from "react";
import { render, screen } from "@testing-library/react";
import { ChatRoom } from "./ChatRoom";

const mockUseAuth = jest.fn();
const mockUsePresenceContext = jest.fn();
const mockUsePresence = jest.fn();
const mockUsePresenceListener = jest.fn();

const mockChannel = {
  state: "attached",
  on: jest.fn(),
  off: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  attach: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockResolvedValue(undefined),
  presence: {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  },
};

const mockAbly = {
  auth: { clientId: "KDH" },
  connection: { id: "conn-1" },
};

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../contexts/AblyContext", () => ({
  usePresenceContext: () => mockUsePresenceContext(),
}));

jest.mock("ably/react", () => ({
  useAbly: () => mockAbly,
  useChannel: () => ({ channel: mockChannel }),
  usePresence: () => mockUsePresence(),
  usePresenceListener: () => mockUsePresenceListener(),
}), { virtual: true });

jest.mock("../supabase", () => ({
  supabase: null,
  isSupabaseConfigured: () => false,
}));

jest.mock("../utils/presenceUtils", () => ({
  getDeviceHint: jest.fn(() => "mobile"),
  getPresenceDisplayName: jest.fn((member) => member.clientId || "알 수 없음"),
  getDeviceIndex: jest.fn(() => 1),
  formatDeviceSuffix: jest.fn(() => ""),
}));

jest.mock("../utils/dateUtils", () => ({
  formatTimestamp: jest.fn(() => "04/01 13:00"),
}));

describe("ChatRoom", () => {
  const setPresenceMembers = (members) => {
    mockUsePresenceListener.mockReturnValue({
      presenceData: members,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      currentUser: {
        uid: "user-1",
      },
    });

    mockUsePresenceContext.mockReturnValue({
      isChatOpen: true,
      setIsChatOpen: jest.fn(),
      unreadCount: 0,
      setUnreadCount: jest.fn(),
      clearUnreadCount: jest.fn(),
    });

    mockUsePresence.mockReturnValue({
      updateStatus: jest.fn(),
    });

    setPresenceMembers([
      {
        clientId: "한태희",
        connectionId: "conn-1",
        data: { status: "online" },
      },
    ]);
  });

  test("drawer variant에서는 입력창을 스크롤 영역 바깥 하단에 유지한다", () => {
    const { container } = render(<ChatRoom variant="drawer" />);

    const panel = container.querySelector(".play-chat-panel--drawer");
    const scrollArea = container.querySelector(".play-chat-panel__scroll--drawer");
    const composer = container.querySelector(".play-chat-panel__composer--sticky");
    const composerShell = container.querySelector(".play-chat-panel__composer-shell");
    const composerGrid = container.querySelector(".play-chat-panel__composer-grid");
    const input = screen.getByPlaceholderText(/메시지를 입력하세요/);
    const sendButton = screen.getByRole("button", { name: "전송" });

    expect(panel).toBeInTheDocument();
    expect(scrollArea).toBeInTheDocument();
    expect(composer).toBeInTheDocument();
    expect(composerShell).toBeInTheDocument();
    expect(composerGrid).toBeInTheDocument();
    expect(composer).toContainElement(composerShell);
    expect(composerShell).toContainElement(composerGrid);
    expect(composer).toContainElement(input);
    expect(composer).toContainElement(sendButton);
    expect(composerGrid).toContainElement(input);
    expect(composerGrid).toContainElement(sendButton);
    expect(scrollArea).not.toContainElement(input);
    expect(scrollArea).toContainElement(screen.getByText(/접속 중인 테이머/));
  });

  test("접속자가 많아져도 composer는 스크롤 영역 바깥에 유지한다", () => {
    setPresenceMembers([
      { clientId: "히히히", connectionId: "conn-1", data: { status: "online" } },
      { clientId: "babo", connectionId: "conn-2", data: { status: "online" } },
      { clientId: "babo", connectionId: "conn-3", data: { status: "online" } },
      { clientId: "babo", connectionId: "conn-4", data: { status: "online" } },
      { clientId: "babo", connectionId: "conn-5", data: { status: "online" } },
      { clientId: "babo", connectionId: "conn-6", data: { status: "online" } },
      { clientId: "babo", connectionId: "conn-7", data: { status: "online" } },
    ]);

    const { container } = render(<ChatRoom variant="drawer" />);

    const scrollArea = container.querySelector(".play-chat-panel__scroll--drawer");
    const composer = container.querySelector(".play-chat-panel__composer--sticky");
    const composerShell = container.querySelector(".play-chat-panel__composer-shell");
    const composerGrid = container.querySelector(".play-chat-panel__composer-grid");
    const input = screen.getByPlaceholderText(/메시지를 입력하세요/);
    const badges = container.querySelectorAll('.play-chat-panel__online-list [title="상태: 온라인"]');

    expect(scrollArea).toBeInTheDocument();
    expect(composer).toBeInTheDocument();
    expect(composerShell).toBeInTheDocument();
    expect(composerGrid).toBeInTheDocument();
    expect(composer).toContainElement(input);
    expect(composerGrid).toContainElement(input);
    expect(scrollArea).not.toContainElement(input);
    expect(screen.getByText(/접속 중인 테이머 \(7\)/)).toBeInTheDocument();
    expect(badges).toHaveLength(7);
  });
});
