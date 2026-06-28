"use strict";

const { randomUUID } = require("node:crypto");

const {
  commitWrites,
  createSetWrite,
  createUpdateWrite,
  getDocument,
  listDocuments,
  runQuery,
} = require("./firestoreAdmin");
const { allowMethods, handleApiError, sendJson } = require("./http");
const {
  resolveNotificationSettings,
} = require("./notificationReports");
const {
  isStoredInCareStorage,
  projectSlotForUrgentCare,
} = require("./urgentCareProjection");
const {
  disablePushSubscription,
  savePushSubscription,
  sendWebPushNotification,
} = require("./webPushNotifications");

const MAX_RECENT_NOTIFICATIONS = 10;
const MAX_RECENT_DELIVERIES = 10;
const URGENT_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const COMMUNITY_BOARD_LABELS = {
  showcase: "자랑게시판",
  free: "자유게시판",
  support: "문의/버그 게시판",
  news: "소식",
};

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeTimestampMs(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function buildNotificationId(type, nowMs = Date.now()) {
  const normalizedType = normalizeString(type, "system").replace(/[^a-z0-9_-]/gi, "_");
  return `${normalizedType}_${nowMs}_${randomUUID()}`;
}

function buildUserNotification({
  uid,
  type = "system",
  title,
  body,
  targetPath = "",
  source = {},
  channelState = {},
  currentTime = new Date(),
}) {
  const nowMs = currentTime instanceof Date ? currentTime.getTime() : Number(currentTime);
  const notificationId = buildNotificationId(type, nowMs);

  return {
    id: notificationId,
    path: `users/${uid}/notifications/${notificationId}`,
    data: {
      type,
      title: normalizeString(title, "알림"),
      body: normalizeString(body),
      targetPath: normalizeString(targetPath),
      source: source && typeof source === "object" ? source : {},
      channelState: channelState && typeof channelState === "object" ? channelState : {},
      readAt: null,
      createdAt: nowMs,
      updatedAt: nowMs,
    },
  };
}

async function resolveUserSettings(uid, getDocumentByPath = getDocument) {
  const [settingsDocument, rootDocument] = await Promise.all([
    getDocumentByPath(`users/${uid}/settings/main`),
    getDocumentByPath(`users/${uid}`),
  ]);

  return resolveNotificationSettings(settingsDocument?.data || {}, rootDocument?.data || {});
}

async function postDiscordWebhook(webhookUrl, content, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Discord 전송에 사용할 fetch 구현이 없습니다.");
  }

  const response = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(`Discord 전송 실패: HTTP ${response.status}`);
  }
}

async function maybeSendDiscordNotification({
  uid,
  title,
  body,
  settings = null,
  getDocumentByPath = getDocument,
  fetchImpl = globalThis.fetch,
}) {
  const resolvedSettings = settings || await resolveUserSettings(uid, getDocumentByPath);
  if (!resolvedSettings.isNotificationEnabled) {
    return {
      enabled: false,
      connected: Boolean(resolvedSettings.discordWebhookUrl),
      status: "skipped",
      reason: "disabled",
      sentAt: null,
    };
  }
  if (resolvedSettings.notificationChannels?.discord === false) {
    return {
      enabled: true,
      connected: Boolean(resolvedSettings.discordWebhookUrl),
      status: "skipped",
      reason: "channel_disabled",
      sentAt: null,
    };
  }
  if (!resolvedSettings.discordWebhookUrl) {
    return {
      enabled: true,
      connected: false,
      status: "skipped",
      reason: "missing_webhook",
      sentAt: null,
    };
  }

  const sentAt = Date.now();
  try {
    await postDiscordWebhook(resolvedSettings.discordWebhookUrl, `**${title}**\n${body}`, fetchImpl);
    return {
      enabled: true,
      connected: true,
      status: "sent",
      reason: "",
      sentAt,
    };
  } catch (error) {
    return {
      enabled: true,
      connected: true,
      status: "failed",
      reason: error?.message || "Discord 전송에 실패했습니다.",
      sentAt,
    };
  }
}

async function createUserNotification({
  uid,
  type,
  title,
  body,
  targetPath = "",
  source = {},
  sendDiscord = false,
  sendWebPush = true,
  getDocumentByPath = getDocument,
  listCollectionDocuments = listDocuments,
  commit = commitWrites,
  fetchImpl = globalThis.fetch,
  webPush = undefined,
  currentTime = new Date(),
}) {
  if (!uid) {
    throw new Error("알림을 저장할 사용자 ID가 필요합니다.");
  }

  const settings = await resolveUserSettings(uid, getDocumentByPath);
  const inAppState = settings.notificationChannels?.inApp === false
    ? { status: "hidden" }
    : { status: "stored" };
  const discordState = sendDiscord
    ? await maybeSendDiscordNotification({
        uid,
        title,
        body,
        settings,
        getDocumentByPath,
        fetchImpl,
      })
    : { status: "skipped", reason: "not_requested", sentAt: null };
  let webPushState;
  if (!sendWebPush) {
    webPushState = {
      status: "skipped",
      reason: "not_requested",
      sentAt: null,
      successCount: 0,
      failureCount: 0,
    };
  } else if (!settings.isNotificationEnabled) {
    webPushState = {
      status: "skipped",
      reason: "disabled",
      sentAt: null,
      successCount: 0,
      failureCount: 0,
    };
  } else if (settings.notificationChannels?.webPush === false) {
    webPushState = {
      status: "skipped",
      reason: "channel_disabled",
      sentAt: null,
      successCount: 0,
      failureCount: 0,
    };
  } else {
    webPushState = await sendWebPushNotification({
        uid,
        title,
        body,
        targetPath,
        listCollectionDocuments,
        webPush,
        currentTime,
      });
  }
  const notification = buildUserNotification({
    uid,
    type,
    title,
    body,
    targetPath,
    source,
    channelState: {
      discord: discordState,
      inApp: inAppState,
      webPush: webPushState,
    },
    currentTime,
  });

  await commit([createSetWrite(notification.path, notification.data)]);

  return {
    id: notification.id,
    ...notification.data,
  };
}

function buildCommunityCommentNotification({ boardId, postId, postTitle, commentAuthorName }) {
  const safeBoardId = normalizeString(boardId, "showcase");
  const boardLabel = COMMUNITY_BOARD_LABELS[safeBoardId] || "게시판";
  const safeTitle = normalizeString(postTitle, "게시글");
  const safeAuthor = normalizeString(commentAuthorName, "테이머");

  return {
    type: "community_comment",
    title: `${boardLabel}에 새 댓글이 달렸습니다.`,
    body: `${safeAuthor}님이 ${boardLabel}의 "${safeTitle}" 글에 댓글을 남겼습니다.`,
    targetPath: `/community?board=${encodeURIComponent(safeBoardId)}`,
    source: {
      boardId: safeBoardId,
      postId,
    },
  };
}

async function notifyCommunityComment({
  recipientUid,
  commenterUid,
  boardId,
  postId,
  postTitle,
  commentId,
  commentAuthorName,
  getDocumentByPath = getDocument,
  commit = commitWrites,
  fetchImpl = globalThis.fetch,
}) {
  if (!recipientUid || recipientUid === commenterUid) {
    return null;
  }

  const payload = buildCommunityCommentNotification({
    boardId,
    postId,
    postTitle,
    commentAuthorName,
  });

  return createUserNotification({
    uid: recipientUid,
    ...payload,
    source: {
      ...payload.source,
      commentId,
      commenterUid,
    },
    sendDiscord: true,
    getDocumentByPath,
    commit,
    fetchImpl,
  });
}

function buildDeliveryQuery(uid) {
  return {
    from: [{ collectionId: "notification_deliveries" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "uid" },
        op: "EQUAL",
        value: { stringValue: uid },
      },
    },
    orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
    limit: MAX_RECENT_DELIVERIES,
  };
}

function mapNotificationDocument(document) {
  const data = document?.data || {};
  return {
    id: document?.id || "",
    type: normalizeString(data.type, "system"),
    title: normalizeString(data.title, "알림"),
    body: normalizeString(data.body),
    targetPath: normalizeString(data.targetPath),
    readAt: data.readAt || null,
    createdAt: data.createdAt || null,
    channelState: data.channelState || {},
  };
}

function isVisibleInAppNotification(notification) {
  return notification?.channelState?.inApp?.status !== "hidden";
}

function normalizeNotificationIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((id) => normalizeString(id)).filter(Boolean))];
}

async function markUserNotificationsRead({
  uid,
  notificationIds = [],
  allVisible = false,
  listCollectionDocuments = listDocuments,
  commit = commitWrites,
  currentTime = new Date(),
}) {
  if (!uid) {
    throw new Error("알림을 읽음 처리할 사용자 ID가 필요합니다.");
  }

  const nowMs = currentTime instanceof Date ? currentTime.getTime() : Number(currentTime);
  const requestedIds = normalizeNotificationIds(notificationIds);
  let targetIds = requestedIds;

  if (allVisible) {
    const notificationDocuments = await listCollectionDocuments(`users/${uid}/notifications`).catch(() => []);
    targetIds = notificationDocuments
      .map(mapNotificationDocument)
      .filter(isVisibleInAppNotification)
      .sort((left, right) => normalizeTimestampMs(right.createdAt) - normalizeTimestampMs(left.createdAt))
      .slice(0, MAX_RECENT_NOTIFICATIONS)
      .filter((notification) => !notification.readAt)
      .map((notification) => notification.id);
  }

  const safeTargetIds = normalizeNotificationIds(targetIds);
  if (safeTargetIds.length === 0) {
    return {
      markedCount: 0,
      notificationIds: [],
      readAt: nowMs,
    };
  }

  const writes = safeTargetIds.map((notificationId) =>
    createUpdateWrite(
      `users/${uid}/notifications/${notificationId}`,
      {
        readAt: nowMs,
        updatedAt: nowMs,
      },
      ["readAt", "updatedAt"]
    )
  );

  await commit(writes);

  return {
    markedCount: safeTargetIds.length,
    notificationIds: safeTargetIds,
    readAt: nowMs,
  };
}

function summarizeLastDiscordResult(notifications = [], deliveries = []) {
  const notificationWithDiscord = notifications.find((notification) => {
    const status = notification?.channelState?.discord?.status;
    return status && status !== "skipped";
  });

  if (notificationWithDiscord) {
    return {
      source: "user_notification",
      status: notificationWithDiscord.channelState.discord.status,
      reason: notificationWithDiscord.channelState.discord.reason || "",
      at: notificationWithDiscord.channelState.discord.sentAt || notificationWithDiscord.createdAt || null,
    };
  }

  const delivery = deliveries.find((entry) => entry?.status);
  if (delivery) {
    return {
      source: "urgent_delivery",
      status: delivery.status,
      reason: "",
      at: delivery.acknowledgedAt || delivery.createdAt || null,
    };
  }

  return null;
}

function mapUrgentCheckStatus(document) {
  const data = document?.data || {};
  if (!document || !data.status) return null;
  return {
    status: normalizeString(data.status, "unknown"),
    checkedAt: data.checkedAt || null,
    preparedReports: Number(data.preparedReports || 0),
    successfulReports: Number(data.successfulReports || 0),
    failedReports: Number(data.failedReports || 0),
    acknowledged: Number(data.acknowledged || 0),
    projectionUnavailable: Number(data.projectionUnavailable || 0),
    frozenSlots: Number(data.frozenSlots || 0),
    newDeliveries: Number(data.newDeliveries || 0),
    reusedDeliveries: Number(data.reusedDeliveries || 0),
    expiredDeliveries: Number(data.expiredDeliveries || 0),
    errorMessage: normalizeString(data.errorMessage),
    updatedAt: data.updatedAt || null,
  };
}

async function buildProjectionSummary({ uid, listCollectionDocuments = listDocuments, currentTime = new Date() }) {
  const nowMs = currentTime instanceof Date ? currentTime.getTime() : Number(currentTime);
  const slots = await listCollectionDocuments(`users/${uid}/slots`);
  const unavailableSlots = [];
  let projectedSlots = 0;
  let frozenSlots = 0;

  slots.forEach((slotDocument) => {
    const slotId = normalizeString(slotDocument?.id || slotDocument?.name?.split("/").pop(), "slot?");
    const slotData = slotDocument?.data || {};

    if (isStoredInCareStorage(slotData)) {
      frozenSlots += 1;
      return;
    }

    const projection = projectSlotForUrgentCare(slotData, nowMs);
    if (projection.status === "projected") {
      projectedSlots += 1;
      return;
    }

    unavailableSlots.push(slotId);
  });

  return {
    totalSlots: slots.length,
    projectedSlots,
    frozenSlots,
    unavailableSlots,
    projectionUnavailable: unavailableSlots.length,
  };
}

async function getUserNotificationStatus({
  uid,
  slotId = "",
  getDocumentByPath = getDocument,
  listCollectionDocuments = listDocuments,
  runFirestoreQuery = runQuery,
  currentTime = new Date(),
}) {
  const settings = await resolveUserSettings(uid, getDocumentByPath);
  const [notificationDocuments, deliveryDocuments, notificationStateDocuments, pushSubscriptionDocuments, projection, urgentCheckDocument] =
    await Promise.all([
      listCollectionDocuments(`users/${uid}/notifications`).catch(() => []),
      runFirestoreQuery(buildDeliveryQuery(uid)).catch(() => []),
      listCollectionDocuments(`users/${uid}/notificationState`).catch(() => []),
      listCollectionDocuments(`users/${uid}/pushSubscriptions`).catch(() => []),
      buildProjectionSummary({ uid, listCollectionDocuments, currentTime }).catch(() => ({
        totalSlots: 0,
        projectedSlots: 0,
        frozenSlots: 0,
        unavailableSlots: [],
        projectionUnavailable: 0,
      })),
      getDocumentByPath("notification_runtime/urgentCare").catch(() => null),
    ]);

  const recentNotifications = notificationDocuments
    .map(mapNotificationDocument)
    .filter(isVisibleInAppNotification)
    .sort((left, right) => normalizeTimestampMs(right.createdAt) - normalizeTimestampMs(left.createdAt))
    .slice(0, MAX_RECENT_NOTIFICATIONS);
  const allNotifications = notificationDocuments
    .map(mapNotificationDocument)
    .sort((left, right) => normalizeTimestampMs(right.createdAt) - normalizeTimestampMs(left.createdAt));
  const recentDeliveries = deliveryDocuments.map((document) => ({
    id: document.id,
    status: normalizeString(document.data?.status, "unknown"),
    slotId: normalizeString(document.data?.slotId),
    createdAt: document.data?.createdAt || null,
    acknowledgedAt: document.data?.acknowledgedAt || null,
    issueKeys: Array.isArray(document.data?.issueKeys) ? document.data.issueKeys : [],
  }));
  const activeIssueSlotCount = notificationStateDocuments.filter((document) =>
    Array.isArray(document.data?.activeIssueKeys) && document.data.activeIssueKeys.length > 0
  ).length;
  const activePushSubscriptionCount = pushSubscriptionDocuments.filter(
    (document) => document.data?.enabled !== false && document.data?.endpoint
  ).length;

  return {
    settings: {
      isNotificationEnabled: settings.isNotificationEnabled === true,
      notificationChannels: settings.notificationChannels,
      hasDiscordWebhook: Boolean(settings.discordWebhookUrl),
      hasWebPushSubscription: activePushSubscriptionCount > 0,
      activePushSubscriptionCount,
    },
    projection,
    delivery: {
      activeIssueSlotCount,
      recentDeliveries,
      lastDiscordResult: summarizeLastDiscordResult(recentNotifications, recentDeliveries),
    },
    recentNotifications,
    urgentCheck: mapUrgentCheckStatus(urgentCheckDocument),
    diagnostics: {
      nextUrgentCheckAt: urgentCheckDocument?.data?.checkedAt
        ? normalizeTimestampMs(urgentCheckDocument.data.checkedAt) + URGENT_CHECK_INTERVAL_MS
        : null,
      latestTestNotification:
        allNotifications.find((notification) => notification.type === "system_test") || null,
      currentSlot: slotId
        ? await buildCurrentSlotUrgentDiagnostics({
            uid,
            slotId,
            getDocumentByPath,
            currentTime,
          })
        : null,
    },
  };
}

async function buildCurrentSlotUrgentDiagnostics({
  uid,
  slotId,
  getDocumentByPath = getDocument,
  currentTime = new Date(),
}) {
  const normalizedSlotId = normalizeString(slotId);
  if (!normalizedSlotId) {
    return null;
  }

  try {
    const { isStoredInCareStorage, projectSlotForUrgentCare } = require("./urgentCareProjection");
    const { resolveUrgentIssues } = require("./urgentCareProjection");
    const nowMs = currentTime instanceof Date ? currentTime.getTime() : Number(currentTime);
    const slotDocument = await getDocumentByPath(`users/${uid}/slots/${normalizedSlotId}`);
    const slotData = slotDocument?.data || {};

    if (!slotDocument) {
      return { slotId: normalizedSlotId, status: "missing", issues: [] };
    }
    if (slotData.notificationEligible !== true) {
      return { slotId: normalizedSlotId, status: "not_eligible", issues: [] };
    }
    if (isStoredInCareStorage(slotData)) {
      return { slotId: normalizedSlotId, status: "stored", issues: [] };
    }

    const projection = projectSlotForUrgentCare(slotData, nowMs);
    if (projection.status !== "projected") {
      return {
        slotId: normalizedSlotId,
        status: projection.status || "projection_unavailable",
        reason: projection.reason || "",
        issues: [],
      };
    }

    const issues = resolveUrgentIssues(projection.stats, slotData, nowMs).map((issue) => ({
      key: issue.key,
      label: issue.label || issue.title || issue.key,
    }));
    return {
      slotId: normalizedSlotId,
      status: issues.length ? "urgent" : "clear",
      issues,
    };
  } catch (error) {
    return {
      slotId: normalizedSlotId,
      status: "error",
      reason: error?.message || "현재 슬롯 진단에 실패했습니다.",
      issues: [],
    };
  }
}

function createNotificationStatusHandler(deps = {}) {
  return async function notificationStatusHandler(req, res) {
    if (!allowMethods(req, res, ["GET"])) return;

    try {
      const { verifyRequestUser } = require("./auth");
      const decodedToken = await (deps.verifyRequestUser || verifyRequestUser)(req);
      const payload = await getUserNotificationStatus({
        uid: decodedToken.uid,
        slotId: normalizeString(req.query?.slotId),
        getDocumentByPath: deps.getDocument || getDocument,
        listCollectionDocuments: deps.listDocuments || listDocuments,
        runFirestoreQuery: deps.runQuery || runQuery,
        currentTime: (deps.getCurrentTime || (() => new Date()))(),
      });

      sendJson(res, 200, { ok: true, status: payload });
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

function createTestNotificationHandler(deps = {}) {
  return async function testNotificationHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) return;

    try {
      const { verifyRequestUser } = require("./auth");
      const decodedToken = await (deps.verifyRequestUser || verifyRequestUser)(req);
      const notification = await createUserNotification({
        uid: decodedToken.uid,
        type: "system_test",
        title: "테스트 알림",
        body: "D2 Tama 알림 연결을 확인했습니다.",
        targetPath: "/me/settings",
        source: { kind: "manual_test" },
        sendDiscord: true,
        getDocumentByPath: deps.getDocument || getDocument,
        listCollectionDocuments: deps.listDocuments || listDocuments,
        commit: deps.commitWrites || commitWrites,
        fetchImpl: deps.fetch || globalThis.fetch,
        webPush: deps.webPush,
        currentTime: (deps.getCurrentTime || (() => new Date()))(),
      });

      sendJson(res, 201, { ok: true, notification });
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

function createNotificationReadHandler(deps = {}) {
  return async function notificationReadHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) return;

    try {
      const { verifyRequestUser } = require("./auth");
      const decodedToken = await (deps.verifyRequestUser || verifyRequestUser)(req);
      const result = await markUserNotificationsRead({
        uid: decodedToken.uid,
        notificationIds: req.body?.notificationIds,
        allVisible: req.body?.allVisible === true,
        listCollectionDocuments: deps.listDocuments || listDocuments,
        commit: deps.commitWrites || commitWrites,
        currentTime: (deps.getCurrentTime || (() => new Date()))(),
      });

      sendJson(res, 200, { ok: true, result });
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

function createPushSubscribeHandler(deps = {}) {
  return async function pushSubscribeHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) return;

    try {
      const { verifyRequestUser } = require("./auth");
      const decodedToken = await (deps.verifyRequestUser || verifyRequestUser)(req);
      const result = await savePushSubscription({
        uid: decodedToken.uid,
        subscription: req.body?.subscription,
        userAgent: req.headers?.["user-agent"] || "",
        commit: deps.commitWrites || commitWrites,
        currentTime: (deps.getCurrentTime || (() => new Date()))(),
      });

      sendJson(res, 200, { ok: true, result });
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

function createPushUnsubscribeHandler(deps = {}) {
  return async function pushUnsubscribeHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) return;

    try {
      const { verifyRequestUser } = require("./auth");
      const decodedToken = await (deps.verifyRequestUser || verifyRequestUser)(req);
      const result = await disablePushSubscription({
        uid: decodedToken.uid,
        endpoint: req.body?.endpoint,
        commit: deps.commitWrites || commitWrites,
        currentTime: (deps.getCurrentTime || (() => new Date()))(),
      });

      sendJson(res, 200, { ok: true, result });
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

module.exports = {
  buildCommunityCommentNotification,
  buildNotificationId,
  buildProjectionSummary,
  buildUserNotification,
  createNotificationReadHandler,
  createNotificationStatusHandler,
  createPushSubscribeHandler,
  createPushUnsubscribeHandler,
  createTestNotificationHandler,
  createUserNotification,
  getUserNotificationStatus,
  markUserNotificationsRead,
  maybeSendDiscordNotification,
  notifyCommunityComment,
};
