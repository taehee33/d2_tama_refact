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
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
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
  if (!isWebPushSupported()) {
    throw new Error("이 브라우저는 푸시 알림을 지원하지 않습니다.");
  }

  const publicKey = getWebPushPublicKey();
  if (!publicKey) {
    throw new Error("브라우저 푸시 공개 키가 설정되지 않았습니다.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("브라우저 푸시 권한이 허용되지 않았습니다.");
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
