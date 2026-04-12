import { BACKGROUND_TYPES, DEFAULT_BACKGROUND_SETTINGS } from "../data/backgroundData";
import { getBackgroundSprite } from "./backgroundUtils";
import {
  getSlotDigimonData,
  getSlotDisplayName,
  getSlotStageLabel,
} from "./slotViewUtils";
import { getSpriteBasePathByVersion } from "./digimonVersionUtils";

function normalizeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  return Boolean(value);
}

const previewStageTranslations = {
  Digitama: "디지타마",
  "Baby I": "유년기 I",
  "Baby II": "유년기 II",
  Baby1: "유년기 I",
  Baby2: "유년기 II",
  Child: "성장기",
  Adult: "성숙기",
  Perfect: "완전체",
  Ultimate: "궁극체",
  "Super Ultimate": "초궁극체",
  SuperUltimate: "초궁극체",
};

function resolvePreviewStageLabel(slot) {
  const rawStage = slot?.digimonStats?.evolutionStage;

  if (rawStage && previewStageTranslations[rawStage]) {
    return previewStageTranslations[rawStage];
  }

  const stageLabel = getSlotStageLabel(slot);

  if (stageLabel && stageLabel !== "Unknown") {
    return stageLabel;
  }

  return "단계 미상";
}

function resolveBackgroundLabel(backgroundNumber) {
  const matchedBackground = BACKGROUND_TYPES.find((background) =>
    background.sprites.includes(backgroundNumber)
  );

  if (!matchedBackground) {
    return "초원 · 낮";
  }

  const phaseLabels = ["낮", "석양", "밤"];
  const phaseIndex = matchedBackground.sprites.indexOf(backgroundNumber);

  return `${matchedBackground.name} · ${phaseLabels[phaseIndex] || "낮"}`;
}

function resolveCommunityScene(source, recordedAt = null) {
  if (!source) {
    return null;
  }

  const stats = source.digimonStats || {};
  const selectedDigimon = source.selectedDigimon || stats.selectedDigimon || "Digitama";
  const version = source.version || "Ver.1";
  const digimonData = getSlotDigimonData({ selectedDigimon, version }) || {};
  const backgroundSettings =
    source.backgroundSettings ||
    source.visual?.backgroundSettings ||
    DEFAULT_BACKGROUND_SETTINGS;
  const resolvedRecordedAt =
    source.recordedAt || source.createdAt || source.updatedAt || recordedAt || null;
  const backgroundNumber =
    normalizeInteger(
      source.backgroundNumber ??
        source.visual?.backgroundNumber ??
        getBackgroundSprite(
          backgroundSettings,
          resolvedRecordedAt ? new Date(resolvedRecordedAt) : new Date()
        )
    ) || 162;
  const spriteBasePath =
    source.spriteBasePath ||
    source.visual?.spriteBasePath ||
    digimonData.spriteBasePath ||
    getSpriteBasePathByVersion(version);
  const spriteNumber = normalizeInteger(
    source.spriteNumber ?? source.visual?.spriteNumber ?? digimonData.sprite ?? 0
  );

  return {
    selectedDigimon,
    version,
    digimonDisplayName:
      source.digimonDisplayName || source.visual?.digimonDisplayName || getSlotDisplayName({ selectedDigimon, version, digimonNickname: source.digimonNickname }),
    stageLabel:
      source.stageLabel ||
      source.visual?.stageLabel ||
      resolvePreviewStageLabel({
        ...source,
        selectedDigimon,
        version,
      }),
    spriteBasePath,
    spriteNumber,
    spriteSrc:
      source.spriteSrc ||
      source.visual?.spriteSrc ||
      `${spriteBasePath}/${spriteNumber}.png`,
    backgroundNumber,
    backgroundLabel: resolveBackgroundLabel(backgroundNumber),
    isLightsOn: normalizeBoolean(
      source.isLightsOn ?? source.visual?.isLightsOn ?? stats.isLightsOn,
      true
    ),
    sleepStatus: source.sleepStatus || source.visual?.sleepStatus || stats.sleepStatus || "AWAKE",
    poopCount: normalizeInteger(source.poopCount ?? source.visual?.poopCount ?? stats.poopCount),
    isFrozen: normalizeBoolean(source.isFrozen ?? source.visual?.isFrozen ?? stats.isFrozen),
    isDead: normalizeBoolean(source.isDead ?? source.visual?.isDead ?? stats.isDead),
    isInjured: normalizeBoolean(source.isInjured ?? source.visual?.isInjured ?? stats.isInjured),
    recordedAt: resolvedRecordedAt,
  };
}

export function buildCommunityPreviewFromSlot(slot) {
  if (!slot) {
    return null;
  }

  const stats = slot.digimonStats || {};
  const totalBattles = normalizeInteger(stats.totalBattles);
  const totalBattlesWon = normalizeInteger(stats.totalBattlesWon);

  return {
    slotId: String(slot.id),
    slotName: slot.slotName || `슬롯${slot.id}`,
    selectedDigimon: slot.selectedDigimon || stats.selectedDigimon || "Digitama",
    digimonDisplayName: slot.digimonDisplayName || getSlotDisplayName(slot),
    stageLabel: resolvePreviewStageLabel(slot),
    version: slot.version || "Ver.1",
    device: slot.device || "Digital Monster Color 25th",
    weight: normalizeInteger(stats.weight),
    careMistakes: normalizeInteger(stats.careMistakes),
    totalBattles,
    totalBattlesWon,
    winRate: totalBattles > 0 ? Math.round((totalBattlesWon / totalBattles) * 100) : 0,
    recordedAt: new Date().toISOString(),
    visual: resolveCommunityScene(slot),
  };
}

export function buildCommunitySnapshotVisual(snapshot) {
  return resolveCommunityScene(snapshot);
}
