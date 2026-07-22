"use strict";
const router = require("../../../digimon-tamagotchi-frontend/api/arena-v2");
module.exports = (req, res) => {
  req.query = { ...req.query, operation: "mirror-sync" };
  return router(req, res);
};
