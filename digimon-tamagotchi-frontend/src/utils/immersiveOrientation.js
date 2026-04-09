function getRequestFullscreenMethod(targetElement) {
  if (!targetElement) {
    return null;
  }

  if (typeof targetElement.requestFullscreen === "function") {
    return () => targetElement.requestFullscreen();
  }

  if (typeof targetElement.webkitRequestFullscreen === "function") {
    return () => targetElement.webkitRequestFullscreen();
  }

  return null;
}

function getExitFullscreenMethod(documentRef) {
  if (!documentRef) {
    return null;
  }

  if (typeof documentRef.exitFullscreen === "function") {
    return () => documentRef.exitFullscreen();
  }

  if (typeof documentRef.webkitExitFullscreen === "function") {
    return () => documentRef.webkitExitFullscreen();
  }

  return null;
}

export function isImmersiveFullscreenActive(documentRef) {
  if (!documentRef) {
    return false;
  }

  return Boolean(documentRef.fullscreenElement || documentRef.webkitFullscreenElement);
}

export function isProbablyIosSafari({ userAgent = "", vendor = "" } = {}) {
  const normalizedUserAgent = String(userAgent).toLowerCase();
  const normalizedVendor = String(vendor).toLowerCase();
  const isIosDevice = /(iphone|ipad|ipod)/.test(normalizedUserAgent);
  const isSafari =
    /safari/.test(normalizedUserAgent) &&
    /apple/.test(normalizedVendor) &&
    !/(crios|fxios|edgios|opios)/.test(normalizedUserAgent);

  return isIosDevice && isSafari;
}

export function getImmersiveOrientationSupportState({
  element,
  documentRef,
  screenRef,
  userAgent = "",
  vendor = "",
} = {}) {
  const targetElement = element || documentRef?.documentElement || null;
  const iosSafari = isProbablyIosSafari({ userAgent, vendor });

  return {
    fullscreenSupported: Boolean(getRequestFullscreenMethod(targetElement)),
    orientationLockSupported:
      Boolean(screenRef?.orientation && typeof screenRef.orientation.lock === "function") &&
      !iosSafari,
    isProbablyIosSafari: iosSafari,
  };
}

function getUnsupportedMessage(isIosSafari) {
  return isIosSafari
    ? "이 브라우저에서는 가로 고정을 지원하지 않아요. 회전 잠금을 끄고 직접 돌려 주세요."
    : "이 브라우저에서는 가로 고정을 지원하지 않아요. 직접 회전해 주세요.";
}

function getFullscreenFailureMessage() {
  return "가로 고정을 시도했지만 전체화면 전환이 허용되지 않았어요. 직접 회전해 주세요.";
}

function getLockFailureMessage() {
  return "가로 고정을 시도했지만 브라우저가 허용하지 않았어요.";
}

export async function enterImmersiveLandscapeMode({
  element,
  documentRef,
  screenRef,
  userAgent = "",
  vendor = "",
} = {}) {
  const targetElement = element || documentRef?.documentElement || null;
  const requestFullscreen = getRequestFullscreenMethod(targetElement);
  const supportState = getImmersiveOrientationSupportState({
    element: targetElement,
    documentRef,
    screenRef,
    userAgent,
    vendor,
  });

  if (!isImmersiveFullscreenActive(documentRef)) {
    if (!requestFullscreen) {
      return {
        isFullscreen: isImmersiveFullscreenActive(documentRef),
        orientationLockSupported: supportState.orientationLockSupported,
        errorMessage: supportState.orientationLockSupported
          ? getFullscreenFailureMessage()
          : getUnsupportedMessage(supportState.isProbablyIosSafari),
      };
    }

    try {
      await requestFullscreen();
    } catch (_error) {
      return {
        isFullscreen: isImmersiveFullscreenActive(documentRef),
        orientationLockSupported: supportState.orientationLockSupported,
        errorMessage: supportState.orientationLockSupported
          ? getFullscreenFailureMessage()
          : getUnsupportedMessage(supportState.isProbablyIosSafari),
      };
    }
  }

  if (!supportState.orientationLockSupported) {
    return {
      isFullscreen: isImmersiveFullscreenActive(documentRef),
      orientationLockSupported: false,
      errorMessage: getUnsupportedMessage(supportState.isProbablyIosSafari),
    };
  }

  try {
    await screenRef.orientation.lock("landscape");
    return {
      isFullscreen: isImmersiveFullscreenActive(documentRef),
      orientationLockSupported: true,
      errorMessage: null,
    };
  } catch (_error) {
    return {
      isFullscreen: isImmersiveFullscreenActive(documentRef),
      orientationLockSupported: true,
      errorMessage: getLockFailureMessage(),
    };
  }
}

export async function exitImmersiveLandscapeMode({
  documentRef,
  screenRef,
  userAgent = "",
  vendor = "",
} = {}) {
  try {
    screenRef?.orientation?.unlock?.();
  } catch (_error) {
    // 브라우저별 unlock 미지원은 조용히 무시한다.
  }

  if (isImmersiveFullscreenActive(documentRef)) {
    const exitFullscreen = getExitFullscreenMethod(documentRef);

    if (exitFullscreen) {
      try {
        await exitFullscreen();
      } catch (_error) {
        // 사용자가 직접 빠져나간 경우나 브라우저 거부는 무시한다.
      }
    }
  }

  const supportState = getImmersiveOrientationSupportState({
    documentRef,
    screenRef,
    userAgent,
    vendor,
  });

  return {
    isFullscreen: isImmersiveFullscreenActive(documentRef),
    orientationLockSupported: supportState.orientationLockSupported,
    errorMessage: null,
  };
}
