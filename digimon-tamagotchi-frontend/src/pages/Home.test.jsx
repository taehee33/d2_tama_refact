import React from "react";
import { render, screen } from "@testing-library/react";
import Home from "./Home";

const mockNavigate = jest.fn();
const mockSetTheme = jest.fn();
const mockAuthState = {
  currentUser: { uid: "tester" },
};
const mockThemeState = {
  themeId: "default",
  isThemeLoading: false,
  setTheme: mockSetTheme,
};
const mockUseTamerProfile = jest.fn();
const mockUseUserSlots = jest.fn();
const mockGetSlotDisplayName = jest.fn();
const mockGetSlotStageLabel = jest.fn();
const mockGetSlotSpriteSrc = jest.fn();
const mockUsePwaInstallPrompt = jest.fn();

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
  useAuth: () => mockAuthState,
}));

jest.mock("../contexts/ThemeContext", () => ({
  SITE_THEME_OPTIONS: [
    { id: "default", label: "기본" },
    { id: "notebook", label: "한솔이의 노트북" },
  ],
  useTheme: () => mockThemeState,
}));

jest.mock("../hooks/useTamerProfile", () => ({
  __esModule: true,
  default: () => mockUseTamerProfile(),
}));

jest.mock("../hooks/useUserSlots", () => ({
  __esModule: true,
  default: () => mockUseUserSlots(),
}));

jest.mock("../hooks/usePwaInstallPrompt", () => ({
  __esModule: true,
  default: () => mockUsePwaInstallPrompt(),
}));

jest.mock("../utils/slotViewUtils", () => ({
  getSlotDisplayName: (...args) => mockGetSlotDisplayName(...args),
  getSlotStageLabel: (...args) => mockGetSlotStageLabel(...args),
  getSlotSpriteSrc: (...args) => mockGetSlotSpriteSrc(...args),
}));

describe("Home 테마 진입점", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSetTheme.mockReset();
    mockAuthState.currentUser = { uid: "tester" };
    mockThemeState.themeId = "default";
    mockThemeState.isThemeLoading = false;
    mockUseTamerProfile.mockReturnValue({
      displayTamerName: "한솔",
      achievements: [],
      maxSlots: 10,
    });
    mockUseUserSlots.mockReturnValue({
      slots: [],
      loading: false,
      recentSlot: null,
    });
    mockUsePwaInstallPrompt.mockReturnValue({
      isActionable: false,
    });
    mockGetSlotDisplayName.mockReturnValue("볼몬");
    mockGetSlotStageLabel.mockReturnValue("유아기");
    mockGetSlotSpriteSrc.mockReturnValue("/images/11.png");
  });

  test("로그인 홈에서는 최근 슬롯 이어하기 카드가 보인다", () => {
    mockUseUserSlots.mockReturnValue({
      slots: [
        {
          id: 1,
          slotName: "슬롯1",
          device: "Digital Monster Color 25th",
          version: "Ver.1",
        },
      ],
      loading: false,
      recentSlot: {
        id: 1,
        slotName: "슬롯1",
        device: "Digital Monster Color 25th",
        version: "Ver.1",
      },
      recentSlots: [
        {
          id: 1,
          slotName: "슬롯1",
          device: "Digital Monster Color 25th",
          version: "Ver.1",
        },
      ],
    });

    render(<Home />);

    expect(screen.getByRole("heading", { name: "한솔님, 오늘도 디지몬이 기다리고 있습니다." })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "볼몬 대표 스프라이트" })).toHaveAttribute(
      "src",
      "/images/11.png"
    );
    expect(
      screen.getAllByText("유아기 · Digital Monster Color 25th / Ver.1").length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("슬롯1").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "이어하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "몰입형 화면" })).toBeInTheDocument();
  });

  test("로그인 홈에서는 공개 테마 토글 대신 빠른 이동 카드가 보인다", () => {
    mockUseUserSlots.mockReturnValue({
      slots: [
        {
          id: 1,
          slotName: "슬롯1",
          device: "Digital Monster Color 25th",
          version: "Ver.1",
        },
      ],
      loading: false,
      recentSlot: {
        id: 1,
        slotName: "슬롯1",
        device: "Digital Monster Color 25th",
        version: "Ver.1",
      },
      recentSlots: [
        {
          id: 1,
          slotName: "슬롯1",
          device: "Digital Monster Color 25th",
          version: "Ver.1",
        },
      ],
    });

    render(<Home />);

    expect(
      screen.queryByRole("group", { name: "서비스 테마 선택" })
    ).not.toBeInTheDocument();

    const notebookLink = screen.getByRole("link", { name: /노트북/ });
    expect(notebookLink).toHaveAttribute("href", "/notebook");
  });

  test("홈에서는 설치 가능한 경우에만 홈화면에 추가 카드가 보인다", () => {
    mockUsePwaInstallPrompt.mockReturnValue({
      isActionable: true,
    });

    render(<Home />);

    const installLink = screen.getByRole("link", { name: /홈화면에 추가/ });
    expect(installLink).toHaveAttribute("href", "/me/settings#install");
  });

  test("홈에서는 이미 설치되었거나 지원되지 않으면 설치 카드를 숨긴다", () => {
    mockUsePwaInstallPrompt.mockReturnValue({
      isActionable: false,
    });

    render(<Home />);

    expect(screen.queryByRole("link", { name: /홈화면에 추가/ })).not.toBeInTheDocument();
  });
});
