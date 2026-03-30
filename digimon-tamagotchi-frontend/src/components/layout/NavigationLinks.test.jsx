import React from "react";
import { render, screen } from "@testing-library/react";
import MobileTabBar from "./MobileTabBar";
import TopNavigation from "./TopNavigation";

const mockAuthState = {
  currentUser: null,
};
const mockLocation = {
  pathname: "/",
};

jest.mock("react-router-dom", () => ({
  __esModule: true,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  NavLink: ({ children, to, className, ...props }) => {
    const isActive = mockLocation.pathname === to;
    const resolvedClassName =
      typeof className === "function" ? className({ isActive }) : className;

    return (
      <a href={to} className={resolvedClassName} {...props}>
        {children}
      </a>
    );
  },
  useLocation: () => mockLocation,
}), { virtual: true });

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

describe("홈과 노트북 전역 이동 링크", () => {
  beforeEach(() => {
    mockAuthState.currentUser = null;
    mockLocation.pathname = "/";
  });

  test("탑네비에 노트북 링크가 보인다", () => {
    render(<TopNavigation />);

    expect(screen.getByRole("link", { name: "노트북" })).toHaveAttribute(
      "href",
      "/notebook"
    );
  });

  test("노트북 경로에서는 홈 복귀 링크가 보인다", () => {
    mockLocation.pathname = "/notebook";
    render(<TopNavigation />);

    expect(screen.getByRole("link", { name: "HOME:// RETURN" })).toHaveAttribute(
      "href",
      "/"
    );
  });

  test("로그인 상태여도 탑네비에는 별도 접속 표시가 보이지 않는다", () => {
    mockAuthState.currentUser = { uid: "tester" };
    mockLocation.pathname = "/guide";
    render(<TopNavigation />);

    expect(screen.queryByText("온라인 사용자 수")).not.toBeInTheDocument();
  });

  test("모바일 탭바에 노트북 탭이 보이고 활성화된다", () => {
    mockLocation.pathname = "/notebook";
    render(<MobileTabBar />);

    const notebookTab = screen.getByRole("link", { name: "노트북" });
    expect(notebookTab).toHaveAttribute("href", "/notebook");
    expect(notebookTab.className).toContain("service-tabbar__item--active");
  });
});
