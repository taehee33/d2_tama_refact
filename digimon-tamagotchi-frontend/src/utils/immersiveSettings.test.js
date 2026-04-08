import {
  DEFAULT_IMMERSIVE_SETTINGS,
  IMMERSIVE_LANDSCAPE_SIDES,
  IMMERSIVE_LAYOUT_MODES,
  IMMERSIVE_SKINS,
} from "../data/immersiveSettings";
import {
  getImmersiveSkinById,
  getNextImmersiveLandscapeSide,
  getNextImmersiveSkinId,
  normalizeImmersiveSettings,
} from "./immersiveSettings";

describe("immersiveSettings utils", () => {
  test("immersiveSettings가 없거나 잘못되면 기본값으로 복구한다", () => {
    expect(normalizeImmersiveSettings()).toEqual(DEFAULT_IMMERSIVE_SETTINGS);
    expect(
      normalizeImmersiveSettings({
        layoutMode: "diagonal",
        skinId: "unknown",
        landscapeSide: "upside-down",
      })
    ).toEqual(DEFAULT_IMMERSIVE_SETTINGS);
  });

  test("유효한 immersiveSettings는 그대로 유지한다", () => {
    const brickSkin = IMMERSIVE_SKINS.find((skin) => skin.id === "brick-ver1");

    expect(
      normalizeImmersiveSettings({
        layoutMode: IMMERSIVE_LAYOUT_MODES.LANDSCAPE,
        skinId: brickSkin.id,
        landscapeSide: IMMERSIVE_LANDSCAPE_SIDES.LEFT,
      })
    ).toEqual({
      layoutMode: IMMERSIVE_LAYOUT_MODES.LANDSCAPE,
      skinId: brickSkin.id,
      landscapeSide: IMMERSIVE_LANDSCAPE_SIDES.LEFT,
    });
    expect(brickSkin).toEqual(
      expect.objectContaining({
        landscapeOnly: true,
        landscapeFrameSrc: "/images/immersive/brick-ver1.png",
      })
    );
  });

  test("스킨 조회와 순환은 등록된 프리셋만 사용한다", () => {
    expect(getImmersiveSkinById("missing").id).toBe(
      DEFAULT_IMMERSIVE_SETTINGS.skinId
    );
    expect(getImmersiveSkinById("brick-ver1")).toEqual(
      expect.objectContaining({ id: "brick-ver1", landscapeOnly: true })
    );
    expect(getNextImmersiveSkinId(IMMERSIVE_SKINS[0].id)).toBe(
      IMMERSIVE_SKINS[1].id
    );
    expect(getNextImmersiveSkinId(IMMERSIVE_SKINS[1].id)).toBe(
      IMMERSIVE_SKINS[2].id
    );
    expect(getNextImmersiveSkinId(IMMERSIVE_SKINS[2].id)).toBe(
      IMMERSIVE_SKINS[3].id
    );
    expect(getNextImmersiveSkinId(IMMERSIVE_SKINS[3].id)).toBe(
      IMMERSIVE_SKINS[4].id
    );
    expect(getNextImmersiveSkinId(IMMERSIVE_SKINS[4].id)).toBe(
      IMMERSIVE_SKINS[0].id
    );
    expect(
      getNextImmersiveLandscapeSide(IMMERSIVE_LANDSCAPE_SIDES.AUTO)
    ).toBe(IMMERSIVE_LANDSCAPE_SIDES.LEFT);
    expect(
      getNextImmersiveLandscapeSide(IMMERSIVE_LANDSCAPE_SIDES.LEFT)
    ).toBe(IMMERSIVE_LANDSCAPE_SIDES.RIGHT);
    expect(
      getNextImmersiveLandscapeSide(IMMERSIVE_LANDSCAPE_SIDES.RIGHT)
    ).toBe(IMMERSIVE_LANDSCAPE_SIDES.AUTO);
  });
});
