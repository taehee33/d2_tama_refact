import React from "react";
import { render, screen } from "@testing-library/react";
import LandingShell from "./LandingShell";

const mockAuthState = {
  currentUser: null,
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
        typeof className === "function" ? className({ isActive: to === "/landing" }) : className;

      return (
        <a href={to} className={resolvedClassName} {...props}>
          {children}
        </a>
      );
    },
  }),
  { virtual: true }
);

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

describe("LandingShell", () => {
  beforeEach(() => {
    mockAuthState.currentUser = null;
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

  test("비로그인 상태에서는 로그인 CTA가 보이고, 로그인 상태에서는 계정 버튼이 보인다", () => {
    const { rerender } = render(<LandingShell />);

    expect(screen.getByRole("link", { name: /디지몬 키우기/i })).toHaveAttribute(
      "href",
      "/landing"
    );
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/auth");

    mockAuthState.currentUser = { uid: "tester", displayName: "코로몬" };
    rerender(<LandingShell />);

    expect(screen.getByRole("link", { name: /디지몬 키우기/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "테이머(설정)" })).toHaveAttribute("href", "/me");
    expect(screen.getByRole("link", { name: "코로몬" })).toHaveAttribute("href", "/me");
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
});
