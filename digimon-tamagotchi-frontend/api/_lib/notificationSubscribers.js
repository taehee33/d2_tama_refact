"use strict";

const { runQuery } = require("./firestoreAdmin");

const USER_SETTINGS_PATH_PATTERN = /\/documents\/users\/([^/]+)\/settings\/main$/;

function normalizeDiscordWebhookUrl(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const allowedHost = url.hostname === "discord.com" || url.hostname === "discordapp.com";
    const pathParts = url.pathname.split("/").filter(Boolean);
    const validPath = pathParts[0] === "api" && pathParts[1] === "webhooks" && pathParts.length >= 4;
    return url.protocol === "https:" && allowedHost && validPath ? normalized : null;
  } catch (error) {
    return null;
  }
}

function buildActiveNotificationSettingsQuery() {
  return {
    from: [{ collectionId: "settings", allDescendants: true }],
    where: {
      fieldFilter: {
        field: { fieldPath: "isNotificationEnabled" },
        op: "EQUAL",
        value: { booleanValue: true },
      },
    },
  };
}

function mapNotificationSubscriber(document) {
  const matchedPath = typeof document?.name === "string"
    ? document.name.match(USER_SETTINGS_PATH_PATTERN)
    : null;
  if (!matchedPath || document?.id !== "main") return null;

  const webhookUrl = normalizeDiscordWebhookUrl(document?.data?.discordWebhookUrl);
  if (!webhookUrl || document?.data?.isNotificationEnabled !== true) return null;

  const uid = matchedPath[1];
  return {
    id: uid,
    uid,
    name: document.name,
    data: {
      ...document.data,
      discordWebhookUrl: webhookUrl,
      isNotificationEnabled: true,
    },
  };
}

async function listNotificationSubscribers(queryDocuments = runQuery) {
  const documents = await queryDocuments(buildActiveNotificationSettingsQuery());
  return (Array.isArray(documents) ? documents : [])
    .map(mapNotificationSubscriber)
    .filter(Boolean);
}

module.exports = {
  USER_SETTINGS_PATH_PATTERN,
  buildActiveNotificationSettingsQuery,
  listNotificationSubscribers,
  mapNotificationSubscriber,
  normalizeDiscordWebhookUrl,
};
