import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { usePresenceContext } from "./AblyContext";
import {
  getNotificationInbox,
  markNotificationsRead,
} from "../utils/notificationApi";
import { getRouteLayoutPolicy } from "../utils/routeLayout";

const NotificationCenterContext = createContext(null);
export const CLOSE_NOTIFICATION_EVENT = "d2-tama:close-notification";
const INBOX_FRESHNESS_MS = 60 * 1000;

function getUnreadNotifications(status) {
  return (status?.recentNotifications || []).filter((notification) => notification.readAt == null);
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
        ? { ...notification, readAt: notification.readAt ?? readAt }
        : notification
    ),
  };
}

export function NotificationCenterProvider({ children }) {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isChatOpen, setIsChatOpen } = usePresenceContext();
  const [statusEntry, setStatusEntry] = useState({ uid: "", value: null });
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const currentUid = currentUser?.uid || "";
  const status = statusEntry.uid === currentUid ? statusEntry.value : null;
  const activeUidRef = useRef(currentUid);
  const inboxCacheRef = useRef({ uid: "", value: null, fetchedAt: 0 });
  const inboxRequestRef = useRef({ uid: "", promise: null });

  activeUidRef.current = currentUid;

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

  const loadStatus = useCallback(async ({ silent = false, force = false } = {}) => {
    if (!routePolicy.shouldShowNotification || !currentUser) {
      return null;
    }

    const uid = currentUser.uid;
    if (!silent) {
      setIsLoading(true);
    }
    setErrorMessage("");
    let request = null;

    try {
      const activeRequest = inboxRequestRef.current;
      request = activeRequest.uid === uid ? activeRequest.promise : null;
      const cached = inboxCacheRef.current;

      if (!request && !force && cached.uid === uid && cached.value &&
          Date.now() - cached.fetchedAt < INBOX_FRESHNESS_MS) {
        setStatusEntry({ uid, value: cached.value });
        return cached.value;
      }

      if (!request) {
        request = getNotificationInbox(currentUser);
        inboxRequestRef.current = { uid, promise: request };
      }

      const nextStatus = await request;
      if (activeUidRef.current !== uid) {
        return null;
      }

      inboxCacheRef.current = {
        uid,
        value: nextStatus,
        fetchedAt: Date.now(),
      };
      setStatusEntry({ uid, value: nextStatus });
      return nextStatus;
    } catch (error) {
      if (activeUidRef.current === uid) {
        setErrorMessage(error?.message || "알림을 불러오지 못했습니다.");
      }
      return null;
    } finally {
      if (inboxRequestRef.current.promise === request) {
        inboxRequestRef.current = { uid: "", promise: null };
      }
      if (!silent && activeUidRef.current === uid) {
        setIsLoading(false);
      }
    }
  }, [currentUser, routePolicy.shouldShowNotification]);

  useEffect(() => {
    inboxCacheRef.current = { uid: "", value: null, fetchedAt: 0 };
    inboxRequestRef.current = { uid: "", promise: null };
    setStatusEntry({ uid: currentUid, value: null });
    setIsOpen(false);
    setErrorMessage("");
  }, [currentUid]);

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
      setStatusEntry({ uid: currentUid, value: null });
      setIsOpen(false);
      return;
    }

    void loadStatus();
  }, [currentUid, currentUser, loadStatus, routePolicy.shouldShowNotification]);

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
      const requestedNotificationIds = unreadNotifications
        .map((notification) => notification.id)
        .slice(0, 10);
      const result = await markNotificationsRead(currentUser, {
        notificationIds: requestedNotificationIds,
      });
      const notificationIds = result?.notificationIds?.length
        ? result.notificationIds
        : requestedNotificationIds;
      const readAt = result?.readAt || Date.now();
      setStatusEntry((currentEntry) => {
        if (currentEntry.uid !== currentUser.uid) {
          return currentEntry;
        }
        const nextStatus = applyReadState(currentEntry.value, notificationIds, readAt);
        if (inboxCacheRef.current.uid === currentUser.uid) {
          inboxCacheRef.current = {
            ...inboxCacheRef.current,
            value: nextStatus,
          };
        }
        return { uid: currentUser.uid, value: nextStatus };
      });
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
