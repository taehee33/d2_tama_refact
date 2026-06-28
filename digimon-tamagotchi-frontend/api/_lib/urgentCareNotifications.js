"use strict";

const {
  commitWrites,
  createSetWrite,
  getDocument,
  listDocuments,
  runQuery,
} = require("./firestoreAdmin");
const { allowMethods, handleApiError, sendJson } = require("./http");
const {
  resolveDigimonDisplayName,
  resolveNotificationSettings,
  resolveTamerName,
  verifySchedulerSecret,
} = require("./notificationReports");
const {
  buildDeliveryId,
  buildUrgentNotificationBody,
  buildUrgentMessage,
  commitInBatches,
  formatKstDate,
} = require("./urgentCareDelivery");
const {
  hasProjectionRuntime,
  isStoredInCareStorage,
  projectSlotForUrgentCare,
  resolveUrgentIssues,
} = require("./urgentCareProjection");
const { listNotificationSubscribers } = require("./notificationSubscribers");
const { maybeSendDiscordNotification } = require("./userNotifications");
const { sendWebPushNotification } = require("./webPushNotifications");

const DELIVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EXPIRED_DELIVERY_CLEANUP_LIMIT = 100;
const URGENT_CHECK_RUNTIME_PATH = "notification_runtime/urgentCare";

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function createEligibleSlotsQuery() {
  return {
    from: [{ collectionId: "slots" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "notificationEligible" },
        op: "EQUAL",
        value: { booleanValue: true },
      },
    },
  };
}

async function listEligibleNotificationSlots(uid, queryDocuments = runQuery) {
  return queryDocuments(createEligibleSlotsQuery(), `users/${uid}`);
}

function createPendingDeliveriesQuery(nowMs) {
  return {
    from: [{ collectionId: "notification_deliveries" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: "status" },
              op: "EQUAL",
              value: { stringValue: "pending" },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "expiresAt" },
              op: "GREATER_THAN",
              value: { integerValue: String(nowMs) },
            },
          },
        ],
      },
    },
    orderBy: [{ field: { fieldPath: "expiresAt" }, direction: "ASCENDING" }],
  };
}

function createExpiredPendingDeliveriesQuery(nowMs) {
  return {
    from: [{ collectionId: "notification_deliveries" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: "status" },
              op: "EQUAL",
              value: { stringValue: "pending" },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "expiresAt" },
              op: "LESS_THAN_OR_EQUAL",
              value: { integerValue: String(nowMs) },
            },
          },
        ],
      },
    },
    orderBy: [{ field: { fieldPath: "expiresAt" }, direction: "ASCENDING" }],
    limit: EXPIRED_DELIVERY_CLEANUP_LIMIT,
  };
}

async function listPendingUrgentDeliveries(nowMs, queryDocuments = runQuery) {
  return queryDocuments(createPendingDeliveriesQuery(nowMs));
}

async function listExpiredPendingUrgentDeliveries(nowMs, queryDocuments = runQuery) {
  return queryDocuments(createExpiredPendingDeliveriesQuery(nowMs));
}

function buildUrgentNotificationPath(uid, deliveryId) {
  return `users/${uid}/notifications/urgent_${deliveryId}`;
}

function buildSlotTargetPath(slotId) {
  const numericSlotId = String(slotId || "").match(/\d+/)?.[0];
  return numericSlotId ? `/play/${numericSlotId}` : "/play";
}

function normalizeSlotDocumentId(slotId) {
  const normalized = normalizeString(slotId);
  if (!normalized) return "";
  return normalized.startsWith("slot") ? normalized : `slot${normalized}`;
}

function buildInAppChannelState(settings = {}) {
  return settings.notificationChannels?.inApp === false
    ? { status: "hidden" }
    : { status: "stored" };
}

function buildSkippedWebPushState(reason) {
  return {
    status: "skipped",
    reason,
    sentAt: null,
    successCount: 0,
    failureCount: 0,
  };
}

async function maybeSendWebPushForSettings({
  uid,
  title,
  body,
  targetPath,
  settings = {},
  listCollectionDocuments,
  webPush,
  currentTime,
}) {
  if (!settings.isNotificationEnabled) {
    return buildSkippedWebPushState("disabled");
  }
  if (settings.notificationChannels?.webPush === false) {
    return buildSkippedWebPushState("channel_disabled");
  }

  return sendWebPushNotification({
    uid,
    title,
    body,
    targetPath,
    listCollectionDocuments,
    webPush,
    currentTime,
  });
}

async function prepareUrgentCareNotifications({
  subscribers = [],
  getDocumentByPath,
  listCollectionDocuments,
  listEligibleSlotDocuments = listEligibleNotificationSlots,
  listPendingDeliveryDocuments = async () => [],
  listExpiredPendingDeliveryDocuments = async () => [],
  commit,
  fetchImpl = globalThis.fetch,
  webPush = undefined,
  currentTime = new Date(),
  dryRun = false,
}) {
  const nowMs = currentTime instanceof Date ? currentTime.getTime() : Number(currentTime);
  const [pendingDocuments, expiredPendingDocuments] = await Promise.all([
    listPendingDeliveryDocuments(nowMs),
    dryRun ? Promise.resolve([]) : listExpiredPendingDeliveryDocuments(nowMs),
  ]);
  const pendingBySlot = new Map();
  const writes = [];
  pendingDocuments.forEach((document) => {
    const data = document?.data || {};
    if (data.status === "pending" && Number(data.expiresAt) > nowMs) {
      pendingBySlot.set(`${data.uid}:${data.slotId}`, { id: document.id, data });
    }
  });
  expiredPendingDocuments.forEach((document) => {
    const data = document?.data || {};
    if (data.status === "pending" && !dryRun) {
      writes.push(createSetWrite(`notification_deliveries/${document.id}`, {
        ...data,
        status: "cancelled",
        cancelledAt: nowMs,
      }));
    }
  });

  const reports = [];
  const summary = {
    totalUsers: subscribers.length,
    activeUsers: 0,
    totalSlots: 0,
    projectedSlots: 0,
    projectionUnavailable: 0,
    frozenSlots: 0,
    newDeliveries: 0,
    reusedDeliveries: 0,
    expiredDeliveries: writes.length,
  };

  for (const subscriber of subscribers) {
    const uid = normalizeString(subscriber?.uid || subscriber?.id);
    if (!uid) continue;
    const settings = resolveNotificationSettings(subscriber?.data, {});
    if (!settings.isNotificationEnabled) continue;
    summary.activeUsers += 1;
    const [rootDocument, profileDocument, slots] = await Promise.all([
      getDocumentByPath(`users/${uid}`),
      getDocumentByPath(`users/${uid}/profile/main`),
      listEligibleSlotDocuments(uid),
    ]);
    const rootData = rootDocument?.data || {};
    summary.totalSlots += slots.length;
    const slotAlerts = [];

    for (const slotDocument of slots) {
      const slotId = normalizeString(slotDocument?.id || slotDocument?.name?.split("/").pop(), "slot?");
      const slotData = slotDocument?.data || {};
      const statePath = `users/${uid}/notificationState/${slotId}`;
      const stateDocument = await getDocumentByPath(statePath);
      const activeIssueKeys = Array.isArray(stateDocument?.data?.activeIssueKeys)
        ? stateDocument.data.activeIssueKeys
        : [];

      if (isStoredInCareStorage(slotData)) {
        summary.frozenSlots += 1;
        if (activeIssueKeys.length && !dryRun) {
          writes.push(createSetWrite(statePath, {
            activeIssueKeys: [],
            lastAcknowledgedAt: stateDocument?.data?.lastAcknowledgedAt || null,
            updatedAt: nowMs,
          }));
        }
        continue;
      }

      const projection = projectSlotForUrgentCare(slotData, nowMs);
      if (projection.status !== "projected") {
        summary.projectionUnavailable += 1;
        continue;
      }
      summary.projectedSlots += 1;
      const issues = resolveUrgentIssues(projection.stats, slotData, nowMs);
      const currentKeys = issues.map((issue) => issue.key);
      const retainedActiveKeys = activeIssueKeys.filter((key) => currentKeys.includes(key));
      const newIssues = issues.filter((issue) => !retainedActiveKeys.includes(issue.key));

      if (retainedActiveKeys.length !== activeIssueKeys.length && !dryRun) {
        writes.push(createSetWrite(statePath, {
          activeIssueKeys: retainedActiveKeys,
          lastAcknowledgedAt: stateDocument?.data?.lastAcknowledgedAt || null,
          updatedAt: nowMs,
        }));
      }
      if (!newIssues.length) continue;

      const pendingKey = `${uid}:${slotId}`;
      const reusable = pendingBySlot.get(pendingKey);
      let deliveryId;
      const nextIssueKeys = newIssues.map((issue) => issue.key).sort();
      const reusableIssueKeys = [...(reusable?.data?.issueKeys || [])].sort();
      if (reusable && JSON.stringify(nextIssueKeys) === JSON.stringify(reusableIssueKeys)) {
        deliveryId = reusable.id;
        summary.reusedDeliveries += 1;
      } else {
        if (reusable && !dryRun) {
          writes.push(createSetWrite(`notification_deliveries/${reusable.id}`, {
            ...reusable.data,
            status: "cancelled",
            cancelledAt: nowMs,
          }));
        }
        deliveryId = buildDeliveryId(
          uid,
          slotId,
          nextIssueKeys,
          stateDocument?.data?.lastAcknowledgedAt || 0
        );
        summary.newDeliveries += 1;
        if (!dryRun) {
          const digimonName = resolveDigimonDisplayName(slotData);
          const notificationBody = buildUrgentNotificationBody(slotId, digimonName, newIssues);
          const notificationTargetPath = buildSlotTargetPath(slotId);
          const [discordState, webPushState] = await Promise.all([
            maybeSendDiscordNotification({
              uid,
              title: "디지몬 긴급 케어 알림",
              body: notificationBody,
              settings,
              getDocumentByPath,
              fetchImpl,
            }),
            maybeSendWebPushForSettings({
              uid,
              title: "디지몬 긴급 케어 알림",
              body: notificationBody,
              targetPath: notificationTargetPath,
              settings,
              listCollectionDocuments,
              webPush,
              currentTime,
            }),
          ]);
          writes.push(createSetWrite(`notification_deliveries/${deliveryId}`, {
            uid,
            slotId,
            issueKeys: nextIssueKeys,
            issues: newIssues,
            slotIssues: [{ slotId, issues: newIssues }],
            status: "pending",
            createdAt: nowMs,
            expiresAt: nowMs + DELIVERY_TTL_MS,
          }));
          writes.push(createSetWrite(buildUrgentNotificationPath(uid, deliveryId), {
            type: "urgent_care",
            title: "디지몬 긴급 케어 알림",
            body: notificationBody,
            targetPath: notificationTargetPath,
            source: {
              kind: "urgent_delivery",
              deliveryId,
              slotId,
              issueKeys: nextIssueKeys,
            },
            channelState: {
              inApp: buildInAppChannelState(settings),
              discord: discordState,
              webPush: webPushState,
            },
            readAt: null,
            createdAt: nowMs,
            updatedAt: nowMs,
          }));
        }
      }
      slotAlerts.push({
        deliveryId,
        slotId,
        digimonName: resolveDigimonDisplayName(slotData),
        issues: newIssues,
      });
    }

    if (slotAlerts.length) {
      const tamerName = resolveTamerName(profileDocument?.data, rootData);
      reports.push({
        uid,
        tamerName,
        webhookUrl: settings.discordWebhookUrl,
        deliveryIds: slotAlerts.map((slot) => slot.deliveryId),
        slotIssues: slotAlerts.map(({ deliveryId, slotId, digimonName, issues }) => ({
          deliveryId,
          slotId,
          digimonName,
          issues,
        })),
        messageContent: buildUrgentMessage(tamerName, slotAlerts, formatKstDate(nowMs)),
      });
    }
  }

  if (!dryRun) {
    writes.push(createSetWrite(URGENT_CHECK_RUNTIME_PATH, {
      status: "success",
      checkedAt: nowMs,
      preparedReports: reports.length,
      successfulReports: reports.length,
      failedReports: 0,
      acknowledged: 0,
      projectionUnavailable: summary.projectionUnavailable,
      frozenSlots: summary.frozenSlots,
      newDeliveries: summary.newDeliveries,
      reusedDeliveries: summary.reusedDeliveries,
      expiredDeliveries: summary.expiredDeliveries,
      updatedAt: nowMs,
    }));
  }
  if (!dryRun && writes.length) await commitInBatches(writes, commit);
  return { ok: true, dryRun, generatedAt: formatKstDate(nowMs), summary, reports };
}

async function evaluateUrgentCareSlotNotification({
  uid,
  slotId,
  getDocumentByPath,
  listCollectionDocuments,
  listPendingDeliveryDocuments = async () => [],
  commit,
  fetchImpl = globalThis.fetch,
  webPush = undefined,
  currentTime = new Date(),
  dryRun = false,
}) {
  const nowMs = currentTime instanceof Date ? currentTime.getTime() : Number(currentTime);
  const normalizedSlotId = normalizeSlotDocumentId(slotId);
  if (!uid || !normalizedSlotId) {
    const error = new Error("즉시 알림을 평가할 사용자와 슬롯 ID가 필요합니다.");
    error.status = 400;
    throw error;
  }

  const [settingsDocument, rootDocument, slotDocument, pendingDocuments] = await Promise.all([
    getDocumentByPath(`users/${uid}/settings/main`),
    getDocumentByPath(`users/${uid}`),
    getDocumentByPath(`users/${uid}/slots/${normalizedSlotId}`),
    listPendingDeliveryDocuments(nowMs),
  ]);
  const settings = resolveNotificationSettings(
    settingsDocument?.data || {},
    rootDocument?.data || {}
  );

  if (!settings.isNotificationEnabled) {
    return {
      ok: true,
      status: "skipped",
      reason: "disabled",
      slotId: normalizedSlotId,
      newDeliveries: 0,
      reusedDeliveries: 0,
    };
  }
  if (!slotDocument) {
    return {
      ok: true,
      status: "skipped",
      reason: "missing_slot",
      slotId: normalizedSlotId,
      newDeliveries: 0,
      reusedDeliveries: 0,
    };
  }

  const slotData = slotDocument.data || {};
  if (slotData.notificationEligible !== true) {
    return {
      ok: true,
      status: "skipped",
      reason: "not_eligible",
      slotId: normalizedSlotId,
      newDeliveries: 0,
      reusedDeliveries: 0,
    };
  }

  const statePath = `users/${uid}/notificationState/${normalizedSlotId}`;
  const stateDocument = await getDocumentByPath(statePath);
  const activeIssueKeys = Array.isArray(stateDocument?.data?.activeIssueKeys)
    ? stateDocument.data.activeIssueKeys
    : [];
  const writes = [];

  if (isStoredInCareStorage(slotData)) {
    if (activeIssueKeys.length && !dryRun) {
      writes.push(createSetWrite(statePath, {
        activeIssueKeys: [],
        lastAcknowledgedAt: stateDocument?.data?.lastAcknowledgedAt || null,
        updatedAt: nowMs,
      }));
      await commitInBatches(writes, commit);
    }
    return {
      ok: true,
      status: "skipped",
      reason: "stored",
      slotId: normalizedSlotId,
      newDeliveries: 0,
      reusedDeliveries: 0,
    };
  }

  const projection = projectSlotForUrgentCare(slotData, nowMs);
  if (projection.status !== "projected") {
    return {
      ok: true,
      status: "skipped",
      reason: projection.reason || projection.status || "projection_unavailable",
      slotId: normalizedSlotId,
      newDeliveries: 0,
      reusedDeliveries: 0,
    };
  }

  const issues = resolveUrgentIssues(projection.stats, slotData, nowMs);
  const currentKeys = issues.map((issue) => issue.key);
  const retainedActiveKeys = activeIssueKeys.filter((key) => currentKeys.includes(key));
  const newIssues = issues.filter((issue) => !retainedActiveKeys.includes(issue.key));

  if (retainedActiveKeys.length !== activeIssueKeys.length && !dryRun) {
    writes.push(createSetWrite(statePath, {
      activeIssueKeys: retainedActiveKeys,
      lastAcknowledgedAt: stateDocument?.data?.lastAcknowledgedAt || null,
      updatedAt: nowMs,
    }));
  }
  if (!newIssues.length) {
    if (!dryRun && writes.length) await commitInBatches(writes, commit);
    return {
      ok: true,
      status: "clear",
      reason: "",
      slotId: normalizedSlotId,
      newDeliveries: 0,
      reusedDeliveries: 0,
      issues: [],
    };
  }

  const pendingBySlot = new Map();
  pendingDocuments.forEach((document) => {
    const data = document?.data || {};
    if (data.status === "pending" && Number(data.expiresAt) > nowMs) {
      pendingBySlot.set(`${data.uid}:${data.slotId}`, { id: document.id, data });
    }
  });

  const pendingKey = `${uid}:${normalizedSlotId}`;
  const reusable = pendingBySlot.get(pendingKey);
  const nextIssueKeys = newIssues.map((issue) => issue.key).sort();
  const reusableIssueKeys = [...(reusable?.data?.issueKeys || [])].sort();
  if (reusable && JSON.stringify(nextIssueKeys) === JSON.stringify(reusableIssueKeys)) {
    if (!dryRun && writes.length) await commitInBatches(writes, commit);
    return {
      ok: true,
      status: "reused",
      reason: "",
      slotId: normalizedSlotId,
      deliveryId: reusable.id,
      newDeliveries: 0,
      reusedDeliveries: 1,
      issues: newIssues,
    };
  }

  if (reusable && !dryRun) {
    writes.push(createSetWrite(`notification_deliveries/${reusable.id}`, {
      ...reusable.data,
      status: "cancelled",
      cancelledAt: nowMs,
    }));
  }

  const deliveryId = buildDeliveryId(
    uid,
    normalizedSlotId,
    nextIssueKeys,
    stateDocument?.data?.lastAcknowledgedAt || 0
  );
  const digimonName = resolveDigimonDisplayName(slotData);
  const notificationBody = buildUrgentNotificationBody(normalizedSlotId, digimonName, newIssues);
  const notificationTargetPath = buildSlotTargetPath(normalizedSlotId);

  if (!dryRun) {
    const [discordState, webPushState] = await Promise.all([
      maybeSendDiscordNotification({
        uid,
        title: "디지몬 긴급 케어 알림",
        body: notificationBody,
        settings,
        getDocumentByPath,
        fetchImpl,
      }),
      maybeSendWebPushForSettings({
        uid,
        title: "디지몬 긴급 케어 알림",
        body: notificationBody,
        targetPath: notificationTargetPath,
        settings,
        listCollectionDocuments,
        webPush,
        currentTime,
      }),
    ]);
    writes.push(createSetWrite(`notification_deliveries/${deliveryId}`, {
      uid,
      slotId: normalizedSlotId,
      issueKeys: nextIssueKeys,
      issues: newIssues,
      slotIssues: [{ slotId: normalizedSlotId, issues: newIssues }],
      status: "pending",
      createdAt: nowMs,
      expiresAt: nowMs + DELIVERY_TTL_MS,
    }));
    writes.push(createSetWrite(buildUrgentNotificationPath(uid, deliveryId), {
      type: "urgent_care",
      title: "디지몬 긴급 케어 알림",
      body: notificationBody,
      targetPath: notificationTargetPath,
      source: {
        kind: "urgent_delivery",
        deliveryId,
        slotId: normalizedSlotId,
        issueKeys: nextIssueKeys,
        trigger: "immediate_slot_save",
      },
      channelState: {
        inApp: buildInAppChannelState(settings),
        discord: discordState,
        webPush: webPushState,
      },
      readAt: null,
      createdAt: nowMs,
      updatedAt: nowMs,
    }));
    if (writes.length) await commitInBatches(writes, commit);
  }

  return {
    ok: true,
    status: "created",
    reason: "",
    slotId: normalizedSlotId,
    deliveryId,
    newDeliveries: 1,
    reusedDeliveries: 0,
    issues: newIssues,
  };
}

async function saveUrgentCheckError({ error, commit, currentTime = new Date() }) {
  const nowMs = currentTime instanceof Date ? currentTime.getTime() : Number(currentTime);
  await commitInBatches([
    createSetWrite(URGENT_CHECK_RUNTIME_PATH, {
      status: "error",
      checkedAt: nowMs,
      errorMessage: error?.message || "unknown",
      updatedAt: nowMs,
    }),
  ], commit);
}

async function acknowledgeUrgentCareDeliveries({ deliveryIds, getDocumentByPath, commit, currentTime = new Date() }) {
  const nowMs = currentTime instanceof Date ? currentTime.getTime() : Number(currentTime);
  const writes = [];
  let acknowledged = 0;
  let alreadyAcknowledged = 0;
  let invalid = 0;

  for (const deliveryId of [...new Set(deliveryIds || [])]) {
    const delivery = await getDocumentByPath(`notification_deliveries/${deliveryId}`);
    if (!delivery) {
      invalid += 1;
      continue;
    }
    if (delivery.data?.status === "acknowledged") {
      alreadyAcknowledged += 1;
      continue;
    }
    if (delivery.data?.status !== "pending") {
      invalid += 1;
      continue;
    }
    const { uid, slotId } = delivery.data;
    const statePath = `users/${uid}/notificationState/${slotId}`;
    const state = await getDocumentByPath(statePath);
    const activeIssueKeys = Array.isArray(state?.data?.activeIssueKeys) ? state.data.activeIssueKeys : [];
    const nextActiveKeys = [...new Set([...activeIssueKeys, ...(delivery.data.issueKeys || [])])];
    writes.push(createSetWrite(statePath, {
      activeIssueKeys: nextActiveKeys,
      lastAcknowledgedAt: nowMs,
      updatedAt: nowMs,
    }));
    writes.push(createSetWrite(`notification_deliveries/${deliveryId}`, {
      ...delivery.data,
      status: "acknowledged",
      acknowledgedAt: nowMs,
    }));
    acknowledged += 1;
  }
  if (writes.length) await commitInBatches(writes, commit);
  return { ok: true, acknowledged, alreadyAcknowledged, invalid };
}

function createUrgentCarePrepareHandler(deps = {}) {
  return async function urgentCarePrepareHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) return;
    try {
      verifySchedulerSecret(req, (deps.getSchedulerSecret || (() => process.env.NOTIFICATION_API_SECRET || ""))());
      const payload = await prepareUrgentCareNotifications({
        subscribers: await (deps.listNotificationSubscribers || listNotificationSubscribers)(),
        getDocumentByPath: deps.getDocument || getDocument,
        listCollectionDocuments: deps.listDocuments || listDocuments,
        listEligibleSlotDocuments: deps.listEligibleSlotDocuments || ((uid) =>
          listEligibleNotificationSlots(uid, deps.runQuery || runQuery)),
        listPendingDeliveryDocuments: deps.listPendingDeliveryDocuments || ((nowMs) =>
          listPendingUrgentDeliveries(nowMs, deps.runQuery || runQuery)),
        listExpiredPendingDeliveryDocuments: deps.listExpiredPendingDeliveryDocuments || ((nowMs) =>
          listExpiredPendingUrgentDeliveries(nowMs, deps.runQuery || runQuery)),
        commit: deps.commitWrites || commitWrites,
        fetchImpl: deps.fetch || globalThis.fetch,
        webPush: deps.webPush,
        currentTime: (deps.getCurrentTime || (() => new Date()))(),
        dryRun: req?.body?.dryRun === true,
      });
      sendJson(res, 200, payload);
    } catch (error) {
      if (req?.body?.dryRun !== true) {
        try {
          await saveUrgentCheckError({
            error,
            commit: deps.commitWrites || commitWrites,
            currentTime: (deps.getCurrentTime || (() => new Date()))(),
          });
        } catch (statusError) {
          console.warn("[urgent-care] failed to save urgent check error status", statusError);
        }
      }
      handleApiError(res, error);
    }
  };
}

function createUrgentCareAckHandler(deps = {}) {
  return async function urgentCareAckHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) return;
    try {
      verifySchedulerSecret(req, (deps.getSchedulerSecret || (() => process.env.NOTIFICATION_API_SECRET || ""))());
      const payload = await acknowledgeUrgentCareDeliveries({
        deliveryIds: Array.isArray(req?.body?.deliveryIds) ? req.body.deliveryIds : [],
        getDocumentByPath: deps.getDocument || getDocument,
        commit: deps.commitWrites || commitWrites,
        currentTime: (deps.getCurrentTime || (() => new Date()))(),
      });
      sendJson(res, 200, payload);
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

function createUrgentCareEvaluateHandler(deps = {}) {
  return async function urgentCareEvaluateHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) return;
    try {
      const { verifyRequestUser } = require("./auth");
      const decodedToken = await (deps.verifyRequestUser || verifyRequestUser)(req);
      const payload = await evaluateUrgentCareSlotNotification({
        uid: decodedToken.uid,
        slotId: req?.body?.slotId,
        getDocumentByPath: deps.getDocument || getDocument,
        listCollectionDocuments: deps.listDocuments || listDocuments,
        listPendingDeliveryDocuments: deps.listPendingDeliveryDocuments || ((nowMs) =>
          listPendingUrgentDeliveries(nowMs, deps.runQuery || runQuery)),
        commit: deps.commitWrites || commitWrites,
        fetchImpl: deps.fetch || globalThis.fetch,
        webPush: deps.webPush,
        currentTime: (deps.getCurrentTime || (() => new Date()))(),
        dryRun: req?.body?.dryRun === true,
      });
      sendJson(res, 200, payload);
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

module.exports = {
  acknowledgeUrgentCareDeliveries,
  buildDeliveryId,
  createExpiredPendingDeliveriesQuery,
  createEligibleSlotsQuery,
  createPendingDeliveriesQuery,
  createUrgentCareAckHandler,
  createUrgentCareEvaluateHandler,
  createUrgentCarePrepareHandler,
  evaluateUrgentCareSlotNotification,
  hasProjectionRuntime,
  listExpiredPendingUrgentDeliveries,
  listEligibleNotificationSlots,
  listPendingUrgentDeliveries,
  prepareUrgentCareNotifications,
  projectSlotForUrgentCare,
  resolveUrgentIssues,
  saveUrgentCheckError,
};
