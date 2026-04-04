import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccountSettingsPanel from "./AccountSettingsPanel";

const mockSetTheme = jest.fn();
const mockUseAuth = jest.fn();
const mockCheckNicknameAvailability = jest.fn();
const mockGetTamerName = jest.fn();
const mockResetToDefaultTamerName = jest.fn();
const mockUpdateTamerName = jest.fn();
const mockGetUserSettings = jest.fn();
const mockGetAchievementsAndMaxSlots = jest.fn();
const mockRefreshProfile = jest.fn();
const mockSetTamerNameParent = jest.fn();
let consoleErrorSpy;

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../../contexts/ThemeContext", () => ({
  SITE_THEME_OPTIONS: [
    { id: "default", label: "기본" },
    { id: "notebook", label: "한솔이의 노트북" },
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

jest.mock("../../utils/tamerNameUtils", () => {
  const actual = jest.requireActual("../../utils/tamerNameUtils");

  return {
    ...actual,
    checkNicknameAvailability: (...args) => mockCheckNicknameAvailability(...args),
    getTamerName: (...args) => mockGetTamerName(...args),
    resetToDefaultTamerName: (...args) => mockResetToDefaultTamerName(...args),
    updateTamerName: (...args) => mockUpdateTamerName(...args),
  };
});

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

function renderPanel() {
  return render(
    <AccountSettingsPanel
      slotCount={1}
      tamerName="한솔"
      setTamerName={mockSetTamerNameParent}
      refreshProfile={mockRefreshProfile}
    />
  );
}

describe("AccountSettingsPanel", () => {
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockSetTheme.mockReset();
    mockUseAuth.mockReturnValue({
      currentUser: { uid: "tester", displayName: "한솔" },
    });
    mockCheckNicknameAvailability.mockReset();
    mockGetTamerName.mockReset();
    mockResetToDefaultTamerName.mockReset();
    mockUpdateTamerName.mockReset();
    mockGetUserSettings.mockReset();
    mockGetAchievementsAndMaxSlots.mockReset();
    mockRefreshProfile.mockReset();
    mockRefreshProfile.mockResolvedValue(undefined);
    mockSetTamerNameParent.mockReset();

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

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  test("설정 패널에서 화면 테마를 선택하면 즉시 적용 저장을 호출한다", async () => {
    renderPanel();

    await waitFor(() => expect(screen.getByText("화면 테마")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "한솔이의 노트북" }));

    await waitFor(() => expect(mockSetTheme).toHaveBeenCalledWith("notebook"));
  });

  test("중복 확인 시 연속 공백을 1칸으로 정규화하고 안내 문구를 보여준다", async () => {
    mockCheckNicknameAvailability.mockResolvedValue({
      status: "available",
      isAvailable: true,
      message: "연속된 공백은 1칸으로 자동 변경됩니다. 사용 가능한 테이머명입니다.",
      normalizedNickname: "한 솔",
      normalizedKey: "한 솔",
      didNormalizeSpaces: true,
    });

    renderPanel();

    await waitFor(() => expect(screen.getByDisplayValue("한솔")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("테이머명을 입력하세요"), {
      target: { value: "한   솔" },
    });
    fireEvent.click(screen.getByRole("button", { name: "중복 확인" }));

    await waitFor(() =>
      expect(mockCheckNicknameAvailability).toHaveBeenCalledWith("한   솔", "tester")
    );
    await waitFor(() =>
      expect(screen.getByPlaceholderText("테이머명을 입력하세요")).toHaveValue("한 솔")
    );
    expect(
      screen.getByText("연속된 공백은 1칸으로 자동 변경됩니다. 사용 가능한 테이머명입니다.")
    ).toBeInTheDocument();
  });

  test("저장 시 정규화된 테이머명을 저장하고 성공 문구를 표시한다", async () => {
    mockUpdateTamerName.mockResolvedValue({
      normalizedNickname: "한 솔",
      normalizedKey: "한 솔",
      didNormalizeSpaces: true,
    });

    renderPanel();

    await waitFor(() => expect(screen.getByDisplayValue("한솔")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("테이머명을 입력하세요"), {
      target: { value: "한   솔" },
    });
    fireEvent.click(screen.getByRole("button", { name: "테이머명 저장" }));

    await waitFor(() =>
      expect(mockUpdateTamerName).toHaveBeenCalledWith("tester", "한   솔", "한솔")
    );
    await waitFor(() =>
      expect(screen.getByPlaceholderText("테이머명을 입력하세요")).toHaveValue("한 솔")
    );
    expect(mockSetTamerNameParent).toHaveBeenCalledWith("한 솔");
    expect(mockRefreshProfile).toHaveBeenCalled();
    expect(
      screen.getByText("연속된 공백은 1칸으로 자동 변경됩니다. 테이머명이 저장되었습니다.")
    ).toBeInTheDocument();
    expect(screen.getByText("현재 테이머명:")).toBeInTheDocument();
    expect(screen.getAllByText("한 솔").length).toBeGreaterThan(0);
  });

  test("현재 사용 중인 이름은 중복 확인 시 안내 문구를 보여주고 저장 버튼을 비활성화한다", async () => {
    mockCheckNicknameAvailability.mockResolvedValue({
      status: "current-user",
      isAvailable: true,
      message: "연속된 공백은 1칸으로 자동 변경됩니다. 현재 사용 중인 테이머명입니다.",
      normalizedNickname: "한솔",
      normalizedKey: "한솔",
      didNormalizeSpaces: true,
    });

    renderPanel();

    await waitFor(() => expect(screen.getByDisplayValue("한솔")).toBeInTheDocument());

    const saveButton = screen.getByRole("button", { name: "테이머명 저장" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("테이머명을 입력하세요"), {
      target: { value: "한  솔" },
    });
    fireEvent.click(screen.getByRole("button", { name: "중복 확인" }));

    await waitFor(() =>
      expect(screen.getByText("연속된 공백은 1칸으로 자동 변경됩니다. 현재 사용 중인 테이머명입니다.")).toBeInTheDocument()
    );
    expect(screen.getByPlaceholderText("테이머명을 입력하세요")).toHaveValue("한솔");
    expect(screen.getByRole("button", { name: "테이머명 저장" })).toBeDisabled();
  });

  test("저장 후 프로필 새로고침만 실패하면 경고 문구를 표시하고 저장 상태는 유지한다", async () => {
    mockUpdateTamerName.mockResolvedValue({
      normalizedNickname: "새 이름",
      normalizedKey: "새 이름",
      didNormalizeSpaces: false,
    });
    mockRefreshProfile.mockRejectedValue(new Error("refresh failed"));

    renderPanel();

    await waitFor(() => expect(screen.getByDisplayValue("한솔")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("테이머명을 입력하세요"), {
      target: { value: "새 이름" },
    });
    fireEvent.click(screen.getByRole("button", { name: "테이머명 저장" }));

    await waitFor(() =>
      expect(screen.getByText("테이머명이 저장되었습니다. 프로필 새로고침이 늦을 수 있습니다.")).toBeInTheDocument()
    );
    expect(mockSetTamerNameParent).toHaveBeenCalledWith("새 이름");
    expect(screen.getByPlaceholderText("테이머명을 입력하세요")).toHaveValue("새 이름");
    expect(screen.getAllByText("새 이름").length).toBeGreaterThan(0);
  });

  test("현재 이름과 같은 입력은 저장을 시도하지 않고 안내만 유지한다", async () => {
    renderPanel();

    await waitFor(() => expect(screen.getByDisplayValue("한솔")).toBeInTheDocument());

    const saveButton = screen.getByRole("button", { name: "테이머명 저장" });
    expect(saveButton).toBeDisabled();

    fireEvent.click(saveButton);

    expect(mockUpdateTamerName).not.toHaveBeenCalled();
  });
});
