"use strict";

const { runArchiveJobs, runMirrorJobs } = require("./arenaJobs");
const { allowMethods, getBearerToken, handleApiError, sendJson } = require("./http");

function assertCronSecret(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected || getBearerToken(req) !== expected) {
    const error = new Error("Cron 인증에 실패했습니다.");
    error.status = 401;
    throw error;
  }
}

function createArenaJobHandler(kind, deps = {}) {
  const worker = kind === "mirror" ? runMirrorJobs : runArchiveJobs;
  return async function arenaJobHandler(req, res) {
    if (!allowMethods(req, res, ["GET"])) return;
    try {
      (deps.assertCronSecret || assertCronSecret)(req);
      sendJson(res, 200, await worker({ deps }));
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

module.exports = { assertCronSecret, createArenaJobHandler };
