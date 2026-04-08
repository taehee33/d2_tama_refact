import {
  DEFAULT_IMMERSIVE_SETTINGS,
  IMMERSIVE_LANDSCAPE_SIDES,
  IMMERSIVE_LAYOUT_MODES,
  IMMERSIVE_SKINS,
} from "../data/immersiveSettings";

const IMMERSIVE_SKIN_IDS = IMMERSIVE_SKINS.map((skin) => skin.id);

export function isValidImmersiveLayoutMode(layoutMode) {
  return Object.values(IMMERSIVE_LAYOUT_MODES).includes(layoutMode);
}

export function isValidImmersiveSkinId(skinId) {
  return IMMERSIVE_SKIN_IDS.includes(skinId);
}

export function isValidImmersiveLandscapeSide(landscapeSide) {
  return Object.values(IMMERSIVE_LANDSCAPE_SIDES).includes(landscapeSide);
}

export function normalizeImmersiveSettings(settings) {
  if (!settings || typeof settings !== "object") {
    return { ...DEFAULT_IMMERSIVE_SETTINGS };
  }

  return {
    layoutMode: isValidImmersiveLayoutMode(settings.layoutMode)
      ? settings.layoutMode
      : DEFAULT_IMMERSIVE_SETTINGS.layoutMode,
    skinId: isValidImmersiveSkinId(settings.skinId)
      ? settings.skinId
      : DEFAULT_IMMERSIVE_SETTINGS.skinId,
    landscapeSide: isValidImmersiveLandscapeSide(settings.landscapeSide)
      ? settings.landscapeSide
      : DEFAULT_IMMERSIVE_SETTINGS.landscapeSide,
  };
}

export function getImmersiveSkinById(skinId) {
  return (
    IMMERSIVE_SKINS.find((skin) => skin.id === skinId) ||
    IMMERSIVE_SKINS.find(
      (skin) => skin.id === DEFAULT_IMMERSIVE_SETTINGS.skinId
    ) ||
    IMMERSIVE_SKINS[0]
  );
}

export function getNextImmersiveSkinId(skinId) {
  const currentIndex = IMMERSIVE_SKIN_IDS.indexOf(skinId);

  if (currentIndex < 0) {
    return DEFAULT_IMMERSIVE_SETTINGS.skinId;
  }

  return IMMERSIVE_SKIN_IDS[(currentIndex + 1) % IMMERSIVE_SKIN_IDS.length];
}

export function getNextImmersiveLandscapeSide(landscapeSide) {
  const cycle = [
    IMMERSIVE_LANDSCAPE_SIDES.AUTO,
    IMMERSIVE_LANDSCAPE_SIDES.LEFT,
    IMMERSIVE_LANDSCAPE_SIDES.RIGHT,
  ];
  const currentIndex = cycle.indexOf(landscapeSide);

  if (currentIndex < 0) {
    return DEFAULT_IMMERSIVE_SETTINGS.landscapeSide;
  }

  return cycle[(currentIndex + 1) % cycle.length];
}
