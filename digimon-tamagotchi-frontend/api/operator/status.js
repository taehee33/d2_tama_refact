"use strict";

const { createAblyTokenHandler } = require("../_lib/ablyAuth");
const { createOperatorStatusHandler } = require("../_lib/operatorHandlers");

const ablyTokenHandler = createAblyTokenHandler();
const operatorStatusHandler = createOperatorStatusHandler();

module.exports = function identityServiceHandler(req, res) {
  if (req.method === "POST" && req.query?.action === "ably-token") {
    return ablyTokenHandler(req, res);
  }

  return operatorStatusHandler(req, res);
};
