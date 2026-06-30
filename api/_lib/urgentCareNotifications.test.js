"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseFirestoreFields } = require("../../digimon-tamagotchi-frontend/api/_lib/firestoreAdmin");
const {
  buildUrgentMessage,
} = require("../../digimon-tamagotchi-frontend/api/_lib/urgentCareDelivery");
const {
  acknowledgeUrgentCareDeliveries,
  createUrgentCareAckHandler,
  createUrgentCarePrepareHandler,
  prepareUrgentCareNotifications,
  projectSlotForUrgentCare,
  resolveUrgentIssues,
} = require("./urgentCareNotifications");
const { NOTIFICATION_SECRET_HEADER } = require("../../digimon-tamagotchi-frontend/api/_lib/notificationReports");

process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "d2-test";

function createRuntimeStats(overrides = {}) {
  return {
    isDead: false,
    birthTime: Date.parse("2026-06-20T00:00:00.000Z"),
    lifespanSeconds: 0,
    timeToEvolveSeconds: 999999,
    hungerTimer: 60,
    hungerCountdown: 60,
    fullness: 1,
    strengthTimer: 60,
    strengthCountdown: 60,
    strength: 1,
    poopTimer: 120,
    poopCountdown: 7200,
    poopCount: 0,
    maxEnergy: 20,
    sleepSchedule: { start: 23, end: 7, startMinute: 0, endMinute: 0 },
    callStatus: {
      hunger: { isActive: false, startedAt: null, isLogged: false },
      strength: { isActive: false, startedAt: null, isLogged: false },
      sleep: { isActive: false, startedAt: null, isLogged: false },
    },
    careMistakes: 0,
    careMistakeLedger: [],
    injuries: 0,
    isInjured: false,
    injuredAt: null,
    activityLogs: [],
    isFrozen: false,
    frozenAt: null,
    takeOutAt: null,
    lastHungerZeroAt: null,
    lastStrengthZeroAt: null,
    ...overrides,
  };
}

function createStore(slotData) {
  const documents = new Map([
    ["users/user-1", { id: "user-1", data: { displayName: "테이머" } }],
    ["users/user-1/settings/main", { id: "main", data: { isNotificationEnabled: true, discordWebhookUrl: "https://discord.com/api/webhooks/test/token" } }],
    ["users/user-1/profile/main", { id: "main", data: { tamerName: "한솔" } }],
    ["users/user-1/slots/slot1", { id: "slot1", data: slotData }],
  ]);

  return {
    documents,
    async get(path) {
      return documents.get(path) || null;
    },
    async list(path) {
      const prefix = `${path}/`;
      return [...documents.entries()]
        .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
        .map(([, value]) => value);
    },
    async listPendingDeliveries(nowMs) {
      return [...documents.entries()]
        .filter(([key, value]) =>
          key.startsWith("notification_deliveries/") &&
          value.data?.status === "pending" &&
          Number(value.data?.expiresAt) > nowMs
        )
        .map(([, value]) => value);
    },
    async listExpiredPendingDeliveries(nowMs) {
      return [...documents.entries()]
        .filter(([key, value]) =>
          key.startsWith("notification_deliveries/") &&
          value.data?.status === "pending" &&
          Number(value.data?.expiresAt) <= nowMs
        )
        .slice(0, 100)
        .map(([, value]) => value);
    },
    async listEligibleSlots() {
      const prefix = "users/user-1/slots/";
      return [...documents.entries()]
        .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
        .map(([, value]) => value);
    },
    async commit(writes) {
      writes.forEach((write) => {
        const name = write.update.name;
        const path = name.slice(name.indexOf("/documents/") + "/documents/".length);
        if (write.currentDocument?.exists === false && documents.has(path)) {
          const error = new Error("Document already exists");
          error.status = 409;
          throw error;
        }
        documents.set(path, {
          id: path.split("/").pop(),
          data: parseFirestoreFields(write.update.fields || {}),
        });
      });
    },
  };
}

async function listTestSubscribers(store) {
  const settings = await store.get("users/user-1/settings/main");
  return [{ uid: "user-1", id: "user-1", data: settings.data }];
}

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    end(payload) {
      if (payload !== undefined) this.body = typeof payload === "string" ? JSON.parse(payload) : payload;
    },
  };
}

test("긴급 Discord 메시지는 대상 수와 디지몬별 상태를 읽기 쉽게 표시한다", () => {
  const message = buildUrgentMessage("한솔", [
    {
      slotId: "slot1",
      digimonName: "아구몬",
      issues: [
        { key: "hunger_call", label: "🍖 배고픔 호출" },
        { key: "poop_warning", label: "💩 똥 6개 경고" },
      ],
    },
    {
      slotId: "slot3",
      digimonName: "파피몬",
      issues: [{ key: "injury", label: "🩹 부상 상태" }],
    },
  ], "2026. 6. 23. AM 1:00:00");

  assert.equal(message, [
    "━━━━━━━━━━━━━━━━━━",
    "🚨 **디지몬 긴급 케어 알림**",
    "지금 확인이 필요한 상태가 발생했습니다.",
    "",
    "👤 **테이머**: 한솔",
    "⚠️ **긴급 대상**: 2마리 · 3건",
    "",
    "🐾 **아구몬** · `슬롯 1`",
    "> 🍖 배고픔 호출",
    "> 💩 똥 6개 경고",
    "",
    "🐾 **파피몬** · `슬롯 3`",
    "> 🩹 부상 상태",
    "",
    "📱 앱을 열어 현재 상태를 확인해 주세요.",
    "",
    "⏰ **확인 시간**: 2026. 6. 23. AM 1:00:00",
    "━━━━━━━━━━━━━━━━━━",
  ].join("\n"));
});

test("13시간 오프라인 상태를 서버에서 계산해 사망을 판정한다", () => {
  const now = Date.parse("2026-06-21T13:00:00.000Z");
  const result = projectSlotForUrgentCare({
    selectedDigimon: "Agumon",
    isLightsOn: true,
    lastSavedAt: now - 13 * 60 * 60 * 1000,
    digimonStats: createRuntimeStats(),
  }, now);

  assert.equal(result.status, "projected");
  assert.equal(result.stats.isDead, true);
  assert.deepEqual(resolveUrgentIssues(result.stats, {}), [
    { key: "death", label: "💀 사망 판정" },
  ]);
});

test("13시간 오프라인에서 힘 소진 사망도 동일하게 판정한다", () => {
  const now = Date.parse("2026-06-21T13:00:00.000Z");
  const result = projectSlotForUrgentCare({
    selectedDigimon: "Agumon",
    lastSavedAt: now - 13 * 60 * 60 * 1000,
    digimonStats: createRuntimeStats({ fullness: 5, hungerCountdown: 3600 }),
  }, now);

  assert.equal(result.stats.isDead, true);
  assert.match(result.stats.deathReason, /EXHAUSTION/);
});

test("정규 수면 구간에는 배고픔과 기력 countdown이 감소하지 않는다", () => {
  const start = Date.parse("2026-06-20T11:00:00.000Z"); // KST 20:00
  const now = Date.parse("2026-06-21T00:00:00.000Z"); // KST 09:00
  const result = projectSlotForUrgentCare({
    selectedDigimon: "Agumon",
    lastSavedAt: start,
    digimonStats: createRuntimeStats({
      fullness: 5,
      strength: 5,
      hungerCountdown: 3600,
      strengthCountdown: 3600,
    }),
  }, now);

  assert.equal(result.stats.fullness, 0);
  assert.equal(result.stats.strength, 0);
  assert.equal(result.stats.isDead, false);
});

test("이미 케어미스로 처리된 수면 조명 경고는 긴급 이슈에서 제외한다", () => {
  const now = Date.parse("2026-06-25T14:45:00.000Z"); // KST 23:45
  const startedAt = now - 45 * 60 * 1000;
  const issues = resolveUrgentIssues({
    sleepSchedule: { start: 22, end: 6, startMinute: 0, endMinute: 0 },
    isLightsOn: true,
    callStatus: {
      sleep: {
        isActive: true,
        startedAt,
        isLogged: true,
      },
    },
    sleepLightOnStart: startedAt,
  }, { isLightsOn: true }, now);

  assert.deepEqual(issues, []);
});

test("이미 케어미스로 처리된 배고픔과 기력 호출은 긴급 이슈에서 제외한다", () => {
  const now = Date.parse("2026-06-25T10:00:00.000Z");
  const startedAt = now - 12 * 60 * 1000;
  const issues = resolveUrgentIssues({
    fullness: 0,
    strength: 0,
    callStatus: {
      hunger: {
        isActive: true,
        startedAt,
        isLogged: true,
      },
      strength: {
        isActive: true,
        startedAt,
        isLogged: true,
      },
    },
  }, {}, now);

  assert.deepEqual(issues, []);
});

test("냉장고 구간은 부상 방치 사망 시간에서 제외한다", () => {
  const start = Date.parse("2026-06-21T00:00:00.000Z");
  const now = start + 10 * 60 * 60 * 1000;
  const result = projectSlotForUrgentCare({
    selectedDigimon: "Agumon",
    lastSavedAt: start,
    digimonStats: createRuntimeStats({
      isFrozen: true,
      frozenAt: start + 2 * 60 * 60 * 1000,
      isInjured: true,
      injuredAt: start,
    }),
  }, now);

  assert.equal(result.stats.isDead, false);
});

test("똥 6개 경고와 8개 위험을 분리한다", () => {
  assert.deepEqual(resolveUrgentIssues({ poopCount: 6, callStatus: {} }, {}).map((issue) => issue.key), ["poop_warning"]);
  assert.deepEqual(resolveUrgentIssues({ poopCount: 8, callStatus: {} }, {}).map((issue) => issue.key), ["poop_danger"]);
});

test("prepare 재호출은 pending delivery를 재사용하고 ack 뒤에는 중복 발송하지 않는다", async () => {
  const now = Date.parse("2026-06-21T13:00:00.000Z");
  const store = createStore({
    selectedDigimon: "Agumon",
    isLightsOn: true,
    lastSavedAt: now,
    digimonStats: createRuntimeStats({ isDead: true, deathReason: "STARVATION" }),
  });
  const args = {
    subscribers: await listTestSubscribers(store),
    getDocumentByPath: store.get,
    listCollectionDocuments: store.list,
    listEligibleSlotDocuments: store.listEligibleSlots,
    listPendingDeliveryDocuments: store.listPendingDeliveries,
    listExpiredPendingDeliveryDocuments: store.listExpiredPendingDeliveries,
    commit: store.commit,
    currentTime: new Date(now),
  };

  const first = await prepareUrgentCareNotifications(args);
  assert.equal(first.reports.length, 1);
  assert.equal(first.summary.newDeliveries, 1);
  const deliveryId = first.reports[0].deliveryIds[0];

  const second = await prepareUrgentCareNotifications(args);
  assert.deepEqual(second.reports[0].deliveryIds, [deliveryId]);
  assert.equal(second.summary.reusedDeliveries, 1);

  const ack = await acknowledgeUrgentCareDeliveries({
    deliveryIds: [deliveryId],
    getDocumentByPath: store.get,
    commit: store.commit,
    currentTime: new Date(now + 1_000),
  });
  assert.equal(ack.acknowledged, 1);

  const repeatedAck = await acknowledgeUrgentCareDeliveries({
    deliveryIds: [deliveryId, "missing"],
    getDocumentByPath: store.get,
    commit: store.commit,
    currentTime: new Date(now + 2_000),
  });
  assert.equal(repeatedAck.alreadyAcknowledged, 1);
  assert.equal(repeatedAck.invalid, 1);

  const third = await prepareUrgentCareNotifications(args);
  assert.equal(third.reports.length, 0);

  store.documents.get("users/user-1/slots/slot1").data.digimonStats.isDead = false;
  await prepareUrgentCareNotifications({ ...args, currentTime: new Date(now + 3_000) });
  store.documents.get("users/user-1/slots/slot1").data.digimonStats.isDead = true;
  const recurrence = await prepareUrgentCareNotifications({ ...args, currentTime: new Date(now + 4_000) });
  assert.equal(recurrence.reports.length, 1);
  assert.notEqual(recurrence.reports[0].deliveryIds[0], deliveryId);
});

test("Discord 실패처럼 ack하지 않은 delivery는 다음 prepare에서 재전송한다", async () => {
  const now = Date.parse("2026-06-21T13:00:00.000Z");
  const store = createStore({
    selectedDigimon: "Agumon",
    lastSavedAt: now,
    digimonStats: createRuntimeStats({ poopCount: 6 }),
  });
  const args = {
    subscribers: await listTestSubscribers(store),
    getDocumentByPath: store.get,
    listCollectionDocuments: store.list,
    listEligibleSlotDocuments: store.listEligibleSlots,
    listPendingDeliveryDocuments: store.listPendingDeliveries,
    listExpiredPendingDeliveryDocuments: store.listExpiredPendingDeliveries,
    commit: store.commit,
    currentTime: new Date(now),
  };
  const first = await prepareUrgentCareNotifications(args);
  const retry = await prepareUrgentCareNotifications({ ...args, currentTime: new Date(now + 15 * 60 * 1000) });
  assert.equal(retry.summary.reusedDeliveries, 1);
  assert.equal(retry.reports[0].deliveryIds[0], first.reports[0].deliveryIds[0]);
});

test("prepare는 delivery 예약 충돌 시 Discord를 보내지 않고 새 리포트를 만들지 않는다", async () => {
  const now = Date.parse("2026-06-21T13:00:00.000Z");
  const store = createStore({
    selectedDigimon: "Agumon",
    lastSavedAt: now,
    digimonStats: createRuntimeStats({ poopCount: 6 }),
  });
  let fetchCalled = false;
  const originalCommit = store.commit;
  const result = await prepareUrgentCareNotifications({
    subscribers: await listTestSubscribers(store),
    getDocumentByPath: store.get,
    listCollectionDocuments: store.list,
    listEligibleSlotDocuments: store.listEligibleSlots,
    listPendingDeliveryDocuments: async () => [],
    listExpiredPendingDeliveryDocuments: async () => [],
    fetchImpl: async () => {
      fetchCalled = true;
      return { ok: true };
    },
    commit: async (writes) => {
      const isReservation = writes.some((write) =>
        String(write?.update?.name || "").includes("/notification_deliveries/") &&
        write?.currentDocument?.exists === false
      );
      if (isReservation) {
        const error = new Error("Document already exists");
        error.status = 409;
        throw error;
      }
      return originalCommit(writes);
    },
    currentTime: new Date(now),
  });

  assert.equal(result.summary.newDeliveries, 0);
  assert.equal(result.summary.reusedDeliveries, 1);
  assert.equal(result.reports.length, 0);
  assert.equal(fetchCalled, false);
});

test("prepare handler는 공용 활성 구독자 조회 결과만 처리한다", async () => {
  const now = Date.parse("2026-06-22T03:00:00.000Z");
  const store = createStore({
    selectedDigimon: "Agumon",
    lastSavedAt: now,
    digimonStats: createRuntimeStats({ poopCount: 6 }),
  });
  let subscriberQueryCount = 0;
  const handler = createUrgentCarePrepareHandler({
    getSchedulerSecret: () => "top-secret",
    getCurrentTime: () => new Date(now),
    listNotificationSubscribers: async () => {
      subscriberQueryCount += 1;
      return listTestSubscribers(store);
    },
    getDocument: store.get,
    listDocuments: store.list,
    listEligibleSlotDocuments: store.listEligibleSlots,
    listPendingDeliveryDocuments: store.listPendingDeliveries,
    listExpiredPendingDeliveryDocuments: store.listExpiredPendingDeliveries,
    commitWrites: store.commit,
  });
  const req = {
    method: "POST",
    headers: { "x-d2-scheduler-secret": "top-secret" },
    body: {},
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(subscriberQueryCount, 1);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.summary.totalUsers, 1);
  assert.equal(res.body.reports.length, 1);
  assert.equal(store.documents.get("notification_runtime/urgentCare").data.status, "success");
  assert.equal(store.documents.get("notification_runtime/urgentCare").data.newDeliveries, 1);
});

test("prepare handler 실패 시 긴급 검사 오류 상태를 저장한다", async () => {
  const now = Date.parse("2026-06-22T03:00:00.000Z");
  const store = createStore({
    selectedDigimon: "Agumon",
    lastSavedAt: now,
    digimonStats: createRuntimeStats(),
  });
  const handler = createUrgentCarePrepareHandler({
    getSchedulerSecret: () => "top-secret",
    getCurrentTime: () => new Date(now),
    listNotificationSubscribers: async () => {
      throw new Error("subscriber query failed");
    },
    getDocument: store.get,
    listDocuments: store.list,
    commitWrites: store.commit,
  });
  const res = createMockRes();

  await handler({
    method: "POST",
    headers: { "x-d2-scheduler-secret": "top-secret" },
    body: {},
  }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(store.documents.get("notification_runtime/urgentCare").data.status, "error");
  assert.equal(store.documents.get("notification_runtime/urgentCare").data.errorMessage, "subscriber query failed");
});

test("dryRun은 메시지를 계산하지만 delivery 문서를 만들지 않는다", async () => {
  const now = Date.parse("2026-06-21T13:00:00.000Z");
  const store = createStore({
    selectedDigimon: "Agumon",
    lastSavedAt: now,
    digimonStats: createRuntimeStats({ poopCount: 8 }),
  });
  const result = await prepareUrgentCareNotifications({
    subscribers: await listTestSubscribers(store),
    getDocumentByPath: store.get,
    listCollectionDocuments: store.list,
    listEligibleSlotDocuments: store.listEligibleSlots,
    listPendingDeliveryDocuments: store.listPendingDeliveries,
    listExpiredPendingDeliveryDocuments: store.listExpiredPendingDeliveries,
    commit: store.commit,
    currentTime: new Date(now),
    dryRun: true,
  });
  assert.equal(result.reports.length, 1);
  assert.equal((await store.list("notification_deliveries")).length, 0);
  assert.equal(store.documents.has("notification_runtime/urgentCare"), false);
});

test("7일이 지난 pending delivery는 cancelled로 정리한다", async () => {
  const now = Date.parse("2026-06-21T13:00:00.000Z");
  const store = createStore({
    selectedDigimon: "Agumon",
    lastSavedAt: now,
    digimonStats: createRuntimeStats(),
  });
  store.documents.set("notification_deliveries/expired", {
    id: "expired",
    data: {
      uid: "user-1",
      slotId: "slot1",
      status: "pending",
      expiresAt: now - 1,
    },
  });
  const result = await prepareUrgentCareNotifications({
    subscribers: await listTestSubscribers(store),
    getDocumentByPath: store.get,
    listCollectionDocuments: store.list,
    listEligibleSlotDocuments: store.listEligibleSlots,
    listPendingDeliveryDocuments: store.listPendingDeliveries,
    listExpiredPendingDeliveryDocuments: store.listExpiredPendingDeliveries,
    commit: store.commit,
    currentTime: new Date(now),
  });
  assert.equal(result.summary.expiredDeliveries, 1);
  assert.equal(store.documents.get("notification_deliveries/expired").data.status, "cancelled");
});

test("runtime 필드가 없는 구 슬롯과 냉장고 슬롯을 안전하게 제외한다", async () => {
  const now = Date.parse("2026-06-21T13:00:00.000Z");
  const store = createStore({
    selectedDigimon: "Agumon",
    lastSavedAt: now,
    digimonStats: { fullness: 0 },
  });
  const unavailable = await prepareUrgentCareNotifications({
    subscribers: await listTestSubscribers(store),
    getDocumentByPath: store.get,
    listCollectionDocuments: store.list,
    listEligibleSlotDocuments: store.listEligibleSlots,
    listPendingDeliveryDocuments: store.listPendingDeliveries,
    listExpiredPendingDeliveryDocuments: store.listExpiredPendingDeliveries,
    commit: store.commit,
    currentTime: new Date(now),
  });
  assert.equal(unavailable.summary.projectionUnavailable, 1);

  store.documents.get("users/user-1/slots/slot1").data = {
    isFrozen: true,
    lastSavedAt: now,
    digimonStats: createRuntimeStats(),
  };
  const frozen = await prepareUrgentCareNotifications({
    subscribers: await listTestSubscribers(store),
    getDocumentByPath: store.get,
    listCollectionDocuments: store.list,
    listEligibleSlotDocuments: store.listEligibleSlots,
    listPendingDeliveryDocuments: store.listPendingDeliveries,
    listExpiredPendingDeliveryDocuments: store.listExpiredPendingDeliveries,
    commit: store.commit,
    currentTime: new Date(now),
  });
  assert.equal(frozen.summary.frozenSlots, 1);
});

test("prepare와 ack API는 scheduler secret 누락·불일치를 거부한다", async () => {
  const dependencies = {
    getSchedulerSecret: () => "top-secret",
    listDocuments: async () => [],
    getDocument: async () => null,
    commitWrites: async () => ({}),
  };
  const prepareHandler = createUrgentCarePrepareHandler(dependencies);
  const missingRes = createMockRes();
  await prepareHandler({ method: "POST", headers: {}, body: {} }, missingRes);
  assert.equal(missingRes.statusCode, 401);

  const ackHandler = createUrgentCareAckHandler(dependencies);
  const mismatchRes = createMockRes();
  await ackHandler({
    method: "POST",
    headers: { [NOTIFICATION_SECRET_HEADER]: "wrong-secret" },
    body: { deliveryIds: [] },
  }, mismatchRes);
  assert.equal(mismatchRes.statusCode, 401);
});
