"use strict";

const { verifyRequestUser } = require("./auth");
const { allowMethods, parseJsonBody, sendJson } = require("./http");
const { getOperatorAccess } = require("./operatorAccess");
const { MasterDataError } = require("./masterDataDomain");
const { restoreMasterData, saveMasterData } = require("./masterDataService");

function sendMasterDataError(res, error) {
  if (error instanceof MasterDataError || error?.name === "MasterDataError") {
    return sendJson(res, error.status || 400, {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }
  if (error?.status === 401) {
    return sendJson(res, 401, {
      error: {
        code: "MASTER_DATA_AUTH_REQUIRED",
        message: "로그인 인증이 필요하거나 만료되었습니다.",
      },
    });
  }
  if (error?.status === 403) {
    return sendJson(res, 403, {
      error: {
        code: "MASTER_DATA_FORBIDDEN",
        message: "운영자 권한이 없습니다.",
      },
    });
  }
  if (
    Number.isInteger(error?.status) &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return sendJson(res, error.status, {
      error: {
        code: "MASTER_DATA_INVALID_REQUEST",
        message: error.message || "마스터 데이터 요청이 올바르지 않습니다.",
      },
    });
  }
  console.error("[master-data-api]", error);
  return sendJson(res, 500, {
    error: {
      code: "MASTER_DATA_INTERNAL_ERROR",
      message: "마스터 데이터 요청을 처리하지 못했습니다.",
    },
  });
}

function createMasterDataHandler(action, deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;
  const resolveAccess = deps.getOperatorAccess || getOperatorAccess;
  const logger = deps.logger || console;
  const mutate =
    action === "master-data-restore"
      ? deps.restoreMasterData || restoreMasterData
      : deps.saveMasterData || saveMasterData;

  return async function masterDataHandler(req, res) {
    res.setHeader("Cache-Control", "private, no-store");
    if (!allowMethods(req, res, ["POST"])) {
      return;
    }
    let decodedToken = null;
    let input = null;
    try {
      decodedToken = await verifyUser(req);
      const access = await resolveAccess(decodedToken, deps);
      if (!access?.isOperator) {
        const error = new Error("운영자 권한이 없습니다.");
        error.status = 403;
        throw error;
      }
      input = await parseJsonBody(req);
      const result = await mutate({ decodedToken, input, deps });
      logger.info?.("[master-data-api]", {
        action,
        requestId:
          typeof input?.requestId === "string" ? input.requestId.slice(0, 120) : null,
        actorUid: decodedToken.uid,
        result: "success",
        revisionAfter: result?.revisionAfter ?? null,
        snapshotId: result?.snapshotId ?? null,
        changeCount: Number(result?.changeSummary?.totalCount || 0),
      });
      sendJson(res, 200, { result });
    } catch (error) {
      logger.warn?.("[master-data-api]", {
        action,
        requestId:
          typeof input?.requestId === "string" ? input.requestId.slice(0, 120) : null,
        actorUid: decodedToken?.uid || null,
        result: "error",
        code: error?.code || (error?.status === 401 ? "MASTER_DATA_AUTH_REQUIRED" : "MASTER_DATA_INTERNAL_ERROR"),
        status: Number(error?.status || 500),
      });
      sendMasterDataError(res, error);
    }
  };
}

module.exports = {
  createMasterDataHandler,
  sendMasterDataError,
};
