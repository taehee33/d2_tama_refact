const test = require("node:test");
const assert = require("node:assert/strict");

test("frontend arena API entrypoints load from the deployed root", async () => {
  const adminConfigHandler = require("../digimon-tamagotchi-frontend/api/arena/admin/config");
  const archiveDeleteHandler = require("../digimon-tamagotchi-frontend/api/arena/admin/archives/[archiveId]");
  const arenaV2Router = require("../digimon-tamagotchi-frontend/api/arena-v2");

  assert.equal(typeof adminConfigHandler, "function");
  assert.equal(typeof archiveDeleteHandler, "function");
  assert.equal(typeof arenaV2Router, "function");
});
