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

test("operator status handler returns operator flags for news editor", async () => {
  const previousArenaUids = process.env.ARENA_ADMIN_UIDS;
  const previousArenaEmails = process.env.ARENA_ADMIN_EMAILS;
  const previousNewsUids = process.env.NEWS_EDITOR_UIDS;
  const previousNewsEmails = process.env.NEWS_EDITOR_EMAILS;
  const previousOperatorUids = process.env.OPERATOR_UIDS;
  const previousOperatorEmails = process.env.OPERATOR_EMAILS;

  process.env.ARENA_ADMIN_UIDS = "arena-admin";
  process.env.ARENA_ADMIN_EMAILS = "arena@example.com";
  process.env.NEWS_EDITOR_UIDS = "news-editor";
  process.env.NEWS_EDITOR_EMAILS = "news@example.com";
  process.env.OPERATOR_UIDS = "";
  process.env.OPERATOR_EMAILS = "";

  const handler = createOperatorStatusHandler({
    verifyRequestUser: async () => ({ uid: "news-editor", email: "news@example.com" }),
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

  process.env.ARENA_ADMIN_UIDS = previousArenaUids;
  process.env.ARENA_ADMIN_EMAILS = previousArenaEmails;
  process.env.NEWS_EDITOR_UIDS = previousNewsUids;
  process.env.NEWS_EDITOR_EMAILS = previousNewsEmails;
  process.env.OPERATOR_UIDS = previousOperatorUids;
  process.env.OPERATOR_EMAILS = previousOperatorEmails;
});
