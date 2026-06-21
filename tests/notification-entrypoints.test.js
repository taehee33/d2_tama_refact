const test = require("node:test");
const assert = require("node:assert/strict");

test("notification API entrypoints load from the deployed root", async () => {
  const rootHandler = require("../api/notifications/daily-digimon-report");
  const frontendHandler = require("../digimon-tamagotchi-frontend/api/notifications/daily-digimon-report");
  const urgentPrepare = require("../api/notifications/urgent-digimon-care/prepare");
  const urgentAck = require("../api/notifications/urgent-digimon-care/ack");

  assert.equal(typeof rootHandler, "function");
  assert.equal(typeof frontendHandler, "function");
  assert.equal(typeof urgentPrepare, "function");
  assert.equal(typeof urgentAck, "function");
});
