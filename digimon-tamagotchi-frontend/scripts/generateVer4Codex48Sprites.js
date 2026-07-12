const fs = require("fs");
const path = require("path");
const {
  decodePng,
  encodePng,
  createBlankImage,
  copyPixel,
  extractScaledFrame,
  appendFrameToSheet,
} = require("./generateVer3Codex48Sprites");

const repoRoot = path.resolve(__dirname, "..");
const referenceRoot =
  "/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/참고자료";
const sheetRoot = path.join(referenceRoot, "16x16 Digimon Sprites");
const vbRoot = path.join(
  referenceRoot,
  "VB for DMC Sprite Conversion",
  "DMC Rosters (PLEASE SEE READ ME)",
  "DMC V4 (Official) Roster",
  "Individual Sprites"
);
const dataPath = path.join(repoRoot, "src", "data", "v4", "digimons.js");
const outputRoot = path.join(repoRoot, "public", "Ver4_Mod_codex_48");
const reportPath = path.resolve(repoRoot, "..", "docs", "V4_CODEX_48_SPRITE_GENERATION.md");

const FRAME_COUNT = 15;
const OUTPUT_SIZE = 48;
const SHEET_FRAME_ORDER = [1, 2, 8, 9, 2, 12, 2, 12, 2, 3, 7, 6, 5, 10, 11];
const excludedStages = new Set(["Ohakadamon", "Digitama"]);
const stageFolders = {
  "Baby I": "Baby I",
  "Baby II": "Baby II",
  Child: "Child",
  Adult: "Adult",
  Perfect: "Perfect",
  Ultimate: "Ultimate-Super Ultimate",
  "Super Ultimate": "Ultimate-Super Ultimate",
};
const sourceAliases = {
  Piyomon: "Biyomon",
  Kokatorimon: "Cockatrimon",
  Ultimatedramon: "Megadramon",
};
const vbIds = new Set([
  "Yuramon",
  "Tanemon",
  "Piyomon",
  "Palmon",
  "Leomon",
  "Ultimatedramon",
  "Darkdramon",
  "Chaosdramon",
]);

function parseEntries() {
  const source = fs.readFileSync(dataPath, "utf8");
  const sprites = Object.fromEntries(
    [...source.matchAll(/^  ([A-Za-z0-9]+): (\d+),$/gm)].map((match) => [
      match[1],
      Number(match[2]),
    ])
  );

  return [...source.matchAll(/^  ([A-Za-z0-9]+): buildEntry\(\{([\s\S]*?)^  \}\),?/gm)]
    .map((match) => {
      const body = match[2];
      const spriteKey = body.match(/sprite: V4_SPRITES\.([A-Za-z0-9]+)/)?.[1];
      return {
        id: match[1],
        name: body.match(/name: "([^"]+)"/)?.[1] || match[1],
        stage: body.match(/stage: "([^"]+)"/)?.[1] || null,
        sprite: sprites[spriteKey],
      };
    })
    .filter((entry) => !excludedStages.has(entry.stage));
}

function resizeNearestContain(source) {
  if (source.width === OUTPUT_SIZE && source.height === OUTPUT_SIZE) return source;
  const scale = Math.min(OUTPUT_SIZE / source.width, OUTPUT_SIZE / source.height);
  const width = Math.max(1, Math.floor(source.width * scale));
  const height = Math.max(1, Math.floor(source.height * scale));
  const offsetX = Math.floor((OUTPUT_SIZE - width) / 2);
  const offsetY = Math.floor((OUTPUT_SIZE - height) / 2);
  const target = createBlankImage(OUTPUT_SIZE, OUTPUT_SIZE);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor(x / scale));
      const sy = Math.min(source.height - 1, Math.floor(y / scale));
      copyPixel(source, sx, sy, target, offsetX + x, offsetY + y);
    }
  }
  return target;
}

function writeFrames(entry, frames) {
  const dir = path.join(outputRoot, String(entry.sprite));
  fs.mkdirSync(dir, { recursive: true });
  const sheet = createBlankImage(OUTPUT_SIZE, OUTPUT_SIZE * frames.length);
  frames.forEach((frame, index) => {
    const name = `frame_${String(index + 1).padStart(2, "0")}.png`;
    fs.writeFileSync(path.join(dir, name), encodePng(frame));
    appendFrameToSheet(frame, sheet, index);
  });
  fs.writeFileSync(path.join(dir, "sheet.png"), encodePng(sheet));
  return dir;
}

function getVbFrames(entry) {
  const sourceName = sourceAliases[entry.id] || entry.id;
  const dir = path.join(vbRoot, sourceName);
  const start = fs.existsSync(path.join(dir, `${sourceName}_0.png`)) ? 0 : 1;
  const paths = Array.from({ length: FRAME_COUNT }, (_, index) =>
    path.join(dir, `${sourceName}_${start + index}.png`)
  );
  if (paths.some((file) => !fs.existsSync(file))) return null;
  const decoded = paths.map((file) => decodePng(file));
  return {
    frames: decoded.map(resizeNearestContain),
    source: `${paths[0]} ... ${paths[paths.length - 1]}`,
    sourceSize: [...new Set(decoded.map(({ width, height }) => `${width}x${height}`))].join(", "),
    method: `VB frames ${start}-${start + FRAME_COUNT - 1}${
      decoded.some(({ width, height }) => width !== 48 || height !== 48)
        ? " + nearest contain"
        : ""
    }`,
  };
}

function getSheetFrames(entry) {
  if (entry.id === "Nanimon") {
    const sourcePath = path.join(sheetRoot, "Idle Frame Only", "Nanimon.png");
    if (!fs.existsSync(sourcePath)) return null;
    const source = decodePng(sourcePath);
    const frame = resizeNearestContain(source);
    return {
      frames: Array.from({ length: FRAME_COUNT }, () => frame),
      source: sourcePath,
      sourceSize: `${source.width}x${source.height}`,
      method: "idle duplicate",
    };
  }

  const sourceName = sourceAliases[entry.id] || entry.id;
  const sourcePath = path.join(sheetRoot, stageFolders[entry.stage], `${sourceName}.png`);
  if (!fs.existsSync(sourcePath)) return null;
  const source = decodePng(sourcePath);
  if (source.width < 48 || source.height < 64) {
    throw new Error(`Invalid 16x16 sheet: ${sourcePath} (${source.width}x${source.height})`);
  }
  return {
    frames: SHEET_FRAME_ORDER.map((number) => extractScaledFrame(source, number)),
    source: sourcePath,
    sourceSize: `${source.width}x${source.height}`,
    method: "16x16 sheet frame map",
  };
}

function generate() {
  fs.mkdirSync(outputRoot, { recursive: true });
  const generated = [];
  const missing = [];

  for (const entry of parseEntries()) {
    const result = vbIds.has(entry.id) ? getVbFrames(entry) : getSheetFrames(entry);
    if (!result) {
      missing.push(entry);
      continue;
    }
    const dir = writeFrames(entry, result.frames);
    generated.push({ ...entry, ...result, dir });
  }

  const lines = [
    "# Ver.4 Codex 48x48 Sprite Generation",
    "",
    `- Generated at: ${new Date().toISOString()}`,
    `- VB frame order: \`0-14\``,
    `- 16x16 frame order: \`${SHEET_FRAME_ORDER.join(", ")}\``,
    `- Generated digimon: ${generated.length}`,
    `- Missing sources: ${missing.length}`,
    "",
    "| id | name | stage | sprite | method | source size | source | output |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...generated.map((item) =>
      `| ${item.id} | ${item.name} | ${item.stage} | ${item.sprite} | ${item.method} | ${item.sourceSize} | \`${item.source}\` | \`${path.relative(repoRoot, item.dir)}\` |`
    ),
    "",
    "## Missing Sources",
    "",
    missing.length ? missing.map(({ id }) => `- ${id}`).join("\n") : "- None",
    "",
  ];
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
  console.log(JSON.stringify({ generated: generated.length, missing: missing.length, outputRoot, reportPath }, null, 2));
  if (generated.length !== 19 || missing.length) process.exitCode = 1;
}

generate();
