import {
  DEFAULT_IMMERSIVE_SETTINGS,
  IMMERSIVE_LANDSCAPE_SIDES,
  IMMERSIVE_LAYOUT_MODES,
  IMMERSIVE_SKINS,
  PIXEL_SKIN_DEFAULT_APPEARANCE,
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

  test.each(["tama-mint", "tama-clear-blue"])(
    "%s 저장값은 기본(없음) 스킨으로 정규화한다",
    (removedSkinId) => {
      expect(
        normalizeImmersiveSettings({
          layoutMode: IMMERSIVE_LAYOUT_MODES.PORTRAIT,
          skinId: removedSkinId,
          landscapeSide: IMMERSIVE_LANDSCAPE_SIDES.AUTO,
        })
      ).toEqual(DEFAULT_IMMERSIVE_SETTINGS);
    }
  );

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
      appearanceBySkin: PIXEL_SKIN_DEFAULT_APPEARANCE,
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
    IMMERSIVE_SKINS.forEach((skin, index) => {
      expect(getNextImmersiveSkinId(skin.id)).toBe(
        IMMERSIVE_SKINS[(index + 1) % IMMERSIVE_SKINS.length].id
      );
    });
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

  test("스킨별 외형 색상을 독립 보존하고 잘못된 값은 해당 기본 팔레트로 복구한다", () => {
    const normalized = normalizeImmersiveSettings({
      appearanceBySkin: {
        "pixel-split-brick": {
          backgroundLeft: "#abcdef",
          backgroundRight: "not-a-color",
          device: "#123456",
        },
        "pixel-red-device": {
          backgroundLeft: "#654321",
          backgroundRight: "#112233",
          device: "#445566",
        },
      },
    });

    expect(normalized.appearanceBySkin["pixel-split-brick"]).toEqual({
      backgroundLeft: "#ABCDEF",
      backgroundRight: PIXEL_SKIN_DEFAULT_APPEARANCE["pixel-split-brick"].backgroundRight,
      device: "#123456",
    });
    expect(normalized.appearanceBySkin["pixel-red-device"]).toEqual({
      backgroundLeft: "#654321",
      backgroundRight: "#112233",
      device: "#445566",
    });
    expect(normalized.appearanceBySkin["pixel-dark-battle"]).toEqual(
      PIXEL_SKIN_DEFAULT_APPEARANCE["pixel-dark-battle"]
    );
  });
});
