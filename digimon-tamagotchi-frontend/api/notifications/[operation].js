"use strict";

const { createDailyDigimonReportHandler } = require("../_lib/notificationReports");
const {
  createUrgentCareAckHandler,
  createUrgentCarePrepareHandler,
} = require("../_lib/urgentCareNotifications");
const {
  createNotificationReadHandler,
  createNotificationStatusHandler,
  createPushSubscribeHandler,
  createPushUnsubscribeHandler,
  createTestNotificationHandler,
} = require("../_lib/userNotifications");

function normalizeOperation(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate.trim() : "";
}

function sendNotFound(res) {
  const payload = { ok: false, error: "지원하지 않는 알림 API 경로입니다." };
  if (typeof res?.status === "function" && typeof res?.json === "function") {
    res.status(404).json(payload);
    return;
  }
  res.statusCode = 404;
  res.setHeader?.("Content-Type", "application/json; charset=utf-8");
  res.end?.(JSON.stringify(payload));
}

function createNotificationRouter(deps = {}) {
  const handlers = {
    daily: deps.dailyHandler || createDailyDigimonReportHandler(),
    prepare: deps.prepareHandler || createUrgentCarePrepareHandler(),
    ack: deps.ackHandler || createUrgentCareAckHandler(),
    status: deps.statusHandler || createNotificationStatusHandler(),
    test: deps.testHandler || createTestNotificationHandler(),
    read: deps.readHandler || createNotificationReadHandler(),
    "push-subscribe": deps.pushSubscribeHandler || createPushSubscribeHandler(),
    "push-unsubscribe": deps.pushUnsubscribeHandler || createPushUnsubscribeHandler(),
  };

  return async function notificationRouter(req, res) {
    const operation = normalizeOperation(req?.query?.operation);
    const handler = handlers[operation];
    if (!handler) {
      sendNotFound(res);
      return;
    }
    return handler(req, res);
  };
}

const handler = createNotificationRouter();

module.exports = handler;
module.exports.createNotificationRouter = createNotificationRouter;
module.exports.normalizeOperation = normalizeOperation;
