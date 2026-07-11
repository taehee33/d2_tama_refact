const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const sourceRoot =
  "/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/참고자료/16x16 Digimon Sprites";
const dataPath = path.join(repoRoot, "src", "data", "v3", "digimons.js");
const outputDir = path.join(repoRoot, "public", "Ver3_Mod_codex");
const reportPath = path.resolve(repoRoot, "..", "docs", "V3_CODEX_SPRITE_GENERATION.md");

const stageSourceFolders = {
  "Baby I": "Baby I",
  "Baby II": "Baby II",
  Child: "Child",
  Adult: "Adult",
  Perfect: "Perfect",
  Ultimate: "Ultimate-Super Ultimate",
  "Super Ultimate": "Ultimate-Super Ultimate",
};

const excludedStages = new Set(["Ohakadamon", "Digitama"]);

function readImageSize(filePath) {
  const output = execFileSync(
    "sips",
    ["-g", "pixelWidth", "-g", "pixelHeight", filePath],
    { encoding: "utf8" }
  );
  const width = Number(output.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(output.match(/pixelHeight:\s*(\d+)/)?.[1]);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Could not read image size: ${filePath}`);
  }

  return { width, height };
}

function parseVer3Entries() {
  const source = fs.readFileSync(dataPath, "utf8");
  const spriteMap = Object.fromEntries(
    [...source.matchAll(/^  ([A-Za-z0-9]+): (\d+),$/gm)].map((match) => [
      match[1],
      Number(match[2]),
    ])
  );

  return [...source.matchAll(/^  ([A-Za-z0-9]+): buildEntry\(\{([\s\S]*?)^  \}\),?/gm)]
    .map((match) => {
      const id = match[1];
      const body = match[2];
      return {
        id,
        name: body.match(/name: "([^"]+)"/)?.[1] || id,
        stage: body.match(/stage: "([^"]+)"/)?.[1] || null,
        sprite: spriteMap[body.match(/sprite: PROVISIONAL_V3_SPRITES\.([A-Za-z0-9]+)/)?.[1]],
      };
    })
    .filter((entry) => !excludedStages.has(entry.stage));
}

function cropFirstFrame(sourcePath, destinationPath) {
  const tempPath = `${destinationPath}.tmp.png`;
  execFileSync("sips", [
    "--cropToHeightWidth",
    "16",
    "16",
    "--cropOffset",
    "0",
    "0",
    sourcePath,
    "--out",
    tempPath,
  ]);
  fs.renameSync(tempPath, destinationPath);
}

function generateSprites() {
  fs.mkdirSync(outputDir, { recursive: true });

  const entries = parseVer3Entries();
  const generated = [];
  const missing = [];
  const invalid = [];

  for (const entry of entries) {
    const destinationPath = path.join(outputDir, `${entry.sprite}.png`);
    const idlePath = path.join(sourceRoot, "Idle Frame Only", `${entry.id}.png`);
    const stageFolder = stageSourceFolders[entry.stage];
    const sheetPath = stageFolder
      ? path.join(sourceRoot, stageFolder, `${entry.id}.png`)
      : null;

    if (fs.existsSync(idlePath)) {
      fs.copyFileSync(idlePath, destinationPath);
      generated.push({
        ...entry,
        method: "idle copy",
        sourcePath: idlePath,
        outputPath: destinationPath,
      });
      continue;
    }

    if (!sheetPath || !fs.existsSync(sheetPath)) {
      missing.push({ ...entry, idlePath, sheetPath });
      continue;
    }

    const { width, height } = readImageSize(sheetPath);
    if (width % 16 !== 0 || height % 16 !== 0) {
      invalid.push({ ...entry, sourcePath: sheetPath, width, height });
      continue;
    }

    cropFirstFrame(sheetPath, destinationPath);
    generated.push({
      ...entry,
      method: "sheet crop",
      sourcePath: sheetPath,
      outputPath: destinationPath,
      sheetSize: `${width}x${height}`,
    });
  }

  const badOutputs = generated
    .map((entry) => {
      const size = readImageSize(entry.outputPath);
      return { ...entry, ...size };
    })
    .filter((entry) => entry.width !== 16 || entry.height !== 16);

  const lines = [
    "# Ver.3 Codex Sprite Generation",
    "",
    `- Generated at: ${new Date().toISOString()}`,
    `- Source root: \`${sourceRoot}\``,
    `- Output dir: \`${path.relative(repoRoot, outputDir)}\``,
    `- Generated files: ${generated.length}`,
    `- Missing sources: ${missing.length}`,
    `- Invalid sources: ${invalid.length}`,
    `- Non-16x16 outputs: ${badOutputs.length}`,
    "",
    "## Generated",
    "",
    "| id | name | stage | sprite | method | source |",
    "| --- | --- | --- | --- | --- | --- |",
    ...generated.map(
      (entry) =>
        `| ${entry.id} | ${entry.name} | ${entry.stage} | ${entry.sprite}.png | ${entry.method} | \`${entry.sourcePath}\` |`
    ),
    "",
    "## Missing Sources",
    "",
    missing.length === 0
      ? "- None"
      : missing
          .map(
            (entry) =>
              `- ${entry.id}: idle=\`${entry.idlePath}\`, sheet=\`${entry.sheetPath || "N/A"}\``
          )
          .join("\n"),
    "",
    "## Invalid Sources",
    "",
    invalid.length === 0
      ? "- None"
      : invalid
          .map(
            (entry) =>
              `- ${entry.id}: \`${entry.sourcePath}\` (${entry.width}x${entry.height})`
          )
          .join("\n"),
    "",
    "## Non-16x16 Outputs",
    "",
    badOutputs.length === 0
      ? "- None"
      : badOutputs
          .map(
            (entry) =>
              `- ${entry.id}: \`${entry.outputPath}\` (${entry.width}x${entry.height})`
          )
          .join("\n"),
    "",
  ];

  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");

  console.log(
    JSON.stringify(
      {
        generated: generated.length,
        missing: missing.length,
        invalid: invalid.length,
        badOutputs: badOutputs.length,
        outputDir,
        reportPath,
      },
      null,
      2
    )
  );

  if (missing.length > 0 || invalid.length > 0 || badOutputs.length > 0) {
    process.exitCode = 1;
  }
}

generateSprites();
