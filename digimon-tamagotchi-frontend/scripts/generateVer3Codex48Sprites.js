const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const repoRoot = path.resolve(__dirname, "..");
const sourceRoot =
  "/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/참고자료/16x16 Digimon Sprites";
const dataPath = path.join(repoRoot, "src", "data", "v3", "digimons.js");
const outputDir = path.join(repoRoot, "public", "Ver3_Mod_codex_48");
const reportPath = path.resolve(
  repoRoot,
  "..",
  "docs",
  "V3_CODEX_48_SPRITE_GENERATION.md"
);

const FRAME_SIZE = 16;
const SCALE = 3;
const OUTPUT_SIZE = FRAME_SIZE * SCALE;
const SOURCE_COLUMNS = 3;
const FRAME_ORDER = [1, 2, 8, 9, 2, 12, 2, 12, 2, 3, 7, 6, 5, 10, 11];

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
const sourceFileAliases = {
  Centaurmon: "Centalmon",
};
const individualFrameSources = {
  Poyomon: {
    root: "/Users/hantaehee/Desktop/파일/개발/프로젝트/디지몬/참고자료/VB for DMC Sprite Conversion/1.Baby 1- Fresh/0.Individual Sprites/M-P/Poyomon",
    start: 2,
    count: FRAME_ORDER.length,
  },
};
const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function paethPredictor(left, above, upperLeft) {
  const p = left + above - upperLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - above);
  const pc = Math.abs(p - upperLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return above;
  return upperLeft;
}

function unfilterScanlines(raw, width, height, bytesPerPixel, stride) {
  const out = Buffer.alloc(height * stride);
  let rawOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = raw[rawOffset];
    rawOffset += 1;
    const rowOffset = y * stride;
    const previousRowOffset = (y - 1) * stride;

    for (let x = 0; x < stride; x += 1) {
      const value = raw[rawOffset + x];
      const left = x >= bytesPerPixel ? out[rowOffset + x - bytesPerPixel] : 0;
      const above = y > 0 ? out[previousRowOffset + x] : 0;
      const upperLeft =
        y > 0 && x >= bytesPerPixel
          ? out[previousRowOffset + x - bytesPerPixel]
          : 0;

      if (filterType === 0) {
        out[rowOffset + x] = value;
      } else if (filterType === 1) {
        out[rowOffset + x] = (value + left) & 0xff;
      } else if (filterType === 2) {
        out[rowOffset + x] = (value + above) & 0xff;
      } else if (filterType === 3) {
        out[rowOffset + x] = (value + Math.floor((left + above) / 2)) & 0xff;
      } else if (filterType === 4) {
        out[rowOffset + x] =
          (value + paethPredictor(left, above, upperLeft)) & 0xff;
      } else {
        throw new Error(`Unsupported PNG filter type: ${filterType}`);
      }
    }

    rawOffset += stride;
  }

  return out;
}

function decodePng(filePath) {
  const file = fs.readFileSync(filePath);
  if (!file.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`Not a PNG file: ${filePath}`);
  }

  let offset = 8;
  let ihdr = null;
  let palette = null;
  let transparency = null;
  const idatChunks = [];

  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.subarray(offset + 4, offset + 8).toString("ascii");
    const data = file.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      transparency = data;
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!ihdr) {
    throw new Error(`Missing IHDR: ${filePath}`);
  }
  if (ihdr.bitDepth !== 8 || ihdr.compression !== 0 || ihdr.filter !== 0) {
    throw new Error(`Unsupported PNG format: ${filePath}`);
  }
  if (ihdr.interlace !== 0) {
    throw new Error(`Interlaced PNG is not supported: ${filePath}`);
  }

  const channelInfo = {
    0: 1,
    2: 3,
    3: 1,
    6: 4,
  };
  const channels = channelInfo[ihdr.colorType];
  if (!channels) {
    throw new Error(`Unsupported PNG color type ${ihdr.colorType}: ${filePath}`);
  }

  if (ihdr.colorType === 3 && !palette) {
    throw new Error(`Palette PNG is missing PLTE: ${filePath}`);
  }

  const stride = ihdr.width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const pixels = unfilterScanlines(
    raw,
    ihdr.width,
    ihdr.height,
    channels,
    stride
  );
  const rgba = Buffer.alloc(ihdr.width * ihdr.height * 4);

  for (let y = 0; y < ihdr.height; y += 1) {
    for (let x = 0; x < ihdr.width; x += 1) {
      const sourceOffset = y * stride + x * channels;
      const targetOffset = (y * ihdr.width + x) * 4;

      if (ihdr.colorType === 0) {
        const gray = pixels[sourceOffset];
        rgba[targetOffset] = gray;
        rgba[targetOffset + 1] = gray;
        rgba[targetOffset + 2] = gray;
        rgba[targetOffset + 3] = 255;
      } else if (ihdr.colorType === 2) {
        rgba[targetOffset] = pixels[sourceOffset];
        rgba[targetOffset + 1] = pixels[sourceOffset + 1];
        rgba[targetOffset + 2] = pixels[sourceOffset + 2];
        rgba[targetOffset + 3] = 255;
      } else if (ihdr.colorType === 3) {
        const paletteIndex = pixels[sourceOffset];
        const paletteOffset = paletteIndex * 3;
        rgba[targetOffset] = palette[paletteOffset] || 0;
        rgba[targetOffset + 1] = palette[paletteOffset + 1] || 0;
        rgba[targetOffset + 2] = palette[paletteOffset + 2] || 0;
        rgba[targetOffset + 3] = transparency?.[paletteIndex] ?? 255;
      } else if (ihdr.colorType === 6) {
        rgba[targetOffset] = pixels[sourceOffset];
        rgba[targetOffset + 1] = pixels[sourceOffset + 1];
        rgba[targetOffset + 2] = pixels[sourceOffset + 2];
        rgba[targetOffset + 3] = pixels[sourceOffset + 3];
      }
    }
  }

  return {
    width: ihdr.width,
    height: ihdr.height,
    data: rgba,
  };
}

function encodePng({ width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const scanlines = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (stride + 1);
    scanlines[rowOffset] = 0;
    data.copy(scanlines, rowOffset + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    pngSignature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", zlib.deflateSync(scanlines)),
    makeChunk("IEND"),
  ]);
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
        sprite:
          spriteMap[
            body.match(/sprite: PROVISIONAL_V3_SPRITES\.([A-Za-z0-9]+)/)?.[1]
          ],
      };
    })
    .filter((entry) => !excludedStages.has(entry.stage));
}

function createBlankImage(width, height) {
  return {
    width,
    height,
    data: Buffer.alloc(width * height * 4),
  };
}

function copyPixel(source, sx, sy, target, tx, ty) {
  const sourceOffset = (sy * source.width + sx) * 4;
  const targetOffset = (ty * target.width + tx) * 4;
  target.data[targetOffset] = source.data[sourceOffset];
  target.data[targetOffset + 1] = source.data[sourceOffset + 1];
  target.data[targetOffset + 2] = source.data[sourceOffset + 2];
  target.data[targetOffset + 3] = source.data[sourceOffset + 3];
}

function extractScaledRegion(source, sourceX, sourceY) {
  const frame = createBlankImage(OUTPUT_SIZE, OUTPUT_SIZE);

  for (let y = 0; y < FRAME_SIZE; y += 1) {
    for (let x = 0; x < FRAME_SIZE; x += 1) {
      for (let dy = 0; dy < SCALE; dy += 1) {
        for (let dx = 0; dx < SCALE; dx += 1) {
          copyPixel(
            source,
            sourceX + x,
            sourceY + y,
            frame,
            x * SCALE + dx,
            y * SCALE + dy
          );
        }
      }
    }
  }

  return frame;
}

function extractScaledFrame(source, frameNumber) {
  const zeroBased = frameNumber - 1;
  const sourceX = (zeroBased % SOURCE_COLUMNS) * FRAME_SIZE;
  const sourceY = Math.floor(zeroBased / SOURCE_COLUMNS) * FRAME_SIZE;
  return extractScaledRegion(source, sourceX, sourceY);
}

function appendFrameToSheet(frame, sheet, frameIndex) {
  const targetY = frameIndex * OUTPUT_SIZE;
  for (let y = 0; y < OUTPUT_SIZE; y += 1) {
    for (let x = 0; x < OUTPUT_SIZE; x += 1) {
      copyPixel(frame, x, y, sheet, x, targetY + y);
    }
  }
}

function getIndividualFramePaths(entry) {
  const config = individualFrameSources[entry.id];
  if (!config) return null;

  return Array.from({ length: config.count }, (_, index) => {
    const frameNumber = config.start + index;
    return path.join(config.root, `${entry.id}_${frameNumber}.png`);
  });
}

function generateSprites() {
  fs.mkdirSync(outputDir, { recursive: true });

  const generated = [];
  const missing = [];
  const invalid = [];

  for (const entry of parseVer3Entries()) {
    const entryOutputDir = path.join(outputDir, String(entry.sprite));
    const individualFramePaths = getIndividualFramePaths(entry);

    if (individualFramePaths) {
      const missingFrames = individualFramePaths.filter((filePath) => !fs.existsSync(filePath));
      if (missingFrames.length > 0) {
        missing.push({
          ...entry,
          sourcePath: individualFramePaths[0],
          idlePath: `missing individual frames: ${missingFrames.join(", ")}`,
        });
        continue;
      }

      const frames = individualFramePaths.map((filePath) => ({
        filePath,
        image: decodePng(filePath),
      }));
      const invalidFrames = frames.filter(
        ({ image }) => image.width !== OUTPUT_SIZE || image.height !== OUTPUT_SIZE
      );

      if (invalidFrames.length > 0) {
        invalid.push({
          ...entry,
          sourcePath: invalidFrames.map(({ filePath }) => filePath).join(", "),
          sourceSize: invalidFrames
            .map(({ image }) => `${image.width}x${image.height}`)
            .join(", "),
        });
        continue;
      }

      fs.mkdirSync(entryOutputDir, { recursive: true });

      const sheet = createBlankImage(OUTPUT_SIZE, OUTPUT_SIZE * frames.length);
      frames.forEach(({ image }, index) => {
        const fileName = `frame_${String(index + 1).padStart(2, "0")}.png`;
        fs.writeFileSync(path.join(entryOutputDir, fileName), encodePng(image));
        appendFrameToSheet(image, sheet, index);
      });
      fs.writeFileSync(path.join(entryOutputDir, "sheet.png"), encodePng(sheet));

      generated.push({
        ...entry,
        sourcePath: `${individualFramePaths[0]} ... ${individualFramePaths[individualFramePaths.length - 1]}`,
        outputDir: entryOutputDir,
        sourceSize: `${OUTPUT_SIZE}x${OUTPUT_SIZE}`,
        frameCount: frames.length,
        method: "individual frames 2-16",
      });
      continue;
    }

    const stageFolder = stageSourceFolders[entry.stage];
    const sourceFileName = sourceFileAliases[entry.id] || entry.id;
    const sourcePath = stageFolder
      ? path.join(sourceRoot, stageFolder, `${sourceFileName}.png`)
      : null;
    const idlePath = path.join(sourceRoot, "Idle Frame Only", `${entry.id}.png`);

    if ((!sourcePath || !fs.existsSync(sourcePath)) && !fs.existsSync(idlePath)) {
      missing.push({ ...entry, sourcePath, idlePath });
      continue;
    }

    const usesIdleFallback = !sourcePath || !fs.existsSync(sourcePath);
    const actualSourcePath = usesIdleFallback ? idlePath : sourcePath;
    const source = decodePng(actualSourcePath);
    const requiredRows = Math.ceil(Math.max(...FRAME_ORDER) / SOURCE_COLUMNS);

    const hasValidSize = usesIdleFallback
      ? source.width >= FRAME_SIZE && source.height >= FRAME_SIZE
      : source.width >= SOURCE_COLUMNS * FRAME_SIZE &&
        source.height >= requiredRows * FRAME_SIZE &&
        source.width % FRAME_SIZE === 0 &&
        source.height % FRAME_SIZE === 0;

    if (!hasValidSize) {
      invalid.push({
        ...entry,
        sourcePath: actualSourcePath,
        sourceSize: `${source.width}x${source.height}`,
      });
      continue;
    }

    fs.mkdirSync(entryOutputDir, { recursive: true });

    const sheet = createBlankImage(OUTPUT_SIZE, OUTPUT_SIZE * FRAME_ORDER.length);
    FRAME_ORDER.forEach((sourceFrameNumber, index) => {
      const frame = usesIdleFallback
        ? extractScaledRegion(source, 0, 0)
        : extractScaledFrame(source, sourceFrameNumber);
      const fileName = `frame_${String(index + 1).padStart(2, "0")}.png`;
      fs.writeFileSync(path.join(entryOutputDir, fileName), encodePng(frame));
      appendFrameToSheet(frame, sheet, index);
    });
    fs.writeFileSync(path.join(entryOutputDir, "sheet.png"), encodePng(sheet));

    generated.push({
      ...entry,
      sourcePath: actualSourcePath,
      outputDir: entryOutputDir,
      sourceSize: `${source.width}x${source.height}`,
      frameCount: FRAME_ORDER.length,
      method: usesIdleFallback ? "idle duplicate" : "sheet frame map",
    });
  }

  const lines = [
    "# Ver.3 Codex 48x48 Sprite Generation",
    "",
    `- Generated at: ${new Date().toISOString()}`,
    `- Source root: \`${sourceRoot}\``,
    `- Output dir: \`${path.relative(repoRoot, outputDir)}\``,
    `- Frame order: \`${FRAME_ORDER.join(", ")}\``,
    `- Generated digimon: ${generated.length}`,
    `- Missing sources: ${missing.length}`,
    `- Invalid sources: ${invalid.length}`,
    "",
    "## Generated",
    "",
    "| id | name | stage | sprite | method | source size | frame count | source | output |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...generated.map(
      (entry) =>
        `| ${entry.id} | ${entry.name} | ${entry.stage} | ${entry.sprite} | ${entry.method} | ${entry.sourceSize} | ${entry.frameCount} | \`${entry.sourcePath}\` | \`${path.relative(repoRoot, entry.outputDir)}\` |`
    ),
    "",
    "## Missing Sources",
    "",
    missing.length === 0
      ? "- None"
      : missing
          .map(
            (entry) =>
              `- ${entry.id}: sheet=\`${entry.sourcePath || "N/A"}\`, idle=\`${entry.idlePath || "N/A"}\``
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
              `- ${entry.id}: \`${entry.sourcePath}\` (${entry.sourceSize})`
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
        outputDir,
        reportPath,
      },
      null,
      2
    )
  );

  if (missing.length > 0 || invalid.length > 0) {
    process.exitCode = 1;
  }
}

generateSprites();
