const METRICS_KEY = "__DIGIMON_RUNTIME_METRICS__";

function getRuntimeMetricsStore() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!window[METRICS_KEY]) {
    window[METRICS_KEY] = {
      counters: {},
      lastPayloads: {},
      lastUpdatedAt: null,
    };
  }

  return window[METRICS_KEY];
}

export function recordRuntimeMetric(name, payload = null) {
  const store = getRuntimeMetricsStore();

  if (!store || !name) {
    return;
  }

  store.counters[name] = (store.counters[name] || 0) + 1;
  store.lastPayloads[name] = payload;
  store.lastUpdatedAt = Date.now();
}

export function resetRuntimeMetrics() {
  const store = getRuntimeMetricsStore();

  if (!store) {
    return;
  }

  store.counters = {};
  store.lastPayloads = {};
  store.lastUpdatedAt = Date.now();
}
