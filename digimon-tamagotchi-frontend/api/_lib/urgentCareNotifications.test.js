"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "test-project";

const {
  createEligibleSlotsQuery,
  listEligibleNotificationSlots,
  prepareUrgentCareNotifications,
  resolveUrgentIssues,
} = require("./urgentCareNotifications");

const TEST_TIME = new Date("2026-06-25T01:00:00.000Z");
const TEST_NOW = TEST_TIME.getTime();

function createSubscriber() {
  return {
    uid: "user-1",
    data: {
      isNotificationEnabled: true,
      discordWebhookUrl: "https://discord.com/api/webhooks/1/token",
    },
  };
}

function createProjectedSlot(overrides = {}) {
  const baseStats = {
    fullness: 5,
    strength: 5,
    poopCount: 0,
    hungerTimer: 60,
    strengthTimer: 60,
    poopTimer: 60,
    maxEnergy: 5,
    sleepSchedule: {
      start: 22,
      end: 6,
      startMinute: 0,
      endMinute: 0,
    },
    callStatus: {
      hunger: {
        isActive: true,
        startedAt: TEST_NOW - 60_000,
        deadline: TEST_NOW + 10 * 60_000,
      },
    },
  };

  return {
    id: "slot1",
    data: {
      selectedDigimon: "Agumon",
      digimonDisplayName: "아구몬",
      notificationEligible: true,
      isLightsOn: true,
      lastSavedAt: TEST_NOW,
      digimonStats: {
        ...baseStats,
        ...(overrides.digimonStats || {}),
      },
      ...overrides,
      digimonStats: {
        ...baseStats,
        ...(overrides.digimonStats || {}),
      },
    },
  };
}

test("eligible 슬롯 쿼리는 notificationEligible == true만 요청한다", async () => {
  let receivedQuery = null;
  let receivedParentPath = null;
  const result = await listEligibleNotificationSlots("user-1", async (query, parentPath) => {
    receivedQuery = query;
    receivedParentPath = parentPath;
    return [{ id: "slot1", data: { notificationEligible: true } }];
  });

  assert.deepEqual(result, [{ id: "slot1", data: { notificationEligible: true } }]);
  assert.equal(receivedParentPath, "users/user-1");
  assert.deepEqual(receivedQuery, createEligibleSlotsQuery());
});

test("prepare는 전체 슬롯 목록 대신 eligible 슬롯 목록만 사용한다", async () => {
  let eligibleReadCount = 0;
  const payload = await prepareUrgentCareNotifications({
    subscribers: [createSubscriber()],
    currentTime: TEST_TIME,
    dryRun: true,
    getDocumentByPath: async (path) => {
      if (path === "users/user-1") return { id: "user-1", data: { tamerName: "테이머" } };
      if (path === "users/user-1/profile/main") return { id: "main", data: {} };
      if (path === "users/user-1/notificationState/slot1") return { id: "slot1", data: {} };
      return null;
    },
    listCollectionDocuments: async (path) => {
      if (path === "notification_deliveries") return [];
      if (path === "users/user-1/slots") {
        throw new Error("전체 슬롯 목록을 읽으면 안 됩니다.");
      }
      return [];
    },
    listEligibleSlotDocuments: async (uid) => {
      assert.equal(uid, "user-1");
      eligibleReadCount += 1;
      return [createProjectedSlot()];
    },
    commit: async () => {
      throw new Error("dryRun에서는 commit하지 않습니다.");
    },
  });

  assert.equal(eligibleReadCount, 1);
  assert.equal(payload.summary.totalSlots, 1);
  assert.equal(payload.summary.projectedSlots, 1);
  assert.equal(payload.summary.newDeliveries, 1);
  assert.equal(payload.reports.length, 1);
  assert.match(payload.reports[0].messageContent, /배고픔 호출/);
  assert.match(payload.reports[0].messageContent, /시작:/);
  assert.match(payload.reports[0].messageContent, /케어미스 예정:/);
});

test("eligible 목록에 보관함 슬롯이 섞여도 서버에서 다시 제외한다", async () => {
  const payload = await prepareUrgentCareNotifications({
    subscribers: [createSubscriber()],
    currentTime: TEST_TIME,
    dryRun: true,
    getDocumentByPath: async (path) => {
      if (path === "users/user-1") return { id: "user-1", data: {} };
      if (path === "users/user-1/profile/main") return { id: "main", data: {} };
      if (path === "users/user-1/notificationState/slot1") {
        return { id: "slot1", data: { activeIssueKeys: ["hunger_call"] } };
      }
      return null;
    },
    listCollectionDocuments: async (path) => {
      if (path === "notification_deliveries") return [];
      return [];
    },
    listEligibleSlotDocuments: async () => [
      createProjectedSlot({
        isRefrigerated: true,
        digimonStats: {
          ...createProjectedSlot().data.digimonStats,
          isFrozen: true,
        },
      }),
    ],
    commit: async () => {},
  });

  assert.equal(payload.summary.frozenSlots, 1);
  assert.equal(payload.summary.projectedSlots, 0);
  assert.equal(payload.summary.newDeliveries, 0);
  assert.equal(payload.reports.length, 0);
});

test("KST 수면 시간이 아니면 남아 있는 sleep call 상태로 수면 알림을 보내지 않는다", async () => {
  const currentTime = new Date("2026-06-25T05:50:00.000Z"); // KST 14:50
  const nowMs = currentTime.getTime();
  const payload = await prepareUrgentCareNotifications({
    subscribers: [createSubscriber()],
    currentTime,
    dryRun: true,
    getDocumentByPath: async (path) => {
      if (path === "users/user-1") return { id: "user-1", data: {} };
      if (path === "users/user-1/profile/main") return { id: "main", data: {} };
      if (path === "users/user-1/notificationState/slot1") {
        return { id: "slot1", data: { activeIssueKeys: ["sleep_light"] } };
      }
      return null;
    },
    listCollectionDocuments: async (path) => {
      if (path === "notification_deliveries") return [];
      return [];
    },
    listEligibleSlotDocuments: async () => [
      createProjectedSlot({
        lastSavedAt: nowMs,
        digimonStats: {
          callStatus: {
            sleep: {
              isActive: true,
              startedAt: nowMs - 5 * 60_000,
              isLogged: false,
            },
          },
          sleepLightOnStart: nowMs - 5 * 60_000,
        },
      }),
    ],
    commit: async () => {},
  });

  assert.equal(payload.summary.projectedSlots, 1);
  assert.equal(payload.summary.newDeliveries, 0);
  assert.equal(payload.reports.length, 0);
});

test("KST 수면 시간이고 불이 켜져 있으면 수면 알림과 30분 데드라인을 표시한다", async () => {
  const currentTime = new Date("2026-06-25T14:05:00.000Z"); // KST 23:05
  const nowMs = currentTime.getTime();
  const payload = await prepareUrgentCareNotifications({
    subscribers: [createSubscriber()],
    currentTime,
    dryRun: true,
    getDocumentByPath: async (path) => {
      if (path === "users/user-1") return { id: "user-1", data: { tamerName: "테이머" } };
      if (path === "users/user-1/profile/main") return { id: "main", data: {} };
      if (path === "users/user-1/notificationState/slot1") return { id: "slot1", data: {} };
      return null;
    },
    listCollectionDocuments: async (path) => {
      if (path === "notification_deliveries") return [];
      return [];
    },
    listEligibleSlotDocuments: async () => [
      createProjectedSlot({
        lastSavedAt: nowMs,
        digimonStats: {
          callStatus: {
            sleep: {
              isActive: true,
              startedAt: nowMs - 5 * 60_000,
              isLogged: false,
            },
          },
          sleepLightOnStart: nowMs - 5 * 60_000,
        },
      }),
    ],
    commit: async () => {},
  });

  assert.equal(payload.summary.newDeliveries, 1);
  assert.equal(payload.reports.length, 1);
  assert.match(payload.reports[0].messageContent, /수면 시간 조명 켜짐/);
  assert.match(payload.reports[0].messageContent, /시작:/);
  assert.match(payload.reports[0].messageContent, /케어미스 예정:/);
  assert.match(payload.reports[0].messageContent, /남은 시간:/);
});

test("wakeUntil 강제 기상 중이면 수면 알림을 보내지 않는다", async () => {
  const currentTime = new Date("2026-06-25T14:05:00.000Z"); // KST 23:05
  const nowMs = currentTime.getTime();
  const payload = await prepareUrgentCareNotifications({
    subscribers: [createSubscriber()],
    currentTime,
    dryRun: true,
    getDocumentByPath: async (path) => {
      if (path === "users/user-1") return { id: "user-1", data: {} };
      if (path === "users/user-1/profile/main") return { id: "main", data: {} };
      if (path === "users/user-1/notificationState/slot1") return { id: "slot1", data: {} };
      return null;
    },
    listCollectionDocuments: async (path) => {
      if (path === "notification_deliveries") return [];
      return [];
    },
    listEligibleSlotDocuments: async () => [
      createProjectedSlot({
        lastSavedAt: nowMs,
        wakeUntil: nowMs + 10 * 60_000,
        digimonStats: {
          wakeUntil: nowMs + 10 * 60_000,
          callStatus: {
            sleep: {
              isActive: true,
              startedAt: nowMs - 5 * 60_000,
              isLogged: false,
            },
          },
          sleepLightOnStart: nowMs - 5 * 60_000,
        },
      }),
    ],
    commit: async () => {},
  });

  assert.equal(payload.summary.newDeliveries, 0);
  assert.equal(payload.reports.length, 0);
});

test("신규 긴급 delivery를 인앱 알림 문서로도 저장한다", async () => {
  const writes = [];
  await prepareUrgentCareNotifications({
    subscribers: [createSubscriber()],
    currentTime: TEST_TIME,
    dryRun: false,
    getDocumentByPath: async (path) => {
      if (path === "users/user-1") return { id: "user-1", data: {} };
      if (path === "users/user-1/profile/main") return { id: "main", data: {} };
      if (path === "users/user-1/notificationState/slot1") return { id: "slot1", data: {} };
      return null;
    },
    listCollectionDocuments: async (path) => {
      if (path === "notification_deliveries") return [];
      return [];
    },
    listEligibleSlotDocuments: async () => [createProjectedSlot()],
    commit: async (batch) => {
      writes.push(...batch);
      return {};
    },
  });

  const notificationWrite = writes.find((write) =>
    String(write?.update?.name || "").includes("/users/user-1/notifications/urgent_")
  );
  assert.ok(notificationWrite);
  assert.equal(notificationWrite.update.fields.type.stringValue, "urgent_care");
  assert.match(notificationWrite.update.fields.body.stringValue, /케어미스 예정:/);
});

test("기력 호출에도 시작과 케어미스 예정 정보를 붙인다", () => {
  const issues = resolveUrgentIssues({
    callStatus: {
      strength: {
        isActive: true,
        startedAt: TEST_NOW - 5 * 60_000,
      },
    },
    strengthMistakeDeadline: TEST_NOW + 5 * 60_000,
  }, {}, TEST_NOW);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].key, "strength_call");
  assert.ok(issues[0].detailLines.some((line) => line.startsWith("시작:")));
  assert.ok(issues[0].detailLines.some((line) => line.startsWith("케어미스 예정:")));
  assert.ok(issues[0].detailLines.some((line) => line.startsWith("남은 시간:")));
});

test("deadline이 지난 호출은 케어미스 발생 구간으로 표시한다", () => {
  const issues = resolveUrgentIssues({
    callStatus: {
      hunger: {
        isActive: true,
        startedAt: TEST_NOW - 20 * 60_000,
      },
    },
  }, {}, TEST_NOW);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].key, "hunger_call");
  assert.ok(issues[0].detailLines.includes("케어미스 발생 구간"));
});
