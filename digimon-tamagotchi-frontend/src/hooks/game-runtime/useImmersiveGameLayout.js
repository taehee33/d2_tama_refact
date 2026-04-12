import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_IMMERSIVE_SETTINGS,
  IMMERSIVE_LANDSCAPE_SIDES,
  IMMERSIVE_LAYOUT_MODES,
} from "../../data/immersiveSettings";
import {
  enterImmersiveFullscreen,
  enterImmersiveLandscapeMode,
  exitImmersiveFullscreen,
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
  const [isLandscapeInfoOpen, setIsLandscapeInfoOpen] = useState(false);
  const [isMobileControlsCollapsed, setIsMobileControlsCollapsed] = useState(() =>
    getViewportSnapshot().isMobile
  );
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
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [fullscreenErrorMessage, setFullscreenErrorMessage] = useState(null);
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
  const shouldShowRotateHint =
    isLandscapeImmersive &&
    isMobile &&
    isViewportPortrait;
  const orientationStatusMessage = fullscreenErrorMessage
    ? fullscreenErrorMessage
    : isLandscapeImmersive && isMobile
      ? orientationLockError
        ? orientationLockError
        : isImmersiveFullscreen && orientationLockSupported
          ? "가로 전체화면으로 보는 중"
          : isImmersiveFullscreen
            ? "전체화면으로 보는 중"
            : null
      : isImmersiveFullscreen
        ? "전체화면으로 보는 중"
        : null;
  const orientationStatusTone =
    fullscreenErrorMessage || (orientationLockError && isLandscapeImmersive && isMobile)
      ? "warning"
      : "success";

  useEffect(() => {
    if (!isImmersive) {
      setShowSkinPicker(false);
      setIsLandscapeInfoOpen(false);
      setFullscreenErrorMessage(null);
      setOrientationLockError(null);
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
    if (!isLandscapeImmersive) {
      setIsLandscapeInfoOpen(false);
    }
  }, [isLandscapeImmersive]);

  useEffect(() => {
    if (isLandscapeImmersive && !isViewportPortrait) {
      setOrientationLockError(null);
    }
  }, [isLandscapeImmersive, isViewportPortrait]);

  useEffect(() => {
    const supportState = getImmersiveOrientationSupportState({
      ...buildFullscreenSupportContext(),
      element: immersiveExperienceRef.current,
    });

    setFullscreenSupported(supportState.fullscreenSupported);
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

  const toggleLandscapeInfo = useCallback(() => {
    if (!isLandscapeImmersive) {
      return;
    }

    setShowSkinPicker(false);
    setIsChatOpen(false);
    setIsLandscapeInfoOpen((previous) => !previous);
  }, [isLandscapeImmersive, setIsChatOpen]);

  const closeLandscapeInfo = useCallback(() => {
    setIsLandscapeInfoOpen(false);
  }, []);

  const handleToggleImmersiveFullscreen = useCallback(async () => {
    if (!isImmersive) {
      return;
    }

    setFullscreenErrorMessage(null);

    if (isImmersiveFullscreen) {
      const result = await exitImmersiveFullscreen({
        documentRef: document,
        screenRef: window.screen,
        userAgent: window.navigator?.userAgent || "",
        vendor: window.navigator?.vendor || "",
      });

      setIsImmersiveFullscreen(result.isFullscreen);
      setFullscreenSupported(result.fullscreenSupported);
      return;
    }

    const result = await enterImmersiveFullscreen({
      element: immersiveExperienceRef.current,
      documentRef: document,
      screenRef: window.screen,
      userAgent: window.navigator?.userAgent || "",
      vendor: window.navigator?.vendor || "",
    });

    setIsImmersiveFullscreen(result.isFullscreen);
    setFullscreenSupported(result.fullscreenSupported);
    setFullscreenErrorMessage(result.errorMessage);
  }, [isImmersive, isImmersiveFullscreen]);

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
        setIsLandscapeInfoOpen(false);
        setOrientationLockError(null);
      }
      return;
      }

      if (isSwitchingToPortrait) {
        setIsLandscapeInfoOpen(false);
        setOrientationLockError(null);

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
      setFullscreenErrorMessage(null);

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
        return;
      }

      const fallbackMessage =
        result.errorMessage ||
        "브라우저가 실제 가로 고정을 지원하지 않아요. 회전 잠금을 끄고 직접 돌려 주세요.";

      setOrientationLockError(fallbackMessage);
      setIsMobileControlsCollapsed(true);
    },
    [
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
    setIsLandscapeInfoOpen(false);
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
      setIsLandscapeInfoOpen(false);
      setIsMobileControlsCollapsed(true);
    },
    [updateImmersiveSettings]
  );

  const toggleSkinPicker = useCallback(() => {
    setIsLandscapeInfoOpen(false);
    setIsMobileControlsCollapsed(true);
    setShowSkinPicker((previous) => !previous);
  }, []);

  return {
    immersiveExperienceRef,
    showSkinPicker,
    setShowSkinPicker,
    isLandscapeInfoOpen,
    isMobileControlsCollapsed,
    isMobile,
    isViewportPortrait,
    detectedLandscapeSide,
    isImmersiveFullscreen,
    fullscreenSupported,
    fullscreenErrorMessage,
    orientationLockSupported,
    orientationLockError,
    normalizedImmersiveSettings,
    immersiveLayoutMode,
    immersiveSkinId,
    immersiveSkin,
    landscapeSidePreference,
    effectiveLandscapeSide,
    isLandscapeImmersive,
    shouldShowRotateHint,
    orientationStatusMessage,
    orientationStatusTone,
    isChatOpen,
    layoutMode: immersiveLayoutMode,
    skinId: immersiveSkinId,
    skin: immersiveSkin,
    toggleMobileControls,
    toggleLandscapeInfo,
    closeLandscapeInfo,
    toggleImmersiveFullscreen: handleToggleImmersiveFullscreen,
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
    handleToggleImmersiveFullscreen,
  };
}
