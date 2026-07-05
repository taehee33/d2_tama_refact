import React from "react";

function formatNotificationTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getChannelStatusLabel(notification) {
  const discordState = notification?.channelState?.discord || {};
  const webPushState = notification?.channelState?.webPush || {};
  const discordStatus = discordState.status;
  const webPushStatus = webPushState.status;
  const labels = ["앱 알림함"];

  if (discordStatus === "sent") labels.push("Discord 전송");
  if (discordStatus === "failed") labels.push("Discord 실패");
  if (discordStatus === "skipped") {
    if (discordState.reason === "disabled" || discordState.reason === "channel_disabled") labels.push("Discord 꺼짐");
    else if (
      discordState.reason === "missing_webhook" ||
      discordState.reason === "webhook_missing"
    ) {
      labels.push("Discord 미연결");
    } else if (discordState.reason === "not_requested") {
      labels.push("Discord 기록 없음");
    } else {
      labels.push("Discord 제외");
    }
  }

  if (webPushStatus === "sent") labels.push("푸시 전송");
  if (webPushStatus === "partial") labels.push("푸시 일부 실패");
  if (webPushStatus === "failed") labels.push("푸시 실패");
  if (webPushStatus === "skipped") {
    if (webPushState.reason === "disabled" || webPushState.reason === "channel_disabled") labels.push("푸시 꺼짐");
    else if (
      webPushState.reason === "no_active_subscription" ||
      webPushState.reason === "missing_subscription"
    ) {
      labels.push("푸시 미연결");
    } else if (webPushState.reason === "not_configured") {
      labels.push("푸시 설정 누락");
    } else if (webPushState.reason === "not_requested") {
      labels.push("푸시 기록 없음");
    } else if (webPushState.reason === "send_failed") {
      labels.push("푸시 실패");
    } else labels.push("푸시 제외");
  }

  return labels.join(" · ");
}

function NotificationPanel({
  className = "global-notification-center__panel",
  recentNotifications,
  isLoading,
  errorMessage,
  onRefresh,
  onNotificationClick,
}) {
  return (
    <section
      className={className}
      role="dialog"
      aria-label="알림 목록"
    >
      <div className="global-notification-center__header">
        <div>
          <p className="service-section-label">앱 알림함</p>
          <h3>알림</h3>
        </div>
        <button
          type="button"
          className="global-notification-center__refresh"
          onClick={onRefresh}
          disabled={isLoading}
        >
          새로고침
        </button>
      </div>

      {errorMessage ? (
        <p className="global-notification-center__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {isLoading && recentNotifications.length === 0 ? (
        <p className="global-notification-center__empty">알림을 불러오는 중입니다...</p>
      ) : recentNotifications.length === 0 ? (
        <p className="global-notification-center__empty">새 알림이 없습니다.</p>
      ) : (
        <div className="global-notification-center__list">
          {recentNotifications.map((notification) => (
            <button
              type="button"
              key={notification.id}
              className={`global-notification-center__item${
                notification.readAt ? "" : " global-notification-center__item--unread"
              }`}
              onClick={() => onNotificationClick(notification)}
            >
              <span className="global-notification-center__item-topline">
                <strong>{notification.title || "알림"}</strong>
                <span>{formatNotificationTime(notification.createdAt)}</span>
              </span>
              {notification.body ? (
                <span className="global-notification-center__body">
                  {notification.body}
                </span>
              ) : null}
              <span className="global-notification-center__meta">
                {getChannelStatusLabel(notification)}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default NotificationPanel;
