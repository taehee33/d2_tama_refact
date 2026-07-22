import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";

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
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!currentUser || !isOnline || !db) {
      setLogs([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const logsRef = collection(db, "arena_battle_logs");
      const [attack, defense] = await Promise.all([
        getDocs(query(logsRef, where("attackerId", "==", currentUser.uid), orderBy("timestamp", "desc"))),
        getDocs(query(logsRef, where("defenderId", "==", currentUser.uid), orderBy("timestamp", "desc"))),
      ]);
      const unique = new Map();
      for (const snapshot of [...attack.docs, ...defense.docs]) {
        unique.set(snapshot.id, normalizeArenaBattleSummary({ id: snapshot.id, ...snapshot.data() }, currentUser.uid));
      }
      setLogs([...unique.values()].sort((left, right) =>
        (right.occurredAt?.getTime() || 0) - (left.occurredAt?.getTime() || 0)
      ));
    } catch (loadError) {
      setError(loadError?.message || "배틀 기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [currentUser, isOnline]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(() => ({ logs, loading, error, refresh }), [error, loading, logs, refresh]);
}
