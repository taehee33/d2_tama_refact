"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "test-project";

const {
  createEligibleSlotsQuery,
  createExpiredPendingDeliveriesQuery,
  createPendingDeliveriesQuery,
  evaluateUrgentCareSlotNotification,
  listEligibleNotificationSlots,
  prepareUrgentCareNotifications,
  resolveUrgentIssues,
} = require("./urgentCareNotifications");
const {
  getCurrentSleepScheduleStartMs,
} = require("./urgentCareProjection");

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

test("pending delivery 쿼리는 유효한 pending 문서만 요청한다", () => {
  assert.deepEqual(createPendingDeliveriesQuery(TEST_NOW), {
    from: [{ collectionId: "notification_deliveries" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: "status" },
              op: "EQUAL",
              value: { stringValue: "pending" },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "expiresAt" },
              op: "GREATER_THAN",
              value: { integerValue: String(TEST_NOW) },
            },
          },
        ],
      },
    },
    orderBy: [{ field: { fieldPath: "expiresAt" }, direction: "ASCENDING" }],
  });
});

test("만료 pending delivery 쿼리는 100개까지만 정리 대상으로 요청한다", () => {
  const query = createExpiredPendingDeliveriesQuery(TEST_NOW);

  assert.equal(query.limit, 100);
  assert.equal(query.where.compositeFilter.filters[1].fieldFilter.op, "LESS_THAN_OR_EQUAL");
  assert.equal(query.where.compositeFilter.filters[1].fieldFilter.value.integerValue, String(TEST_NOW));
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

test("저장된 sleep call이 없어도 수면 스케줄 시작 시각으로 수면 조명 알림을 만든다", async () => {
  const currentTime = new Date("2026-06-30T11:12:00.000Z"); // KST 20:12
  const nowMs = currentTime.getTime();
  const sleepStartedAt = Date.parse("2026-06-30T20:00:00+09:00");
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
    listCollectionDocuments: async () => [],
    listEligibleSlotDocuments: async () => [
      createProjectedSlot({
        lastSavedAt: nowMs,
        digimonStats: {
          fullness: 5,
          strength: 5,
          sleepSchedule: {
            start: 20,
            end: 8,
            startMinute: 0,
            endMinute: 0,
          },
          callStatus: {
            sleep: { isActive: false, startedAt: null, isLogged: false },
          },
          sleepLightOnStart: null,
        },
      }),
    ],
    commit: async () => {},
  });

  assert.equal(payload.summary.newDeliveries, 1);
  assert.equal(payload.reports.length, 1);
  const issue = payload.reports[0].slotIssues[0].issues[0];
  assert.equal(issue.key, "sleep_light");
  assert.equal(issue.startedAt, sleepStartedAt);
  assert.equal(issue.deadlineAt, sleepStartedAt + 30 * 60_000);
  assert.ok(issue.detailLines.includes("시작: 오후 8:00"));
  assert.ok(issue.detailLines.includes("케어미스 예정: 오후 8:30"));
  assert.ok(issue.detailLines.includes("남은 시간: 18분"));
});

test("수면 조명 스케줄 시작 계산은 자정 이후 전날 시작 시각을 사용한다", () => {
  const startedAt = getCurrentSleepScheduleStartMs(
    { start: 20, end: 8, startMinute: 0, endMinute: 0 },
    Date.parse("2026-07-01T01:00:00+09:00")
  );

  assert.equal(startedAt, Date.parse("2026-06-30T20:00:00+09:00"));
});

test("수면 조명 경고가 30분을 넘기면 저장된 sleep call 없이 새 알림을 만들지 않는다", async () => {
  const currentTime = new Date("2026-06-30T11:45:00.000Z"); // KST 20:45
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
    listCollectionDocuments: async () => [],
    listEligibleSlotDocuments: async () => [
      createProjectedSlot({
        lastSavedAt: nowMs,
        digimonStats: {
          fullness: 5,
          strength: 5,
          sleepSchedule: {
            start: 20,
            end: 8,
            startMinute: 0,
            endMinute: 0,
          },
          callStatus: {
            sleep: { isActive: false, startedAt: null, isLogged: false },
          },
          sleepLightOnStart: null,
        },
      }),
    ],
    commit: async () => {},
  });

  assert.equal(payload.summary.newDeliveries, 0);
  assert.equal(payload.reports.length, 0);
});

test("이미 케어미스로 처리된 수면 조명 경고는 수면 중이어도 새 알림을 만들지 않는다", async () => {
  const currentTime = new Date("2026-06-25T14:45:00.000Z"); // KST 23:45
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
              startedAt: nowMs - 45 * 60_000,
              isLogged: true,
            },
          },
          sleepLightOnStart: nowMs - 45 * 60_000,
        },
      }),
    ],
    commit: async () => {},
  });

  assert.equal(payload.summary.newDeliveries, 0);
  assert.equal(payload.reports.length, 0);
});

test("이미 케어미스로 처리된 배고픔과 기력 호출은 새 알림을 만들지 않는다", async () => {
  const currentTime = new Date("2026-06-25T10:00:00.000Z");
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
          fullness: 0,
          strength: 0,
          callStatus: {
            hunger: {
              isActive: true,
              startedAt: nowMs - 12 * 60_000,
              isLogged: true,
            },
            strength: {
              isActive: true,
              startedAt: nowMs - 12 * 60_000,
              isLogged: true,
            },
          },
        },
      }),
    ],
    commit: async () => {},
  });

  assert.equal(payload.summary.newDeliveries, 0);
  assert.equal(payload.reports.length, 0);
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
  let discordPayload = null;
  await prepareUrgentCareNotifications({
    subscribers: [createSubscriber()],
    currentTime: TEST_TIME,
    dryRun: false,
    getDocumentByPath: async (path) => {
      if (path === "users/user-1") return { id: "user-1", data: { tamerName: "히히히" } };
      if (path === "users/user-1/profile/main") return { id: "main", data: {} };
      if (path === "users/user-1/notificationState/slot1") return { id: "slot1", data: {} };
      return null;
    },
    listCollectionDocuments: async (path) => {
      if (path === "notification_deliveries") return [];
      return [];
    },
    listEligibleSlotDocuments: async () => [createProjectedSlot()],
    fetchImpl: async (_url, options) => {
      discordPayload = JSON.parse(options.body);
      return { ok: true };
    },
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
  assert.equal(
    notificationWrite.update.fields.channelState.mapValue.fields.inApp.mapValue.fields.status.stringValue,
    "stored"
  );
  assert.equal(
    notificationWrite.update.fields.channelState.mapValue.fields.discord.mapValue.fields.status.stringValue,
    "sent"
  );
  assert.equal(discordPayload.username, "디지몬 파수꾼");
  assert.match(discordPayload.content, /🚨 \*\*디지몬 긴급 케어 알림\*\*/);
  assert.match(discordPayload.content, /👤 \*\*테이머\*\*: 히히히/);
  assert.match(discordPayload.content, /⚠️ \*\*긴급 대상\*\*: 1마리 · 1건/);
  assert.match(discordPayload.content, /🐾 \*\*아구몬\*\* · `슬롯 1`/);
  assert.match(discordPayload.content, /📱 앱을 열어 현재 상태를 확인해 주세요\./);
  assert.match(discordPayload.content, /⏰ \*\*확인 시간\*\*:/);
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

test("수면 중 일시정지된 배고픔과 기력 호출은 긴급 알림에서 제외한다", () => {
  const issues = resolveUrgentIssues({
    fullness: 0,
    strength: 0,
    sleepSchedule: { start: 20, end: 8, startMinute: 0, endMinute: 0 },
    callStatus: {
      hunger: {
        isActive: true,
        startedAt: TEST_NOW - 5 * 60_000,
        sleepStartAt: TEST_NOW - 2 * 60_000,
      },
      strength: {
        isActive: true,
        startedAt: TEST_NOW - 5 * 60_000,
        sleepStartAt: TEST_NOW - 2 * 60_000,
      },
    },
    hungerMistakeDeadline: TEST_NOW + 5 * 60_000,
    strengthMistakeDeadline: TEST_NOW + 5 * 60_000,
  }, {}, new Date("2026-06-26T22:52:00+09:00").getTime());

  assert.deepEqual(issues, []);
});

test("수면 중이면 sleepStartAt이 없어도 배고픔과 기력 호출은 긴급 알림에서 제외한다", () => {
  const issues = resolveUrgentIssues({
    fullness: 0,
    strength: 0,
    sleepSchedule: { start: 20, end: 8, startMinute: 0, endMinute: 0 },
    callStatus: {
      hunger: {
        isActive: true,
        startedAt: TEST_NOW - 5 * 60_000,
      },
      strength: {
        isActive: true,
        startedAt: TEST_NOW - 5 * 60_000,
      },
    },
    hungerMistakeDeadline: TEST_NOW + 5 * 60_000,
    strengthMistakeDeadline: TEST_NOW + 5 * 60_000,
  }, {}, new Date("2026-06-29T21:32:43+09:00").getTime());

  assert.deepEqual(issues, []);
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

test("즉시 슬롯 평가는 기존 pending delivery가 같은 이슈이면 재사용한다", async () => {
  const payload = await evaluateUrgentCareSlotNotification({
    uid: "user-1",
    slotId: "1",
    currentTime: TEST_TIME,
    getDocumentByPath: async (path) => {
      if (path === "users/user-1/settings/main") {
        return { id: "main", data: { isNotificationEnabled: true } };
      }
      if (path === "users/user-1") {
        return { id: "user-1", data: { discordWebhookUrl: "https://discord.com/api/webhooks/1/token" } };
      }
      if (path === "users/user-1/slots/slot1") return createProjectedSlot();
      if (path === "users/user-1/notificationState/slot1") return { id: "slot1", data: {} };
      return null;
    },
    listCollectionDocuments: async () => [],
    listPendingDeliveryDocuments: async () => [
      {
        id: "existing-delivery",
        data: {
          uid: "user-1",
          slotId: "slot1",
          issueKeys: ["hunger_call"],
          status: "pending",
          expiresAt: TEST_NOW + 60_000,
        },
      },
    ],
    commit: async () => {
      throw new Error("같은 pending delivery가 있으면 새 write를 만들면 안 됩니다.");
    },
  });

  assert.equal(payload.status, "reused");
  assert.equal(payload.deliveryId, "existing-delivery");
  assert.equal(payload.reusedDeliveries, 1);
});

test("prepare와 즉시 슬롯 평가는 저장된 sleep call이 없어도 같은 수면 조명 이슈를 계산한다", async () => {
  const currentTime = new Date("2026-06-30T11:12:00.000Z"); // KST 20:12
  const nowMs = currentTime.getTime();
  const slotDocument = createProjectedSlot({
    lastSavedAt: nowMs,
    digimonStats: {
      fullness: 5,
      strength: 5,
      sleepSchedule: {
        start: 20,
        end: 8,
        startMinute: 0,
        endMinute: 0,
      },
      callStatus: {
        sleep: { isActive: false, startedAt: null, isLogged: false },
      },
      sleepLightOnStart: null,
    },
  });

  const preparePayload = await prepareUrgentCareNotifications({
    subscribers: [createSubscriber()],
    currentTime,
    dryRun: true,
    getDocumentByPath: async (path) => {
      if (path === "users/user-1") return { id: "user-1", data: { tamerName: "테이머" } };
      if (path === "users/user-1/profile/main") return { id: "main", data: {} };
      if (path === "users/user-1/notificationState/slot1") return { id: "slot1", data: {} };
      return null;
    },
    listCollectionDocuments: async () => [],
    listEligibleSlotDocuments: async () => [slotDocument],
    commit: async () => {},
  });
  const evaluatePayload = await evaluateUrgentCareSlotNotification({
    uid: "user-1",
    slotId: "slot1",
    currentTime,
    dryRun: true,
    getDocumentByPath: async (path) => {
      if (path === "users/user-1/settings/main") {
        return { id: "main", data: { isNotificationEnabled: true } };
      }
      if (path === "users/user-1") {
        return { id: "user-1", data: { discordWebhookUrl: "https://discord.com/api/webhooks/1/token" } };
      }
      if (path === "users/user-1/profile/main") return { id: "main", data: {} };
      if (path === "users/user-1/slots/slot1") return slotDocument;
      if (path === "users/user-1/notificationState/slot1") return { id: "slot1", data: {} };
      return null;
    },
    listCollectionDocuments: async () => [],
    listPendingDeliveryDocuments: async () => [],
    commit: async () => {},
  });

  const prepareIssue = preparePayload.reports[0].slotIssues[0].issues[0];
  const evaluateIssue = evaluatePayload.issues[0];
  assert.equal(prepareIssue.key, "sleep_light");
  assert.equal(evaluateIssue.key, "sleep_light");
  assert.equal(prepareIssue.startedAt, evaluateIssue.startedAt);
  assert.equal(prepareIssue.deadlineAt, evaluateIssue.deadlineAt);
});

test("즉시 슬롯 평가는 delivery 예약 충돌 시 Discord를 보내지 않고 재사용 처리한다", async () => {
  let fetchCalled = false;
  const payload = await evaluateUrgentCareSlotNotification({
    uid: "user-1",
    slotId: "slot1",
    currentTime: TEST_TIME,
    getDocumentByPath: async (path) => {
      if (path === "users/user-1/settings/main") {
        return {
          id: "main",
          data: {
            isNotificationEnabled: true,
            discordWebhookUrl: "https://discord.com/api/webhooks/1/token",
          },
        };
      }
      if (path === "users/user-1") return { id: "user-1", data: {} };
      if (path === "users/user-1/slots/slot1") return createProjectedSlot();
      if (path === "users/user-1/notificationState/slot1") return { id: "slot1", data: {} };
      return null;
    },
    listCollectionDocuments: async () => [],
    listPendingDeliveryDocuments: async () => [],
    fetchImpl: async () => {
      fetchCalled = true;
      return { ok: true };
    },
    commit: async (batch) => {
      const isReservation = batch.some((write) =>
        String(write?.update?.name || "").includes("/notification_deliveries/") &&
        write?.currentDocument?.exists === false
      );
      if (isReservation) {
        const error = new Error("Document already exists");
        error.status = 409;
        throw error;
      }
    },
  });

  assert.equal(payload.status, "reused");
  assert.equal(payload.newDeliveries, 0);
  assert.equal(payload.reusedDeliveries, 1);
  assert.equal(fetchCalled, false);
});

test("prepare는 delivery 예약 충돌 시 Discord를 보내지 않고 새 리포트를 만들지 않는다", async () => {
  let fetchCalled = false;
  const payload = await prepareUrgentCareNotifications({
    subscribers: [createSubscriber()],
    currentTime: TEST_TIME,
    dryRun: false,
    getDocumentByPath: async (path) => {
      if (path === "users/user-1") return { id: "user-1", data: { tamerName: "테이머" } };
      if (path === "users/user-1/profile/main") return { id: "main", data: {} };
      if (path === "users/user-1/notificationState/slot1") return { id: "slot1", data: {} };
      return null;
    },
    listCollectionDocuments: async () => [],
    listEligibleSlotDocuments: async () => [createProjectedSlot()],
    fetchImpl: async () => {
      fetchCalled = true;
      return { ok: true };
    },
    commit: async (batch) => {
      const isReservation = batch.some((write) =>
        String(write?.update?.name || "").includes("/notification_deliveries/") &&
        write?.currentDocument?.exists === false
      );
      if (isReservation) {
        const error = new Error("Document already exists");
        error.status = 409;
        throw error;
      }
    },
  });

  assert.equal(payload.summary.newDeliveries, 0);
  assert.equal(payload.summary.reusedDeliveries, 1);
  assert.equal(payload.reports.length, 0);
  assert.equal(fetchCalled, false);
});

test("즉시 슬롯 평가는 채널 토글에 따라 hidden/skipped 상태를 알림 문서에 저장한다", async () => {
  const writes = [];
  const payload = await evaluateUrgentCareSlotNotification({
    uid: "user-1",
    slotId: "slot1",
    currentTime: TEST_TIME,
    getDocumentByPath: async (path) => {
      if (path === "users/user-1/settings/main") {
        return {
          id: "main",
          data: {
            isNotificationEnabled: true,
            discordWebhookUrl: "https://discord.com/api/webhooks/1/token",
            notificationChannels: {
              inApp: false,
              discord: false,
              webPush: false,
            },
          },
        };
      }
      if (path === "users/user-1") return { id: "user-1", data: {} };
      if (path === "users/user-1/slots/slot1") return createProjectedSlot();
      if (path === "users/user-1/notificationState/slot1") return { id: "slot1", data: {} };
      return null;
    },
    listCollectionDocuments: async () => [],
    listPendingDeliveryDocuments: async () => [],
    fetchImpl: async () => {
      throw new Error("Discord 채널이 꺼져 있으면 전송하지 않아야 합니다.");
    },
    commit: async (batch) => {
      writes.push(...batch);
    },
  });

  assert.equal(payload.status, "created");
  const notificationWrite = writes.find((write) =>
    String(write?.update?.name || "").includes("/users/user-1/notifications/urgent_")
  );
  assert.ok(notificationWrite);
  assert.equal(
    notificationWrite.update.fields.channelState.mapValue.fields.inApp.mapValue.fields.status.stringValue,
    "hidden"
  );
  assert.equal(
    notificationWrite.update.fields.channelState.mapValue.fields.discord.mapValue.fields.reason.stringValue,
    "channel_disabled"
  );
  assert.equal(
    notificationWrite.update.fields.channelState.mapValue.fields.webPush.mapValue.fields.reason.stringValue,
    "channel_disabled"
  );
});
