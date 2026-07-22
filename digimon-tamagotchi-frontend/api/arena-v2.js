"use strict";

const { createArenaBattleHandler } = require("./_lib/arenaBattleHandlers");
const { createArenaGhostCollectionHandler, createArenaGhostItemHandler } = require("./_lib/arenaGhostHandlers");
const { createArenaJobHandler } = require("./_lib/arenaJobHandlers");
const { createArenaBattleCompleteHandler } = require("./_lib/arenaHandlers");
const { createArenaBattleArchivePostHandler } = require("./_lib/logArchiveHandlers");
const { sendJson } = require("./_lib/http");

const handlers = Object.freeze({
  "archive-sync": createArenaJobHandler("archive"),
  battle: createArenaBattleHandler(),
  "ghost-collection": createArenaGhostCollectionHandler(),
  "ghost-item": createArenaGhostItemHandler(),
  "legacy-archive": createArenaBattleArchivePostHandler(),
  "legacy-complete": createArenaBattleCompleteHandler(),
  "mirror-sync": createArenaJobHandler("mirror"),
});

module.exports = async function arenaV2Router(req, res) {
  const operation = typeof req.query?.operation === "string" ? req.query.operation : "";
  const handler = handlers[operation];
  if (!handler) {
    return sendJson(res, 404, { error: "아레나 API 경로를 찾을 수 없습니다." });
  }
  return handler(req, res);
};
