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
  search: "",
};

jest.mock("react-router-dom", () => ({
  __esModule: true,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  NavLink: ({ children, to, className, end, ...props }) => {
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
    mockLocation.search = "";
  });

  test("탑네비에 노트북 링크가 보인다", () => {
    const { container } = render(<TopNavigation />);

    expect(screen.getByRole("link", { name: "노트북" })).toHaveAttribute(
      "href",
      "/notebook"
    );
    expect(container.querySelector(".service-brand__mark-image")).toHaveAttribute(
      "src",
      "/logo192_agumon.png"
    );
  });

  test("비로그인 상태에서는 홈 링크가 루트를 가리키고 소개 링크가 활성화된다", () => {
    mockLocation.pathname = "/landing";

    render(<TopNavigation />);

    const homeLink = screen.getByRole("link", { name: "홈" });
    expect(homeLink).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "소개" })).toHaveAttribute("href", "/landing");
    expect(screen.getByRole("link", { name: "소개" }).className).toContain(
      "service-nav__link--active"
    );
  });

  test("로그인 상태에서는 홈 링크가 기존 홈을 가리키고 소개 링크와 테이머 메뉴가 보인다", () => {
    mockAuthState.currentUser = { uid: "tester", displayName: "코로몬" };

    render(<TopNavigation tamerName="코로몬" />);

    expect(screen.getByRole("link", { name: "홈" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "소개" })).toHaveAttribute("href", "/landing");
    expect(screen.getByRole("link", { name: "테이머(설정)" })).toHaveAttribute("href", "/me");
  });

  test("노트북 경로에서는 소개 빠른 메뉴와 앱 아이콘, 홈 복귀 링크가 보인다", () => {
    mockLocation.pathname = "/notebook";
    const { container } = render(<TopNavigation />);

    expect(screen.getByRole("link", { name: "소개" })).toHaveAttribute("href", "/landing");
    expect(screen.getByRole("link", { name: "가이드" })).toHaveAttribute("href", "/guide");
    expect(screen.getByRole("link", { name: "HOME:// RETURN" })).toHaveAttribute(
      "href",
      "/"
    );
    expect(container.querySelector(".notebook-topbar__brand-icon-image")).toHaveAttribute(
      "src",
      "/logo192_agumon.png"
    );
  });

  test("탑네비에서 커뮤니티를 누르면 게시판 드롭다운 4개와 올바른 href가 보인다", () => {
    render(<TopNavigation />);

    fireEvent.click(screen.getByRole("button", { name: "커뮤니티" }));

    expect(screen.getByRole("link", { name: /^자유게시판/ })).toHaveAttribute(
      "href",
      "/community?board=free"
    );
    expect(screen.getByRole("link", { name: /^자랑게시판/ })).toHaveAttribute(
      "href",
      "/community?board=showcase"
    );
    expect(screen.getByRole("link", { name: /버그제보\s*\/\s*QnA/ })).toHaveAttribute(
      "href",
      "/community?board=support"
    );
    expect(screen.getByRole("link", { name: /^디스코드/ })).toHaveAttribute(
      "href",
      "/community?board=discord"
    );
  });

  test("커뮤니티 드롭다운은 바깥 클릭과 Escape, 라우트 변경에서 닫힌다", () => {
    const { rerender } = render(<TopNavigation />);

    fireEvent.click(screen.getByRole("button", { name: "커뮤니티" }));
    expect(screen.getByRole("link", { name: /^자유게시판/ })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("link", { name: /^자유게시판/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "커뮤니티" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link", { name: /^자유게시판/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "커뮤니티" }));
    mockLocation.pathname = "/guide";
    rerender(<TopNavigation />);
    expect(screen.queryByRole("link", { name: /^자유게시판/ })).not.toBeInTheDocument();
  });

  test("노트북 경로에서도 커뮤니티 드롭다운 항목이 보인다", () => {
    mockLocation.pathname = "/notebook";

    render(<TopNavigation />);

    fireEvent.click(screen.getByRole("button", { name: "커뮤니티" }));

    expect(screen.getByRole("link", { name: /^자유게시판/ })).toHaveAttribute(
      "href",
      "/community?board=free"
    );
    expect(screen.getByRole("link", { name: /^자랑게시판/ })).toHaveAttribute(
      "href",
      "/community?board=showcase"
    );
    expect(screen.getByRole("link", { name: /버그제보\s*\/\s*QnA/ })).toHaveAttribute(
      "href",
      "/community?board=support"
    );
    expect(screen.getByRole("link", { name: /^디스코드/ })).toHaveAttribute(
      "href",
      "/community?board=discord"
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
    expect(await screen.findByRole("menuitem", { name: "🚪 로그아웃" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "🚪 로그아웃" }));
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

  test("비로그인 모바일 탭바에서는 홈 탭이 랜딩을 가리키고 활성화된다", () => {
    mockLocation.pathname = "/landing";
    render(<MobileTabBar />);

    const homeTab = screen.getByRole("link", { name: "홈" });
    expect(homeTab).toHaveAttribute("href", "/landing");
    expect(homeTab.className).toContain("service-tabbar__item--active");
  });

  test("로그인 모바일 탭바에는 테이머(설정) 탭이 보인다", () => {
    mockAuthState.currentUser = { uid: "tester", displayName: "코로몬" };

    render(<MobileTabBar />);

    expect(screen.getByRole("link", { name: "테이머(설정)" })).toHaveAttribute(
      "href",
      "/me"
    );
  });
});
