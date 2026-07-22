"use strict";

const { verifyRequestUser } = require("./auth");
const { assertArenaClientSchemaVersion } = require("./arenaDomain");
const { ArenaError } = require("./arenaErrors");
const { commitArenaBattle } = require("./arenaBattleService");
const { getArenaFirestore } = require("./arenaTransactions");
const { allowMethods, handleApiError, parseJsonBody, sendJson } = require("./http");

function getClientSchemaVersion(req) {
  return req.headers?.["x-arena-client-schema-version"] ||
    req.headers?.["X-Arena-Client-Schema-Version"] || null;
}

function normalizeBattleHandlerError(error) {
  if (error instanceof ArenaError) return error;
  if (error?.status === 401 || error?.code === "auth/id-token-expired" || error?.code === "auth/argument-error") {
    return new ArenaError("ARENA_AUTH_REQUIRED", "로그인 인증이 필요하거나 만료되었습니다.");
  }
  if (error?.code === 14 || error?.code === "unavailable") {
    return new ArenaError("ARENA_SOURCE_READ_UNAVAILABLE", "아레나 저장소에 연결하지 못했습니다.", null, null, { retryable: true });
  }
  return error;
}

function createArenaBattleHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;
  return async function arenaBattleHandler(req, res) {
    if (!allowMethods(req, res, ["POST"])) return;
    try {
      const decodedToken = await verifyUser(req);
      const db = deps.db || getArenaFirestore();
      const configSnapshot = await db.doc("game_settings/arena_config").get();
      const config = configSnapshot.exists ? configSnapshot.data() || {} : {};
      assertArenaClientSchemaVersion({
        requestVersion: getClientSchemaVersion(req),
        minimumVersion: Number(config.minArenaClientSchemaVersion || 2),
      });
      const input = await parseJsonBody(req);
      const result = await commitArenaBattle({
        uid: decodedToken.uid,
        input,
        deps: { ...deps, db },
      });
      sendJson(res, 200, result);
    } catch (error) {
      handleApiError(res, normalizeBattleHandlerError(error));
    }
  };
}

module.exports = {
  createArenaBattleHandler,
  normalizeBattleHandlerError,
};
