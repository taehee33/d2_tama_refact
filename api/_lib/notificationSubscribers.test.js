"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildActiveNotificationSettingsQuery,
  listNotificationSubscribers,
  mapNotificationSubscriber,
} = require("../../digimon-tamagotchi-frontend/api/_lib/notificationSubscribers");

function settingsDocument(uid, data = {}) {
  return {
    id: "main",
    name: `projects/d2-test/databases/(default)/documents/users/${uid}/settings/main`,
    data,
  };
}

test("활성 알림 설정 collection-group 쿼리를 생성한다", () => {
  assert.deepEqual(buildActiveNotificationSettingsQuery(), {
    from: [{ collectionId: "settings", allDescendants: true }],
    where: {
      fieldFilter: {
        field: { fieldPath: "isNotificationEnabled" },
        op: "EQUAL",
        value: { booleanValue: true },
      },
    },
  });
});

test("settings/main과 유효한 Discord webhook만 구독자로 변환한다", () => {
  const valid = mapNotificationSubscriber(settingsDocument("user-1", {
    isNotificationEnabled: true,
    discordWebhookUrl: "https://discord.com/api/webhooks/id/token",
  }));
  assert.equal(valid.uid, "user-1");
  assert.equal(valid.data.isNotificationEnabled, true);

  assert.equal(mapNotificationSubscriber({
    ...settingsDocument("user-2", {
      isNotificationEnabled: true,
      discordWebhookUrl: "https://discord.com/api/webhooks/id/token",
    }),
    id: "other",
  }), null);
  assert.equal(mapNotificationSubscriber(settingsDocument("user-3", {
    isNotificationEnabled: true,
    discordWebhookUrl: "https://example.com/api/webhooks/id/token",
  })), null);
  assert.equal(mapNotificationSubscriber(settingsDocument("user-4", {
    isNotificationEnabled: false,
    discordWebhookUrl: "https://discord.com/api/webhooks/id/token",
  })), null);
});

test("조회 결과에서 유효한 활성 구독자만 반환한다", async () => {
  let receivedQuery = null;
  const subscribers = await listNotificationSubscribers(async (query) => {
    receivedQuery = query;
    return [
      settingsDocument("enabled", {
        isNotificationEnabled: true,
        discordWebhookUrl: "https://discordapp.com/api/webhooks/id/token",
      }),
      settingsDocument("invalid", {
        isNotificationEnabled: true,
        discordWebhookUrl: "https://invalid.example/webhook",
      }),
    ];
  });

  assert.deepEqual(receivedQuery, buildActiveNotificationSettingsQuery());
  assert.deepEqual(subscribers.map((entry) => entry.uid), ["enabled"]);
});
