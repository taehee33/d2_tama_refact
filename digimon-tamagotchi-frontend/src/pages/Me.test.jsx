import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import Me from "./Me";

const mockNavigate = jest.fn();
const mockUseTamerProfile = jest.fn();
const mockUseUserSlots = jest.fn();
const mockUseEncyclopediaSummary = jest.fn();
const mockGetSlotDisplayName = jest.fn();
const mockGetSlotStageLabel = jest.fn();
const mockGetUserSettings = jest.fn();

jest.mock("react-router-dom", () => ({
  __esModule: true,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { uid: "tester" },
  }),
}));

jest.mock("../contexts/ThemeContext", () => ({
  SITE_THEME_OPTIONS: [
    { id: "default", label: "기본" },
    { id: "notebook", label: "한솔이의 노트북" },
  ],
  useTheme: () => ({
    themeId: "notebook",
  }),
}));

jest.mock("../hooks/useTamerProfile", () => ({
  __esModule: true,
  default: () => mockUseTamerProfile(),
}));

jest.mock("../hooks/useUserSlots", () => ({
  __esModule: true,
  default: () => mockUseUserSlots(),
}));

jest.mock("../hooks/useEncyclopediaSummary", () => ({
  __esModule: true,
  default: () => mockUseEncyclopediaSummary(),
}));

jest.mock("../utils/slotViewUtils", () => ({
  getSlotDisplayName: (...args) => mockGetSlotDisplayName(...args),
  getSlotStageLabel: (...args) => mockGetSlotStageLabel(...args),
}));

jest.mock("../utils/userSettingsUtils", () => ({
  getUserSettings: (...args) => mockGetUserSettings(...args),
}));

describe("Me", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseTamerProfile.mockReturnValue({
      displayTamerName: "히히히",
      achievements: [],
      maxSlots: 10,
    });
    mockUseUserSlots.mockReturnValue({
      slots: [{ id: 1 }, { id: 2 }],
      recentSlots: [{ id: 2 }, { id: 1 }],
      recentSlot: { id: 2 },
      loading: false,
    });
    mockUseEncyclopediaSummary.mockReturnValue({
      loading: false,
      totalDiscoveredCount: 12,
      totalRequiredCount: 84,
      versions: [
        {
          version: "Ver.1",
          discoveredCount: 6,
          totalCount: 42,
          remainingCount: 36,
          isComplete: false,
        },
        {
          version: "Ver.2",
          discoveredCount: 6,
          totalCount: 42,
          remainingCount: 36,
          isComplete: false,
        },
      ],
    });
    mockGetSlotDisplayName.mockImplementation((slot) =>
      slot.id === 2 ? "뿔몬" : "코로몬"
    );
    mockGetSlotStageLabel.mockImplementation((slot) =>
      slot.id === 2 ? "유아기" : "유년기 I"
    );
    mockGetUserSettings.mockResolvedValue({
      discordWebhookUrl: null,
      isNotificationEnabled: true,
      siteTheme: "notebook",
    });
  });

  test("계정 설정은 상단 유틸리티 카드로 분리되고 본문 바로가기는 3개만 남는다", async () => {
    render(<Me />);

    expect(screen.getByRole("heading", { name: "히히히님의 테이머 카드" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "환경 요약" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "계정 설정 열기" })).toHaveAttribute(
      "href",
      "/me/settings"
    );

    await waitFor(() => {
      expect(screen.getByText("켜짐")).toBeInTheDocument();
    });

    const shortcutSection = screen
      .getByRole("heading", { name: "자주 찾는 메뉴" })
      .closest(".service-card");

    expect(shortcutSection).not.toBeNull();
    expect(within(shortcutSection).getByRole("link", { name: /도감/ })).toHaveAttribute(
      "href",
      "/me/collection"
    );
    expect(within(shortcutSection).getByRole("link", { name: /진화 가이드/ })).toHaveAttribute(
      "href",
      "/guide"
    );
    expect(within(shortcutSection).getByRole("link", { name: /플레이 허브/ })).toHaveAttribute(
      "href",
      "/play"
    );
    expect(screen.queryByRole("link", { name: "계정 설정" })).not.toBeInTheDocument();
  });

  test("대표 최근 슬롯과 보조 최근 슬롯을 함께 노출한다", async () => {
    render(<Me />);

    await waitFor(() => {
      expect(screen.getByText("켜짐")).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "이어 키우기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /뿔몬/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /코로몬/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이어하기" })).toBeInTheDocument();
  });
});
