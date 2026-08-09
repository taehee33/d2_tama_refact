"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createMasterDataHandler } = require("./masterDataHandlers");
const { MasterDataError } = require("./masterDataDomain");

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

const silentLogger = {
  info() {},
  warn() {},
};

test("마스터 데이터 handler는 운영자가 아니면 mutation 전에 403을 반환한다", async () => {
  let mutationCalled = false;
  const handler = createMasterDataHandler("master-data-save", {
    verifyRequestUser: async () => ({ uid: "regular-user" }),
    getOperatorAccess: async () => ({ isOperator: false }),
    saveMasterData: async () => {
      mutationCalled = true;
    },
    logger: silentLogger,
  });
  const res = createMockRes();

  await handler({ method: "POST", headers: {}, body: {} }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, "MASTER_DATA_FORBIDDEN");
  assert.equal(res.headers["Cache-Control"], "private, no-store");
  assert.equal(mutationCalled, false);
});

test("마스터 데이터 handler는 검증된 운영자와 body만 service에 전달한다", async () => {
  let received = null;
  const handler = createMasterDataHandler("master-data-save", {
    verifyRequestUser: async () => ({ uid: "operator-1", name: "운영자" }),
    getOperatorAccess: async () => ({ isOperator: true }),
    saveMasterData: async (value) => {
      received = value;
      return { revisionAfter: 2, snapshotId: "snapshot-2" };
    },
    logger: silentLogger,
  });
  const res = createMockRes();
  const body = { requestId: "request-1" };

  await handler({ method: "POST", headers: {}, body }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(received.decodedToken.uid, "operator-1");
  assert.equal(received.input, body);
  assert.deepEqual(res.body.result, {
    revisionAfter: 2,
    snapshotId: "snapshot-2",
  });
});

test("마스터 데이터 handler는 안정적인 domain error code를 반환한다", async () => {
  const handler = createMasterDataHandler("master-data-restore", {
    verifyRequestUser: async () => ({ uid: "operator-1" }),
    getOperatorAccess: async () => ({ isOperator: true }),
    restoreMasterData: async () => {
      throw new MasterDataError(
        "MASTER_DATA_REVISION_CONFLICT",
        "revision 충돌",
        409,
        { currentRevision: 4 }
      );
    },
    logger: silentLogger,
  });
  const res = createMockRes();

  await handler({ method: "POST", headers: {}, body: {} }, res);

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body.error, {
    code: "MASTER_DATA_REVISION_CONFLICT",
    message: "revision 충돌",
    details: { currentRevision: 4 },
  });
});

test("마스터 데이터 handler는 잘못된 JSON을 400으로 반환한다", async () => {
  let mutationCalled = false;
  const handler = createMasterDataHandler("master-data-save", {
    verifyRequestUser: async () => ({ uid: "operator-1" }),
    getOperatorAccess: async () => ({ isOperator: true }),
    saveMasterData: async () => {
      mutationCalled = true;
    },
    logger: silentLogger,
  });
  const res = createMockRes();

  await handler({ method: "POST", headers: {}, body: "{invalid" }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, "MASTER_DATA_INVALID_REQUEST");
  assert.equal(mutationCalled, false);
});

test("마스터 데이터 handler는 POST 외 요청을 거부한다", async () => {
  const handler = createMasterDataHandler("master-data-save", {
    logger: silentLogger,
  });
  const res = createMockRes();

  await handler({ method: "GET", headers: {} }, res);

  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
});
