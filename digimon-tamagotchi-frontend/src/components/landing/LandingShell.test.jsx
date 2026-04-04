import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LandingShell from "./LandingShell";

const mockAuthState = {
  currentUser: null,
  logout: jest.fn(),
};
const mockNavigate = jest.fn();
const mockLocation = {
  pathname: "/landing",
  search: "",
};

jest.mock(
  "react-router-dom",
  () => ({
    __esModule: true,
    Link: ({ children, to, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    NavLink: ({ children, to, className, end, ...props }) => {
      const resolvedClassName =
        typeof className === "function"
          ? className({ isActive: mockLocation.pathname === to })
          : className;

      return (
        <a href={to} className={resolvedClassName} {...props}>
          {children}
        </a>
      );
    },
    useLocation: () => mockLocation,
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
);

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

describe("LandingShell", () => {
  beforeEach(() => {
    mockAuthState.currentUser = null;
    mockAuthState.logout.mockReset();
    mockAuthState.logout.mockResolvedValue(undefined);
    mockNavigate.mockReset();
    mockLocation.pathname = "/landing";
    mockLocation.search = "";
  });

  test("랜딩 전용 플로팅 헤더와 본문을 함께 렌더링한다", () => {
    const { container } = render(<LandingShell />);

    expect(container.querySelector(".landing-topbar__surface")).toBeInTheDocument();
    expect(container.querySelector(".landing-topbar__brand-mark-image")).toHaveAttribute(
      "src",
      "/logo192_agumon.png"
    );
    expect(screen.getByRole("navigation", { name: "랜딩 주요 이동" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /디지몬 키우기/i })).toHaveAttribute(
      "href",
      "/landing"
    );
    expect(screen.getByRole("link", { name: "소개" }).className).toContain(
      "landing-topbar__link--active"
    );
    expect(
      screen.getByRole("heading", { name: "그 시절, 우리는 모두 선택받은 아이들이었다" })
    ).toBeInTheDocument();
  });

  test("비로그인 상태에서는 로그인 CTA가 보이고, 로그인 상태에서는 저장된 닉네임 계정 버튼이 보인다", () => {
    const { rerender } = render(<LandingShell />);

    expect(screen.getByRole("link", { name: /디지몬 키우기/i })).toHaveAttribute(
      "href",
      "/landing"
    );
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/auth");

    mockAuthState.currentUser = { uid: "tester", displayName: "코로몬" };
    rerender(<LandingShell tamerName="아구몬" />);

    expect(screen.getByRole("link", { name: /디지몬 키우기/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "테이머(설정)" })).toHaveAttribute("href", "/me");
    expect(
      screen.getByRole("button", { name: "아구몬 계정 메뉴" })
    ).toBeInTheDocument();
  });

  test("랜딩 모바일 헤더 가운데 홈 링크는 비로그인 시 로그인으로 이동한다", () => {
    render(<LandingShell />);

    expect(screen.getByRole("link", { name: "랜딩 모바일 홈" })).toHaveAttribute(
      "href",
      "/auth"
    );
    expect(screen.queryByRole("button", { name: "랜딩 모바일 더보기 메뉴" })).not.toBeInTheDocument();
  });

  test("랜딩 모바일 헤더 가운데 홈 링크는 로그인 시 홈으로 이동한다", () => {
    mockAuthState.currentUser = { uid: "tester", displayName: "코로몬" };

    render(<LandingShell />);

    expect(screen.getByRole("link", { name: "랜딩 모바일 홈" })).toHaveAttribute(
      "href",
      "/"
    );
  });

  test("소개 페이지 계정 버튼을 누르면 계정설정과 로그아웃 메뉴가 열린다", async () => {
    mockAuthState.currentUser = { uid: "tester", displayName: "코로몬" };

    render(<LandingShell tamerName="아구몬" />);

    fireEvent.click(screen.getByRole("button", { name: "아구몬 계정 메뉴" }));

    expect(await screen.findByRole("menu", { name: "계정 메뉴" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "계정설정" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "🚪 로그아웃" })).toBeInTheDocument();
  });

  test("소개 페이지 계정 메뉴에서 계정설정과 로그아웃이 일반 페이지와 동일하게 동작한다", async () => {
    mockAuthState.currentUser = { uid: "tester", displayName: "코로몬" };

    const { rerender } = render(<LandingShell tamerName="아구몬" />);

    fireEvent.click(screen.getByRole("button", { name: "아구몬 계정 메뉴" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "계정설정" }));
    expect(mockNavigate).toHaveBeenCalledWith("/me/settings");

    mockNavigate.mockReset();
    rerender(<LandingShell tamerName="아구몬" />);

    fireEvent.click(screen.getByRole("button", { name: "아구몬 계정 메뉴" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "🚪 로그아웃" }));

    expect(mockAuthState.logout).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/auth");
    });
  });
});
