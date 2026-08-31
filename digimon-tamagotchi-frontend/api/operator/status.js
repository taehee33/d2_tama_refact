"use strict";

const { createAblyTokenHandler } = require("../_lib/ablyAuth");
const { createMasterDataHandler } = require("../_lib/masterDataHandlers");
const { createOperatorStatusHandler } = require("../_lib/operatorHandlers");
const { createCareMistakeV2Handler } = require("../_lib/careMistakeV2Handlers");

const ablyTokenHandler = createAblyTokenHandler();
const masterDataSaveHandler = createMasterDataHandler("master-data-save");
const masterDataRestoreHandler = createMasterDataHandler("master-data-restore");
const operatorStatusHandler = createOperatorStatusHandler();
const careMistakeV2Handler = createCareMistakeV2Handler();

module.exports = function identityServiceHandler(req, res) {
  if (req.method === "POST" && req.query?.action === "ably-token") {
    return ablyTokenHandler(req, res);
  }

  if (req.query?.action === "master-data-save") {
    return masterDataSaveHandler(req, res);
  }

  if (req.query?.action === "master-data-restore") {
    return masterDataRestoreHandler(req, res);
  }

  if (req.query?.action === "care-mistake-v2") {
    return careMistakeV2Handler(req, res);
  }

  return operatorStatusHandler(req, res);
};
