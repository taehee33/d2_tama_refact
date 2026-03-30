import React from "react";
import { render, screen } from "@testing-library/react";
import ServiceLayout from "./ServiceLayout";

const mockLocation = {
  pathname: "/",
};

const mockThemeState = {
  resolvedTheme: "default",
};

jest.mock("react-router-dom", () => ({
  __esModule: true,
  Outlet: () => <div>서비스 콘텐츠</div>,
  useLocation: () => mockLocation,
}), { virtual: true });

jest.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => mockThemeState,
}));

jest.mock("./TopNavigation", () => () => <div>상단 네비게이션</div>);
jest.mock("./MobileTabBar", () => () => <div>모바일 탭바</div>);

describe("ServiceLayout 테마 클래스", () => {
  beforeEach(() => {
    mockLocation.pathname = "/";
    mockThemeState.resolvedTheme = "default";
  });

  test("일반 서비스 페이지에서는 선택된 테마 클래스를 붙인다", () => {
    const { container } = render(<ServiceLayout />);

    expect(screen.getByText("서비스 콘텐츠")).toBeInTheDocument();
    expect(container.firstChild.className).toContain("service-shell--theme-default");
  });

  test("/notebook에서는 선택된 테마 대신 전용 notebook 클래스를 유지한다", () => {
    mockLocation.pathname = "/notebook";
    mockThemeState.resolvedTheme = "notebook";

    const { container } = render(<ServiceLayout />);

    expect(container.firstChild.className).toContain("service-shell--notebook");
    expect(container.firstChild.className).not.toContain("service-shell--theme-notebook");
  });
});
