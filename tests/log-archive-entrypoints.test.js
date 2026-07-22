const test = require("node:test");
const assert = require("node:assert/strict");

test("frontend log archive API entrypoints load from the deployed root", async () => {
  const arenaV2Router = require("../digimon-tamagotchi-frontend/api/arena-v2");
  const arenaReplayHandler = require("../digimon-tamagotchi-frontend/api/logs/arena-battles/[archiveId]/replay");
  const jogressArchiveHandler = require("../digimon-tamagotchi-frontend/api/logs/jogress/archive");

  assert.equal(typeof arenaV2Router, "function");
  assert.equal(typeof arenaReplayHandler, "function");
  assert.equal(typeof jogressArchiveHandler, "function");
});
