import React, { useEffect, useRef } from "react";
import { useNotificationCenter } from "../../contexts/NotificationCenterContext";
import NotificationPanel from "./NotificationPanel";

function GlobalNotificationCenter({ placement = "floating" }) {
  const rootRef = useRef(null);
  const {
    recentNotifications,
    unreadCount,
    isOpen,
    isLoading,
    errorMessage,
    routePolicy,
    loadStatus,
    closeNotification,
    toggleNotification,
    handleNotificationClick,
  } = useNotificationCenter();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        closeNotification();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeNotification();
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
  }, [closeNotification, isOpen]);

  if (!routePolicy.shouldShowServiceFloatingNotification) {
    return null;
  }

  return (
    <div
      className={`global-notification-center global-notification-center--${placement}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`global-notification-center__button${
          isOpen ? " global-notification-center__button--open" : ""
        }`}
        onClick={toggleNotification}
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
        <NotificationPanel
          recentNotifications={recentNotifications}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onRefresh={() => loadStatus()}
          onNotificationClick={handleNotificationClick}
        />
      ) : null}
    </div>
  );
}

export default GlobalNotificationCenter;
