"use strict";

const { verifyRequestUser } = require("./auth");
const { JogressError } = require("./jogressDomain");
const {
  cancelJogressRoom,
  completeJogressRoom,
  createJogressRoom,
  joinJogressRoom,
  listJogressRooms,
} = require("./jogressService");
const { allowMethods, handleApiError, parseJsonBody, sendJson } = require("./http");

function displayNameFor(user) {
  return user?.name || user?.displayName || user?.email?.split("@")[0] || null;
}

function requireString(value, message) {
  if (typeof value !== "string" || !value.trim()) {
    throw new JogressError("JOGRESS_PAIR_INVALID", message, null, 400);
  }
  return value.trim();
}

function createJogressHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;
  return async function jogressHandler(req, res) {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Vary", "Authorization");
    if (!allowMethods(req, res, ["GET", "POST", "DELETE"])) return;

    try {
      const user = await verifyUser(req);
      if (req.method === "GET") {
        const result = await (deps.listJogressRooms || listJogressRooms)({
          uid: user.uid,
          scope: req.query?.scope || "waiting",
          deps,
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === "DELETE") {
        const result = await (deps.cancelJogressRoom || cancelJogressRoom)({
          uid: user.uid,
          roomId: requireString(req.query?.roomId, "취소할 방 ID가 필요합니다."),
          deps,
        });
        sendJson(res, 200, result);
        return;
      }

      const input = await parseJsonBody(req);
      const common = { uid: user.uid, displayName: displayNameFor(user), deps };
      let result;
      if (input.action === "create") {
        result = await (deps.createJogressRoom || createJogressRoom)({
          ...common,
          slotId: input.slotId,
          expectedRevision: input.expectedRevision,
        });
        sendJson(res, result.alreadyRegistered ? 200 : 201, result);
        return;
      }
      if (input.action === "join") {
        result = await (deps.joinJogressRoom || joinJogressRoom)({
          ...common,
          roomId: requireString(input.roomId, "참가할 방 ID가 필요합니다."),
          guestSlotId: input.guestSlotId,
          expectedRevision: input.expectedRevision,
        });
        sendJson(res, 200, result);
        return;
      }
      if (input.action === "complete") {
        result = await (deps.completeJogressRoom || completeJogressRoom)({
          uid: user.uid,
          roomId: requireString(input.roomId, "완료할 방 ID가 필요합니다."),
          expectedRevision: input.expectedRevision,
          deps,
        });
        sendJson(res, 200, result);
        return;
      }
      throw new JogressError("JOGRESS_PAIR_INVALID", "지원하지 않는 조그레스 작업입니다.", null, 400);
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

module.exports = { createJogressHandler };
