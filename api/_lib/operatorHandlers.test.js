const test = require("node:test");
const assert = require("node:assert/strict");

const { createOperatorStatusHandler } = require("../../digimon-tamagotchi-frontend/api/_lib/operatorHandlers");

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
