"use strict";

const unifiedArenaAdminHandler = require("../../../digimon-tamagotchi-frontend/api/arena/admin/config");

module.exports = function legacyArenaUsersHandler(req, res) {
  req.query = {
    ...(req.query || {}),
    view: "user-directory",
  };

  return unifiedArenaAdminHandler(req, res);
};
