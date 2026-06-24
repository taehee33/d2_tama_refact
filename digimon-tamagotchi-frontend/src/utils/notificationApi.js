const NOTIFICATION_API_BASE_URL = process.env.REACT_APP_NOTIFICATION_API_BASE_URL || "";

function buildNotificationUrl(operation) {
  return `${NOTIFICATION_API_BASE_URL}/api/notifications/${operation}`;
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
  const response = await fetch(buildNotificationUrl(operation), {
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

export async function getNotificationStatus(currentUser) {
  const payload = await requestNotification(currentUser, "status");
  return payload.status || null;
}

export async function sendTestNotification(currentUser) {
  const payload = await requestNotification(currentUser, "test", {
    method: "POST",
    body: { kind: "manual" },
  });

  return payload.notification || null;
}
