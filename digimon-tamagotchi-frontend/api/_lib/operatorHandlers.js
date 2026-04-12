"use strict";

const { verifyRequestUser } = require("./auth");
const { allowMethods, handleApiError, sendJson } = require("./http");
const { getOperatorAccess } = require("./operatorAccess");

function createOperatorStatusHandler(deps = {}) {
  const verifyUser = deps.verifyRequestUser || verifyRequestUser;

  return async function operatorStatusHandler(req, res) {
    if (!allowMethods(req, res, ["GET"])) {
      return;
    }

    try {
      const decodedToken = await verifyUser(req);
      const access = await getOperatorAccess(decodedToken, deps);

      sendJson(res, 200, {
        viewer: access,
      });
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

module.exports = {
  createOperatorStatusHandler,
};
