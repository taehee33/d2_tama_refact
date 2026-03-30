import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Home from "./Home";

const mockNavigate = jest.fn();
const mockSetTheme = jest.fn();
const mockAuthState = {
  currentUser: null,
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
    { id: "notebook", label: "노트북" },
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

jest.mock("../utils/slotViewUtils", () => ({
  getSlotDisplayName: (...args) => mockGetSlotDisplayName(...args),
  getSlotStageLabel: (...args) => mockGetSlotStageLabel(...args),
}));

describe("Home 테마 진입점", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSetTheme.mockReset();
    mockAuthState.currentUser = null;
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
    mockGetSlotDisplayName.mockReturnValue("볼몬");
    mockGetSlotStageLabel.mockReturnValue("유아기");
  });

  test("비로그인 홈에서는 공개 테마 토글이 보인다", () => {
    render(<Home />);

    expect(screen.getByRole("group", { name: "서비스 테마 선택" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "노트북" }));

    expect(mockSetTheme).toHaveBeenCalledWith("notebook");
  });

  test("로그인 홈에서는 공개 테마 토글 대신 노트북 빠른 이동 카드가 보인다", () => {
    mockAuthState.currentUser = { uid: "tester" };
    mockUseUserSlots.mockReturnValue({
      slots: [{ id: 1 }],
      loading: false,
      recentSlot: { id: 1 },
    });

    render(<Home />);

    expect(
      screen.queryByRole("group", { name: "서비스 테마 선택" })
    ).not.toBeInTheDocument();

    const notebookLink = screen.getByRole("link", { name: /노트북/ });
    expect(notebookLink).toHaveAttribute("href", "/notebook");
  });
});
