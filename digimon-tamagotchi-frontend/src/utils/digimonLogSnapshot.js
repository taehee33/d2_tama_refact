function normalizeMaps(maps = []) {
  return maps.flat().filter((map) => map && typeof map === "object");
}

export function resolveDigimonLogName(digimonId, ...maps) {
  const normalizedId = typeof digimonId === "string" ? digimonId.trim() : "";
  if (!normalizedId) return null;

  for (const map of normalizeMaps(maps)) {
    const byKey = map[normalizedId]?.name;
    if (byKey) return byKey;

    const match = Object.values(map).find(
      (entry) => entry && (entry.id === normalizedId || entry.name === normalizedId)
    );
    if (match?.name) return match.name;
  }

  return normalizedId;
}

export function resolveDigimonSnapshotFromToken(token, ...maps) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) {
    return { digimonId: null, digimonName: null };
  }

  for (const map of normalizeMaps(maps)) {
    if (map[normalizedToken]) {
      return {
        digimonId: normalizedToken,
        digimonName: map[normalizedToken]?.name || normalizedToken,
      };
    }

    const match = Object.entries(map).find(([, entry]) => {
      return entry && (entry.id === normalizedToken || entry.name === normalizedToken);
    });

    if (match) {
      const [key, entry] = match;
      return {
        digimonId: entry?.id || key,
        digimonName: entry?.name || normalizedToken,
      };
    }
  }

  return {
    digimonId: null,
    digimonName: normalizedToken,
  };
}

export function sanitizeDigimonLogSnapshot(snapshot = {}) {
  const digimonId = typeof snapshot?.digimonId === "string" ? snapshot.digimonId.trim() : "";
  const digimonName =
    typeof snapshot?.digimonName === "string" ? snapshot.digimonName.trim() : "";

  return {
    ...(digimonId ? { digimonId } : {}),
    ...(digimonName ? { digimonName } : {}),
  };
}

export function buildDigimonLogSnapshot(digimonId, ...maps) {
  const normalizedId = typeof digimonId === "string" ? digimonId.trim() : "";
  if (!normalizedId) return {};

  return sanitizeDigimonLogSnapshot({
    digimonId: normalizedId,
    digimonName: resolveDigimonLogName(normalizedId, ...maps),
  });
}

export function getLifeStartDigimonId(slotVersion = "Ver.1", currentDigimonId = null) {
  if (typeof slotVersion === "string" && slotVersion.includes("2")) {
    return "DigitamaV2";
  }

  if (typeof currentDigimonId === "string" && currentDigimonId.includes("V2")) {
    return "DigitamaV2";
  }

  return "Digitama";
}
