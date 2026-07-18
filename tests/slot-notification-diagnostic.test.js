"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DIAGNOSIS,
  classifySlotDiagnostic,
  collectSlotNotificationDiagnostic,
} = require("../scripts/slotNotificationDiagnosticCore");

test("복수 원인은 복합 원인으로 분류한다", () => {
  const result = classifySlotDiagnostic({
    slot: { revision: 4, notificationEligible: false, isDead: false },
    projection: { status: "projected", isDead: true },
    deliveries: [],
    pending: { baseRevision: 3, isDead: false },
  });

  assert.equal(result.category, DIAGNOSIS.COMPOSITE);
  assert.deepEqual(result.causes, [
    DIAGNOSIS.ELIGIBILITY,
    DIAGNOSIS.DEATH_NOT_PERSISTED,
    DIAGNOSIS.PENDING_ROLLBACK,
  ]);
});

test("승인 필드만 마스킹 출력하고 webhook·토큰·프로필은 노출하지 않는다", async () => {
  const nowMs = Date.parse("2026-07-18T00:00:00.000Z");
  const documents = {
    "users/private-user/slots/slot5": {
      data: {
        revision: 7,
        notificationEligible: true,
        selectedDigimon: "Agumon",
        discordWebhookUrl: "https://discord.example/secret",
        lastSavedAt: nowMs,
        digimonStats: {
          hungerTimer: 60,
          strengthTimer: 60,
          poopTimer: 60,
          maxEnergy: 10,
          sleepSchedule: { start: 22, end: 6 },
          fullness: 5,
          strength: 5,
          poopCount: 0,
          isDead: false,
          callStatus: {},
        },
      },
    },
    "users/private-user/notificationState/slot5": {
      data: { activeIssueKeys: ["death"] },
    },
    "notification_runtime/urgentCare": {
      data: { status: "success", checkedAt: nowMs, schedulerToken: "secret" },
    },
    "users/private-user/notifications/urgent_delivery-1": {
      data: {
        channelState: {
          discord: { status: "failed", reason: "http_500" },
          webPush: { status: "skipped", reason: "not_connected" },
        },
      },
    },
  };
  const result = await collectSlotNotificationDiagnostic({
    uid: "private-user",
    nowMs,
    getDocumentByPath: async (path) => documents[path] || null,
    queryDocuments: async () => [{
      id: "delivery-1",
      data: {
        uid: "private-user",
        slotId: "slot5",
        status: "acknowledged",
        issueKeys: ["death"],
        createdAt: nowMs,
        webhook: "secret",
      },
    }],
  });

  const serialized = JSON.stringify(result);
  assert.match(result.uid, /^uid_[a-f0-9]{12}$/);
  assert.equal(result.deliveries[0].channelState.discord.reason, "http_500");
  assert.equal(result.diagnosis.category, DIAGNOSIS.DELIVERY_CONSUMED);
  assert.doesNotMatch(serialized, /private-user|discord\.example|schedulerToken|webhook|secret/);
});
