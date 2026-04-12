"use strict";

const unifiedArenaAdminHandler = require("../../../digimon-tamagotchi-frontend/api/arena/admin/config");

module.exports = function legacyArenaSeasonEndHandler(req, res) {
  req.query = {
    ...(req.query || {}),
    action: "end-season",
  };

  return unifiedArenaAdminHandler(req, res);
};
