"use strict";

const {
  createArenaAdminConfigHandler,
  createArenaSeasonEndHandler,
  createArenaSetOperatorHandler,
  createArenaUserDirectoryHandler,
} = require("../../_lib/arenaHandlers");

const arenaAdminConfigHandler = createArenaAdminConfigHandler();
const arenaSeasonEndHandler = createArenaSeasonEndHandler();
const arenaSetOperatorHandler = createArenaSetOperatorHandler();
const arenaUserDirectoryHandler = createArenaUserDirectoryHandler();

module.exports = async function unifiedArenaAdminHandler(req, res) {
  const view = typeof req?.query?.view === "string" ? req.query.view.trim().toLowerCase() : "";
  const action =
    typeof req?.query?.action === "string" ? req.query.action.trim().toLowerCase() : "";

  if (req.method === "GET" && view === "user-directory") {
    return arenaUserDirectoryHandler(req, res);
  }

  if (req.method === "POST" && action === "end-season") {
    return arenaSeasonEndHandler(req, res);
  }

  if (req.method === "POST" && action === "set-operator") {
    return arenaSetOperatorHandler(req, res);
  }

  return arenaAdminConfigHandler(req, res);
};
