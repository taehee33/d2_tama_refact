import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import { db } from "../firebase";

export const ARENA_HISTORY_PAGE_SIZE = 5;
const ARENA_HISTORY_LOOKAHEAD_SIZE = ARENA_HISTORY_PAGE_SIZE + 1;

function createHistoryStream(key, conditions) {
  return {
    key,
    conditions,
    queue: [],
    cursor: null,
    initialized: false,
    hasMore: true,
  };
}

export function buildArenaHistoryStreamDefinitions(filter = "all", currentUid = null) {
  if (filter.startsWith("combat:") && filter.slice("combat:".length)) {
    return [{
      key: "combat",
      conditions: [["attackerCombatIdentityId", filter.slice("combat:".length)]],
    }];
  }
  if (filter.startsWith("ghost:") && filter.slice("ghost:".length) && currentUid) {
    const ghostId = filter.slice("ghost:".length);
    return [
      {
        key: "attack",
        conditions: [["attackerId", currentUid], ["defenderGhostId", ghostId]],
      },
      {
        key: "defense",
        conditions: [["defenderId", currentUid], ["defenderGhostId", ghostId]],
      },
    ];
  }
  return [
    { key: "attack", conditions: [["attackerId", currentUid]] },
    { key: "defense", conditions: [["defenderId", currentUid]] },
  ];
}

function createHistoryPager(filter, currentUid) {
  return Object.fromEntries(
    buildArenaHistoryStreamDefinitions(filter, currentUid)
      .map(({ key, conditions }) => [key, createHistoryStream(key, conditions)])
  );
}

function createFilterCache(filter, currentUid) {
  return {
    pager: createHistoryPager(filter, currentUid),
    pages: [],
    seenBattleIds: new Set(),
  };
}

function cloneHistoryPager(pager) {
  return Object.fromEntries(
    Object.entries(pager).map(([key, stream]) => [key, {
      ...stream,
      queue: [...stream.queue],
    }])
  );
}

function getOccurredAtTime(log) {
  return log?.occurredAt?.getTime?.() || 0;
}

function takeNextHistoryStreamsPage({ streams, seenBattleIds, pageSize }) {
  const queues = streams.map((stream) => [...stream.queue]);
  const page = [];

  while (page.length < pageSize && queues.some((queue) => queue.length > 0)) {
    let selectedQueueIndex = -1;
    let selectedTime = -Infinity;
    queues.forEach((queue, index) => {
      const nextTime = getOccurredAtTime(queue[0]);
      if (queue.length > 0 && nextTime > selectedTime) {
        selectedQueueIndex = index;
        selectedTime = nextTime;
      }
    });
    if (selectedQueueIndex < 0) break;
    const selected = queues[selectedQueueIndex].shift();
    if (!selected || seenBattleIds.has(selected.battleId)) continue;
    seenBattleIds.add(selected.battleId);
    page.push(selected);
  }

  return { page, queues };
}

export function takeNextArenaHistoryPage({ attackQueue = [], defenseQueue = [], seenBattleIds = new Set(), pageSize = ARENA_HISTORY_PAGE_SIZE }) {
  const result = takeNextHistoryStreamsPage({
    streams: [{ queue: attackQueue }, { queue: defenseQueue }],
    seenBattleIds,
    pageSize,
  });
  return {
    page: result.page,
    attackQueue: result.queues[0],
    defenseQueue: result.queues[1],
  };
}

export function normalizeArenaBattleSummary(log = {}, currentUid = null) {
  const attacker = log.attackerSnapshot || {};
  const defender = log.defenderGhostSnapshot || {};
  const timestamp = typeof log.timestamp?.toDate === "function"
    ? log.timestamp.toDate()
    : new Date(log.timestamp || 0);
  return {
    ...log,
    battleId: log.battleId || log.id,
    isAttack: log.attackerId === currentUid,
    attackerName: attacker.digimonName || log.attackerDigimonName || "알 수 없는 디지몬",
    defenderName: defender.digimonName || log.defenderDigimonName || "알 수 없는 Ghost",
    attackerSprite: attacker.sprite ?? 0,
    defenderSprite: defender.sprite ?? 0,
    attackerSpriteBasePath: attacker.spriteBasePath || "/images",
    defenderSpriteBasePath: defender.spriteBasePath || "/images",
    occurredAt: Number.isNaN(timestamp.getTime()) ? null : timestamp,
    archiveStatus: log.archiveStatus || (log.archiveId ? "ready" : "legacy"),
  };
}

export function buildArenaHistoryFilters(logs = [], myGhosts = [], currentCombatIdentityId = null) {
  const ownGhostIds = new Set(myGhosts.map((ghost) => ghost.ghostId));
  const filters = [{ value: "all", label: "전체 기록" }];
  if (currentCombatIdentityId) {
    filters.push({ value: `combat:${currentCombatIdentityId}`, label: "현재 연결 · 공격 기록" });
  }
  const seenGhostIds = new Set();
  for (const log of logs) {
    if (!log.defenderGhostId || seenGhostIds.has(log.defenderGhostId)) continue;
    seenGhostIds.add(log.defenderGhostId);
    const name = log.defenderName || "Ghost";
    filters.push({
      value: `ghost:${log.defenderGhostId}`,
      label: ownGhostIds.has(log.defenderGhostId)
        ? `${name} · 내 Ghost`
        : `${name} · 삭제된 Ghost 또는 이전 아레나 기록`,
    });
  }
  return filters;
}

export function filterArenaBattleHistory(logs, filter) {
  if (!filter || filter === "all") return logs;
  if (filter.startsWith("combat:")) {
    return logs.filter((log) => `combat:${log.attackerCombatIdentityId}` === filter);
  }
  if (filter.startsWith("ghost:")) {
    return logs.filter((log) => `ghost:${log.defenderGhostId}` === filter);
  }
  return logs;
}

function pagerHasMore(pager) {
  return Object.values(pager).some((stream) =>
    stream.queue.length > 0 || !stream.initialized || stream.hasMore
  );
}

export function useArenaBattleHistory({ currentUser, isOnline }) {
  const currentUid = currentUser?.uid || null;
  const [filter, setFilter] = useState("all");
  const [logs, setLogs] = useState([]);
  const [discoveredLogs, setDiscoveredLogs] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const filterCachesRef = useRef(new Map());
  const discoveredBattleIdsRef = useRef(new Set());
  const requestSequenceRef = useRef(0);
  const pageRequestInFlightRef = useRef(false);
  const ownerUidRef = useRef(currentUid);

  const rememberDiscoveredLogs = useCallback((nextLogs) => {
    const uniqueLogs = nextLogs.filter((log) => {
      if (!log?.battleId || discoveredBattleIdsRef.current.has(log.battleId)) return false;
      discoveredBattleIdsRef.current.add(log.battleId);
      return true;
    });
    if (uniqueLogs.length > 0) {
      setDiscoveredLogs((currentLogs) => [...currentLogs, ...uniqueLogs]);
    }
  }, []);

  const fetchStream = useCallback(async (stream) => {
    if (!currentUser || !db || (stream.initialized && !stream.hasMore)) return;
    const constraints = stream.conditions.map(([fieldName, value]) => where(fieldName, "==", value));
    constraints.push(orderBy("timestamp", "desc"));
    if (stream.cursor) constraints.push(startAfter(stream.cursor));
    constraints.push(limit(ARENA_HISTORY_LOOKAHEAD_SIZE));

    const snapshot = await getDocs(query(collection(db, "arena_battle_logs"), ...constraints));
    const nextLogs = snapshot.docs.map((documentSnapshot) =>
      normalizeArenaBattleSummary(
        { id: documentSnapshot.id, ...documentSnapshot.data() },
        currentUser.uid
      )
    );
    stream.queue.push(...nextLogs);
    stream.cursor = snapshot.docs[snapshot.docs.length - 1] || stream.cursor;
    stream.initialized = true;
    stream.hasMore = snapshot.docs.length === ARENA_HISTORY_LOOKAHEAD_SIZE;
  }, [currentUser]);

  const collectNextPage = useCallback(async (cache) => {
    const streams = Object.values(cache.pager);
    const page = [];

    while (page.length < ARENA_HISTORY_PAGE_SIZE) {
      await Promise.all(
        streams
          .filter((stream) => stream.queue.length === 0 && (!stream.initialized || stream.hasMore))
          .map((stream) => fetchStream(stream))
      );

      const result = takeNextHistoryStreamsPage({
        streams,
        seenBattleIds: cache.seenBattleIds,
        pageSize: ARENA_HISTORY_PAGE_SIZE - page.length,
      });
      streams.forEach((stream, index) => {
        stream.queue = result.queues[index];
      });
      page.push(...result.page);

      if (!pagerHasMore(cache.pager) || result.page.length === 0) break;
    }

    return { logs: page, hasNext: pagerHasMore(cache.pager) };
  }, [fetchStream]);

  const showPage = useCallback((cache, nextPageIndex) => {
    const page = cache?.pages?.[nextPageIndex] || null;
    setPageIndex(nextPageIndex);
    setLogs(page?.logs || []);
    setHasMore(Boolean(cache?.pages?.[nextPageIndex + 1] || page?.hasNext));
    setError("");
  }, []);

  const loadFirstPage = useCallback(async (nextFilter, { force = false } = {}) => {
    if (!currentUser || !isOnline || !db) {
      requestSequenceRef.current += 1;
      setLogs([]);
      setPageIndex(0);
      setHasMore(false);
      setLoading(false);
      setLoadingMore(false);
      setError("");
      return false;
    }

    if (!force) {
      const cached = filterCachesRef.current.get(nextFilter);
      if (cached?.pages?.[0]) {
        showPage(cached, 0);
        return true;
      }
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    const cache = createFilterCache(nextFilter, currentUser.uid);
    filterCachesRef.current.set(nextFilter, cache);
    setLoading(true);
    setLogs([]);
    setPageIndex(0);
    setHasMore(false);
    setError("");
    try {
      const firstPage = await collectNextPage(cache);
      if (requestId !== requestSequenceRef.current) return false;
      cache.pages[0] = firstPage;
      rememberDiscoveredLogs(firstPage.logs);
      showPage(cache, 0);
      return true;
    } catch (loadError) {
      if (requestId !== requestSequenceRef.current) return false;
      filterCachesRef.current.delete(nextFilter);
      setError(loadError?.message || "배틀 기록을 불러오지 못했습니다.");
      setHasMore(false);
      return false;
    } finally {
      if (requestId === requestSequenceRef.current) setLoading(false);
    }
  }, [collectNextPage, currentUser, isOnline, rememberDiscoveredLogs, showPage]);

  const refresh = useCallback(async () => {
    filterCachesRef.current = new Map();
    pageRequestInFlightRef.current = false;
    return loadFirstPage(filter, { force: true });
  }, [filter, loadFirstPage]);

  const changeFilter = useCallback((nextFilter) => {
    const normalizedFilter = typeof nextFilter === "string" && nextFilter ? nextFilter : "all";
    if (normalizedFilter === filter) {
      const cached = filterCachesRef.current.get(normalizedFilter);
      if (cached?.pages?.[0]) showPage(cached, 0);
      return;
    }
    requestSequenceRef.current += 1;
    setFilter(normalizedFilter);
    setPageIndex(0);
  }, [filter, showPage]);

  const goToNextPage = useCallback(async () => {
    if (!currentUser || !isOnline || !db || loading || loadingMore || pageRequestInFlightRef.current) return false;
    const cache = filterCachesRef.current.get(filter);
    if (!cache) return false;
    const nextPageIndex = pageIndex + 1;
    if (cache.pages[nextPageIndex]) {
      showPage(cache, nextPageIndex);
      return true;
    }
    if (!cache.pages[pageIndex]?.hasNext) return false;

    pageRequestInFlightRef.current = true;
    setLoadingMore(true);
    setError("");
    const pagerCheckpoint = cloneHistoryPager(cache.pager);
    const seenBattleIdsCheckpoint = new Set(cache.seenBattleIds);
    try {
      const nextPage = await collectNextPage(cache);
      if (nextPage.logs.length === 0) {
        cache.pages[pageIndex].hasNext = false;
        setHasMore(false);
        return false;
      }
      cache.pages[nextPageIndex] = nextPage;
      rememberDiscoveredLogs(nextPage.logs);
      showPage(cache, nextPageIndex);
      return true;
    } catch (loadError) {
      cache.pager = pagerCheckpoint;
      cache.seenBattleIds = seenBattleIdsCheckpoint;
      setError(loadError?.message || "다음 배틀 기록을 불러오지 못했습니다.");
      return false;
    } finally {
      pageRequestInFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [collectNextPage, currentUser, filter, isOnline, loading, loadingMore, pageIndex, rememberDiscoveredLogs, showPage]);

  const goToPreviousPage = useCallback(() => {
    if (pageIndex <= 0 || loading || loadingMore) return false;
    const cache = filterCachesRef.current.get(filter);
    if (!cache?.pages?.[pageIndex - 1]) return false;
    showPage(cache, pageIndex - 1);
    return true;
  }, [filter, loading, loadingMore, pageIndex, showPage]);

  useEffect(() => {
    if (ownerUidRef.current === currentUid) return;
    ownerUidRef.current = currentUid;
    requestSequenceRef.current += 1;
    filterCachesRef.current = new Map();
    discoveredBattleIdsRef.current = new Set();
    setDiscoveredLogs([]);
    setFilter("all");
  }, [currentUid]);

  useEffect(() => {
    void loadFirstPage(filter);
  }, [filter, loadFirstPage]);

  return useMemo(
    () => ({
      filter,
      logs,
      discoveredLogs,
      loading,
      loadingMore,
      hasMore,
      hasPrevious: pageIndex > 0,
      pageNumber: logs.length > 0 ? pageIndex + 1 : 0,
      error,
      refresh,
      changeFilter,
      goToPreviousPage,
      goToNextPage,
    }),
    [changeFilter, discoveredLogs, error, filter, goToNextPage, goToPreviousPage, hasMore, loading, loadingMore, logs, pageIndex, refresh]
  );
}
