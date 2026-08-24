"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { parseFirestoreFields } = require("../../digimon-tamagotchi-frontend/api/_lib/firestoreAdmin");
const {
  buildCommunityCommentNotification,
  buildInboxQuery,
  buildLatestNotificationByTypeQuery,
  createUserNotification,
  getUserNotificationInbox,
  getUserNotificationStatus,
  markUserNotificationsRead,
} = require("../../digimon-tamagotchi-frontend/api/_lib/userNotifications");
const {
  assertNotificationDocumentContract,
} = require("../../digimon-tamagotchi-frontend/api/_lib/notificationDocumentContract");

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
  const listedPaths = [];
  const queries = [];

  function readField(data, fieldPath) {
    return fieldPath.split(".").reduce((value, key) => value?.[key], data);
  }

  return {
    store,
    listedPaths,
    queries,
    async get(path) {
      return store.get(path) || null;
    },
    async list(path) {
      listedPaths.push(path);
      const prefix = `${path}/`;
      return [...store.entries()]
        .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
        .map(([key, value]) => ({
          id: value.id || key.split("/").pop(),
          name: key,
          data: value.data || {},
        }));
    },
    async query(structuredQuery, parentPath = "") {
      queries.push({ structuredQuery, parentPath });
      const collectionId = structuredQuery?.from?.[0]?.collectionId;
      const prefix = parentPath ? `${parentPath}/${collectionId}/` : `${collectionId}/`;
      const fieldFilter = structuredQuery?.where?.fieldFilter;
      const results = [...store.entries()]
        .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
        .filter(([, value]) => {
          if (!fieldFilter) return true;
          return readField(value.data, fieldFilter.field.fieldPath) ===
            (fieldFilter.value.stringValue ?? fieldFilter.value.integerValue);
        })
        .map(([key, value]) => ({
          id: value.id || key.split("/").pop(),
          name: key,
          data: value.data || {},
        }))
        .sort((left, right) => {
          const createdAtDifference = Number(right.data.createdAt || 0) - Number(left.data.createdAt || 0);
          return createdAtDifference || right.id.localeCompare(left.id);
        });
      return results.slice(0, structuredQuery?.limit || results.length);
    },
    async commit(writes) {
      writes.forEach((write) => {
        const name = write.update.name;
        const path = name.slice(name.indexOf("/documents/") + "/documents/".length);
        const nextData = parseFirestoreFields(write.update.fields || {});
        const previous = store.get(path) || {
          id: path.split("/").pop(),
          data: {},
        };
        store.set(path, {
          id: path.split("/").pop(),
          data: write.updateMask
            ? { ...previous.data, ...nextData }
            : nextData,
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
  assert.equal(payload.title, "자유게시판에 새 댓글이 달렸습니다.");
  assert.equal(payload.body, '한솔님이 자유게시판의 "첫 글" 글에 댓글을 남겼습니다.');
  assert.equal(payload.targetPath, "/community?board=free");
  assert.equal(payload.source.boardId, "free");
});

test("inbox 쿼리는 stored 알림을 결정적 순서로 최대 10개 조회한다", () => {
  const query = buildInboxQuery();

  assert.equal(query.where.fieldFilter.field.fieldPath, "channelState.inApp.status");
  assert.equal(query.where.fieldFilter.value.stringValue, "stored");
  assert.deepEqual(query.orderBy, [
    { field: { fieldPath: "createdAt" }, direction: "DESCENDING" },
    { field: { fieldPath: "__name__" }, direction: "DESCENDING" },
  ]);
  assert.equal(query.limit, 10);
});

test("최신 테스트 알림 쿼리는 type과 결정적 순서를 사용한다", () => {
  const query = buildLatestNotificationByTypeQuery("system_test");

  assert.equal(query.where.fieldFilter.field.fieldPath, "type");
  assert.equal(query.where.fieldFilter.value.stringValue, "system_test");
  assert.equal(query.limit, 1);
  assert.equal(query.orderBy[1].field.fieldPath, "__name__");
});

test("알림 문서 계약은 유효한 숫자 시각과 인앱 상태만 허용한다", () => {
  assert.doesNotThrow(() => assertNotificationDocumentContract({
    createdAt: 0,
    channelState: { inApp: { status: "stored" } },
  }));
  assert.doesNotThrow(() => assertNotificationDocumentContract({
    createdAt: 1,
    channelState: { inApp: { status: "hidden" } },
  }));

  for (const createdAt of ["1", Number.NaN, Number.POSITIVE_INFINITY, -1, undefined]) {
    assert.throws(() => assertNotificationDocumentContract({
      createdAt,
      channelState: { inApp: { status: "stored" } },
    }), /createdAt/);
  }
  assert.throws(() => assertNotificationDocumentContract({
    createdAt: 1,
    channelState: { inApp: { status: "read" } },
  }), /인앱 상태/);
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
  assert.equal(savedNotifications[0].data.channelState.inApp.status, "stored");
  assert.equal(savedNotifications[0].data.createdAt, Date.parse("2026-06-24T00:00:00.000Z"));
});

test("신규 알림 필수 필드가 유효하지 않으면 commit하지 않는다", async () => {
  let commitCalled = false;
  await assert.rejects(createUserNotification({
    uid: "user-1",
    type: "system_test",
    title: "테스트",
    body: "본문",
    sendWebPush: false,
    getDocumentByPath: async () => null,
    commit: async () => {
      commitCalled = true;
    },
    currentTime: "invalid-time",
  }), /createdAt/);
  assert.equal(commitCalled, false);
});

test("inbox는 hidden과 레거시 문서를 제외하고 stored 알림 최대 10개만 반환한다", async () => {
  const now = Date.parse("2026-06-24T00:00:00.000Z");
  const documents = {};
  for (let index = 0; index < 12; index += 1) {
    documents[`users/user-1/notifications/stored-${index}`] = {
      data: {
        title: `표시 알림 ${index}`,
        createdAt: now + index,
        channelState: { inApp: { status: "stored" } },
      },
    };
  }
  for (let index = 0; index < 1000; index += 1) {
    documents[`users/user-1/notifications/hidden-${index}`] = {
      data: {
        title: `숨김 알림 ${index}`,
        createdAt: now + 100 + index,
        channelState: { inApp: { status: "hidden" } },
      },
    };
  }
  documents["users/user-1/notifications/legacy"] = {
    data: { title: "레거시 알림" },
  };
  const store = createStore(documents);

  const inbox = await getUserNotificationInbox({
    uid: "user-1",
    runFirestoreQuery: store.query,
  });

  assert.equal(inbox.recentNotifications.length, 10);
  assert.equal(inbox.recentNotifications[0].id, "stored-11");
  assert.equal(store.queries.length, 1);
  assert.equal(store.listedPaths.includes("users/user-1/notifications"), false);
});

test("inbox는 유효한 Unix epoch createdAt과 readAt을 그대로 보존한다", async () => {
  const store = createStore({
    "users/user-1/notifications/epoch": {
      data: {
        title: "epoch 알림",
        createdAt: 0,
        readAt: 0,
        channelState: { inApp: { status: "stored" } },
      },
    },
  });

  const inbox = await getUserNotificationInbox({
    uid: "user-1",
    runFirestoreQuery: store.query,
  });

  assert.equal(inbox.recentNotifications[0].createdAt, 0);
  assert.equal(inbox.recentNotifications[0].readAt, 0);
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
    "notification_runtime/urgentCare": {
      id: "urgentCare",
      data: {
        status: "success",
        checkedAt: now,
        preparedReports: 0,
        successfulReports: 0,
        failedReports: 0,
        acknowledged: 0,
        projectionUnavailable: 1,
        frozenSlots: 0,
        newDeliveries: 0,
        reusedDeliveries: 0,
        expiredDeliveries: 2,
        updatedAt: now,
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
  assert.equal(status.urgentCheck.status, "success");
  assert.equal(status.urgentCheck.checkedAt, now);
  assert.equal(status.urgentCheck.expiredDeliveries, 2);
  assert.equal(store.listedPaths.includes("users/user-1/notifications"), false);
});

test("알림 읽음 처리는 요청한 사용자 알림만 갱신한다", async () => {
  const now = Date.parse("2026-06-25T00:00:00.000Z");
  const store = createStore({
    "users/user-1/notifications/n1": {
      id: "n1",
      data: {
        title: "첫 알림",
        body: "본문",
        readAt: null,
        createdAt: now - 1000,
        channelState: { inApp: { status: "stored" } },
      },
    },
    "users/user-2/notifications/n1": {
      id: "n1",
      data: {
        title: "다른 사용자 알림",
        readAt: null,
        createdAt: now - 1000,
      },
    },
  });

  const result = await markUserNotificationsRead({
    uid: "user-1",
    notificationIds: ["n1"],
    listCollectionDocuments: store.list,
    commit: store.commit,
    currentTime: new Date(now),
  });

  assert.equal(result.markedCount, 1);
  assert.equal(store.store.get("users/user-1/notifications/n1").data.readAt, now);
  assert.equal(store.store.get("users/user-1/notifications/n1").data.title, "첫 알림");
  assert.equal(store.store.get("users/user-1/notifications/n1").data.channelState.inApp.status, "stored");
  assert.equal(store.store.get("users/user-2/notifications/n1").data.readAt, null);
});

test("알림 읽음 처리는 빈 notificationIds를 안전하게 무시한다", async () => {
  const store = createStore();
  const result = await markUserNotificationsRead({
    uid: "user-1",
    notificationIds: [],
    listCollectionDocuments: store.list,
    commit: async () => {
      throw new Error("commit should not be called");
    },
    currentTime: new Date("2026-06-25T00:00:00.000Z"),
  });

  assert.equal(result.markedCount, 0);
  assert.deepEqual(result.notificationIds, []);
});

test("알림 읽음 처리는 안전하지 않거나 10개를 넘는 ID를 거부한다", async () => {
  await assert.rejects(markUserNotificationsRead({
    uid: "user-1",
    notificationIds: ["nested/id"],
    commit: async () => {},
  }), /안전하지 않은/);
  await assert.rejects(markUserNotificationsRead({
    uid: "user-1",
    notificationIds: Array.from({ length: 11 }, (_, index) => `n${index}`),
    commit: async () => {},
  }), /최대 10개/);
});

test("allVisible 읽음 처리는 최근 unread 알림만 갱신한다", async () => {
  const now = Date.parse("2026-06-25T00:00:00.000Z");
  const store = createStore({
    "users/user-1/notifications/n1": {
      id: "n1",
      data: {
        title: "읽지 않음",
        readAt: null,
        createdAt: now - 1000,
        channelState: { inApp: { status: "stored" } },
      },
    },
    "users/user-1/notifications/n2": {
      id: "n2",
      data: {
        title: "이미 읽음",
        readAt: 0,
        createdAt: now - 2000,
        channelState: { inApp: { status: "stored" } },
      },
    },
  });

  const result = await markUserNotificationsRead({
    uid: "user-1",
    allVisible: true,
    runFirestoreQuery: store.query,
    commit: store.commit,
    currentTime: new Date(now),
  });

  assert.deepEqual(result.notificationIds, ["n1"]);
  assert.equal(store.store.get("users/user-1/notifications/n1").data.readAt, now);
  assert.equal(store.store.get("users/user-1/notifications/n2").data.readAt, 0);
  assert.equal(store.store.get("users/user-1/notifications/n1").data.channelState.inApp.status, "stored");
});
