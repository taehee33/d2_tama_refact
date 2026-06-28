const NOTIFICATION_API_BASE_URL = process.env.REACT_APP_NOTIFICATION_API_BASE_URL || "";

function buildNotificationUrl(operation, query = {}) {
  const queryString = new URLSearchParams(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== "")
  ).toString();
  const baseUrl = `${NOTIFICATION_API_BASE_URL}/api/notifications/${operation}`;
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

function extractNotificationErrorMessage(response, payload, rawText) {
  const nestedMessage =
    typeof payload?.error === "object" ? payload.error?.message || payload.error?.code : "";
  const directMessage = typeof payload?.error === "string" ? payload.error : "";
  const message = nestedMessage || directMessage || payload?.message;

  if (message) {
    return message;
  }

  if (rawText && /<!doctype html>|<html/i.test(rawText)) {
    return `알림 API 경로를 찾지 못했습니다. 배포 또는 로컬 API 연결을 확인해 주세요. (HTTP ${response.status})`;
  }

  return `알림 요청을 처리하지 못했습니다. (HTTP ${response.status})`;
}

async function requestNotification(currentUser, operation, options = {}) {
  if (!currentUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch(buildNotificationUrl(operation, options.query), {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const rawText = await response.text().catch(() => "");
  let payload = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch (error) {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new Error(extractNotificationErrorMessage(response, payload, rawText));
  }

  return payload || {};
}

export async function getNotificationStatus(currentUser, options = {}) {
  const payload = await requestNotification(currentUser, "status", {
    query: options.slotId ? { slotId: options.slotId } : undefined,
  });
  return payload.status || null;
}

export async function sendTestNotification(currentUser) {
  const payload = await requestNotification(currentUser, "test", {
    method: "POST",
    body: { kind: "manual" },
  });

  return payload.notification || null;
}

export async function markNotificationsRead(currentUser, body = {}) {
  const payload = await requestNotification(currentUser, "read", {
    method: "POST",
    body,
  });

  return payload.result || null;
}

export async function evaluateSlotUrgentNotification(currentUser, slotId) {
  const payload = await requestNotification(currentUser, "evaluate-slot", {
    method: "POST",
    body: { slotId },
  });

  return payload || null;
}

export async function subscribeWebPush(currentUser, subscription) {
  const payload = await requestNotification(currentUser, "push-subscribe", {
    method: "POST",
    body: { subscription },
  });

  return payload.result || null;
}

export async function unsubscribeWebPush(currentUser, endpoint) {
  const payload = await requestNotification(currentUser, "push-unsubscribe", {
    method: "POST",
    body: { endpoint },
  });

  return payload.result || null;
}
