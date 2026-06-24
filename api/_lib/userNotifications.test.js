"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { parseFirestoreFields } = require("../../digimon-tamagotchi-frontend/api/_lib/firestoreAdmin");
const {
  buildCommunityCommentNotification,
  createUserNotification,
  getUserNotificationStatus,
} = require("./userNotifications");

process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "d2-test";

function createRuntimeStats(overrides = {}) {
  return {
    hungerTimer: 60,
    strengthTimer: 60,
    poopTimer: 120,
    maxEnergy: 20,
    sleepSchedule: { start: 23, end: 7, startMinute: 0, endMinute: 0 },
    ...overrides,
  };
}

function createStore(documents = {}) {
  const store = new Map(Object.entries(documents));

  return {
    store,
    async get(path) {
      return store.get(path) || null;
    },
    async list(path) {
      const prefix = `${path}/`;
      return [...store.entries()]
        .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
        .map(([key, value]) => ({
          id: value.id || key.split("/").pop(),
          name: key,
          data: value.data || {},
        }));
    },
    async query() {
      return [...store.entries()]
        .filter(([key, value]) => key.startsWith("notification_deliveries/") && value.data?.uid === "user-1")
        .map(([key, value]) => ({
          id: value.id || key.split("/").pop(),
          name: key,
          data: value.data || {},
        }));
    },
    async commit(writes) {
      writes.forEach((write) => {
        const name = write.update.name;
        const path = name.slice(name.indexOf("/documents/") + "/documents/".length);
        store.set(path, {
          id: path.split("/").pop(),
          data: parseFirestoreFields(write.update.fields || {}),
        });
      });
    },
  };
}

test("댓글 알림 payload는 게시글 상세로 이동할 수 있는 targetPath를 만든다", () => {
  const payload = buildCommunityCommentNotification({
    boardId: "free",
    postId: "post-1",
    postTitle: "첫 글",
    commentAuthorName: "한솔",
  });

  assert.equal(payload.type, "community_comment");
  assert.equal(payload.title, "게시글에 새 댓글이 달렸습니다.");
  assert.match(payload.body, /한솔님/);
  assert.equal(payload.targetPath, "/community?board=free");
});

test("Discord가 꺼져 있어도 인앱 알림은 저장한다", async () => {
  const store = createStore({
    "users/user-1/settings/main": {
      id: "main",
      data: { isNotificationEnabled: false, discordWebhookUrl: null },
    },
  });

  const notification = await createUserNotification({
    uid: "user-1",
    type: "system_test",
    title: "테스트",
    body: "본문",
    sendDiscord: true,
    getDocumentByPath: store.get,
    commit: store.commit,
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
    currentTime: new Date("2026-06-24T00:00:00.000Z"),
  });

  assert.equal(notification.channelState.discord.status, "skipped");
  assert.equal(notification.channelState.discord.reason, "disabled");
  const savedNotifications = await store.list("users/user-1/notifications");
  assert.equal(savedNotifications.length, 1);
  assert.equal(savedNotifications[0].data.title, "테스트");
});

test("알림 상태는 projectionUnavailable 슬롯을 요약한다", async () => {
  const now = Date.parse("2026-06-24T00:00:00.000Z");
  const store = createStore({
    "users/user-1/settings/main": {
      id: "main",
      data: {
        isNotificationEnabled: true,
        discordWebhookUrl: "https://discord.com/api/webhooks/test/token",
      },
    },
    "users/user-1/slots/slot1": {
      id: "slot1",
      data: {
        lastSavedAt: now,
        digimonStats: createRuntimeStats(),
      },
    },
    "users/user-1/slots/slot2": {
      id: "slot2",
      data: {
        digimonStats: {},
      },
    },
    "notification_deliveries/delivery-1": {
      id: "delivery-1",
      data: {
        uid: "user-1",
        slotId: "slot1",
        status: "acknowledged",
        createdAt: now - 1000,
        acknowledgedAt: now,
        issueKeys: ["hunger_call"],
      },
    },
  });

  const status = await getUserNotificationStatus({
    uid: "user-1",
    getDocumentByPath: store.get,
    listCollectionDocuments: store.list,
    runFirestoreQuery: store.query,
    currentTime: new Date(now),
  });

  assert.equal(status.settings.isNotificationEnabled, true);
  assert.equal(status.settings.hasDiscordWebhook, true);
  assert.equal(status.projection.totalSlots, 2);
  assert.equal(status.projection.projectedSlots, 1);
  assert.deepEqual(status.projection.unavailableSlots, ["slot2"]);
  assert.equal(status.delivery.lastDiscordResult.status, "acknowledged");
});
