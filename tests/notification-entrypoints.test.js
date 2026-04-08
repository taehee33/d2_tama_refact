const test = require("node:test");
const assert = require("node:assert/strict");

test("notification API entrypoints load from the deployed root", async () => {
  const rootHandler = require("../api/notifications/daily-digimon-report");
  const frontendHandler = require("../digimon-tamagotchi-frontend/api/notifications/daily-digimon-report");

  assert.equal(typeof rootHandler, "function");
  assert.equal(typeof frontendHandler, "function");
});
