export function resolveArenaGhostV2Enabled({
  nodeEnv = process.env.NODE_ENV,
  featureFlag = process.env.REACT_APP_ARENA_GHOST_V2,
} = {}) {
  if (featureFlag === "false") {
    return false;
  }

  return nodeEnv === "development" || featureFlag === "true";
}

export const ARENA_GHOST_V2_ENABLED = resolveArenaGhostV2Enabled();

export function resolveRealtimeArenaMvpEnabled({
  nodeEnv = process.env.NODE_ENV,
  featureFlag = process.env.REACT_APP_REALTIME_ARENA_MVP,
} = {}) {
  return nodeEnv === "development" || featureFlag === "true";
}

export const REALTIME_ARENA_MVP_ENABLED = resolveRealtimeArenaMvpEnabled();
