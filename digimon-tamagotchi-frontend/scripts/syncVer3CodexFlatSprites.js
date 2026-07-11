const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "src", "data", "v3", "digimons.js");
const sourceDir = path.join(repoRoot, "public", "Ver3_Mod_codex_48");
const outputDir = path.join(repoRoot, "public", "Ver3_Mod_codex");
const legacyV3Dir = path.join(repoRoot, "public", "Ver3_Mod_TH");
const ver2CommonDir = path.join(repoRoot, "public", "Ver2_Mod_Kor");
const reportPath = path.resolve(repoRoot, "..", "docs", "V3_CODEX_FLAT_SPRITE_SYNC.md");

const supportingV3Sprites = [
  {
    spriteNumber: 133,
    sourcePath: path.join(sourceDir, "133.png"),
  },
  {
    spriteNumber: 159,
    sourcePath: path.join(legacyV3Dir, "159.png"),
  },
  {
    spriteNumber: 160,
    sourcePath: path.join(legacyV3Dir, "160.png"),
  },
];
const frameCount = 15;

function parseEntries() {
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
      const spriteKey = body.match(/sprite: PROVISIONAL_V3_SPRITES\.([A-Za-z0-9]+)/)?.[1];
      const attackSpriteMatch = body.match(/attackSprite: (null|\d+),/);
      return {
        id,
        name: body.match(/name: "([^"]+)"/)?.[1] || id,
        stage: body.match(/stage: "([^"]+)"/)?.[1] || null,
        sprite: spriteMap[spriteKey],
        attackSprite:
          attackSpriteMatch?.[1] === "null"
            ? null
            : Number.parseInt(attackSpriteMatch?.[1] || "", 10),
      };
    });
}

function copyFile(sourcePath, destinationPath) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function syncFlatSprites() {
  fs.mkdirSync(outputDir, { recursive: true });

  const copiedFrames = [];
  const copiedSupporting = [];
  const copiedAttackSprites = [];
  const missing = [];

  const entries = parseEntries();
  const livingEntries = entries.filter(
    (entry) => entry.stage !== "Digitama" && entry.stage !== "Ohakadamon"
  );

  for (const entry of livingEntries) {
    const entrySourceDir = path.join(sourceDir, String(entry.sprite));

    for (let index = 0; index < frameCount; index += 1) {
      const sourcePath = path.join(
        entrySourceDir,
        `frame_${String(index + 1).padStart(2, "0")}.png`
      );
      const destinationNumber = entry.sprite + index;
      const destinationPath = path.join(outputDir, `${destinationNumber}.png`);

      if (!fs.existsSync(sourcePath)) {
        missing.push({ type: "living frame", id: entry.id, sourcePath });
        continue;
      }

      copyFile(sourcePath, destinationPath);
      copiedFrames.push({
        id: entry.id,
        name: entry.name,
        sourcePath,
        destinationNumber,
      });
    }
  }

  for (const { spriteNumber, sourcePath } of supportingV3Sprites) {
    const destinationPath = path.join(outputDir, `${spriteNumber}.png`);

    if (!fs.existsSync(sourcePath)) {
      missing.push({ type: "supporting v3", id: String(spriteNumber), sourcePath });
      continue;
    }

    copyFile(sourcePath, destinationPath);
    copiedSupporting.push({ spriteNumber, sourcePath });
  }

  const attackSprites = [
    ...new Set(
      entries
        .map((entry) => entry.attackSprite)
        .filter((spriteNumber) => Number.isFinite(spriteNumber))
    ),
  ].sort((a, b) => a - b);

  for (const spriteNumber of attackSprites) {
    const destinationPath = path.join(outputDir, `${spriteNumber}.png`);
    if (fs.existsSync(destinationPath)) {
      continue;
    }

    const sourcePath = path.join(ver2CommonDir, `${spriteNumber}.png`);
    if (!fs.existsSync(sourcePath)) {
      missing.push({ type: "attack sprite", id: String(spriteNumber), sourcePath });
      continue;
    }

    copyFile(sourcePath, destinationPath);
    copiedAttackSprites.push({ spriteNumber, sourcePath });
  }

  const lines = [
    "# Ver.3 Codex Flat Sprite Sync",
    "",
    `- Synced at: ${new Date().toISOString()}`,
    `- Source dir: \`${path.relative(repoRoot, sourceDir)}\``,
    `- Output dir: \`${path.relative(repoRoot, outputDir)}\``,
    `- Living frame files copied: ${copiedFrames.length}`,
    `- Supporting Ver.3 files copied: ${copiedSupporting.length}`,
    `- Attack/common files copied: ${copiedAttackSprites.length}`,
    `- Missing files: ${missing.length}`,
    "",
    "## Living Frames",
    "",
    "| id | name | output range | source |",
    "| --- | --- | --- | --- |",
    ...livingEntries.map((entry) => {
      const first = entry.sprite;
      const last = entry.sprite + frameCount - 1;
      return `| ${entry.id} | ${entry.name} | ${first}.png-${last}.png | \`${path.relative(repoRoot, path.join(sourceDir, String(entry.sprite)))}\` |`;
    }),
    "",
    "## Supporting Ver.3 Files",
    "",
    copiedSupporting.length === 0
      ? "- None"
      : copiedSupporting
          .map(
            (entry) =>
              `- ${entry.spriteNumber}.png from \`${path.relative(repoRoot, entry.sourcePath)}\``
          )
          .join("\n"),
    "",
    "## Attack/Common Files",
    "",
    copiedAttackSprites.length === 0
      ? "- None"
      : copiedAttackSprites
          .map(
            (entry) =>
              `- ${entry.spriteNumber}.png from \`${path.relative(repoRoot, entry.sourcePath)}\``
          )
          .join("\n"),
    "",
    "## Missing",
    "",
    missing.length === 0
      ? "- None"
      : missing
          .map(
            (entry) =>
              `- ${entry.type} ${entry.id}: \`${path.relative(repoRoot, entry.sourcePath)}\``
          )
          .join("\n"),
    "",
  ];

  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");

  console.log(
    JSON.stringify(
      {
        livingFrameFiles: copiedFrames.length,
        supportingFiles: copiedSupporting.length,
        attackCommonFiles: copiedAttackSprites.length,
        missing: missing.length,
        outputDir,
        reportPath,
      },
      null,
      2
    )
  );

  if (missing.length > 0) {
    process.exitCode = 1;
  }
}

syncFlatSprites();
