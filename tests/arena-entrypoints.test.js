const test = require("node:test");
const assert = require("node:assert/strict");

test("frontend arena API entrypoints load from the deployed root", async () => {
  const adminConfigHandler = require("../digimon-tamagotchi-frontend/api/arena/admin/config");
  const endSeasonHandler = require("../digimon-tamagotchi-frontend/api/arena/admin/end-season");
  const archiveDeleteHandler = require("../digimon-tamagotchi-frontend/api/arena/admin/archives/[archiveId]");
  const battleCompleteHandler = require("../digimon-tamagotchi-frontend/api/arena/battles/complete");

  assert.equal(typeof adminConfigHandler, "function");
  assert.equal(typeof endSeasonHandler, "function");
  assert.equal(typeof archiveDeleteHandler, "function");
  assert.equal(typeof battleCompleteHandler, "function");
});
