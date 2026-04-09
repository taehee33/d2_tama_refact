import { getRequiredDigimonIds } from "../logic/encyclopediaMaster";
import { SUPPORTED_DIGIMON_VERSIONS } from "./digimonVersionUtils";

const VERSION_DEFINITIONS = SUPPORTED_DIGIMON_VERSIONS.map((version) => ({
  version,
}));

function getEncyclopediaEntry(versionData, digimonId) {
  if (!versionData || !digimonId) {
    return null;
  }

  return (
    versionData[digimonId] ||
    Object.entries(versionData).find(
      ([key]) => (key || "").toLowerCase() === (digimonId || "").toLowerCase()
    )?.[1] ||
    null
  );
}

export function buildEncyclopediaVersionSummary(version, encyclopedia = {}) {
  const requiredIds = getRequiredDigimonIds(version);
  const versionData = encyclopedia[version] || {};
  const discoveredCount = requiredIds.filter(
    (digimonId) => getEncyclopediaEntry(versionData, digimonId)?.isDiscovered === true
  ).length;

  return {
    version,
    discoveredCount,
    totalCount: requiredIds.length,
    remainingCount: Math.max(requiredIds.length - discoveredCount, 0),
    isComplete: requiredIds.length > 0 && discoveredCount === requiredIds.length,
  };
}

export function buildEncyclopediaSummary(encyclopedia = {}) {
  const versions = VERSION_DEFINITIONS.map(({ version }) =>
    buildEncyclopediaVersionSummary(version, encyclopedia)
  );

  return {
    versions,
    totalDiscoveredCount: versions.reduce(
      (sum, versionSummary) => sum + versionSummary.discoveredCount,
      0
    ),
    totalRequiredCount: versions.reduce(
      (sum, versionSummary) => sum + versionSummary.totalCount,
      0
    ),
  };
}
