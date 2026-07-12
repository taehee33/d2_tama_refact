const fs = require("fs");
const path = require("path");
const { decodePng } = require("./generateVer3Codex48Sprites");

const repoRoot = path.resolve(__dirname, "..");
const baselineDir = path.join(repoRoot, "public", "Ver2_Mod_Kor");
const frameRoot = path.join(repoRoot, "public", "Ver4_Mod_codex_48");
const outputDir = path.join(repoRoot, "public", "Ver4_Mod_codex");
const dataPath = path.join(repoRoot, "src", "data", "v4", "digimons.js");
const FRAME_COUNT = 15;
const specialFrames = [133, 134, 135, 159, 160];
const excludedStages = new Set(["Ohakadamon", "Digitama"]);

function parseLivingEntries() {
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
        stage: body.match(/stage: "([^"]+)"/)?.[1] || null,
        sprite: sprites[spriteKey],
      };
    })
    .filter((entry) => !excludedStages.has(entry.stage));
}

function copyBaseline() {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const name of fs.readdirSync(outputDir)) {
    fs.rmSync(path.join(outputDir, name), { recursive: true, force: true });
  }
  for (const name of fs.readdirSync(baselineDir)) {
    const source = path.join(baselineDir, name);
    if (fs.statSync(source).isFile()) {
      fs.copyFileSync(source, path.join(outputDir, name));
    }
  }
}

function overwriteLivingFrames(entries) {
  for (const entry of entries) {
    const sourceDir = path.join(frameRoot, String(entry.sprite));
    for (let index = 0; index < FRAME_COUNT; index += 1) {
      const sourceName = `frame_${String(index + 1).padStart(2, "0")}.png`;
      const source = path.join(sourceDir, sourceName);
      if (!fs.existsSync(source)) {
        throw new Error(`Missing Ver.4 frame: ${source}`);
      }
      const image = decodePng(source);
      if (image.width !== 48 || image.height !== 48) {
        throw new Error(`Invalid Ver.4 frame: ${source} (${image.width}x${image.height})`);
      }
      fs.copyFileSync(source, path.join(outputDir, `${entry.sprite + index}.png`));
    }
  }
}

function overwriteSpecialFrames() {
  for (const number of specialFrames) {
    const namedSource = path.join(frameRoot, `ver4 ${number}.png`);
    if (!fs.existsSync(namedSource)) {
      throw new Error(`Missing Ver.4 special frame: ${namedSource}`);
    }
    const image = decodePng(namedSource);
    if (image.width !== 48 || image.height !== 48) {
      throw new Error(`Invalid Ver.4 special frame: ${namedSource} (${image.width}x${image.height})`);
    }
    fs.copyFileSync(namedSource, path.join(frameRoot, `${number}.png`));
    fs.copyFileSync(namedSource, path.join(outputDir, `${number}.png`));
  }
}

function verify(entries) {
  const baselineNames = fs.readdirSync(baselineDir).filter((name) => name.endsWith(".png"));
  const outputNames = fs.readdirSync(outputDir).filter((name) => name.endsWith(".png"));
  if (outputNames.length !== baselineNames.length) {
    throw new Error(`File count mismatch: baseline=${baselineNames.length}, output=${outputNames.length}`);
  }
  for (const entry of entries) {
    for (let index = 0; index < FRAME_COUNT; index += 1) {
      const file = path.join(outputDir, `${entry.sprite + index}.png`);
      const image = decodePng(file);
      if (image.width !== 48 || image.height !== 48) {
        throw new Error(`Output frame is not 48x48: ${file}`);
      }
    }
  }
  return outputNames.length;
}

const entries = parseLivingEntries();
if (entries.length !== 19) {
  throw new Error(`Expected 19 living Ver.4 entries, received ${entries.length}`);
}
copyBaseline();
overwriteLivingFrames(entries);
overwriteSpecialFrames();
const fileCount = verify(entries);
console.log(JSON.stringify({ outputDir, fileCount, replacedDigimon: entries.length, replacedFrames: entries.length * FRAME_COUNT, specialFrames }, null, 2));
