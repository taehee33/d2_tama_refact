import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_IMMERSIVE_SETTINGS,
  IMMERSIVE_LANDSCAPE_SIDES,
  IMMERSIVE_LAYOUT_MODES,
} from "../../data/immersiveSettings";
import {
  enterImmersiveLandscapeMode,
  exitImmersiveLandscapeMode,
  getImmersiveOrientationSupportState,
  isImmersiveFullscreenActive,
} from "../../utils/immersiveOrientation";
import {
  getImmersiveSkinById,
  getNextImmersiveLandscapeSide,
  normalizeImmersiveSettings,
} from "../../utils/immersiveSettings";

function getViewportSnapshot() {
  if (typeof window === "undefined") {
    return {
      isMobile: false,
      isViewportPortrait: true,
      detectedLandscapeSide: IMMERSIVE_LANDSCAPE_SIDES.RIGHT,
    };
  }

  const width = window.innerWidth || 0;
  const height = window.innerHeight || 0;
  const isViewportPortrait = height >= width;
  const isMobile = width > 0 && width <= 768;

  return {
    isMobile,
    isViewportPortrait,
    detectedLandscapeSide: detectLandscapeSide(window),
  };
}

function detectLandscapeSide(windowRef) {
  const screenOrientation = windowRef.screen?.orientation;
  const orientationType = screenOrientation?.type;

  if (orientationType === "landscape-primary") {
    return IMMERSIVE_LANDSCAPE_SIDES.RIGHT;
  }

  if (orientationType === "landscape-secondary") {
    return IMMERSIVE_LANDSCAPE_SIDES.LEFT;
  }

  const rawAngle =
    typeof screenOrientation?.angle === "number"
      ? screenOrientation.angle
      : typeof windowRef.orientation === "number"
        ? windowRef.orientation
        : null;

  if (rawAngle === 90) {
    return IMMERSIVE_LANDSCAPE_SIDES.RIGHT;
  }

  if (rawAngle === -90 || rawAngle === 270) {
    return IMMERSIVE_LANDSCAPE_SIDES.LEFT;
  }

  return IMMERSIVE_LANDSCAPE_SIDES.RIGHT;
}

function buildFullscreenSupportContext() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      element: null,
      documentRef: null,
      screenRef: null,
      userAgent: "",
      vendor: "",
    };
  }

  return {
    element: null,
    documentRef: document,
    screenRef: window.screen,
    userAgent: window.navigator?.userAgent || "",
    vendor: window.navigator?.vendor || "",
  };
}

const VIEWPORT_SETTLE_DELAY_MS = 160;

export function useImmersiveGameLayout({
  isImmersive,
  immersiveSettings,
  setImmersiveSettings,
  isChatOpen,
  setIsChatOpen,
}) {
  const immersiveExperienceRef = useRef(null);
  const [showSkinPicker, setShowSkinPicker] = useState(false);
  const [isMobileControlsCollapsed, setIsMobileControlsCollapsed] = useState(() =>
    getViewportSnapshot().isMobile
  );
  const [showVirtualLandscapePrompt, setShowVirtualLandscapePrompt] = useState(false);
  const [hasDeclinedVirtualLandscape, setHasDeclinedVirtualLandscape] = useState(false);
  const [hasApprovedVirtualLandscape, setHasApprovedVirtualLandscape] = useState(false);
  const [isVirtualLandscapeActive, setIsVirtualLandscapeActive] = useState(false);
  const [isMobile, setIsMobile] = useState(() => getViewportSnapshot().isMobile);
  const [isViewportPortrait, setIsViewportPortrait] = useState(
    () => getViewportSnapshot().isViewportPortrait
  );
  const [detectedLandscapeSide, setDetectedLandscapeSide] = useState(
    () => getViewportSnapshot().detectedLandscapeSide
  );
  const [isImmersiveFullscreen, setIsImmersiveFullscreen] = useState(() =>
    typeof document === "undefined" ? false : isImmersiveFullscreenActive(document)
  );
  const [orientationLockSupported, setOrientationLockSupported] = useState(false);
  const [orientationLockError, setOrientationLockError] = useState(null);

  const normalizedImmersiveSettings = useMemo(
    () => normalizeImmersiveSettings(immersiveSettings),
    [immersiveSettings]
  );
  const immersiveLayoutMode =
    normalizedImmersiveSettings.layoutMode || DEFAULT_IMMERSIVE_SETTINGS.layoutMode;
  const immersiveSkinId =
    normalizedImmersiveSettings.skinId || DEFAULT_IMMERSIVE_SETTINGS.skinId;
  const landscapeSidePreference =
    normalizedImmersiveSettings.landscapeSide ||
    DEFAULT_IMMERSIVE_SETTINGS.landscapeSide;
  const immersiveSkin = useMemo(
    () => getImmersiveSkinById(immersiveSkinId),
    [immersiveSkinId]
  );
  const isLandscapeImmersive =
    isImmersive && immersiveLayoutMode === IMMERSIVE_LAYOUT_MODES.LANDSCAPE;
  const effectiveLandscapeSide =
    landscapeSidePreference === IMMERSIVE_LANDSCAPE_SIDES.AUTO
      ? detectedLandscapeSide
      : landscapeSidePreference;
  const virtualLandscapeDirection =
    effectiveLandscapeSide === IMMERSIVE_LANDSCAPE_SIDES.LEFT
      ? IMMERSIVE_LANDSCAPE_SIDES.LEFT
      : IMMERSIVE_LANDSCAPE_SIDES.RIGHT;
  const shouldShowRotateHint =
    isLandscapeImmersive &&
    isMobile &&
    isViewportPortrait &&
    !isVirtualLandscapeActive;
  const orientationStatusMessage =
    isLandscapeImmersive && isMobile
      ? showVirtualLandscapePrompt
        ? null
        : isVirtualLandscapeActive
          ? "가상 가로 모드로 보는 중"
          : (orientationLockError ||
              (isImmersiveFullscreen && orientationLockSupported
                ? "가로 전체화면으로 보는 중"
                : null))
      : null;
  const orientationStatusTone =
    orientationLockError &&
    isLandscapeImmersive &&
    isMobile &&
    !isVirtualLandscapeActive
      ? "warning"
      : "success";
  const virtualLandscapePromptMessage = orientationLockError
    ? `${orientationLockError} 앱 화면을 가상 가로로 돌릴까요?`
    : "브라우저가 실제 가로 고정을 지원하지 않아요. 앱 화면을 가상 가로로 돌릴까요?";

  useEffect(() => {
    if (!isImmersive) {
      setShowSkinPicker(false);
      setOrientationLockError(null);
      setShowVirtualLandscapePrompt(false);
      setHasDeclinedVirtualLandscape(false);
      setHasApprovedVirtualLandscape(false);
      setIsVirtualLandscapeActive(false);
      return undefined;
    }

    return () => {
      setIsChatOpen(false);
      void exitImmersiveLandscapeMode({
        documentRef: document,
        screenRef: window.screen,
        userAgent: window.navigator?.userAgent || "",
        vendor: window.navigator?.vendor || "",
      });
    };
  }, [isImmersive, setIsChatOpen]);

  useEffect(() => {
    if (!isImmersive || !isMobile) {
      setIsMobileControlsCollapsed(false);
      return;
    }

    setIsMobileControlsCollapsed(true);
  }, [isImmersive, isMobile]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const updateViewportState = () => {
      const snapshot = getViewportSnapshot();
      setIsMobile(snapshot.isMobile);
      setIsViewportPortrait(snapshot.isViewportPortrait);
      setDetectedLandscapeSide(snapshot.detectedLandscapeSide);
    };

    const handleFullscreenChange = () => {
      if (typeof document !== "undefined") {
        setIsImmersiveFullscreen(isImmersiveFullscreenActive(document));
      }
    };

    updateViewportState();

    window.addEventListener("resize", updateViewportState);
    window.addEventListener("orientationchange", updateViewportState);
    window.screen?.orientation?.addEventListener?.("change", updateViewportState);
    document?.addEventListener?.("fullscreenchange", handleFullscreenChange);
    document?.addEventListener?.("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("resize", updateViewportState);
      window.removeEventListener("orientationchange", updateViewportState);
      window.screen?.orientation?.removeEventListener?.("change", updateViewportState);
      document?.removeEventListener?.("fullscreenchange", handleFullscreenChange);
      document?.removeEventListener?.("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!isLandscapeImmersive || !isMobile || !isViewportPortrait) {
      setIsVirtualLandscapeActive(false);
      setShowVirtualLandscapePrompt(false);
    }
  }, [isLandscapeImmersive, isMobile, isViewportPortrait]);

  useEffect(() => {
    if (!isMobile) {
      setOrientationLockSupported(false);
      return;
    }

    const supportState = getImmersiveOrientationSupportState({
      ...buildFullscreenSupportContext(),
      element: immersiveExperienceRef.current,
    });

    setOrientationLockSupported(supportState.orientationLockSupported);
  }, [isMobile, isImmersive]);

  const updateImmersiveSettings = useCallback(
    (partialSettings) => {
      setImmersiveSettings((previousSettings) =>
        normalizeImmersiveSettings({
          ...normalizeImmersiveSettings(previousSettings),
          ...partialSettings,
        })
      );
    },
    [setImmersiveSettings]
  );

  const toggleMobileControls = useCallback((nextCollapsed) => {
    setIsMobileControlsCollapsed((previous) =>
      typeof nextCollapsed === "boolean" ? nextCollapsed : !previous
    );
  }, []);

  const confirmVirtualLandscape = useCallback(() => {
    setHasApprovedVirtualLandscape(true);
    setHasDeclinedVirtualLandscape(false);
    setShowVirtualLandscapePrompt(false);
    setIsVirtualLandscapeActive(true);
    setOrientationLockError(null);
  }, []);

  const dismissVirtualLandscape = useCallback(() => {
    setHasDeclinedVirtualLandscape(true);
    setHasApprovedVirtualLandscape(false);
    setShowVirtualLandscapePrompt(false);
    setIsVirtualLandscapeActive(false);
  }, []);

  const handleLayoutModeChange = useCallback(
    async (nextLayoutMode) => {
      const isSwitchingToLandscape =
        nextLayoutMode === IMMERSIVE_LAYOUT_MODES.LANDSCAPE;
      const isSwitchingToPortrait =
        nextLayoutMode === IMMERSIVE_LAYOUT_MODES.PORTRAIT;
      const isSameLayoutMode = immersiveLayoutMode === nextLayoutMode;

      if (!isSameLayoutMode) {
        updateImmersiveSettings({ layoutMode: nextLayoutMode });
      }

      if (!isImmersive || !isMobile) {
        if (isSwitchingToPortrait) {
          setOrientationLockError(null);
        }
        return;
      }

      if (isSwitchingToPortrait) {
        setOrientationLockError(null);
        setShowVirtualLandscapePrompt(false);
        setHasDeclinedVirtualLandscape(false);
        setHasApprovedVirtualLandscape(false);
        setIsVirtualLandscapeActive(false);

        const result = await exitImmersiveLandscapeMode({
          documentRef: document,
          screenRef: window.screen,
          userAgent: window.navigator?.userAgent || "",
          vendor: window.navigator?.vendor || "",
        });

        setIsImmersiveFullscreen(result.isFullscreen);
        setOrientationLockSupported(result.orientationLockSupported);
        return;
      }

      if (!isSwitchingToLandscape) {
        return;
      }

      const shouldSkipRetry =
        isSameLayoutMode &&
        isImmersiveFullscreen &&
        orientationLockSupported &&
        !orientationLockError;

      if (shouldSkipRetry) {
        return;
      }

      setOrientationLockError(null);
      setShowVirtualLandscapePrompt(false);

      const result = await enterImmersiveLandscapeMode({
        element: immersiveExperienceRef.current,
        documentRef: document,
        screenRef: window.screen,
        userAgent: window.navigator?.userAgent || "",
        vendor: window.navigator?.vendor || "",
      });

      setIsImmersiveFullscreen(result.isFullscreen);
      setOrientationLockSupported(result.orientationLockSupported);

      await new Promise((resolve) => {
        window.setTimeout(resolve, VIEWPORT_SETTLE_DELAY_MS);
      });

      const latestViewportSnapshot = getViewportSnapshot();
      const failedToReachLandscapeViewport = latestViewportSnapshot.isViewportPortrait;
      const landscapeRequestFailed = Boolean(result.errorMessage) || failedToReachLandscapeViewport;

      if (!landscapeRequestFailed) {
        setOrientationLockError(null);
        setShowVirtualLandscapePrompt(false);
        setIsVirtualLandscapeActive(false);
        return;
      }

      const fallbackMessage =
        result.errorMessage ||
        "브라우저가 실제 가로 고정을 지원하지 않아요. 직접 회전하거나 가상 가로를 사용할 수 있어요.";

      setOrientationLockError(fallbackMessage);

      if (!latestViewportSnapshot.isViewportPortrait) {
        setShowVirtualLandscapePrompt(false);
        setIsVirtualLandscapeActive(false);
        return;
      }

      if (hasApprovedVirtualLandscape) {
        setShowVirtualLandscapePrompt(false);
        setIsVirtualLandscapeActive(true);
        return;
      }

      if (hasDeclinedVirtualLandscape) {
        setShowVirtualLandscapePrompt(false);
        setIsVirtualLandscapeActive(false);
        return;
      }

      setShowVirtualLandscapePrompt(true);
      setIsVirtualLandscapeActive(false);
      setIsMobileControlsCollapsed(true);
    },
    [
      hasApprovedVirtualLandscape,
      hasDeclinedVirtualLandscape,
      immersiveLayoutMode,
      isImmersive,
      isImmersiveFullscreen,
      isMobile,
      orientationLockError,
      orientationLockSupported,
      updateImmersiveSettings,
    ]
  );

  const handleCycleLandscapeSide = useCallback(() => {
    updateImmersiveSettings({
      landscapeSide: getNextImmersiveLandscapeSide(landscapeSidePreference),
    });
  }, [landscapeSidePreference, updateImmersiveSettings]);

  const handleToggleImmersiveChat = useCallback(() => {
    setIsMobileControlsCollapsed(true);
    setIsChatOpen((previous) => !previous);
  }, [setIsChatOpen]);

  const handleCloseImmersiveChat = useCallback(() => {
    setIsChatOpen(false);
  }, [setIsChatOpen]);

  const handleSkinSelect = useCallback(
    (nextSkinId) => {
      updateImmersiveSettings({ skinId: nextSkinId });
      setShowSkinPicker(false);
      setIsMobileControlsCollapsed(true);
    },
    [updateImmersiveSettings]
  );

  const toggleSkinPicker = useCallback(() => {
    setIsMobileControlsCollapsed(true);
    setShowSkinPicker((previous) => !previous);
  }, []);

  return {
    immersiveExperienceRef,
    showSkinPicker,
    setShowSkinPicker,
    isMobileControlsCollapsed,
    showVirtualLandscapePrompt,
    isVirtualLandscapeActive,
    isMobile,
    isViewportPortrait,
    detectedLandscapeSide,
    isImmersiveFullscreen,
    orientationLockSupported,
    orientationLockError,
    normalizedImmersiveSettings,
    immersiveLayoutMode,
    immersiveSkinId,
    immersiveSkin,
    landscapeSidePreference,
    effectiveLandscapeSide,
    virtualLandscapeDirection,
    isLandscapeImmersive,
    shouldShowRotateHint,
    orientationStatusMessage,
    orientationStatusTone,
    virtualLandscapePromptMessage,
    isChatOpen,
    layoutMode: immersiveLayoutMode,
    skinId: immersiveSkinId,
    skin: immersiveSkin,
    toggleMobileControls,
    confirmVirtualLandscape,
    dismissVirtualLandscape,
    changeLayoutMode: handleLayoutModeChange,
    cycleLandscapeSide: handleCycleLandscapeSide,
    toggleImmersiveChat: handleToggleImmersiveChat,
    closeImmersiveChat: handleCloseImmersiveChat,
    toggleSkinPicker,
    selectSkin: handleSkinSelect,
    updateImmersiveSettings,
    handleLayoutModeChange,
    handleCycleLandscapeSide,
    handleToggleImmersiveChat,
    handleCloseImmersiveChat,
    handleSkinSelect,
  };
}
