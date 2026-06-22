"use strict";

const {
  commitWrites,
  createUpdateWrite,
  getDocument,
  listDocuments,
} = require("../digimon-tamagotchi-frontend/api/_lib/firestoreAdmin");
const {
  normalizeDiscordWebhookUrl,
} = require("../digimon-tamagotchi-frontend/api/_lib/notificationSubscribers");

function hasOwnField(data, fieldName) {
  return !!data && Object.prototype.hasOwnProperty.call(data, fieldName);
}

function buildNotificationSettingsBackfill(rootData = {}, settingsData = null) {
  const current = settingsData && typeof settingsData === "object" ? settingsData : {};
  const enabled = hasOwnField(current, "isNotificationEnabled")
    ? current.isNotificationEnabled === true
    : rootData?.isNotificationEnabled === true;
  const webhookUrl = normalizeDiscordWebhookUrl(
    hasOwnField(current, "discordWebhookUrl")
      ? current.discordWebhookUrl
      : rootData?.discordWebhookUrl
  );

  if (!enabled || !webhookUrl) return null;

  const updates = {};
  if (!hasOwnField(current, "isNotificationEnabled")) {
    updates.isNotificationEnabled = true;
  }
  if (!hasOwnField(current, "discordWebhookUrl")) {
    updates.discordWebhookUrl = webhookUrl;
  }

  return Object.keys(updates).length ? updates : null;
}

async function runNotificationSettingsBackfill({
  apply = false,
  listUsers = () => listDocuments("users"),
  getDocumentByPath = getDocument,
  commit = commitWrites,
} = {}) {
  const users = await listUsers();
  const writes = [];
  const userIds = [];

  for (const user of Array.isArray(users) ? users : []) {
    const uid = user?.id || user?.name?.split("/").pop();
    if (!uid) continue;
    const settingsDocument = await getDocumentByPath(`users/${uid}/settings/main`);
    const updates = buildNotificationSettingsBackfill(user?.data || {}, settingsDocument?.data);
    if (!updates) continue;

    userIds.push(uid);
    writes.push(createUpdateWrite(
      `users/${uid}/settings/main`,
      updates,
      Object.keys(updates)
    ));
  }

  if (apply) {
    for (let index = 0; index < writes.length; index += 400) {
      await commit(writes.slice(index, index + 400));
    }
  }

  return {
    mode: apply ? "apply" : "dry-run",
    scannedUsers: Array.isArray(users) ? users.length : 0,
    plannedWrites: writes.length,
    writtenUsers: apply ? writes.length : 0,
    userIds,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const summary = await runNotificationSettingsBackfill({ apply });
  console.log(`[notification subscribers] ${JSON.stringify(summary)}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[notification subscribers] 실패: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildNotificationSettingsBackfill,
  runNotificationSettingsBackfill,
};
