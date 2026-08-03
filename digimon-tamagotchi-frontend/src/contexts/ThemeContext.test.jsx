import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  SITE_THEME_STORAGE_KEY,
  ThemeProvider,
  useTheme,
} from "./ThemeContext";

const mockAuthState = {
  currentUser: null,
};

const mockGetUserSettings = jest.fn();
const mockSaveUserSettings = jest.fn();

jest.mock("./AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

jest.mock("../utils/userSettingsUtils", () => {
  const actual = jest.requireActual("../utils/userSettingsUtils");

  return {
    ...actual,
    getUserSettings: (...args) => mockGetUserSettings(...args),
    saveUserSettings: (...args) => mockSaveUserSettings(...args),
  };
});

function ThemeProbe() {
  const {
    themeId,
    resolvedTheme,
    isThemeLoading,
    setTheme,
    defaultScreen,
    isDefaultScreenLoading,
    setDefaultScreen,
  } = useTheme();

  return (
    <div>
      <div data-testid="theme-id">{themeId}</div>
      <div data-testid="resolved-theme">{resolvedTheme}</div>
      <div data-testid="theme-loading">{String(isThemeLoading)}</div>
      <div data-testid="default-screen">{defaultScreen}</div>
      <div data-testid="default-screen-loading">{String(isDefaultScreenLoading)}</div>
      <button type="button" onClick={() => setTheme("notebook")}>
        한솔이의 노트북 저장
      </button>
      <button type="button" onClick={() => setDefaultScreen("play")}>
        플레이 기본 화면 저장
      </button>
    </div>
  );
}

describe("ThemeContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockAuthState.currentUser = null;
    mockGetUserSettings.mockReset();
    mockSaveUserSettings.mockReset();
    mockGetUserSettings.mockResolvedValue({
      discordWebhookUrl: null,
      isNotificationEnabled: false,
      siteTheme: null,
    });
  });

  test("비로그인이고 저장된 값이 없으면 기본 테마를 사용한다", async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("theme-loading")).toHaveTextContent("false")
    );

    expect(screen.getByTestId("theme-id")).toHaveTextContent("default");
    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("default");
    expect(screen.getByTestId("default-screen")).toHaveTextContent("home");
    expect(screen.getByTestId("default-screen-loading")).toHaveTextContent("false");
  });

  test("비로그인이고 localStorage 값이 있으면 해당 테마를 사용한다", async () => {
    window.localStorage.setItem(SITE_THEME_STORAGE_KEY, "notebook");

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("theme-id")).toHaveTextContent("notebook")
    );
  });

  test("로그인 사용자 저장값이 게스트 localStorage보다 우선한다", async () => {
    window.localStorage.setItem(SITE_THEME_STORAGE_KEY, "notebook");
    mockAuthState.currentUser = { uid: "tester" };
    mockGetUserSettings.mockResolvedValue({
      discordWebhookUrl: null,
      isNotificationEnabled: false,
      siteTheme: "default",
      defaultScreen: "play",
    });

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("default-screen")).toHaveTextContent("play")
    );
  });

  test("로그인 사용자 저장값이 없으면 게스트 localStorage를 fallback으로 사용한다", async () => {
    window.localStorage.setItem(SITE_THEME_STORAGE_KEY, "notebook");
    mockAuthState.currentUser = { uid: "tester" };
    mockGetUserSettings.mockResolvedValue({
      discordWebhookUrl: null,
      isNotificationEnabled: false,
      siteTheme: null,
      defaultScreen: "invalid",
    });

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("theme-id")).toHaveTextContent("notebook")
    );
    expect(screen.getByTestId("default-screen")).toHaveTextContent("home");
  });

  test("비로그인 상태에서 테마를 바꾸면 localStorage에 저장한다", async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "한솔이의 노트북 저장" }));

    await waitFor(() =>
      expect(window.localStorage.getItem(SITE_THEME_STORAGE_KEY)).toBe("notebook")
    );
  });

  test("로그인 상태에서 테마를 바꾸면 사용자 설정에 저장한다", async () => {
    mockAuthState.currentUser = { uid: "tester" };

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("theme-loading")).toHaveTextContent("false")
    );

    fireEvent.click(screen.getByRole("button", { name: "한솔이의 노트북 저장" }));

    await waitFor(() =>
      expect(mockSaveUserSettings).toHaveBeenCalledWith("tester", {
        siteTheme: "notebook",
      })
    );
  });

  test("로그인 상태에서 기본 화면을 바꾸면 사용자 설정에 저장한다", async () => {
    mockAuthState.currentUser = { uid: "tester" };

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("default-screen-loading")).toHaveTextContent("false")
    );

    fireEvent.click(screen.getByRole("button", { name: "플레이 기본 화면 저장" }));

    await waitFor(() =>
      expect(mockSaveUserSettings).toHaveBeenCalledWith("tester", {
        defaultScreen: "play",
      })
    );
  });
});
