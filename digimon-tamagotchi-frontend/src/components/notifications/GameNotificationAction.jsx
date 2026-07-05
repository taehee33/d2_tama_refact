import React, { useEffect, useRef } from "react";
import { useNotificationCenter } from "../../contexts/NotificationCenterContext";
import NotificationPanel from "./NotificationPanel";

function GameNotificationAction({ compact = false }) {
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

  if (!routePolicy.shouldShowGameToolbarNotification) {
    return null;
  }

  return (
    <div className="game-notification-action" ref={rootRef}>
      <button
        type="button"
        className={`game-notification-action__button${
          isOpen ? " game-notification-action__button--open" : ""
        }${compact ? " game-notification-action__button--compact" : ""}`}
        onClick={toggleNotification}
        aria-label="알림"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="알림"
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 ? (
          <span className="game-notification-action__badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <NotificationPanel
          className="global-notification-center__panel game-notification-action__panel"
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

export default GameNotificationAction;
