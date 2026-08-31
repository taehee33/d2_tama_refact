"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createCareMistakeV2Handler } = require("./careMistakeV2Handlers");

function createResponse() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function createRequest(body, query = { action: "care-mistake-v2" }) {
  return { method: "POST", body, query, headers: {} };
}

test("delete_slot은 인증된 사용자의 자기 UID만 서비스에 전달한다", async () => {
  const calls = [];
  const handler = createCareMistakeV2Handler({
    verifyRequestUser: async () => ({ uid: "alice" }),
    deleteSlot: async (input) => {
      calls.push(input);
      return { status: "complete", operationId: "delete-a", idempotent: false };
    },
  });
  const response = createResponse();
  await handler(createRequest({
    action: "delete_slot",
    slotId: 4,
    slotInstanceId: "slot-life-a",
    expectedRevision: 7,
  }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].uid, "alice");
  assert.equal(calls[0].slotId, 4);
});

test("일반 사용자 action의 targetUid 주입은 서비스 호출 전에 거부한다", async () => {
  let called = false;
  const handler = createCareMistakeV2Handler({
    verifyRequestUser: async () => ({ uid: "alice" }),
    deleteSlot: async () => { called = true; },
  });
  const response = createResponse();
  await handler(createRequest({
    action: "delete_slot",
    targetUid: "bob",
    slotId: 4,
    slotInstanceId: "slot-life-a",
    expectedRevision: 7,
  }), response);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.code, "TARGET_UID_NOT_ALLOWED");
  assert.equal(called, false);
});

test("migrate는 operator 확인 뒤 targetUid 슬롯만 처리한다", async () => {
  const calls = [];
  const deniedHandler = createCareMistakeV2Handler({
    verifyRequestUser: async () => ({ uid: "alice" }),
    assertOperator: async () => {
      const error = new Error("운영자 권한이 없습니다.");
      error.status = 403;
      throw error;
    },
    migrate: async () => { calls.push("denied"); },
  });
  const deniedResponse = createResponse();
  await deniedHandler(createRequest({
    action: "migrate",
    targetUid: "bob",
    slotId: 4,
    expectedRevision: 7,
  }), deniedResponse);
  assert.equal(deniedResponse.statusCode, 403);
  assert.equal(calls.length, 0);

  const allowedHandler = createCareMistakeV2Handler({
    verifyRequestUser: async () => ({ uid: "operator-a" }),
    assertOperator: async () => {},
    migrate: async (input) => {
      calls.push(input);
      return { revision: 8 };
    },
  });
  const allowedResponse = createResponse();
  await allowedHandler(createRequest({
    action: "migrate",
    targetUid: "bob",
    slotId: 4,
    expectedRevision: 7,
  }), allowedResponse);
  assert.equal(allowedResponse.statusCode, 200);
  assert.equal(calls[0].uid, "bob");
});

test("active deletion lease는 202 상태를 그대로 노출한다", async () => {
  const handler = createCareMistakeV2Handler({
    verifyRequestUser: async () => ({ uid: "alice" }),
    deleteSlot: async () => ({
      status: "in_progress",
      operationId: "delete-a",
      retryAfterMs: 1000,
    }),
  });
  const response = createResponse();
  await handler(createRequest({
    action: "delete_slot",
    slotId: 4,
    slotInstanceId: "slot-life-a",
    expectedRevision: 7,
  }), response);
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.status, "in_progress");
});

for (const action of ["baseline_override", "linked_head_repair"]) {
  test(`일반 사용자는 ${action} action으로 권한 상승할 수 없다`, async () => {
    let repairCalled = false;
    const handler = createCareMistakeV2Handler({
      verifyRequestUser: async () => ({ uid: "alice" }),
      assertOperator: async () => {
        const error = new Error("운영자 권한이 없습니다.");
        error.status = 403;
        throw error;
      },
      repair: async () => { repairCalled = true; },
    });
    const response = createResponse();
    await handler(createRequest({
      action,
      targetUid: "alice",
      slotId: 4,
      repairId: "repair-a",
      expectedRevision: 7,
      expectedReceiptId: "receipt-a",
      reason: "test",
    }), response);
    assert.equal(response.statusCode, 403);
    assert.equal(repairCalled, false);
  });
}
