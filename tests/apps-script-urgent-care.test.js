"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scriptSource = fs.readFileSync(
  path.resolve(__dirname, "../scripts/apps-script/urgentDigimonCare.gs"),
  "utf8"
);

function response(status, payload = {}) {
  return {
    getResponseCode: () => status,
    getContentText: () => JSON.stringify(payload),
  };
}

function createContext(fetchImplementation) {
  const logs = [];
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => ({
          DIGIMON_URGENT_PREPARE_API_URL: "https://app.test/prepare",
          DIGIMON_URGENT_ACK_API_URL: "https://app.test/ack",
          NOTIFICATION_API_SECRET: "secret",
        })[key],
      }),
    },
    UrlFetchApp: { fetch: fetchImplementation },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
    },
    ScriptApp: {
      getProjectTriggers: () => [],
      deleteTrigger: () => {},
      newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => {} }) }) }),
    },
    Logger: { log: (message) => logs.push(message) },
    JSON,
    Error,
  };
  vm.createContext(context);
  vm.runInContext(scriptSource, context);
  return { context, logs };
}

test("Apps Script는 Discord 성공 delivery만 ack한다", () => {
  const calls = [];
  const { context } = createContext((url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/prepare")) {
      return response(200, {
        ok: true,
        summary: { projectionUnavailable: 1, frozenSlots: 2 },
        reports: [{
          uid: "user-1",
          webhookUrl: "https://discord.test/webhook",
          messageContent: "긴급",
          deliveryIds: ["delivery-1"],
        }],
      });
    }
    if (url.includes("discord.test")) return response(204);
    return response(200, { ok: true, acknowledged: 1 });
  });

  const result = context.notifyUrgentDigimonCare();
  assert.equal(result.acknowledged, 1);
  const ackCall = calls.find((call) => call.url.endsWith("/ack"));
  assert.deepEqual(JSON.parse(ackCall.options.payload), { deliveryIds: ["delivery-1"] });
  assert.equal(ackCall.options.headers["x-d2-scheduler-secret"], "secret");
});

test("Discord 실패 delivery는 ack하지 않아 다음 cron 재전송 대상으로 남긴다", () => {
  const calls = [];
  const { context } = createContext((url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/prepare")) {
      return response(200, {
        ok: true,
        summary: {},
        reports: [{
          webhookUrl: "https://discord.test/webhook",
          messageContent: "긴급",
          deliveryIds: ["delivery-1"],
        }],
      });
    }
    return response(500, {});
  });

  const result = context.notifyUrgentDigimonCare();
  assert.equal(result.failedReports, 1);
  assert.equal(calls.some((call) => call.url.endsWith("/ack")), false);
});

test("dryRun은 prepare만 호출하고 webhook을 결과에서 제거한다", () => {
  const calls = [];
  const { context } = createContext((url, options) => {
    calls.push({ url, options });
    return response(200, {
      ok: true,
      generatedAt: "지금",
      summary: { newDeliveries: 1 },
      reports: [{
        uid: "user-1",
        tamerName: "한솔",
        webhookUrl: "https://discord.test/webhook",
        slotIssues: [{ slotId: "slot1", issues: [{ key: "injury" }] }],
        messageContent: "긴급",
      }],
    });
  });

  const result = context.dryRunUrgentDigimonCare();
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].options.payload).dryRun, true);
  assert.equal("webhookUrl" in result.reports[0], false);
});
