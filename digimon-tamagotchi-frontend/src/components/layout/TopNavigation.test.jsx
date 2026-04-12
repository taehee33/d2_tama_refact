import React from "react";
import { render, screen } from "@testing-library/react";
import TopNavigation from "./TopNavigation";

const mockUseHeaderAccountMenu = jest.fn();
const mockUseOperatorStatus = jest.fn();
const mockLocation = {
  pathname: "/guide",
  search: "",
};

jest.mock("react-router-dom", () => ({
  __esModule: true,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  NavLink: ({ children, to, className }) => {
    const resolvedClassName =
      typeof className === "function" ? className({ isActive: mockLocation.pathname === to }) : className;

    return (
      <a href={to} className={resolvedClassName}>
        {children}
      </a>
    );
  },
  useLocation: () => mockLocation,
}), { virtual: true });

jest.mock("../../hooks/useHeaderAccountMenu", () => ({
  useHeaderAccountMenu: (...args) => mockUseHeaderAccountMenu(...args),
}));

jest.mock("../../hooks/useOperatorStatus", () => ({
  __esModule: true,
  default: () => mockUseOperatorStatus(),
}));

jest.mock("../home/NotebookTopBar", () => () => <div>노트북 상단바</div>);

function createMenuState(overrides = {}) {
  return {
    currentUser: {
      uid: "tester",
      email: "tester@example.com",
    },
    displayTamerName: "테이머",
    isAccountMenuOpen: false,
    isLogoutLoading: false,
    menuError: "",
    accountMenuRef: { current: null },
    toggleAccountMenu: jest.fn(),
    closeAccountMenu: jest.fn(),
    handleSettingsClick: jest.fn(),
    handleLogoutClick: jest.fn(),
    ...overrides,
  };
}

describe("TopNavigation", () => {
  beforeEach(() => {
    mockUseHeaderAccountMenu.mockReturnValue(createMenuState());
    mockUseOperatorStatus.mockReturnValue({
      operatorStatus: {
        canAccessUserDirectory: false,
      },
    });
  });

  test("운영자 권한이 없으면 사용자관리 메뉴를 숨긴다", () => {
    render(<TopNavigation tamerName="테이머" />);

    expect(screen.queryByRole("link", { name: "사용자관리" })).not.toBeInTheDocument();
  });

  test("운영자 권한이 있으면 소개 오른쪽에 사용자관리 메뉴를 노출한다", () => {
    mockUseOperatorStatus.mockReturnValue({
      operatorStatus: {
        canAccessUserDirectory: true,
      },
    });

    render(<TopNavigation tamerName="테이머" />);

    expect(screen.getByRole("link", { name: "소개" })).toHaveAttribute("href", "/landing");
    expect(screen.getByRole("link", { name: "사용자관리" })).toHaveAttribute(
      "href",
      "/operators/users"
    );
  });
});
