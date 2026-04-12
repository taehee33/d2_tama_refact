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

function getLandscapeUnsupportedMessage(isIosSafari) {
  return isIosSafari
    ? "이 브라우저에서는 가로 고정을 지원하지 않아요. 회전 잠금을 끄고 직접 돌려 주세요."
    : "이 브라우저에서는 가로 고정을 지원하지 않아요. 직접 회전해 주세요.";
}

function getLandscapeFullscreenFailureMessage() {
  return "가로 고정을 시도했지만 전체화면 전환이 허용되지 않았어요. 직접 회전해 주세요.";
}

function getLockFailureMessage() {
  return "가로 고정을 시도했지만 브라우저가 허용하지 않았어요.";
}

function getFullscreenUnsupportedMessage(isIosSafari) {
  return isIosSafari
    ? "이 브라우저에서는 전체화면을 지원하지 않아요. 현재 몰입형 화면으로 계속 사용할 수 있어요."
    : "이 브라우저에서는 전체화면을 지원하지 않아요.";
}

function getFullscreenOnlyFailureMessage() {
  return "전체화면 전환이 허용되지 않았어요.";
}

async function ensureImmersiveFullscreen({
  targetElement,
  documentRef,
  supportState,
  unsupportedMessage,
  failureMessage,
} = {}) {
  if (isImmersiveFullscreenActive(documentRef)) {
    return {
      isFullscreen: true,
      fullscreenSupported: supportState.fullscreenSupported,
      errorMessage: null,
    };
  }

  const requestFullscreen = getRequestFullscreenMethod(targetElement);

  if (!requestFullscreen) {
    return {
      isFullscreen: isImmersiveFullscreenActive(documentRef),
      fullscreenSupported: supportState.fullscreenSupported,
      errorMessage: unsupportedMessage,
    };
  }

  try {
    await requestFullscreen();
    return {
      isFullscreen: isImmersiveFullscreenActive(documentRef),
      fullscreenSupported: supportState.fullscreenSupported,
      errorMessage: null,
    };
  } catch (_error) {
    return {
      isFullscreen: isImmersiveFullscreenActive(documentRef),
      fullscreenSupported: supportState.fullscreenSupported,
      errorMessage: failureMessage,
    };
  }
}

export async function enterImmersiveFullscreen({
  element,
  documentRef,
  screenRef,
  userAgent = "",
  vendor = "",
} = {}) {
  const targetElement = element || documentRef?.documentElement || null;
  const supportState = getImmersiveOrientationSupportState({
    element: targetElement,
    documentRef,
    screenRef,
    userAgent,
    vendor,
  });

  return ensureImmersiveFullscreen({
    targetElement,
    documentRef,
    supportState,
    unsupportedMessage: getFullscreenUnsupportedMessage(
      supportState.isProbablyIosSafari
    ),
    failureMessage: getFullscreenOnlyFailureMessage(),
  });
}

export async function enterImmersiveLandscapeMode({
  element,
  documentRef,
  screenRef,
  userAgent = "",
  vendor = "",
} = {}) {
  const targetElement = element || documentRef?.documentElement || null;
  const supportState = getImmersiveOrientationSupportState({
    element: targetElement,
    documentRef,
    screenRef,
    userAgent,
    vendor,
  });

  const fullscreenResult = await ensureImmersiveFullscreen({
    targetElement,
    documentRef,
    supportState,
    unsupportedMessage: supportState.orientationLockSupported
      ? getLandscapeFullscreenFailureMessage()
      : getLandscapeUnsupportedMessage(supportState.isProbablyIosSafari),
    failureMessage: supportState.orientationLockSupported
      ? getLandscapeFullscreenFailureMessage()
      : getLandscapeUnsupportedMessage(supportState.isProbablyIosSafari),
  });

  if (fullscreenResult.errorMessage) {
    return {
      isFullscreen: fullscreenResult.isFullscreen,
      orientationLockSupported: supportState.orientationLockSupported,
      errorMessage: fullscreenResult.errorMessage,
    };
  }

  if (!supportState.orientationLockSupported) {
    return {
      isFullscreen: isImmersiveFullscreenActive(documentRef),
      orientationLockSupported: false,
      errorMessage: getLandscapeUnsupportedMessage(
        supportState.isProbablyIosSafari
      ),
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

export async function exitImmersiveFullscreen({
  documentRef,
  screenRef,
  userAgent = "",
  vendor = "",
} = {}) {
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
    fullscreenSupported: supportState.fullscreenSupported,
    errorMessage: null,
  };
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
    await exitImmersiveFullscreen({
      documentRef,
      screenRef,
      userAgent,
      vendor,
    });
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
