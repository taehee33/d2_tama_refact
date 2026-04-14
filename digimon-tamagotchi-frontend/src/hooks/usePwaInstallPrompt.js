import { useCallback, useEffect, useState } from "react";

export function isPwaInstallActionable({
  isInstalled = false,
  isInstallable = false,
  isIOS = false,
} = {}) {
  return !isInstalled && (isInstallable || isIOS);
}

function isIOSDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function getStandaloneMatchMedia() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }

  return window.matchMedia("(display-mode: standalone)");
}

export default function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return undefined;
    }

    const mediaQuery = getStandaloneMatchMedia();

    const syncInstalledState = () => {
      const isStandalone = Boolean(mediaQuery?.matches);
      const isIOSStandalone = window.navigator.standalone === true;
      const nextInstalled = isStandalone || isIOSStandalone;

      setIsInstalled(nextInstalled);

      if (nextInstalled) {
        setDeferredPrompt(null);
        setIsInstallable(false);
        setShowIOSInstructions(false);
      }
    };

    setIsIOS(isIOSDevice());
    syncInstalledState();

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setIsInstallable(true);
      setIsInstalled(false);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      setShowIOSInstructions(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener("change", syncInstalledState);
    } else if (mediaQuery?.addListener) {
      mediaQuery.addListener(syncInstalledState);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);

      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener("change", syncInstalledState);
      } else if (mediaQuery?.removeListener) {
        mediaQuery.removeListener(syncInstalledState);
      }
    };
  }, []);

  const openInstallPrompt = useCallback(async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return { outcome: "ios-instructions" };
    }

    if (!deferredPrompt) {
      window.alert("이 브라우저에서는 설치가 지원되지 않습니다.");
      return { outcome: "unsupported" };
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice?.outcome === "accepted") {
        setIsInstalled(true);
      }

      setDeferredPrompt(null);
      setIsInstallable(false);

      return choice || { outcome: "dismissed" };
    } catch (error) {
      console.error("PWA 설치 오류:", error);
      window.alert("설치 중 오류가 발생했습니다.");
      return { outcome: "error", error };
    }
  }, [deferredPrompt, isIOS]);

  return {
    isInstalled,
    isInstallable,
    isIOS,
    showIOSInstructions,
    setShowIOSInstructions,
    openInstallPrompt,
    isActionable: isPwaInstallActionable({
      isInstalled,
      isInstallable,
      isIOS,
    }),
  };
}
