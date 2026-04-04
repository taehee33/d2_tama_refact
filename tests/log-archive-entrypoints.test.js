const test = require("node:test");
const assert = require("node:assert/strict");

test("frontend log archive API entrypoints load from the deployed root", async () => {
  const arenaArchiveHandler = require("../digimon-tamagotchi-frontend/api/logs/arena-battles/archive");
  const arenaReplayHandler = require("../digimon-tamagotchi-frontend/api/logs/arena-battles/[archiveId]/replay");
  const jogressArchiveHandler = require("../digimon-tamagotchi-frontend/api/logs/jogress/archive");
  const arenaArchiveMonitoringHandler = require("../digimon-tamagotchi-frontend/api/arena/admin/archive-monitoring");

  assert.equal(typeof arenaArchiveHandler, "function");
  assert.equal(typeof arenaReplayHandler, "function");
  assert.equal(typeof jogressArchiveHandler, "function");
  assert.equal(typeof arenaArchiveMonitoringHandler, "function");
});
