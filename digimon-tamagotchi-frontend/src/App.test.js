import React from "react";
import { render, screen, within } from "@testing-library/react";
import App, { LandingEntry, RootEntry } from "./App";

const mockLocation = { pathname: "/", search: "" };
const mockAuthState = {
  currentUser: null,
  loading: false,
  logout: jest.fn(),
  isFirebaseAvailable: true,
};

jest.mock("react-router-dom", () => ({
  __esModule: true,
  BrowserRouter: ({ children }) => <div>{children}</div>,
  Routes: ({ children }) => <div>{children}</div>,
  Route: ({ element, children }) => {
    const mockReact = require("react");
    return element
      ? mockReact.cloneElement(element, {}, children)
      : <div>{children}</div>;
  },
  Navigate: ({ to }) => <div>{`redirect:${to}`}</div>,
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
  useParams: () => ({ slotId: "1" }),
}), { virtual: true });

jest.mock("@vercel/analytics/react", () => ({
  Analytics: () => null,
}), { virtual: true });

jest.mock("react-ga4", () => ({
  initialize: jest.fn(),
  send: jest.fn(),
}), { virtual: true });

jest.mock("ably/react", () => ({
  ChannelProvider: ({ children }) => <div>{children}</div>,
}), { virtual: true });

jest.mock("./contexts/AuthContext", () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: () => mockAuthState,
}));

jest.mock("./contexts/ThemeContext", () => ({
  ThemeProvider: ({ children }) => <div>{children}</div>,
  useTheme: () => ({
    themeId: "default",
    resolvedTheme: "default",
    isThemeLoading: false,
    setTheme: jest.fn(),
  }),
}));

jest.mock("./contexts/AblyContext", () => ({
  AblyContextProvider: ({ children, renderChatRoom }) => (
    <div>
      {children}
      {renderChatRoom ? renderChatRoom({ clientReady: true, hasKey: true, hasTamerName: true }) : null}
    </div>
  ),
}));

jest.mock("./contexts/MasterDataContext", () => ({
  MasterDataProvider: ({ children }) => <div>{children}</div>,
  useMasterData: () => ({
    isMasterDataReady: true,
  }),
}));

jest.mock("./hooks/useTamerProfile", () => ({
  useTamerProfile: () => ({
    tamerName: "테이머",
  }),
}));

jest.mock("./components/layout/ServiceLayout", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="service-layout">{children}</div>,
}));

jest.mock("./components/landing/LandingShell", () => ({
  __esModule: true,
  default: () => <div data-testid="landing-shell">랜딩 화면</div>,
}));

jest.mock("./components/layout/RequireAuth", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock("./components/ChatRoom", () => () => <div>채팅방</div>);
jest.mock("./components/chat/PlayChatDrawer", () => () => <div>플레이 채팅 드로어</div>);
jest.mock("./pages/Home", () => () => <div>홈 화면</div>);
jest.mock("./pages/Landing", () => () => <div>랜딩 화면</div>);
jest.mock("./pages/Login", () => () => <div>로그인 화면</div>);
jest.mock("./pages/PlayHub", () => () => <div>플레이 허브 화면</div>);
jest.mock("./pages/Game", () => () => <div>게임 화면</div>);
jest.mock("./pages/PlayFull", () => () => <div>몰입형 플레이 화면</div>);
jest.mock("./pages/NotebookLanding", () => () => <div>노트북 랜딩 화면</div>);
jest.mock("./pages/Guide", () => () => <div>가이드 화면</div>);
jest.mock("./pages/Community", () => () => <div>커뮤니티 화면</div>);
jest.mock("./pages/Me", () => () => <div>테이머 화면</div>);
jest.mock("./pages/Collection", () => () => <div>도감 화면</div>);
jest.mock("./pages/Settings", () => () => <div>설정 화면</div>);
jest.mock("./pages/News", () => () => <div>소식 화면</div>);
jest.mock("./pages/Support", () => () => <div>지원 화면</div>);

beforeEach(() => {
  mockLocation.pathname = "/";
  mockLocation.search = "";
  mockAuthState.currentUser = null;
  mockAuthState.loading = false;
  mockAuthState.isFirebaseAvailable = true;
});

test("앱 라우트 셸이 깨지지 않고 렌더링된다", () => {
  render(<App />);
  expect(screen.getByText("랜딩 화면")).toBeInTheDocument();
  expect(screen.getByText("로그인 화면")).toBeInTheDocument();
  expect(screen.getByText("가이드 화면")).toBeInTheDocument();
  expect(screen.getByText("도감 화면")).toBeInTheDocument();
  expect(screen.getByText("설정 화면")).toBeInTheDocument();
  expect(screen.getByText("redirect:/play")).toBeInTheDocument();
  expect(screen.getByText("redirect:/play/1")).toBeInTheDocument();
});

test("/landing은 공통 ServiceLayout 밖의 전용 셸로 분리된다", () => {
  render(<App />);

  expect(screen.getByTestId("landing-shell")).toBeInTheDocument();
  expect(within(screen.getByTestId("service-layout")).queryByTestId("landing-shell")).toBeNull();
});

test("비로그인 사용자가 루트 엔트리에 들어오면 랜딩으로 이동한다", () => {
  render(<RootEntry />);

  expect(screen.getByText("redirect:/landing")).toBeInTheDocument();
});

test("로그인 사용자가 루트 엔트리에 들어오면 홈을 본다", () => {
  mockAuthState.currentUser = { uid: "tester" };

  render(<RootEntry />);

  expect(screen.getByText("홈 화면")).toBeInTheDocument();
});

test("로그인 사용자가 랜딩 경로에 직접 들어와도 랜딩을 볼 수 있다", () => {
  mockAuthState.currentUser = { uid: "tester" };

  render(<LandingEntry />);

  expect(screen.getByText("랜딩 화면")).toBeInTheDocument();
});

test("/play에서 로그인 상태면 채팅 드로어 런처가 준비된다", () => {
  mockLocation.pathname = "/play";
  mockAuthState.currentUser = { uid: "tester" };

  render(<App />);

  expect(screen.getByText("플레이 채팅 드로어")).toBeInTheDocument();
});

test("/guide에서도 로그인 상태면 채팅 드로어 런처가 준비된다", () => {
  mockLocation.pathname = "/guide";
  mockAuthState.currentUser = { uid: "tester" };

  render(<App />);

  expect(screen.getByText("플레이 채팅 드로어")).toBeInTheDocument();
});

test("/community에서도 인라인 채팅 대신 채팅 드로어 런처가 준비된다", () => {
  mockLocation.pathname = "/community";
  mockAuthState.currentUser = { uid: "tester" };

  render(<App />);

  expect(screen.getByText("플레이 채팅 드로어")).toBeInTheDocument();
  expect(screen.queryByText("채팅방")).not.toBeInTheDocument();
});
