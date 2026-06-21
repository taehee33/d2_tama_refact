"use strict";

const path = require("node:path");
const webpack = require(path.resolve(
  __dirname,
  "../digimon-tamagotchi-frontend/node_modules/webpack"
));

const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "digimon-tamagotchi-frontend");

const compiler = webpack({
  mode: "production",
  target: "node18",
  context: frontendDir,
  entry: path.join(frontendDir, "src/server/gameProjectionEntry.js"),
  output: {
    path: path.join(frontendDir, "api/_generated"),
    filename: "gameProjection.cjs",
    library: { type: "commonjs2" },
    clean: false,
  },
  optimization: {
    minimize: false,
  },
  performance: {
    hints: false,
  },
  stats: "errors-warnings",
});

compiler.run((error, stats) => {
  compiler.close(() => {});
  if (error) {
    console.error(error);
    process.exitCode = 1;
    return;
  }
  if (stats?.hasErrors()) {
    console.error(stats.toString("errors-only"));
    process.exitCode = 1;
    return;
  }
  console.log("서버 게임 projection bundle 생성 완료");
});

