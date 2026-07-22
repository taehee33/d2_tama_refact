import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import { db } from "../firebase";

export const ARENA_HISTORY_PAGE_SIZE = 5;

function createHistoryStream(fieldName) {
  return {
    fieldName,
    queue: [],
    cursor: null,
    initialized: false,
    hasMore: true,
  };
}

function createHistoryPager() {
  return {
    attack: createHistoryStream("attackerId"),
    defense: createHistoryStream("defenderId"),
  };
}

function getOccurredAtTime(log) {
  return log?.occurredAt?.getTime?.() || 0;
}

export function takeNextArenaHistoryPage({ attackQueue = [], defenseQueue = [], seenBattleIds = new Set(), pageSize = ARENA_HISTORY_PAGE_SIZE }) {
  const remainingAttack = [...attackQueue];
  const remainingDefense = [...defenseQueue];
  const page = [];

  while (page.length < pageSize && (remainingAttack.length > 0 || remainingDefense.length > 0)) {
    const attack = remainingAttack[0];
    const defense = remainingDefense[0];
    const takeAttack = !defense || (attack && getOccurredAtTime(attack) >= getOccurredAtTime(defense));
    const selected = takeAttack ? remainingAttack.shift() : remainingDefense.shift();
    if (!selected || seenBattleIds.has(selected.battleId)) continue;
    seenBattleIds.add(selected.battleId);
    page.push(selected);
  }

  return {
    page,
    attackQueue: remainingAttack,
    defenseQueue: remainingDefense,
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

export function useArenaBattleHistory({ currentUser, isOnline }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const pagerRef = useRef(createHistoryPager());
  const seenBattleIdsRef = useRef(new Set());

  const fetchStream = useCallback(async (stream) => {
    if (!currentUser || !db || (stream.initialized && !stream.hasMore)) return;
    const constraints = [
      where(stream.fieldName, "==", currentUser.uid),
      orderBy("timestamp", "desc"),
    ];
    if (stream.cursor) constraints.push(startAfter(stream.cursor));
    constraints.push(limit(ARENA_HISTORY_PAGE_SIZE));

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
    stream.hasMore = snapshot.docs.length === ARENA_HISTORY_PAGE_SIZE;
  }, [currentUser]);

  const collectNextPage = useCallback(async () => {
    const pager = pagerRef.current;
    const page = [];

    while (page.length < ARENA_HISTORY_PAGE_SIZE) {
      await Promise.all(
        Object.values(pager)
          .filter((stream) => stream.queue.length === 0 && (!stream.initialized || stream.hasMore))
          .map((stream) => fetchStream(stream))
      );

      const result = takeNextArenaHistoryPage({
        attackQueue: pager.attack.queue,
        defenseQueue: pager.defense.queue,
        seenBattleIds: seenBattleIdsRef.current,
        pageSize: ARENA_HISTORY_PAGE_SIZE - page.length,
      });
      pager.attack.queue = result.attackQueue;
      pager.defense.queue = result.defenseQueue;
      page.push(...result.page);

      const canContinue = Object.values(pager).some((stream) =>
        stream.queue.length > 0 || (!stream.initialized || stream.hasMore)
      );
      if (!canContinue || result.page.length === 0) break;
    }

    setHasMore(Object.values(pager).some((stream) => stream.queue.length > 0 || stream.hasMore));
    return page;
  }, [fetchStream]);

  const refresh = useCallback(async () => {
    if (!currentUser || !isOnline || !db) {
      setLogs([]);
      setHasMore(false);
      return;
    }
    setLoading(true);
    setError("");
    pagerRef.current = createHistoryPager();
    seenBattleIdsRef.current = new Set();
    try {
      setLogs(await collectNextPage());
    } catch (loadError) {
      setError(loadError?.message || "배틀 기록을 불러오지 못했습니다.");
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [collectNextPage, currentUser, isOnline]);

  const loadMore = useCallback(async () => {
    if (!currentUser || !isOnline || !db || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const nextPage = await collectNextPage();
      if (nextPage.length > 0) setLogs((currentLogs) => [...currentLogs, ...nextPage]);
    } catch (loadError) {
      setError(loadError?.message || "추가 배틀 기록을 불러오지 못했습니다.");
    } finally {
      setLoadingMore(false);
    }
  }, [collectNextPage, currentUser, hasMore, isOnline, loadingMore]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({ logs, loading, loadingMore, hasMore, error, refresh, loadMore }),
    [error, hasMore, loadMore, loading, loadingMore, logs, refresh]
  );
}
