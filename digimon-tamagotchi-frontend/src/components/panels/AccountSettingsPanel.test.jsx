import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccountSettingsPanel from "./AccountSettingsPanel";

const mockSetTheme = jest.fn();
const mockUseAuth = jest.fn();
const mockGetTamerName = jest.fn();
const mockGetUserSettings = jest.fn();
const mockGetAchievementsAndMaxSlots = jest.fn();

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../../contexts/ThemeContext", () => ({
  SITE_THEME_OPTIONS: [
    { id: "default", label: "기본" },
    { id: "notebook", label: "노트북" },
  ],
  useTheme: () => ({
    themeId: "default",
    setTheme: mockSetTheme,
    isThemeLoading: false,
  }),
}));

jest.mock("../../hooks/useTamerProfile", () => ({
  emitTamerProfileRefresh: jest.fn(),
}));

jest.mock("../../utils/tamerNameUtils", () => ({
  checkNicknameAvailability: jest.fn(),
  getTamerName: (...args) => mockGetTamerName(...args),
  resetToDefaultTamerName: jest.fn(),
  updateTamerName: jest.fn(),
}));

jest.mock("../../utils/userSettingsUtils", () => ({
  getUserSettings: (...args) => mockGetUserSettings(...args),
  isValidDiscordWebhookUrl: jest.fn(() => true),
  normalizeSiteTheme: jest.fn((themeId) => themeId),
  saveUserSettings: jest.fn(),
}));

jest.mock("../../utils/userProfileUtils", () => ({
  ACHIEVEMENT_VER1_MASTER: "ver1",
  ACHIEVEMENT_VER2_MASTER: "ver2",
  BASE_MAX_SLOTS: 10,
  SLOTS_PER_MASTER: 1,
  getAchievementsAndMaxSlots: (...args) => mockGetAchievementsAndMaxSlots(...args),
}));

describe("AccountSettingsPanel 테마 선택", () => {
  beforeEach(() => {
    mockSetTheme.mockReset();
    mockUseAuth.mockReturnValue({
      currentUser: { uid: "tester", displayName: "한솔" },
    });
    mockGetTamerName.mockResolvedValue("한솔");
    mockGetUserSettings.mockResolvedValue({
      discordWebhookUrl: null,
      isNotificationEnabled: false,
      siteTheme: "default",
    });
    mockGetAchievementsAndMaxSlots.mockResolvedValue({
      achievements: [],
      maxSlots: 10,
    });
  });

  test("설정 패널에서 화면 테마를 선택하면 즉시 적용 저장을 호출한다", async () => {
    render(
      <AccountSettingsPanel
        slotCount={1}
        tamerName="한솔"
        setTamerName={jest.fn()}
        refreshProfile={jest.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText("화면 테마")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "노트북" }));

    await waitFor(() => expect(mockSetTheme).toHaveBeenCalledWith("notebook"));
  });
});
