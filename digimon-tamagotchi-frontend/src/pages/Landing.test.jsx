import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Landing from "./Landing";

const mockAuthState = {
  currentUser: null,
};
const mockSetTheme = jest.fn();
const mockThemeState = {
  themeId: "default",
  isThemeLoading: false,
  setTheme: mockSetTheme,
};

jest.mock("react-router-dom", () => ({
  __esModule: true,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}), { virtual: true });

jest.mock("../contexts/ThemeContext", () => ({
  SITE_THEME_OPTIONS: [
    { id: "default", label: "기본" },
    { id: "notebook", label: "노트북" },
  ],
  useTheme: () => mockThemeState,
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

describe("Landing 둘러보기 진입점", () => {
  beforeEach(() => {
    mockAuthState.currentUser = null;
    mockSetTheme.mockReset();
    mockThemeState.themeId = "default";
    mockThemeState.isThemeLoading = false;
  });

  test("비로그인 둘러보기에서 핵심 CTA와 공개 링크가 보인다", () => {
    render(<Landing />);

    expect(
      screen.getByRole("heading", {
        name: "디지타마에서 시작해 나만의 디지몬을 키우는 웹 디지바이스",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인하고 시작하기" })).toHaveAttribute(
      "href",
      "/auth"
    );
    expect(screen.getByRole("link", { name: "노트북 둘러보기" })).toHaveAttribute(
      "href",
      "/notebook"
    );
    expect(screen.getByRole("link", { name: "가이드 먼저 보기" })).toHaveAttribute(
      "href",
      "/guide"
    );
    expect(screen.getByRole("link", { name: /저장 방식 확인/ })).toHaveAttribute(
      "href",
      "/support"
    );
  });

  test("로그인 상태에서는 둘러보기 CTA가 플레이 허브와 홈 복귀로 바뀐다", () => {
    mockAuthState.currentUser = { uid: "tester" };

    render(<Landing />);

    expect(screen.getByRole("link", { name: "플레이 허브 열기" })).toHaveAttribute(
      "href",
      "/play"
    );
    expect(screen.getByRole("link", { name: "내 홈으로 돌아가기" })).toHaveAttribute(
      "href",
      "/"
    );
  });

  test("둘러보기에서도 공개 테마 토글을 유지한다", () => {
    render(<Landing />);

    expect(screen.getByRole("group", { name: "서비스 테마 선택" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "노트북" }));

    expect(mockSetTheme).toHaveBeenCalledWith("notebook");
  });
});
