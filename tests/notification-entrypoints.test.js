const test = require("node:test");
const assert = require("node:assert/strict");

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    setHeader() {},
    end(payload) { this.body = payload ? JSON.parse(payload) : null; },
  };
}

test("notification API entrypoints load from the deployed root", () => {
  const rootHandler = require("../api/notifications/daily-digimon-report");
  const frontendHandler = require("../digimon-tamagotchi-frontend/api/notifications/[operation]");
  const urgentPrepare = require("../api/notifications/urgent-digimon-care/prepare");
  const urgentAck = require("../api/notifications/urgent-digimon-care/ack");

  assert.equal(typeof rootHandler, "function");
  assert.equal(typeof frontendHandler, "function");
  assert.equal(typeof urgentPrepare, "function");
  assert.equal(typeof urgentAck, "function");
});

test("단일 notification function이 operation별 handler로 라우팅한다", async () => {
  const { createNotificationRouter } = require("../digimon-tamagotchi-frontend/api/notifications/[operation]");
  const calls = [];
  const router = createNotificationRouter({
    dailyHandler: async () => calls.push("daily"),
    prepareHandler: async () => calls.push("prepare"),
    ackHandler: async () => calls.push("ack"),
  });

  for (const operation of ["daily", "prepare", "ack"]) {
    await router({ query: { operation } }, createMockRes());
  }

  assert.deepEqual(calls, ["daily", "prepare", "ack"]);
});

test("알 수 없는 notification operation은 404를 반환한다", async () => {
  const { createNotificationRouter } = require("../digimon-tamagotchi-frontend/api/notifications/[operation]");
  const router = createNotificationRouter({
    dailyHandler: async () => {},
    prepareHandler: async () => {},
    ackHandler: async () => {},
  });
  const res = createMockRes();

  await router({ query: { operation: "unknown" } }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.ok, false);
});
