import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import {
  DEFAULT_IMMERSIVE_SETTINGS,
  IMMERSIVE_LANDSCAPE_SIDES,
  IMMERSIVE_LAYOUT_MODES,
  IMMERSIVE_SKINS,
} from "../../data/immersiveSettings";
import { useImmersiveGameLayout } from "./useImmersiveGameLayout";

const mockEnterImmersiveFullscreen = jest.fn();
const mockEnterImmersiveLandscapeMode = jest.fn();
const mockExitImmersiveFullscreen = jest.fn();
const mockExitImmersiveLandscapeMode = jest.fn();
const mockGetImmersiveOrientationSupportState = jest.fn();
const mockIsImmersiveFullscreenActive = jest.fn();

jest.mock("../../utils/immersiveOrientation", () => ({
  enterImmersiveFullscreen: (...args) => mockEnterImmersiveFullscreen(...args),
  enterImmersiveLandscapeMode: (...args) => mockEnterImmersiveLandscapeMode(...args),
  exitImmersiveFullscreen: (...args) => mockExitImmersiveFullscreen(...args),
  exitImmersiveLandscapeMode: (...args) => mockExitImmersiveLandscapeMode(...args),
  getImmersiveOrientationSupportState: (...args) =>
    mockGetImmersiveOrientationSupportState(...args),
  isImmersiveFullscreenActive: (...args) => mockIsImmersiveFullscreenActive(...args),
}));

describe("useImmersiveGameLayout", () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    mockEnterImmersiveFullscreen.mockReset();
    mockEnterImmersiveLandscapeMode.mockReset();
    mockExitImmersiveFullscreen.mockReset();
    mockExitImmersiveLandscapeMode.mockReset();
    mockGetImmersiveOrientationSupportState.mockReset();
    mockIsImmersiveFullscreenActive.mockReset();
    jest.spyOn(window, "setTimeout").mockImplementation((callback) => {
      callback();
      return 0;
    });

    mockGetImmersiveOrientationSupportState.mockReturnValue({
      fullscreenSupported: true,
      orientationLockSupported: true,
    });
    mockIsImmersiveFullscreenActive.mockReturnValue(false);
    mockEnterImmersiveFullscreen.mockResolvedValue({
      isFullscreen: true,
      fullscreenSupported: true,
      errorMessage: null,
    });
    mockEnterImmersiveLandscapeMode.mockResolvedValue({
      isFullscreen: true,
      orientationLockSupported: true,
      errorMessage: null,
    });
    mockExitImmersiveFullscreen.mockResolvedValue({
      isFullscreen: false,
      fullscreenSupported: true,
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
    expect(result.current.isLandscapeInfoOpen).toBe(false);
    expect(result.current.fullscreenSupported).toBe(true);
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
      result.current.toggleLandscapeInfo();
    });

    expect(result.current.isLandscapeInfoOpen).toBe(true);

    act(() => {
      result.current.handleSkinSelect(nextSkinId);
    });

    expect(result.current.showSkinPicker).toBe(false);
    expect(result.current.isLandscapeInfoOpen).toBe(false);
    expect(result.current.immersiveSkinId).toBe(nextSkinId);
    expect(result.current.immersiveSkin.id).toBe(nextSkinId);
  });

  test("fullscreen-only 토글이 세로 몰입형에서도 동작한다", async () => {
    const initialSettings = {
      layoutMode: IMMERSIVE_LAYOUT_MODES.PORTRAIT,
      skinId: DEFAULT_IMMERSIVE_SETTINGS.skinId,
      landscapeSide: DEFAULT_IMMERSIVE_SETTINGS.landscapeSide,
    };

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
      await result.current.toggleImmersiveFullscreen();
    });

    expect(mockEnterImmersiveFullscreen).toHaveBeenCalledTimes(1);
    expect(result.current.isImmersiveFullscreen).toBe(true);
    expect(result.current.orientationStatusMessage).toBe("전체화면으로 보는 중");

    await act(async () => {
      await result.current.toggleImmersiveFullscreen();
    });

    expect(mockExitImmersiveFullscreen).toHaveBeenCalledTimes(1);
    expect(result.current.isImmersiveFullscreen).toBe(false);
  });

  test("fullscreen-only 실패 시 안내 메시지를 노출한다", async () => {
    const initialSettings = {
      layoutMode: IMMERSIVE_LAYOUT_MODES.PORTRAIT,
      skinId: DEFAULT_IMMERSIVE_SETTINGS.skinId,
      landscapeSide: DEFAULT_IMMERSIVE_SETTINGS.landscapeSide,
    };

    mockEnterImmersiveFullscreen.mockResolvedValue({
      isFullscreen: false,
      fullscreenSupported: false,
      errorMessage: "이 브라우저에서는 전체화면을 지원하지 않아요.",
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
      await result.current.toggleImmersiveFullscreen();
    });

    expect(result.current.fullscreenErrorMessage).toBe(
      "이 브라우저에서는 전체화면을 지원하지 않아요."
    );
    expect(result.current.orientationStatusMessage).toBe(
      "이 브라우저에서는 전체화면을 지원하지 않아요."
    );
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
  });

  test("가로 요청 실패 시 prompt 없이 직접 회전 안내만 남긴다", async () => {
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

    expect(result.current.orientationStatusMessage).toContain("직접 회전");
  });

  test("가로 요청 실패 후 재시도해도 가상 가로 없이 직접 회전 안내를 유지한다", async () => {
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

    await act(async () => {
      await result.current.handleLayoutModeChange(
        IMMERSIVE_LAYOUT_MODES.LANDSCAPE
      );
    });

    expect(result.current.orientationStatusMessage).toContain("브라우저가 허용하지 않았어요");
  });
});
