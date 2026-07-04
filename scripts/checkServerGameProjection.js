"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const generatedBundlePath = "digimon-tamagotchi-frontend/api/_generated/gameProjection.cjs";

function commandName(command) {
  return process.platform === "win32" ? `${command}.cmd` : command;
}

function run(command, args, options = {}) {
  const result = spawnSync(commandName(command), args, {
    cwd: rootDir,
    encoding: "utf8",
    ...options,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return result;
}

const buildResult = run("npm", ["run", "build:server-projection"]);
if (buildResult.status !== 0) {
  process.exit(buildResult.status || 1);
}

const diffResult = run("git", ["diff", "--exit-code", "--", generatedBundlePath]);
if (diffResult.status !== 0) {
  console.error("");
  console.error("api/_generated/gameProjection.cjs is out of date.");
  console.error("Run npm run build:server-projection and commit the updated bundle.");
  process.exit(diffResult.status || 1);
}

console.log("서버 게임 projection bundle 최신 상태 확인 완료");
