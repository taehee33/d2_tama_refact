const test = require("node:test");
const assert = require("node:assert/strict");

const { createOperatorStatusHandler } = require("../../digimon-tamagotchi-frontend/api/_lib/operatorHandlers");
const operatorStatusEntrypoint = require("../../digimon-tamagotchi-frontend/api/operator/status");

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(payload) {
      if (payload !== undefined) {
        this.body = typeof payload === "string" ? JSON.parse(payload) : payload;
      }
    },
  };
}

test("operator status handler returns operator flags for firestore operator", async () => {
  const handler = createOperatorStatusHandler({
    verifyRequestUser: async () => ({ uid: "news-editor", email: "news@example.com" }),
    isOperatorIdentity: async () => true,
  });

  const res = createMockRes();
  await handler(
    {
      method: "GET",
      headers: { authorization: "Bearer test-token" },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.viewer, {
    isOperator: true,
    canAccessUserDirectory: true,
  });
});

test("operator status 진입점은 master data action을 인증 handler로 라우팅한다", async () => {
  for (const action of ["master-data-save", "master-data-restore"]) {
    const res = createMockRes();
    await operatorStatusEntrypoint(
      {
        method: "POST",
        query: { action },
        headers: {},
        body: {},
      },
      res
    );

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, "MASTER_DATA_AUTH_REQUIRED");
    assert.equal(res.headers["Cache-Control"], "private, no-store");
  }
});
