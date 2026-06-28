const WEB_PUSH_SERVICE_WORKER_PATH = "/d2-tama-push-sw.js";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export function isWebPushSupported() {
  return getWebPushSupportInfo().supported;
}

export function isIOSDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

export function isStandaloneWebApp() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const displayModeStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)")?.matches === true;
  const iosStandalone = window.navigator.standalone === true;

  return displayModeStandalone || iosStandalone;
}

export function getWebPushSupportInfo() {
  const hasCoreSupport =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  if (!hasCoreSupport) {
    return {
      supported: false,
      reason: "unsupported",
      message: "현재 브라우저는 푸시 알림을 지원하지 않습니다.",
    };
  }

  if (isIOSDevice() && !isStandaloneWebApp()) {
    return {
      supported: false,
      reason: "ios_not_standalone",
      message: "iPhone에서는 Safari 탭이 아니라 홈 화면 아이콘으로 연 앱에서만 브라우저 푸시를 연결할 수 있습니다.",
    };
  }

  return (
    {
      supported: true,
      reason: "",
      message: "",
    }
  );
}

export function getWebPushPublicKey() {
  return process.env.REACT_APP_VAPID_PUBLIC_KEY || "";
}

export async function getExistingWebPushSubscription() {
  if (!isWebPushSupported()) {
    return null;
  }

  const registration = await navigator.serviceWorker.getRegistration(WEB_PUSH_SERVICE_WORKER_PATH);
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function requestWebPushSubscription() {
  const supportInfo = getWebPushSupportInfo();
  if (!supportInfo.supported) {
    throw new Error(supportInfo.message);
  }

  const publicKey = getWebPushPublicKey();
  if (!publicKey) {
    throw new Error("브라우저 푸시 공개 키가 설정되지 않았습니다.");
  }

  if (Notification.permission === "denied") {
    throw new Error("브라우저 푸시 권한이 차단되어 있습니다. iPhone 설정 > 알림 > 디지몬 타마고치에서 알림을 허용한 뒤 다시 시도해 주세요.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    if (permission === "denied") {
      throw new Error("브라우저 푸시 권한이 차단되어 있습니다. iPhone 설정 > 알림 > 디지몬 타마고치에서 알림을 허용한 뒤 다시 시도해 주세요.");
    }
    throw new Error("브라우저 푸시 권한이 허용되지 않았습니다. 권한 요청 창에서 허용을 눌러야 연결됩니다.");
  }

  const registration = await navigator.serviceWorker.register(WEB_PUSH_SERVICE_WORKER_PATH);
  const existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription) {
    return existingSubscription.toJSON();
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  return subscription.toJSON();
}

export async function removeWebPushSubscription() {
  const subscription = await getExistingWebPushSubscription();
  if (!subscription) {
    return null;
  }

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}
