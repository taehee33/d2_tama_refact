import { updateEncyclopedia } from "./useEncyclopedia";
import { isStarterDigimonId } from "../utils/digimonVersionUtils";

export async function syncEvolutionEncyclopediaEntries({
  previousDigimonId,
  previousStats,
  targetId,
  nextStats,
  currentUser,
  version,
  swallowErrors = false,
}) {
  const operations = [];

  if (previousDigimonId) {
    operations.push(() =>
      updateEncyclopedia(
        previousDigimonId,
        previousStats,
        "evolution",
        currentUser,
        version
      )
    );
  }

  if (targetId && !isStarterDigimonId(targetId)) {
    operations.push(() =>
      updateEncyclopedia(targetId, nextStats, "discovery", currentUser, version)
    );
  }

  for (const operation of operations) {
    if (swallowErrors) {
      await operation().catch(() => {});
      continue;
    }

    await operation();
  }
}
