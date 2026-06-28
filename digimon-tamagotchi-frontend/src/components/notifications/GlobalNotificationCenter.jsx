import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  getNotificationStatus,
  markNotificationsRead,
} from "../../utils/notificationApi";

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
    }
    else labels.push("푸시 제외");
  }

  return labels.join(" · ");
}

function getUnreadNotifications(status) {
  return (status?.recentNotifications || []).filter((notification) => !notification.readAt);
}

function applyReadState(status, notificationIds, readAt) {
  if (!status || !Array.isArray(notificationIds) || notificationIds.length === 0) {
    return status;
  }

  const idSet = new Set(notificationIds);
  return {
    ...status,
    recentNotifications: (status.recentNotifications || []).map((notification) =>
      idSet.has(notification.id)
        ? { ...notification, readAt: notification.readAt || readAt }
        : notification
    ),
  };
}

function GlobalNotificationCenter() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [readSignature, setReadSignature] = useState("");

  const isAuthRoute = location.pathname.startsWith("/auth");
  const recentNotifications = status?.recentNotifications || [];
  const unreadNotifications = useMemo(() => getUnreadNotifications(status), [status]);
  const unreadCount = unreadNotifications.length;

  const loadStatus = useCallback(async ({ silent = false } = {}) => {
    if (!currentUser || isAuthRoute) {
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }
    setErrorMessage("");

    try {
      const nextStatus = await getNotificationStatus(currentUser);
      setStatus(nextStatus);
    } catch (error) {
      setErrorMessage(error?.message || "알림을 불러오지 못했습니다.");
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [currentUser, isAuthRoute]);

  useEffect(() => {
    if (!currentUser || isAuthRoute) {
      setStatus(null);
      setIsOpen(false);
      return;
    }

    void loadStatus();
  }, [currentUser, isAuthRoute, loadStatus]);

  useEffect(() => {
    if (!currentUser || isAuthRoute) {
      return undefined;
    }

    const handleFocus = () => {
      void loadStatus({ silent: true });
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [currentUser, isAuthRoute, loadStatus]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !currentUser || unreadNotifications.length === 0) {
      return;
    }

    const signature = unreadNotifications.map((notification) => notification.id).join("|");
    if (!signature || signature === readSignature) {
      return;
    }

    setReadSignature(signature);
    markNotificationsRead(currentUser, { allVisible: true })
      .then((result) => {
        const notificationIds = result?.notificationIds?.length
          ? result.notificationIds
          : unreadNotifications.map((notification) => notification.id);
        const readAt = result?.readAt || Date.now();
        setStatus((currentStatus) => applyReadState(currentStatus, notificationIds, readAt));
      })
      .catch((error) => {
        setReadSignature("");
        setErrorMessage(error?.message || "알림 읽음 처리에 실패했습니다.");
      });
  }, [currentUser, isOpen, readSignature, unreadNotifications]);

  if (!currentUser || isAuthRoute) {
    return null;
  }

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      void loadStatus({ silent: true });
    }
  };

  const handleNotificationClick = (notification) => {
    if (notification.targetPath) {
      navigate(notification.targetPath);
    }
    setIsOpen(false);
  };

  return (
    <div className="global-notification-center" ref={rootRef}>
      <button
        type="button"
        className={`global-notification-center__button${
          isOpen ? " global-notification-center__button--open" : ""
        }`}
        onClick={handleToggle}
        aria-label="알림"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="global-notification-center__icon" aria-hidden="true">
          🔔
        </span>
        {unreadCount > 0 ? (
          <span className="global-notification-center__badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <section
          className="global-notification-center__panel"
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
              onClick={() => loadStatus()}
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
                  onClick={() => handleNotificationClick(notification)}
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
      ) : null}
    </div>
  );
}

export default GlobalNotificationCenter;
