const fs = require("fs");
const path = require("path");
const { decodePng } = require("../../../scripts/generateVer3Codex48Sprites");
const {
  FRAME_COUNT,
  SHEET_FRAME_ORDER,
  parseEntries,
  staticSpriteNumbers,
} = require("../../../scripts/generateVer5Codex48Sprites");

const outputRoot = path.resolve(__dirname, "../../../public/Ver5_Mod_codex_48");

describe("Ver.5 Codex 48x48 스프라이트 팩", () => {
  test("Ver.3과 동일한 15프레임 순서를 사용한다", () => {
    expect(SHEET_FRAME_ORDER).toEqual([1, 2, 8, 9, 2, 12, 2, 12, 2, 3, 7, 6, 5, 10, 11]);
    expect(FRAME_COUNT).toBe(15);
  });

  test("생체 디지몬 19종의 프레임과 합본 크기가 정상이다", () => {
    const entries = parseEntries();
    expect(entries).toHaveLength(19);

    entries.forEach(({ sprite }) => {
      const dir = path.join(outputRoot, String(sprite));
      const frameFiles = fs
        .readdirSync(dir)
        .filter((file) => /^frame_\d{2}\.png$/.test(file))
        .sort();
      expect(frameFiles).toHaveLength(FRAME_COUNT);
      frameFiles.forEach((file) => {
        const image = decodePng(path.join(dir, file));
        expect([image.width, image.height]).toEqual([48, 48]);
      });

      const sheet = decodePng(path.join(dir, "sheet.png"));
      expect([sheet.width, sheet.height]).toEqual([48, 720]);
    });
  });

  test("디지타마와 사망 폼 정적 자산이 48x48 투명 PNG다", () => {
    staticSpriteNumbers.forEach((sprite) => {
      const image = decodePng(path.join(outputRoot, `${sprite}.png`));
      expect([image.width, image.height]).toEqual([48, 48]);
      const alphaAt = (x, y) => image.data[(y * image.width + x) * 4 + 3];
      expect(alphaAt(0, 0)).toBe(0);
      expect(alphaAt(47, 0)).toBe(0);
      expect(alphaAt(0, 47)).toBe(0);
      expect(alphaAt(47, 47)).toBe(0);
      expect(image.data.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
    });
  });
});
