"use strict";

const router = require("../../../digimon-tamagotchi-frontend/api/arena-v2");
module.exports = (req, res) => {
  req.query = { ...req.query, operation: "legacy-archive" };
  return router(req, res);
};
