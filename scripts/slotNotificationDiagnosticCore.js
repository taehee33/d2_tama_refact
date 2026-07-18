"use strict";

const crypto = require("node:crypto");
const {
  projectSlotForUrgentCare,
  resolveUrgentIssues,
} = require("../digimon-tamagotchi-frontend/api/_lib/urgentCareProjection");

const DIAGNOSIS = {
  ELIGIBILITY: "eligible 제외",
  PROJECTION: "projection 입력 누락",
  DEATH_NOT_PERSISTED: "메모리 사망 미저장",
  DELIVERY_CONSUMED: "채널 실패 후 소진",
  PENDING_ROLLBACK: "pending rollback",
  COMPOSITE: "복합 원인",
  NEEDS_SCOPE_APPROVAL: "NEEDS_SCOPE_APPROVAL",
};

function toEpochMs(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (Number.isFinite(Number(value?.seconds))) {
    return Number(value.seconds) * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1e6);
  }
  return null;
}

function maskIdentifier(value, prefix) {
  const digest = crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex")
    .slice(0, 12);
  return `${prefix}_${digest}`;
}

function createDeliveriesByUidQuery(uid) {
  return {
    from: [{ collectionId: "notification_deliveries" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "uid" },
        op: "EQUAL",
        value: { stringValue: uid },
      },
    },
    limit: 100,
  };
}

function pickChannelState(channel = {}) {
  return {
    status: channel.status || null,
    reason: channel.reason || null,
    sentAt: toEpochMs(channel.sentAt),
    successCount: Number.isFinite(Number(channel.successCount))
      ? Number(channel.successCount)
      : null,
    failureCount: Number.isFinite(Number(channel.failureCount))
      ? Number(channel.failureCount)
      : null,
  };
}

function hasFailedRequiredChannel(delivery = {}) {
  const channelState = delivery.channelState || {};
  return [channelState.discord, channelState.webPush].some((channel) =>
    ["failed", "partial", "error"].includes(String(channel?.status || "").toLowerCase())
  );
}

function classifySlotDiagnostic({ slot, projection, deliveries, pending }) {
  const matches = [];
  if (slot.notificationEligible !== true) matches.push(DIAGNOSIS.ELIGIBILITY);
  if (projection.status !== "projected") matches.push(DIAGNOSIS.PROJECTION);
  if (projection.isDead === true && slot.isDead !== true) {
    matches.push(DIAGNOSIS.DEATH_NOT_PERSISTED);
  }
  if (deliveries.some((delivery) =>
    delivery.status === "acknowledged" && hasFailedRequiredChannel(delivery))) {
    matches.push(DIAGNOSIS.DELIVERY_CONSUMED);
  }
  if (
    pending &&
    (Number(pending.baseRevision) !== Number(slot.revision) ||
      (projection.isDead === true && pending.isDead !== true))
  ) {
    matches.push(DIAGNOSIS.PENDING_ROLLBACK);
  }

  if (matches.length > 1) {
    return { category: DIAGNOSIS.COMPOSITE, causes: matches };
  }
  if (matches.length === 1) {
    return { category: matches[0], causes: matches };
  }
  return { category: DIAGNOSIS.NEEDS_SCOPE_APPROVAL, causes: [] };
}

async function collectSlotNotificationDiagnostic({
  uid,
  slotId = "slot5",
  pending = null,
  nowMs = Date.now(),
  getDocumentByPath,
  queryDocuments,
} = {}) {
  if (!uid) throw new Error("--uid가 필요합니다.");
  if (typeof getDocumentByPath !== "function" || typeof queryDocuments !== "function") {
    throw new Error("읽기 전용 Firestore 의존성이 필요합니다.");
  }

  const normalizedSlotId = String(slotId).startsWith("slot")
    ? String(slotId)
    : `slot${slotId}`;
  const [slotDocument, stateDocument, runtimeDocument, deliveryDocuments] = await Promise.all([
    getDocumentByPath(`users/${uid}/slots/${normalizedSlotId}`),
    getDocumentByPath(`users/${uid}/notificationState/${normalizedSlotId}`),
    getDocumentByPath("notification_runtime/urgentCare"),
    queryDocuments(createDeliveriesByUidQuery(uid)),
  ]);
  if (!slotDocument?.data) {
    throw new Error(`${normalizedSlotId} 문서를 찾을 수 없습니다.`);
  }

  const slotData = slotDocument.data;
  const stats = slotData.digimonStats || {};
  const projectionResult = projectSlotForUrgentCare(slotData, nowMs);
  const projectionIssues = projectionResult.status === "projected"
    ? resolveUrgentIssues(projectionResult.stats, slotData, nowMs)
    : [];
  const recentDeliveryDocuments = (deliveryDocuments || [])
    .filter((document) => String(document?.data?.slotId || "") === normalizedSlotId)
    .sort((left, right) =>
      (toEpochMs(right?.data?.createdAt) || 0) - (toEpochMs(left?.data?.createdAt) || 0)
    )
    .slice(0, 5);

  const deliveries = await Promise.all(recentDeliveryDocuments.map(async (document) => {
    const notification = await getDocumentByPath(
      `users/${uid}/notifications/urgent_${document.id}`
    );
    return {
      deliveryId: maskIdentifier(document.id, "delivery"),
      status: document.data?.status || null,
      issueKeys: Array.isArray(document.data?.issueKeys) ? document.data.issueKeys : [],
      createdAt: toEpochMs(document.data?.createdAt),
      updatedAt: toEpochMs(document.data?.updatedAt),
      expiresAt: toEpochMs(document.data?.expiresAt),
      channelState: {
        discord: pickChannelState(notification?.data?.channelState?.discord),
        webPush: pickChannelState(notification?.data?.channelState?.webPush),
      },
    };
  }));

  const result = {
    observedAt: nowMs,
    uid: maskIdentifier(uid, "uid"),
    slotId: normalizedSlotId,
    slot: {
      revision: Number.isFinite(Number(slotData.revision)) ? Number(slotData.revision) : 0,
      notificationEligible: slotData.notificationEligible === true,
      selectedDigimon: slotData.selectedDigimon || null,
      lastSavedAt: toEpochMs(slotData.lastSavedAt ?? stats.lastSavedAt ?? slotData.lastSavedAtServer),
      updatedAt: toEpochMs(slotData.updatedAt),
      isDead: stats.isDead === true,
      diedAt: toEpochMs(stats.diedAt),
      deathReason: stats.deathReason || null,
      fullness: Number.isFinite(Number(stats.fullness)) ? Number(stats.fullness) : null,
      strength: Number.isFinite(Number(stats.strength)) ? Number(stats.strength) : null,
      lastHungerZeroAt: toEpochMs(stats.lastHungerZeroAt),
      lastStrengthZeroAt: toEpochMs(stats.lastStrengthZeroAt),
      hungerCallStartedAt: toEpochMs(stats.callStatus?.hunger?.startedAt),
      strengthCallStartedAt: toEpochMs(stats.callStatus?.strength?.startedAt),
    },
    projection: {
      status: projectionResult.status,
      isDead: projectionResult.stats?.isDead === true,
      diedAt: toEpochMs(projectionResult.stats?.diedAt),
      deathReason: projectionResult.stats?.deathReason || null,
      issueKeys: projectionIssues.map((issue) => issue.dedupKey || issue.key).filter(Boolean),
    },
    notificationState: {
      activeIssueKeys: Array.isArray(stateDocument?.data?.activeIssueKeys)
        ? stateDocument.data.activeIssueKeys
        : [],
      lastAcknowledgedAt: toEpochMs(stateDocument?.data?.lastAcknowledgedAt),
      updatedAt: toEpochMs(stateDocument?.data?.updatedAt),
    },
    deliveries,
    urgentScheduler: {
      status: runtimeDocument?.data?.status || null,
      checkedAt: toEpochMs(runtimeDocument?.data?.checkedAt),
      updatedAt: toEpochMs(runtimeDocument?.data?.updatedAt),
      preparedReports: Number(runtimeDocument?.data?.preparedReports) || 0,
      successfulReports: Number(runtimeDocument?.data?.successfulReports) || 0,
      failedReports: Number(runtimeDocument?.data?.failedReports) || 0,
      errorMessage: runtimeDocument?.data?.errorMessage || null,
    },
    pending: pending
      ? {
          baseRevision: Number.isFinite(Number(pending.baseRevision))
            ? Number(pending.baseRevision)
            : null,
          updatedAt: toEpochMs(pending.updatedAt),
          isDead: pending.isDead === true,
        }
      : null,
  };
  result.diagnosis = classifySlotDiagnostic({
    slot: result.slot,
    projection: result.projection,
    deliveries: result.deliveries,
    pending: result.pending,
  });
  return result;
}

module.exports = {
  DIAGNOSIS,
  classifySlotDiagnostic,
  collectSlotNotificationDiagnostic,
  createDeliveriesByUidQuery,
  maskIdentifier,
};
