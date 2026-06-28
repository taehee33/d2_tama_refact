import {
  getWebPushSupportInfo,
  isStandaloneWebApp,
  isWebPushSupported,
  requestWebPushSubscription,
} from "./webPushClient";

const originalUserAgent = window.navigator.userAgent;
const originalStandalone = window.navigator.standalone;
const originalMatchMedia = window.matchMedia;
const originalPushManager = window.PushManager;
const originalNotification = window.Notification;
const originalServiceWorker = window.navigator.serviceWorker;
const originalPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;

function setNavigatorValue(key, value) {
  Object.defineProperty(window.navigator, key, {
    configurable: true,
    value,
  });
}

function setCorePushSupport({ notificationPermission = "default" } = {}) {
  Object.defineProperty(window, "PushManager", {
    configurable: true,
    value: function PushManager() {},
  });
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: {
      permission: notificationPermission,
      requestPermission: jest.fn().mockResolvedValue(notificationPermission),
    },
  });
  setNavigatorValue("serviceWorker", {
    register: jest.fn(),
    getRegistration: jest.fn(),
  });
}

describe("webPushClient", () => {
  beforeEach(() => {
    process.env.REACT_APP_VAPID_PUBLIC_KEY = "BOGUS_PUBLIC_KEY";
    setNavigatorValue("userAgent", originalUserAgent);
    setNavigatorValue("standalone", false);
    window.matchMedia = jest.fn(() => ({ matches: false }));
    setCorePushSupport();
  });

  afterEach(() => {
    process.env.REACT_APP_VAPID_PUBLIC_KEY = originalPublicKey;
    setNavigatorValue("userAgent", originalUserAgent);
    setNavigatorValue("standalone", originalStandalone);
    setNavigatorValue("serviceWorker", originalServiceWorker);
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: originalPushManager,
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: originalNotification,
    });
  });

  test("iPhone Safari 탭에서는 홈 화면 웹앱 실행 안내를 반환한다", () => {
    setNavigatorValue(
      "userAgent",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
    );
    setNavigatorValue("standalone", false);
    window.matchMedia = jest.fn(() => ({ matches: false }));

    const supportInfo = getWebPushSupportInfo();

    expect(supportInfo).toEqual({
      supported: false,
      reason: "ios_not_standalone",
      message: "iPhone에서는 Safari 탭이 아니라 홈 화면 아이콘으로 연 앱에서만 브라우저 푸시를 연결할 수 있습니다.",
    });
    expect(isWebPushSupported()).toBe(false);
  });

  test("iPhone 홈 화면 웹앱에서는 지원 상태로 판정한다", () => {
    setNavigatorValue(
      "userAgent",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
    );
    setNavigatorValue("standalone", true);

    expect(isStandaloneWebApp()).toBe(true);
    expect(getWebPushSupportInfo().supported).toBe(true);
  });

  test("권한이 이미 차단된 상태면 iPhone 설정 안내를 반환한다", async () => {
    setNavigatorValue(
      "userAgent",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
    );
    setNavigatorValue("standalone", true);
    setCorePushSupport({ notificationPermission: "denied" });

    await expect(requestWebPushSubscription()).rejects.toThrow(
      "브라우저 푸시 권한이 차단되어 있습니다. iPhone 설정 > 알림 > 디지몬 타마고치에서 알림을 허용한 뒤 다시 시도해 주세요."
    );
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
  });
});
