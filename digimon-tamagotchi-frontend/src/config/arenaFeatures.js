export const ARENA_GHOST_V2_ENABLED =
  process.env.REACT_APP_ARENA_GHOST_V2 === "true";

export function resolveRealtimeArenaMvpEnabled({
  nodeEnv = process.env.NODE_ENV,
  featureFlag = process.env.REACT_APP_REALTIME_ARENA_MVP,
} = {}) {
  return nodeEnv === "development" || featureFlag === "true";
}

export const REALTIME_ARENA_MVP_ENABLED = resolveRealtimeArenaMvpEnabled();
