"use strict";

const fs = require("node:fs");
const path = require("node:path");
const webpack = require("webpack");

const frontendDir = path.resolve(__dirname, "..");

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
  const outputPath = path.join(frontendDir, "api/_generated/gameProjection.cjs");
  const normalizedOutput = fs.readFileSync(outputPath, "utf8")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n*$/, "\n");
  fs.writeFileSync(outputPath, normalizedOutput);
  console.log("서버 게임 projection bundle 생성 완료");
});
