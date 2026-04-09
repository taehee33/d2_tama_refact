import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import {
  DEFAULT_IMMERSIVE_SETTINGS,
  IMMERSIVE_LANDSCAPE_SIDES,
  IMMERSIVE_LAYOUT_MODES,
  IMMERSIVE_SKINS,
} from "../../data/immersiveSettings";
import { useImmersiveGameLayout } from "./useImmersiveGameLayout";

const mockEnterImmersiveLandscapeMode = jest.fn();
const mockExitImmersiveLandscapeMode = jest.fn();
const mockGetImmersiveOrientationSupportState = jest.fn();
const mockIsImmersiveFullscreenActive = jest.fn();

jest.mock("../../utils/immersiveOrientation", () => ({
  enterImmersiveLandscapeMode: (...args) => mockEnterImmersiveLandscapeMode(...args),
  exitImmersiveLandscapeMode: (...args) => mockExitImmersiveLandscapeMode(...args),
  getImmersiveOrientationSupportState: (...args) =>
    mockGetImmersiveOrientationSupportState(...args),
  isImmersiveFullscreenActive: (...args) => mockIsImmersiveFullscreenActive(...args),
}));

describe("useImmersiveGameLayout", () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    mockEnterImmersiveLandscapeMode.mockReset();
    mockExitImmersiveLandscapeMode.mockReset();
    mockGetImmersiveOrientationSupportState.mockReset();
    mockIsImmersiveFullscreenActive.mockReset();
    jest.spyOn(window, "setTimeout").mockImplementation((callback) => {
      callback();
      return 0;
    });

    mockGetImmersiveOrientationSupportState.mockReturnValue({
      orientationLockSupported: true,
    });
    mockIsImmersiveFullscreenActive.mockReturnValue(false);
    mockEnterImmersiveLandscapeMode.mockResolvedValue({
      isFullscreen: true,
      orientationLockSupported: true,
      errorMessage: null,
    });
    mockExitImmersiveLandscapeMode.mockResolvedValue({
      isFullscreen: false,
      orientationLockSupported: false,
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight,
    });
    jest.restoreAllMocks();
  });

  test("layout/skin 파생값을 계산하고 skin 선택 시 picker를 닫는다", () => {
    const initialSettings = {
      layoutMode: IMMERSIVE_LAYOUT_MODES.LANDSCAPE,
      skinId: IMMERSIVE_SKINS[0].id,
      landscapeSide: DEFAULT_IMMERSIVE_SETTINGS.landscapeSide,
    };
    const nextSkinId = IMMERSIVE_SKINS[1].id;

    const { result } = renderHook(() => {
      const [immersiveSettings, setImmersiveSettings] = useState(initialSettings);
      const [isChatOpen, setIsChatOpen] = useState(false);

      return useImmersiveGameLayout({
        isImmersive: true,
        immersiveSettings,
        setImmersiveSettings,
        isChatOpen,
        setIsChatOpen,
      });
    });

    expect(result.current.immersiveLayoutMode).toBe(IMMERSIVE_LAYOUT_MODES.LANDSCAPE);
    expect(result.current.immersiveSkinId).toBe(IMMERSIVE_SKINS[0].id);
    expect(result.current.immersiveSkin.id).toBe(IMMERSIVE_SKINS[0].id);
    expect(result.current.isLandscapeImmersive).toBe(true);
    expect(result.current.shouldShowRotateHint).toBe(true);
    expect(result.current.isMobileControlsCollapsed).toBe(true);
    expect(result.current.effectiveLandscapeSide).toBe(
      IMMERSIVE_LANDSCAPE_SIDES.RIGHT
    );

    act(() => {
      result.current.toggleMobileControls(false);
    });

    expect(result.current.isMobileControlsCollapsed).toBe(false);

    act(() => {
      result.current.toggleSkinPicker();
    });

    expect(result.current.showSkinPicker).toBe(true);

    act(() => {
      result.current.handleSkinSelect(nextSkinId);
    });

    expect(result.current.showSkinPicker).toBe(false);
    expect(result.current.immersiveSkinId).toBe(nextSkinId);
    expect(result.current.immersiveSkin.id).toBe(nextSkinId);
  });

  test("chat 토글이 동작하고 모바일 가로 요청 성공 시 전체화면 상태 메시지를 보여준다", async () => {
    const initialSettings = {
      layoutMode: IMMERSIVE_LAYOUT_MODES.PORTRAIT,
      skinId: DEFAULT_IMMERSIVE_SETTINGS.skinId,
      landscapeSide: DEFAULT_IMMERSIVE_SETTINGS.landscapeSide,
    };

    mockEnterImmersiveLandscapeMode.mockImplementation(async () => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 844,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: 390,
      });

      return {
        isFullscreen: true,
        orientationLockSupported: true,
        errorMessage: null,
      };
    });

    const { result } = renderHook(() => {
      const [immersiveSettings, setImmersiveSettings] = useState(initialSettings);
      const [isChatOpen, setIsChatOpen] = useState(false);

      return useImmersiveGameLayout({
        isImmersive: true,
        immersiveSettings,
        setImmersiveSettings,
        isChatOpen,
        setIsChatOpen,
      });
    });

    act(() => {
      result.current.handleToggleImmersiveChat();
    });

    expect(result.current.isChatOpen).toBe(true);

    await act(async () => {
      await result.current.handleLayoutModeChange(
        IMMERSIVE_LAYOUT_MODES.LANDSCAPE
      );
    });

    expect(mockEnterImmersiveLandscapeMode).toHaveBeenCalled();
    expect(result.current.immersiveLayoutMode).toBe(IMMERSIVE_LAYOUT_MODES.LANDSCAPE);
    expect(result.current.orientationStatusMessage).toBe("가로 전체화면으로 보는 중");
    expect(result.current.orientationStatusTone).toBe("success");
    expect(result.current.showVirtualLandscapePrompt).toBe(false);
    expect(result.current.isVirtualLandscapeActive).toBe(false);
  });

  test("가로 요청 실패 시 prompt를 띄우고 승인하면 가상 가로를 활성화한다", async () => {
    const initialSettings = {
      layoutMode: IMMERSIVE_LAYOUT_MODES.PORTRAIT,
      skinId: DEFAULT_IMMERSIVE_SETTINGS.skinId,
      landscapeSide: DEFAULT_IMMERSIVE_SETTINGS.landscapeSide,
    };

    mockEnterImmersiveLandscapeMode.mockResolvedValue({
      isFullscreen: true,
      orientationLockSupported: false,
      errorMessage: "이 브라우저에서는 가로 고정을 지원하지 않아요. 직접 회전해 주세요.",
    });

    const { result } = renderHook(() => {
      const [immersiveSettings, setImmersiveSettings] = useState(initialSettings);
      const [isChatOpen, setIsChatOpen] = useState(false);

      return useImmersiveGameLayout({
        isImmersive: true,
        immersiveSettings,
        setImmersiveSettings,
        isChatOpen,
        setIsChatOpen,
      });
    });

    await act(async () => {
      await result.current.handleLayoutModeChange(
        IMMERSIVE_LAYOUT_MODES.LANDSCAPE
      );
    });

    expect(result.current.showVirtualLandscapePrompt).toBe(true);
    expect(result.current.orientationStatusMessage).toBeNull();
    expect(result.current.virtualLandscapePromptMessage).toContain("가상 가로");

    act(() => {
      result.current.confirmVirtualLandscape();
    });

    expect(result.current.showVirtualLandscapePrompt).toBe(false);
    expect(result.current.isVirtualLandscapeActive).toBe(true);
    expect(result.current.orientationStatusMessage).toBe("가상 가로 모드로 보는 중");
  });

  test("가상 가로를 취소하면 같은 세션 재시도에서 prompt를 다시 띄우지 않는다", async () => {
    const initialSettings = {
      layoutMode: IMMERSIVE_LAYOUT_MODES.PORTRAIT,
      skinId: DEFAULT_IMMERSIVE_SETTINGS.skinId,
      landscapeSide: DEFAULT_IMMERSIVE_SETTINGS.landscapeSide,
    };

    mockEnterImmersiveLandscapeMode.mockResolvedValue({
      isFullscreen: true,
      orientationLockSupported: false,
      errorMessage: "가로 고정을 시도했지만 브라우저가 허용하지 않았어요.",
    });

    const { result } = renderHook(() => {
      const [immersiveSettings, setImmersiveSettings] = useState(initialSettings);
      const [isChatOpen, setIsChatOpen] = useState(false);

      return useImmersiveGameLayout({
        isImmersive: true,
        immersiveSettings,
        setImmersiveSettings,
        isChatOpen,
        setIsChatOpen,
      });
    });

    await act(async () => {
      await result.current.handleLayoutModeChange(
        IMMERSIVE_LAYOUT_MODES.LANDSCAPE
      );
    });

    act(() => {
      result.current.dismissVirtualLandscape();
    });

    expect(result.current.showVirtualLandscapePrompt).toBe(false);
    expect(result.current.isVirtualLandscapeActive).toBe(false);

    await act(async () => {
      await result.current.handleLayoutModeChange(
        IMMERSIVE_LAYOUT_MODES.LANDSCAPE
      );
    });

    expect(result.current.showVirtualLandscapePrompt).toBe(false);
    expect(result.current.isVirtualLandscapeActive).toBe(false);
    expect(result.current.orientationStatusMessage).toContain("브라우저가 허용하지 않았어요");
  });
});
