const fs = require("fs");
const path = require("path");
const { decodePng } = require("../../../scripts/generateVer3Codex48Sprites");
const {
  FRAME_COUNT,
  parseLivingEntries,
} = require("../../../scripts/buildVer5CodexSpritePack");

const publicRoot = path.resolve(__dirname, "../../../public");
const baselineDir = path.join(publicRoot, "Ver2_Mod_Kor");
const frameRoot = path.join(publicRoot, "Ver5_Mod_codex_48");
const outputDir = path.join(publicRoot, "Ver5_Mod_codex");

describe("Ver.5 Codex 평면 스프라이트 팩", () => {
  test("Ver.2와 동일한 PNG 파일 번호 집합을 가진다", () => {
    const getNames = (dir) =>
      fs.readdirSync(dir).filter((name) => name.endsWith(".png")).sort();
    expect(getNames(outputDir)).toEqual(getNames(baselineDir));
    expect(getNames(outputDir)).toHaveLength(597);
  });

  test("19종의 15프레임이 Codex 48 원본과 일치한다", () => {
    const entries = parseLivingEntries();
    expect(entries).toHaveLength(19);

    entries.forEach(({ sprite }) => {
      for (let index = 0; index < FRAME_COUNT; index += 1) {
        const source = path.join(
          frameRoot,
          String(sprite),
          `frame_${String(index + 1).padStart(2, "0")}.png`
        );
        const output = path.join(outputDir, `${sprite + index}.png`);
        expect(fs.readFileSync(output)).toEqual(fs.readFileSync(source));
        const image = decodePng(output);
        expect([image.width, image.height]).toEqual([48, 48]);
      }
    });
  });

  test("Ver.5 디지타마와 사망 폼을 사용한다", () => {
    [0, 133, 134, 135, 159, 160].forEach((sprite) => {
      expect(fs.readFileSync(path.join(outputDir, `${sprite}.png`))).toEqual(
        fs.readFileSync(path.join(frameRoot, `${sprite}.png`))
      );
    });
  });
});
