"use strict";

const crypto = require("node:crypto");
const { applyLazyUpdate } = require("../_generated/gameProjection.cjs");
const {
  commitWrites,
  createSetWrite,
  getDocument,
  listDocuments,
} = require("./firestoreAdmin");
const { allowMethods, handleApiError, sendJson } = require("./http");
const {
  resolveDigimonDisplayName,
  resolveNotificationSettings,
  resolveTamerName,
  verifySchedulerSecret,
} = require("./notificationReports");

const DELIVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FIRESTORE_WRITE_BATCH_SIZE = 450;

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toTimestamp(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (Number.isFinite(Number(value?.seconds))) {
    return Number(value.seconds) * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1e6);
  }
  return null;
}

function hasProjectionRuntime(slotData = {}) {
  const stats = slotData?.digimonStats;
  if (!stats || typeof stats !== "object") return false;
  return (
    Number.isFinite(Number(stats.hungerTimer)) &&
    Number.isFinite(Number(stats.strengthTimer)) &&
    Number.isFinite(Number(stats.poopTimer)) &&
    Number.isFinite(Number(stats.maxEnergy)) &&
    stats.sleepSchedule &&
    typeof stats.sleepSchedule === "object" &&
    toTimestamp(slotData.lastSavedAt ?? stats.lastSavedAt ?? slotData.lastSavedAtServer) != null
  );
}

function projectSlotForUrgentCare(slotData = {}, nowMs = Date.now()) {
  if (!hasProjectionRuntime(slotData)) {
    return { status: "unavailable", stats: null };
  }
  const stats = slotData.digimonStats;
  const lastSavedAt = toTimestamp(
    slotData.lastSavedAt ?? stats.lastSavedAt ?? slotData.lastSavedAtServer
  );
  const projected = applyLazyUpdate(
    {
      ...stats,
      isLightsOn: slotData.isLightsOn ?? stats.isLightsOn ?? true,
      wakeUntil: toTimestamp(slotData.wakeUntil ?? stats.wakeUntil),
    },
    lastSavedAt,
    stats.sleepSchedule,
    Number(stats.maxEnergy),
    { nowMs }
  );
  return { status: "projected", stats: projected };
}

function resolveUrgentIssues(projectedStats = {}, slotData = {}) {
  if (projectedStats.isDead) {
    return [{ key: "death", label: "💀 사망 판정" }];
  }
  const issues = [];
  const callStatus = projectedStats.callStatus || {};
  if (callStatus.hunger?.isActive) issues.push({ key: "hunger_call", label: "🍖 배고픔 호출" });
  if (callStatus.strength?.isActive) issues.push({ key: "strength_call", label: "🔋 기력 호출" });
  if (callStatus.sleep?.isActive && slotData.isLightsOn !== false) {
    issues.push({ key: "sleep_light", label: "💡 수면 시간 조명 켜짐" });
  }
  const poopCount = Number(projectedStats.poopCount) || 0;
  if (poopCount >= 8) {
    issues.push({ key: "poop_danger", label: "💩 똥 8개 위험" });
  } else if (poopCount >= 6) {
    issues.push({ key: "poop_warning", label: `💩 똥 ${poopCount}개 경고` });
  }
  if (projectedStats.isInjured) issues.push({ key: "injury", label: "🏥 치료가 필요한 부상" });
  return issues;
}

function isStoredInCareStorage(slotData = {}) {
  const stats = slotData?.digimonStats || {};
  return slotData.isFrozen === true || slotData.isRefrigerated === true || stats.isFrozen === true || stats.isRefrigerated === true;
}

function buildDeliveryId(uid, slotId, issueKeys, occurrenceSeed = 0) {
  return crypto
    .createHash("sha256")
    .update(`${uid}|${slotId}|${[...issueKeys].sort().join(",")}|${occurrenceSeed}`)
    .digest("hex")
    .slice(0, 32);
}

async function commitInBatches(writes, commit) {
  for (let index = 0; index < writes.length; index += FIRESTORE_WRITE_BATCH_SIZE) {
    await commit(writes.slice(index, index + FIRESTORE_WRITE_BATCH_SIZE));
  }
}

function buildUrgentMessage(tamerName, slotAlerts, generatedAt) {
  const lines = slotAlerts.flatMap((slot) => [
    `**${slot.digimonName}** (${slot.slotId})`,
    ...slot.issues.map((issue) => `- ${issue.label}`),
  ]);
  return [
    "━━━━━━━━━━━━━━━━━━",
    "🚨 **긴급 케어 알림**",
    `👤 **테이머**: ${tamerName}`,
    "",
    ...lines,
    "",
    `⏰ **확인 시간**: ${generatedAt}`,
    "━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}

function formatKstDate(nowMs) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(nowMs));
}

async function prepareUrgentCareNotifications({
  users,
  getDocumentByPath,
  listCollectionDocuments,
  commit,
  currentTime = new Date(),
  dryRun = false,
}) {
  const nowMs = currentTime instanceof Date ? currentTime.getTime() : Number(currentTime);
  const pendingDocuments = await listCollectionDocuments("notification_deliveries");
  const pendingBySlot = new Map();
  const writes = [];
  pendingDocuments.forEach((document) => {
    const data = document?.data || {};
    if (data.status === "pending" && Number(data.expiresAt) > nowMs) {
      pendingBySlot.set(`${data.uid}:${data.slotId}`, { id: document.id, data });
    } else if (data.status === "pending" && !dryRun) {
      writes.push(createSetWrite(`notification_deliveries/${document.id}`, {
        ...data,
        status: "cancelled",
        cancelledAt: nowMs,
      }));
    }
  });

  const reports = [];
  const summary = {
    totalUsers: users.length,
    activeUsers: 0,
    totalSlots: 0,
    projectedSlots: 0,
    projectionUnavailable: 0,
    frozenSlots: 0,
    newDeliveries: 0,
    reusedDeliveries: 0,
    expiredDeliveries: writes.length,
  };

  for (const userDocument of users) {
    const uid = normalizeString(userDocument?.id || userDocument?.name?.split("/").pop());
    if (!uid) continue;
    const rootData = userDocument?.data || {};
    const settingsDocument = await getDocumentByPath(`users/${uid}/settings/main`);
    const settings = resolveNotificationSettings(settingsDocument?.data, rootData);
    if (!settings.isNotificationEnabled || !settings.discordWebhookUrl) continue;
    summary.activeUsers += 1;
    const [profileDocument, slots] = await Promise.all([
      getDocumentByPath(`users/${uid}/profile/main`),
      listCollectionDocuments(`users/${uid}/slots`),
    ]);
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
          writes.push(createSetWrite(statePath, { activeIssueKeys: [], updatedAt: nowMs }));
        }
        continue;
      }

      const projection = projectSlotForUrgentCare(slotData, nowMs);
      if (projection.status !== "projected") {
        summary.projectionUnavailable += 1;
        continue;
      }
      summary.projectedSlots += 1;
      const issues = resolveUrgentIssues(projection.stats, slotData);
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
      if (reusable && newIssues.every((issue) => reusable.data.issueKeys?.includes(issue.key))) {
        deliveryId = reusable.id;
        summary.reusedDeliveries += 1;
      } else {
        deliveryId = buildDeliveryId(
          uid,
          slotId,
          newIssues.map((issue) => issue.key),
          stateDocument?.data?.lastAcknowledgedAt || 0
        );
        summary.newDeliveries += 1;
        if (!dryRun) {
          writes.push(createSetWrite(`notification_deliveries/${deliveryId}`, {
            uid,
            slotId,
            issueKeys: newIssues.map((issue) => issue.key),
            issues: newIssues,
            slotIssues: [{ slotId, issues: newIssues }],
            status: "pending",
            createdAt: nowMs,
            expiresAt: nowMs + DELIVERY_TTL_MS,
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

  if (!dryRun && writes.length) await commitInBatches(writes, commit);
  return { ok: true, dryRun, generatedAt: formatKstDate(nowMs), summary, reports };
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
        users: await (deps.listDocuments || listDocuments)("users"),
        getDocumentByPath: deps.getDocument || getDocument,
        listCollectionDocuments: deps.listDocuments || listDocuments,
        commit: deps.commitWrites || commitWrites,
        currentTime: (deps.getCurrentTime || (() => new Date()))(),
        dryRun: req?.body?.dryRun === true,
      });
      sendJson(res, 200, payload);
    } catch (error) {
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

module.exports = {
  acknowledgeUrgentCareDeliveries,
  buildDeliveryId,
  createUrgentCareAckHandler,
  createUrgentCarePrepareHandler,
  hasProjectionRuntime,
  prepareUrgentCareNotifications,
  projectSlotForUrgentCare,
  resolveUrgentIssues,
};
