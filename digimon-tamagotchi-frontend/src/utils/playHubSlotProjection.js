import { adaptDataMapToOldFormat } from "../data/v1/adapter";
import { digimonDataVer1 } from "../data/v1/digimons";
import { digimonDataVer2 } from "../data/v2modkor";
import { digimonDataVer3 } from "../data/v3";
import { digimonDataVer4 } from "../data/v4";
import { digimonDataVer5 } from "../data/v5";
import { buildLoadedSlotRuntimeState } from "../hooks/useGameData";
import {
  getDigimonDataMapByVersion,
  normalizeDigimonVersionLabel,
} from "./digimonVersionUtils";

const ADAPTED_DATA_MAPS_BY_VERSION = {
  "Ver.1": adaptDataMapToOldFormat(digimonDataVer1),
  "Ver.2": adaptDataMapToOldFormat(digimonDataVer2),
  "Ver.3": adaptDataMapToOldFormat(digimonDataVer3),
  "Ver.4": adaptDataMapToOldFormat(digimonDataVer4),
  "Ver.5": adaptDataMapToOldFormat(digimonDataVer5),
};

export function buildPlayHubProjectedSlot(slot = {}) {
  const version = normalizeDigimonVersionLabel(slot.version || "Ver.1");
  const dataMap = ADAPTED_DATA_MAPS_BY_VERSION[version] || ADAPTED_DATA_MAPS_BY_VERSION["Ver.1"];
  const savedStats = { ...(slot.digimonStats || {}) };
  const savedName = slot.selectedDigimon || savedStats.selectedDigimon || null;

  if (!savedName) {
    return {
      ...slot,
      projectedDigimonStats: savedStats,
    };
  }

  const runtimeState = buildLoadedSlotRuntimeState({
    slotData: slot,
    savedName,
    savedStats,
    rootSlotFields: {
      isLightsOn: slot.isLightsOn !== undefined ? slot.isLightsOn : true,
      wakeUntil: slot.wakeUntil ?? null,
    },
    dataMap,
    slotRuntimeDataMap: dataMap,
    runtimeAdaptedDataMaps: ADAPTED_DATA_MAPS_BY_VERSION,
    evolutionDataForSlot: getDigimonDataMapByVersion(version),
  });

  return {
    ...slot,
    projectedDigimonStats: runtimeState.digimonStats,
  };
}
