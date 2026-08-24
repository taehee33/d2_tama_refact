"use strict";

const IN_APP_NOTIFICATION_STATUSES = new Set(["stored", "hidden"]);

function assertNotificationDocumentContract(notification) {
  const createdAt = notification?.createdAt;
  if (!Number.isFinite(createdAt) || createdAt < 0) {
    throw new TypeError("알림 createdAt은 0 이상의 유한한 숫자여야 합니다.");
  }

  const inAppStatus = notification?.channelState?.inApp?.status;
  if (!IN_APP_NOTIFICATION_STATUSES.has(inAppStatus)) {
    throw new TypeError("알림 인앱 상태는 stored 또는 hidden이어야 합니다.");
  }

  return notification;
}

module.exports = {
  assertNotificationDocumentContract,
};
