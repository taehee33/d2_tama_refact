export function isAuthRoute(pathname = "") {
  return pathname.startsWith("/auth");
}

export function isGameRoute(pathname = "") {
  return /^\/play\/[^/]+$/.test(pathname);
}

export function isImmersiveGameRoute(pathname = "") {
  return /^\/play\/[^/]+\/full$/.test(pathname);
}

export function getRouteLayoutPolicy(pathname = "", currentUser = null) {
  const authRoute = isAuthRoute(pathname);
  const gameRoute = isGameRoute(pathname);
  const immersiveGameRoute = isImmersiveGameRoute(pathname);
  const hasUser = Boolean(currentUser);
  const shouldShowNotification = hasUser && !authRoute && !immersiveGameRoute;

  return {
    isAuthRoute: authRoute,
    isGameRoute: gameRoute,
    isImmersiveGameRoute: immersiveGameRoute,
    shouldShowNotification,
    shouldShowServiceFloatingNotification: shouldShowNotification && !gameRoute,
    shouldShowGameToolbarNotification: shouldShowNotification && gameRoute,
    shouldShowChat: hasUser && !authRoute && !immersiveGameRoute,
  };
}
