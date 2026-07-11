import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { usePresenceContext } from "./AblyContext";
import {
  getNotificationStatus,
  markNotificationsRead,
} from "../utils/notificationApi";
import { getRouteLayoutPolicy } from "../utils/routeLayout";

const NotificationCenterContext = createContext(null);
export const CLOSE_NOTIFICATION_EVENT = "d2-tama:close-notification";

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

export function NotificationCenterProvider({ children }) {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isChatOpen, setIsChatOpen } = usePresenceContext();
  const [status, setStatus] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const routePolicy = useMemo(
    () => getRouteLayoutPolicy(location.pathname, currentUser),
    [currentUser, location.pathname]
  );
  const recentNotifications = useMemo(
    () => status?.recentNotifications || [],
    [status]
  );
  const unreadNotifications = useMemo(() => getUnreadNotifications(status), [status]);
  const unreadCount = unreadNotifications.length;

  const closeNotification = useCallback(() => {
    setIsOpen(false);
  }, []);

  const loadStatus = useCallback(async ({ silent = false } = {}) => {
    if (!routePolicy.shouldShowNotification || !currentUser) {
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
  }, [currentUser, routePolicy.shouldShowNotification]);

  const openNotification = useCallback(() => {
    if (!routePolicy.shouldShowNotification) {
      return;
    }
    if (isChatOpen) {
      setIsChatOpen(false);
    }
    setIsOpen(true);
    void loadStatus({ silent: true });
  }, [isChatOpen, loadStatus, routePolicy.shouldShowNotification, setIsChatOpen]);

  const toggleNotification = useCallback(() => {
    if (isOpen) {
      closeNotification();
      return;
    }
    openNotification();
  }, [closeNotification, isOpen, openNotification]);

  const closeForChat = useCallback(() => {
    if (isOpen) {
      closeNotification();
    }
  }, [closeNotification, isOpen]);

  const handleNotificationClick = useCallback((notification) => {
    if (notification.targetPath) {
      navigate(notification.targetPath);
    }
    setIsOpen(false);
  }, [navigate]);

  useEffect(() => {
    if (!routePolicy.shouldShowNotification || !currentUser) {
      setStatus(null);
      setIsOpen(false);
      return;
    }

    void loadStatus();
  }, [currentUser, loadStatus, routePolicy.shouldShowNotification]);

  useEffect(() => {
    if (!routePolicy.shouldShowNotification || !currentUser) {
      return undefined;
    }

    const handleFocus = () => {
      void loadStatus({ silent: true });
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [currentUser, loadStatus, routePolicy.shouldShowNotification]);

  useEffect(() => {
    const handleCloseRequest = () => {
      setIsOpen(false);
    };

    window.addEventListener(CLOSE_NOTIFICATION_EVENT, handleCloseRequest);
    return () => window.removeEventListener(CLOSE_NOTIFICATION_EVENT, handleCloseRequest);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    if (!currentUser || unreadNotifications.length === 0 || isMarkingAllRead) {
      return;
    }

    setIsMarkingAllRead(true);
    setErrorMessage("");
    try {
      const result = await markNotificationsRead(currentUser, { allVisible: true });
      const notificationIds = result?.notificationIds?.length
        ? result.notificationIds
        : unreadNotifications.map((notification) => notification.id);
      const readAt = result?.readAt || Date.now();
      setStatus((currentStatus) => applyReadState(currentStatus, notificationIds, readAt));
    } catch (error) {
      setErrorMessage(error?.message || "알림 읽음 처리에 실패했습니다.");
    } finally {
      setIsMarkingAllRead(false);
    }
  }, [currentUser, isMarkingAllRead, unreadNotifications]);

  const value = useMemo(() => ({
    status,
    recentNotifications,
    unreadNotifications,
    unreadCount,
    isOpen,
    isLoading,
    isMarkingAllRead,
    errorMessage,
    routePolicy,
    loadStatus,
    openNotification,
    closeNotification,
    toggleNotification,
    closeForChat,
    handleNotificationClick,
    markAllNotificationsRead,
  }), [
    closeForChat,
    closeNotification,
    errorMessage,
    handleNotificationClick,
    isLoading,
    isMarkingAllRead,
    isOpen,
    loadStatus,
    markAllNotificationsRead,
    openNotification,
    recentNotifications,
    routePolicy,
    status,
    toggleNotification,
    unreadCount,
    unreadNotifications,
  ]);

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter() {
  const context = useContext(NotificationCenterContext);
  if (!context) {
    throw new Error("useNotificationCenter must be used within NotificationCenterProvider");
  }
  return context;
}

export default NotificationCenterContext;
