"use strict";

const { assertArenaAdmin, verifyRequestUser } = require("./auth");
const { allowMethods, handleApiError, parseJsonBody, sendError, sendJson } = require("./http");
const {
  CareMistakeV2Error,
  commitCareMistakeV2Command,
  getCareMistakeV2Integrity,
  migrateCareMistakeV2Slot,
  nativeInitCareMistakeV2Slot,
  repairCareMistakeV2,
} = require("./careMistakeV2Service");

function createCareMistakeV2Handler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;
  return async function careMistakeV2Handler(req, res) {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Vary", "Authorization");
    if (!allowMethods(req, res, ["GET", "POST"])) return;

    try {
      const viewer = await verifyUser(req);
      if (req.method === "GET") {
        const result = await (deps.getIntegrity || getCareMistakeV2Integrity)({
          uid: viewer.uid,
          slotId: req.query?.slotId,
          deps,
        });
        sendJson(res, 200, result);
        return;
      }

      const input = await parseJsonBody(req);
      if (input.action === "command") {
        const result = await (deps.commitCommand || commitCareMistakeV2Command)({
          uid: viewer.uid,
          slotId: input.slotId,
          command: input.command,
          deps,
        });
        sendJson(res, 200, result);
        return;
      }
      if (input.action === "native_init") {
        const result = await (deps.nativeInit || nativeInitCareMistakeV2Slot)({
          uid: viewer.uid,
          slotId: input.slotId,
          commandId: input.commandId,
          slotData: input.slotData,
          deps,
        });
        sendJson(res, result.idempotent ? 200 : 201, result);
        return;
      }
      if (input.action === "migrate") {
        const result = await (deps.migrate || migrateCareMistakeV2Slot)({
          uid: viewer.uid,
          slotId: input.slotId,
          expectedRevision: input.expectedRevision,
          deps,
        });
        sendJson(res, 200, result);
        return;
      }
      if (input.action === "baseline_override" || input.action === "linked_head_repair") {
        await (deps.assertOperator || assertArenaAdmin)(viewer, deps);
        const result = await (deps.repair || repairCareMistakeV2)({
          uid: input.targetUid,
          slotId: input.slotId,
          repairType: input.action,
          repairId: input.repairId,
          expectedRevision: input.expectedRevision,
          expectedReceiptId: input.expectedReceiptId,
          baseline: input.baseline,
          reason: input.reason,
          operator: viewer,
          deps,
        });
        sendJson(res, 200, result);
        return;
      }
      throw new CareMistakeV2Error("INVALID_CARE_ACTION", "지원하지 않는 작업입니다.", 400);
    } catch (error) {
      if (error instanceof CareMistakeV2Error) {
        sendError(res, error.status, error.code, error.message, error.details ? { details: error.details } : {});
        return;
      }
      handleApiError(res, error);
    }
  };
}

module.exports = { createCareMistakeV2Handler };
