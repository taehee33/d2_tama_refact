"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createJogressHandler } = require("./jogressHandlers");

function createResponse() {
  return {
    headers: {},
    statusCode: 0,
    payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(payload) { this.payload = payload; },
  };
}

test("로컬 조그레스 handler는 인증 UID와 두 슬롯 CAS 계약만 service에 전달한다", async () => {
  let received = null;
  const handler = createJogressHandler({
    verifyRequestUser: async () => ({ uid: "user-1" }),
    completeLocalJogress: async (input) => {
      received = input;
      return { slotOutcome: { selectedDigimon: "Chaosmon" } };
    },
  });
  const response = createResponse();
  await handler({
    method: "POST",
    headers: {},
    body: {
      action: "complete-local",
      requestId: "request-1",
      currentSlotId: 1,
      partnerSlotId: 2,
      expectedCurrentRevision: 4,
      expectedPartnerRevision: 7,
      targetId: "클라이언트가 결정하면 안 되는 값",
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(received.uid, "user-1");
  assert.equal(received.requestId, "request-1");
  assert.equal(received.currentSlotId, 1);
  assert.equal(received.partnerSlotId, 2);
  assert.equal(received.expectedCurrentRevision, 4);
  assert.equal(received.expectedPartnerRevision, 7);
  assert.equal(received.targetId, undefined);
  assert.equal(response.payload.slotOutcome.selectedDigimon, "Chaosmon");
});
