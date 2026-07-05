import { getRouteLayoutPolicy } from "./routeLayout";

const user = { uid: "user-1" };

describe("routeLayout", () => {
  test("/play는 서비스 floating 알림 대상이다", () => {
    const policy = getRouteLayoutPolicy("/play", user);

    expect(policy.isGameRoute).toBe(false);
    expect(policy.isImmersiveGameRoute).toBe(false);
    expect(policy.shouldShowServiceFloatingNotification).toBe(true);
    expect(policy.shouldShowGameToolbarNotification).toBe(false);
  });

  test("/play/:slotId는 게임 toolbar 알림 대상이다", () => {
    const policy = getRouteLayoutPolicy("/play/4", user);

    expect(policy.isGameRoute).toBe(true);
    expect(policy.shouldShowServiceFloatingNotification).toBe(false);
    expect(policy.shouldShowGameToolbarNotification).toBe(true);
  });

  test("/play/:slotId/full은 알림과 채팅을 숨긴다", () => {
    const policy = getRouteLayoutPolicy("/play/4/full", user);

    expect(policy.isImmersiveGameRoute).toBe(true);
    expect(policy.shouldShowNotification).toBe(false);
    expect(policy.shouldShowChat).toBe(false);
  });

  test("/auth는 알림과 채팅을 숨긴다", () => {
    const policy = getRouteLayoutPolicy("/auth", user);

    expect(policy.isAuthRoute).toBe(true);
    expect(policy.shouldShowNotification).toBe(false);
    expect(policy.shouldShowChat).toBe(false);
  });
});
