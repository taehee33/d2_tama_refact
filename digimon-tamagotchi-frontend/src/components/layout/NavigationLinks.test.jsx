import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MobileTabBar from "./MobileTabBar";
import TopNavigation from "./TopNavigation";

const mockAuthState = {
  currentUser: null,
  logout: jest.fn(),
};

const mockNavigate = jest.fn();
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
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

describe("홈과 노트북 전역 이동 링크", () => {
  beforeEach(() => {
    mockAuthState.currentUser = null;
    mockAuthState.logout.mockReset();
    mockAuthState.logout.mockResolvedValue(undefined);
    mockNavigate.mockReset();
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
    mockAuthState.currentUser = { uid: "tester", displayName: "코로몬" };
    mockLocation.pathname = "/guide";
    render(<TopNavigation tamerName="코로몬" />);

    expect(screen.queryByText("온라인 사용자 수")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "코로몬 계정 메뉴" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "내 디지몬 보기" })).not.toBeInTheDocument();
  });

  test("테이머명을 누르면 계정설정과 로그아웃 메뉴가 열린다", async () => {
    mockAuthState.currentUser = { uid: "tester", displayName: "코로몬" };
    mockLocation.pathname = "/guide";

    render(<TopNavigation tamerName="코로몬" />);

    fireEvent.click(screen.getByRole("button", { name: "코로몬 계정 메뉴" }));

    expect(await screen.findByRole("menu", { name: "계정 메뉴" })).toBeInTheDocument();
    expect(await screen.findByRole("menuitem", { name: "계정설정" })).toBeInTheDocument();
    expect(await screen.findByRole("menuitem", { name: "로그아웃" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "로그아웃" }));
    expect(mockAuthState.logout).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/auth");
    });
  });

  test("계정설정 메뉴를 누르면 설정 페이지로 이동한다", async () => {
    mockAuthState.currentUser = { uid: "tester", displayName: "코로몬" };
    mockLocation.pathname = "/guide";

    render(<TopNavigation tamerName="코로몬" />);

    fireEvent.click(screen.getByRole("button", { name: "코로몬 계정 메뉴" }));

    expect(await screen.findByRole("menu", { name: "계정 메뉴" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "계정설정" }));
    expect(mockNavigate).toHaveBeenCalledWith("/me/settings");
  });

  test("모바일 탭바에 노트북 탭이 보이고 활성화된다", () => {
    mockLocation.pathname = "/notebook";
    render(<MobileTabBar />);

    const notebookTab = screen.getByRole("link", { name: "노트북" });
    expect(notebookTab).toHaveAttribute("href", "/notebook");
    expect(notebookTab.className).toContain("service-tabbar__item--active");
  });
});
