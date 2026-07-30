"use strict";

const { verifyRequestUser } = require("./auth");
const { ArenaError, toArenaErrorPayload } = require("./arenaErrors");
const { allowMethods, parseJsonBody, sendJson } = require("./http");
const { createRealtimeBattle, commandRealtimeLobby } = require("./realtimeArenaLobbyService");
const { commandRealtimeRound, viewerFor } = require("./realtimeArenaRoundService");
const {
  REALTIME_ARENA_CLIENT_SCHEMA_VERSION,
  assertOnlyKeys,
  normalizeBattleId,
  normalizeRequestId,
  serializeBattle,
} = require("./realtimeArenaDomain");

const LOBBY_COMMANDS = new Set(["join", "set-ready", "leave", "cancel"]);
const ACTIVE_COMMANDS = new Set(["restore", "submit-action", "resolve-timeout", "forfeit"]);

function setPrivateHeaders(res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization");
}

function assertClientVersion(req) {
  const value = req.headers?.["x-arena-client-schema-version"] || req.headers?.["X-Arena-Client-Schema-Version"];
  if (Number(value) < REALTIME_ARENA_CLIENT_SCHEMA_VERSION) {
    throw new ArenaError("ARENA_CLIENT_UPGRADE_REQUIRED", "실시간 아레나를 사용하려면 앱을 새로고침해 주세요.", { minimumVersion: REALTIME_ARENA_CLIENT_SCHEMA_VERSION });
  }
}

function assertServerMode(uid, command = "create") {
  const mode = process.env.REALTIME_ARENA_MODE || "off";
  if (mode === "off") throw new ArenaError("ARENA_MAINTENANCE", "실시간 아레나가 현재 비활성화되어 있습니다.", { retryAfterSeconds: 60 }, null, { retryable: true });
  if (mode === "private") {
    const allowlist = new Set((process.env.REALTIME_ARENA_PRIVATE_UIDS || "").split(",").map((value) => value.trim()).filter(Boolean));
    if (!allowlist.has(uid)) throw new ArenaError("ARENA_REALTIME_FORBIDDEN", "비공개 실시간 아레나 테스트 참가자가 아닙니다.");
  }
  if (mode === "drain" && (command === "create" || command === "join")) {
    throw new ArenaError("ARENA_MAINTENANCE", "실시간 아레나는 기존 경기만 마무리할 수 있습니다.", { retryAfterSeconds: 60 }, null, { retryable: true });
  }
  if (!["private", "drain", "active"].includes(mode)) throw new ArenaError("ARENA_MAINTENANCE", "실시간 아레나 서버 설정이 올바르지 않습니다.");
}

function sendSafeError(res, error, context) {
  const normalized = error instanceof ArenaError
    ? error
    : error?.status === 401
      ? new ArenaError("ARENA_AUTH_REQUIRED", "로그인 인증이 필요하거나 만료되었습니다.")
      : new ArenaError("ARENA_INTERNAL_ERROR", "실시간 아레나 요청을 처리하지 못했습니다.");
  if (!(error instanceof ArenaError)) console.error("[realtime-arena]", { battleId: context.battleId || null, round: context.round || null, stateVersion: context.stateVersion || null, errorCode: normalized.code });
  sendJson(res, normalized.status, toArenaErrorPayload(normalized));
}

function buildResponse(result) {
  return {
    battle: serializeBattle(result.battle),
    viewer: result.secret ? viewerFor(result.secret, result.role, result.battle.round) : { role: result.role, hasSubmitted: false },
    command: { status: result.status || (result.replayed ? "replayed" : "accepted"), resolvedRound: result.resolvedRound ? serializeBattle({ resolvedRounds: [result.resolvedRound] }).resolvedRounds[0] : null },
  };
}

function createRealtimeBattleCollectionHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;
  return async function handler(req, res) {
    setPrivateHeaders(res);
    if (!allowMethods(req, res, ["POST"])) return;
    try {
      assertClientVersion(req);
      const user = await verifyUser(req);
      assertServerMode(user.uid, "create");
      const input = await parseJsonBody(req);
      assertOnlyKeys(input, ["requestId", "slotId"]);
      normalizeRequestId(input.requestId);
      const result = await createRealtimeBattle({ uid: user.uid, slotId: input.slotId, requestId: input.requestId, deps });
      sendJson(res, result.replayed ? 200 : 201, buildResponse({ ...result, status: result.replayed ? "replayed" : "accepted" }));
    } catch (error) {
      sendSafeError(res, error, {});
    }
  };
}

function createRealtimeBattleCommandHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;
  return async function handler(req, res) {
    setPrivateHeaders(res);
    if (!allowMethods(req, res, ["POST"])) return;
    const context = { battleId: null, round: null, stateVersion: null };
    try {
      assertClientVersion(req);
      const user = await verifyUser(req);
      const battleId = normalizeBattleId(req.query?.battleId);
      context.battleId = battleId;
      const input = await parseJsonBody(req);
      const command = typeof input.command === "string" ? input.command : "";
      if (!LOBBY_COMMANDS.has(command) && !ACTIVE_COMMANDS.has(command)) throw new ArenaError("ARENA_INVALID_REQUEST", "지원하지 않는 실시간 아레나 명령입니다.");
      const allowedKeysByCommand = {
        join: ["command", "requestId", "slotId"],
        "set-ready": ["command", "requestId", "ready"],
        leave: ["command", "requestId"],
        cancel: ["command", "requestId"],
        restore: ["command", "requestId"],
        "resolve-timeout": ["command", "requestId"],
        forfeit: ["command", "requestId"],
        "submit-action": ["command", "requestId", "round", "expectedStateVersion", "action"],
      };
      assertOnlyKeys(input, allowedKeysByCommand[command]);
      normalizeRequestId(input.requestId);
      context.round = input.round ?? null;
      context.stateVersion = input.expectedStateVersion ?? null;
      assertServerMode(user.uid, command);
      const result = LOBBY_COMMANDS.has(command)
        ? await commandRealtimeLobby({ uid: user.uid, battleId, command, input, deps })
        : await commandRealtimeRound({ uid: user.uid, battleId, command, input, deps });
      sendJson(res, 200, buildResponse(result));
    } catch (error) {
      sendSafeError(res, error, context);
    }
  };
}

module.exports = {
  assertServerMode,
  createRealtimeBattleCollectionHandler,
  createRealtimeBattleCommandHandler,
  setPrivateHeaders,
};
