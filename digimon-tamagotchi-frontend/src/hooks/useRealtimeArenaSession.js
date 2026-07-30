import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { createRealtimeArenaBattle, listRealtimeArenaBattles, sendRealtimeArenaCommand } from "../utils/realtimeArenaApi";

const SESSION_KEY = "realtime_arena_active_battle_id";

function createRequestId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadBattleId() {
  try { return sessionStorage.getItem(SESSION_KEY) || ""; } catch (error) { return ""; }
}

function normalizePublicBattle(data, battleId) {
  const toIso = (value) => typeof value?.toDate === "function" ? value.toDate().toISOString() : value || null;
  return {
    ...data,
    battleId,
    deadlineAt: toIso(data.deadlineAt),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    startedAt: toIso(data.startedAt),
    finishedAt: toIso(data.finishedAt),
    expiresAt: toIso(data.expiresAt),
    resolvedRounds: (data.resolvedRounds || []).map((round) => ({ ...round, resolvedAt: toIso(round.resolvedAt) })),
  };
}

export default function useRealtimeArenaSession({ currentUser, slotId }) {
  const [battleId, setBattleIdState] = useState(loadBattleId);
  const [battle, setBattle] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remainingMs, setRemainingMs] = useState(0);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState("");
  const timeoutStartedRef = useRef("");
  const restoreStartedRef = useRef(false);

  const setBattleId = useCallback((value) => {
    setBattleIdState(value);
    try {
      if (value) sessionStorage.setItem(SESSION_KEY, value);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (error) { /* 탐색 보조값 저장 실패는 게임 상태에 영향을 주지 않는다. */ }
  }, []);

  const applyPayload = useCallback((payload) => {
    if (payload?.battle) {
      setBattle(payload.battle);
      setBattleId(payload.battle.battleId);
    }
    if (payload?.viewer) setViewer(payload.viewer);
    return payload;
  }, [setBattleId]);

  const refreshRooms = useCallback(async () => {
    if (!currentUser) return [];
    setRoomsLoading(true);
    setRoomsError("");
    try {
      const payload = await listRealtimeArenaBattles(currentUser);
      const nextRooms = Array.isArray(payload?.rooms) ? payload.rooms : [];
      setRooms(nextRooms);
      return nextRooms;
    } catch (roomError) {
      setRoomsError(roomError.message);
      return [];
    } finally {
      setRoomsLoading(false);
    }
  }, [currentUser]);

  const runCommand = useCallback(async (command, extra = {}, requestId = createRequestId()) => {
    if (!currentUser || !battleId) return null;
    setBusy(true);
    setError("");
    try {
      return applyPayload(await sendRealtimeArenaCommand(currentUser, battleId, { command, requestId, ...extra }));
    } catch (commandError) {
      setError(commandError.message);
      throw commandError;
    } finally {
      setBusy(false);
    }
  }, [applyPayload, battleId, currentUser]);

  const restore = useCallback(async () => {
    if (restoreStartedRef.current || !battleId || !currentUser) return null;
    restoreStartedRef.current = true;
    try { return await runCommand("restore"); }
    finally { restoreStartedRef.current = false; }
  }, [battleId, currentUser, runCommand]);

  useEffect(() => {
    if (!db || !currentUser || !battleId) return undefined;
    const unsubscribe = onSnapshot(
      doc(db, "realtimeArenaBattles", battleId),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const next = normalizePublicBattle(snapshot.data(), snapshot.id);
        setBattle((previous) => {
          if (previous?.round !== next.round) setViewer((value) => value ? { ...value, hasSubmitted: false } : value);
          return next;
        });
      },
      () => setError("실시간 배틀 상태를 불러오지 못했습니다.")
    );
    void restore();
    return unsubscribe;
  }, [battleId, currentUser, restore]);

  useEffect(() => {
    if (!currentUser || battleId) return;
    void refreshRooms();
  }, [battleId, currentUser, refreshRooms]);

  useEffect(() => {
    if (!battle?.deadlineAt || battle.status !== "selecting") {
      setRemainingMs(0);
      return undefined;
    }
    const tick = () => setRemainingMs(Math.max(0, new Date(battle.deadlineAt).getTime() - Date.now()));
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [battle?.deadlineAt, battle?.status]);

  useEffect(() => {
    if (
      battle?.status !== "selecting" ||
      !battle.deadlineAt ||
      new Date(battle.deadlineAt).getTime() > Date.now()
    ) return;
    const key = `${battle.battleId}:${battle.round}`;
    if (timeoutStartedRef.current === key) return;
    timeoutStartedRef.current = key;
    void runCommand("resolve-timeout").catch(() => {});
  }, [battle, remainingMs, runCommand]);

  useEffect(() => {
    const recover = () => { if (!document.hidden) void restore(); };
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", recover);
    };
  }, [restore]);

  const createBattle = useCallback(async () => {
    setBusy(true);
    setError("");
    try { return applyPayload(await createRealtimeArenaBattle(currentUser, { requestId: createRequestId(), slotId })); }
    catch (createError) { setError(createError.message); throw createError; }
    finally { setBusy(false); }
  }, [applyPayload, currentUser, slotId]);

  const joinBattle = useCallback(async (targetBattleId) => {
    const normalizedBattleId = targetBattleId.trim();
    setBusy(true);
    setError("");
    try { return applyPayload(await sendRealtimeArenaCommand(currentUser, normalizedBattleId, { command: "join", requestId: createRequestId(), slotId })); }
    catch (joinError) { setError(joinError.message); throw joinError; }
    finally { setBusy(false); }
  }, [applyPayload, currentUser, slotId]);

  const closeSession = useCallback(() => {
    setBattleId("");
    setBattle(null);
    setViewer(null);
    setError("");
  }, [setBattleId]);

  return { battleId, battle, viewer, busy, error, remainingMs, rooms, roomsLoading, roomsError, refreshRooms, createBattle, joinBattle, runCommand, restore, closeSession };
}
