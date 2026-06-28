"use strict";

const { createHash } = require("node:crypto");

const {
  commitWrites,
  createSetWrite,
  createUpdateWrite,
  listDocuments,
} = require("./firestoreAdmin");

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeSubscription(input = {}) {
  const endpoint = normalizeString(input.endpoint);
  const keys = input.keys && typeof input.keys === "object" ? input.keys : {};
  const p256dh = normalizeString(keys.p256dh);
  const auth = normalizeString(keys.auth);

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    keys: { p256dh, auth },
  };
}

function buildSubscriptionId(endpoint) {
  return createHash("sha256").update(String(endpoint)).digest("hex").slice(0, 32);
}

function resolveVapidConfig(env = process.env) {
  return {
    publicKey: normalizeString(env.VAPID_PUBLIC_KEY || env.REACT_APP_VAPID_PUBLIC_KEY),
    privateKey: normalizeString(env.VAPID_PRIVATE_KEY),
    subject: normalizeString(env.VAPID_SUBJECT, "mailto:admin@d2-tama.local"),
  };
}

function loadWebPushLibrary() {
  try {
    return require("web-push");
  } catch (error) {
    return null;
  }
}

async function listActivePushSubscriptions(uid, listCollectionDocuments = listDocuments) {
  if (!uid) {
    return [];
  }

  const documents = await listCollectionDocuments(`users/${uid}/pushSubscriptions`).catch(() => []);
  return (Array.isArray(documents) ? documents : [])
    .map((document) => ({
      id: document.id,
      ...normalizeSubscription(document.data || {}),
      data: document.data || {},
    }))
    .filter((subscription) => subscription.endpoint && subscription.data.enabled !== false);
}

async function savePushSubscription({
  uid,
  subscription,
  userAgent = "",
  commit = commitWrites,
  currentTime = new Date(),
}) {
  const normalized = normalizeSubscription(subscription);
  if (!uid || !normalized) {
    throw new Error("브라우저 푸시 구독 정보가 올바르지 않습니다.");
  }

  const nowMs = currentTime instanceof Date ? currentTime.getTime() : Number(currentTime);
  const subscriptionId = buildSubscriptionId(normalized.endpoint);
  await commit([
    createSetWrite(`users/${uid}/pushSubscriptions/${subscriptionId}`, {
      ...normalized,
      enabled: true,
      userAgent: normalizeString(userAgent),
      createdAt: nowMs,
      updatedAt: nowMs,
      lastSuccessAt: null,
      lastFailureAt: null,
    }),
  ]);

  return { subscriptionId, enabled: true, updatedAt: nowMs };
}

async function disablePushSubscription({
  uid,
  endpoint,
  commit = commitWrites,
  currentTime = new Date(),
}) {
  const normalizedEndpoint = normalizeString(endpoint);
  if (!uid || !normalizedEndpoint) {
    throw new Error("해제할 브라우저 푸시 구독 정보가 없습니다.");
  }

  const nowMs = currentTime instanceof Date ? currentTime.getTime() : Number(currentTime);
  const subscriptionId = buildSubscriptionId(normalizedEndpoint);
  await commit([
    createUpdateWrite(
      `users/${uid}/pushSubscriptions/${subscriptionId}`,
      {
        enabled: false,
        updatedAt: nowMs,
      },
      ["enabled", "updatedAt"]
    ),
  ]);

  return { subscriptionId, enabled: false, updatedAt: nowMs };
}

async function sendWebPushNotification({
  uid,
  title,
  body,
  targetPath = "",
  listCollectionDocuments = listDocuments,
  webPush = loadWebPushLibrary(),
  currentTime = new Date(),
}) {
  const subscriptions = await listActivePushSubscriptions(uid, listCollectionDocuments);
  if (subscriptions.length === 0) {
    return {
      status: "skipped",
      reason: "missing_subscription",
      sentAt: null,
      successCount: 0,
      failureCount: 0,
    };
  }

  const vapid = resolveVapidConfig();
  if (!webPush || !vapid.publicKey || !vapid.privateKey) {
    return {
      status: "skipped",
      reason: "not_configured",
      sentAt: null,
      successCount: 0,
      failureCount: 0,
    };
  }

  webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  const sentAt = currentTime instanceof Date ? currentTime.getTime() : Number(currentTime);
  const payload = JSON.stringify({
    title: normalizeString(title, "D2 Tama 알림"),
    body: normalizeString(body),
    targetPath: normalizeString(targetPath, "/"),
  });
  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        payload
      )
    )
  );
  const successCount = results.filter((result) => result.status === "fulfilled").length;
  const failureCount = results.length - successCount;

  return {
    status: failureCount === 0 ? "sent" : successCount > 0 ? "partial" : "failed",
    reason: failureCount === 0 ? "" : "send_failed",
    sentAt,
    successCount,
    failureCount,
  };
}

module.exports = {
  buildSubscriptionId,
  disablePushSubscription,
  listActivePushSubscriptions,
  normalizeSubscription,
  savePushSubscription,
  sendWebPushNotification,
};
