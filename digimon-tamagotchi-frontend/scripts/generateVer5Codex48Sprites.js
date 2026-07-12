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
  "DMC V5 (Official) Roster",
  "Individual Sprites"
);
const dataPath = path.join(repoRoot, "src", "data", "v5", "digimons.js");
const outputRoot = path.join(repoRoot, "public", "Ver5_Mod_codex_48");
const reportPath = path.resolve(
  repoRoot,
  "..",
  "docs",
  "V5_CODEX_48_SPRITE_GENERATION.md"
);

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
  DarkTyranomon: "DarkTyrannomon",
  MetalTyranomon: "MetalTyrannomon",
  ExTyranomon: "Ex-Tyranomon",
  Mugendramon: "Machinedramon",
};
const vbIds = new Set([
  "Zurumon",
  "Pagumon",
  "Gazimon",
  "Gizamon",
  "DarkTyranomon",
  "MetalTyranomon",
  "Mugendramon",
  "Chaosdramon",
]);
const staticSpriteNumbers = [133, 134, 135, 159, 160];

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
      const spriteKey = body.match(/sprite: V5_SPRITES\.([A-Za-z0-9]+)/)?.[1];
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

function isBrightNeutralPixel(image, x, y) {
  const offset = (y * image.width + x) * 4;
  const red = image.data[offset];
  const green = image.data[offset + 1];
  const blue = image.data[offset + 2];
  const minimum = Math.min(red, green, blue);
  const maximum = Math.max(red, green, blue);
  return minimum >= 220 && maximum - minimum <= 18;
}

function removeConnectedBrightBackground(source) {
  const output = {
    width: source.width,
    height: source.height,
    data: Buffer.from(source.data),
  };
  const visited = new Uint8Array(source.width * source.height);
  const queue = [];

  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= source.width || y >= source.height) return;
    const index = y * source.width + x;
    if (visited[index] || !isBrightNeutralPixel(source, x, y)) return;
    visited[index] = 1;
    queue.push([x, y]);
  };

  for (let x = 0; x < source.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, source.height - 1);
  }
  for (let y = 0; y < source.height; y += 1) {
    enqueue(0, y);
    enqueue(source.width - 1, y);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [x, y] = queue[cursor];
    const alphaOffset = (y * source.width + x) * 4 + 3;
    output.data[alphaOffset] = 0;
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  return output;
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
  if (entry.id === "Flymon") {
    const sourcePath = path.join(sheetRoot, "Idle Frame Only", "Flymon.png");
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
  const stageFolder = stageFolders[entry.stage];
  const sourcePath = stageFolder
    ? path.join(sheetRoot, stageFolder, `${sourceName}.png`)
    : null;
  if (!sourcePath || !fs.existsSync(sourcePath)) return null;
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

function copyStaticSprites() {
  const fallbackRoot = path.join(repoRoot, "public", "Ver5_Mod_TH");
  const fallbackZero = path.join(fallbackRoot, "0.png");
  if (fs.existsSync(fallbackZero)) {
    fs.copyFileSync(fallbackZero, path.join(outputRoot, "0.png"));
  }

  for (const sprite of staticSpriteNumbers) {
    const source = path.join(outputRoot, `ver5 ${sprite}.png`);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing named Ver.5 static sprite: ${source}`);
    }
    const image = decodePng(source);
    if (image.width !== OUTPUT_SIZE || image.height !== OUTPUT_SIZE) {
      throw new Error(`Invalid Ver.5 static sprite: ${source} (${image.width}x${image.height})`);
    }
    const normalized = removeConnectedBrightBackground(image);
    fs.writeFileSync(path.join(outputRoot, `${sprite}.png`), encodePng(normalized));
  }
}

function generate() {
  fs.mkdirSync(outputRoot, { recursive: true });
  copyStaticSprites();
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
    "# Ver.5 Codex 48x48 Sprite Generation",
    "",
    `- Generated at: ${new Date().toISOString()}`,
    "- Source priority: `VB for DMC Sprite Conversion` → `16x16 Digimon Sprites`",
    `- 16x16 frame order: \`${SHEET_FRAME_ORDER.join(", ")}\``,
    `- Generated digimon: ${generated.length}`,
    `- Missing sources: ${missing.length}`,
    `- Normalized static sprites: ${staticSpriteNumbers.join(", ")}`,
    "",
    "| id | name | stage | sprite | method | source size | source | output |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...generated.map(
      (item) =>
        `| ${item.id} | ${item.name} | ${item.stage} | ${item.sprite} | ${item.method} | ${item.sourceSize} | \`${item.source}\` | \`${path.relative(repoRoot, item.dir)}\` |`
    ),
    "",
    "## Missing Sources",
    "",
    missing.length ? missing.map(({ id }) => `- ${id}`).join("\n") : "- None",
    "",
  ];
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
  console.log(
    JSON.stringify(
      { generated: generated.length, missing: missing.length, outputRoot, reportPath },
      null,
      2
    )
  );
  if (generated.length !== 19 || missing.length) process.exitCode = 1;
}

if (require.main === module) generate();

module.exports = {
  FRAME_COUNT,
  SHEET_FRAME_ORDER,
  parseEntries,
  resizeNearestContain,
  removeConnectedBrightBackground,
  staticSpriteNumbers,
};
