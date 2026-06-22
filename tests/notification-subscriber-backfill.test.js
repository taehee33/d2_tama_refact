"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "d2-test";

const {
  buildNotificationSettingsBackfill,
  runNotificationSettingsBackfill,
} = require("../scripts/backfillNotificationSubscribers");

const VALID_WEBHOOK = "https://discord.com/api/webhooks/id/token";

test("루트의 활성 알림 설정 중 settings/main에 없는 필드만 계획한다", () => {
  assert.deepEqual(buildNotificationSettingsBackfill({
    isNotificationEnabled: true,
    discordWebhookUrl: VALID_WEBHOOK,
  }, null), {
    isNotificationEnabled: true,
    discordWebhookUrl: VALID_WEBHOOK,
  });

  assert.deepEqual(buildNotificationSettingsBackfill({
    isNotificationEnabled: true,
    discordWebhookUrl: VALID_WEBHOOK,
  }, {
    isNotificationEnabled: true,
  }), {
    discordWebhookUrl: VALID_WEBHOOK,
  });

  assert.equal(buildNotificationSettingsBackfill({
    isNotificationEnabled: true,
    discordWebhookUrl: VALID_WEBHOOK,
  }, {
    isNotificationEnabled: false,
  }), null);
  assert.equal(buildNotificationSettingsBackfill({
    isNotificationEnabled: true,
    discordWebhookUrl: "https://example.com/webhook",
  }, null), null);
  assert.equal(buildNotificationSettingsBackfill({
    isNotificationEnabled: true,
    discordWebhookUrl: VALID_WEBHOOK,
  }, {
    isNotificationEnabled: true,
    discordWebhookUrl: VALID_WEBHOOK,
  }), null);
});

test("audit은 쓰지 않고 apply는 같은 계획만 한 번 commit한다", async () => {
  const users = [{
    id: "user-1",
    data: { isNotificationEnabled: true, discordWebhookUrl: VALID_WEBHOOK },
  }];
  const commits = [];
  const dependencies = {
    listUsers: async () => users,
    getDocumentByPath: async () => null,
    commit: async (writes) => commits.push(writes),
  };

  const audit = await runNotificationSettingsBackfill(dependencies);
  assert.equal(audit.mode, "dry-run");
  assert.equal(audit.plannedWrites, 1);
  assert.equal(commits.length, 0);

  const applied = await runNotificationSettingsBackfill({ ...dependencies, apply: true });
  assert.equal(applied.writtenUsers, 1);
  assert.equal(commits.length, 1);
  assert.deepEqual(commits[0][0].updateMask.fieldPaths.sort(), [
    "discordWebhookUrl",
    "isNotificationEnabled",
  ]);
});

test("백필 후 재실행하면 추가 쓰기를 계획하지 않는다", async () => {
  const rootData = {
    isNotificationEnabled: true,
    discordWebhookUrl: VALID_WEBHOOK,
  };
  let settingsData = null;
  const commits = [];
  const dependencies = {
    listUsers: async () => [{ id: "user-1", data: rootData }],
    getDocumentByPath: async () => settingsData ? { data: settingsData } : null,
    commit: async (writes) => {
      commits.push(writes);
      settingsData = { ...settingsData, ...rootData };
    },
  };

  const first = await runNotificationSettingsBackfill({ ...dependencies, apply: true });
  const second = await runNotificationSettingsBackfill({ ...dependencies, apply: true });

  assert.equal(first.writtenUsers, 1);
  assert.equal(second.plannedWrites, 0);
  assert.equal(second.writtenUsers, 0);
  assert.equal(commits.length, 1);
});
