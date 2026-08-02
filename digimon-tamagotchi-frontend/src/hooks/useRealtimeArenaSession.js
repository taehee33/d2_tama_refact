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

function isLegacyResolveTimeoutContractError(error) {
  return error?.code === "ARENA_INVALID_REQUEST" &&
    error?.message === "허용되지 않은 요청 필드가 있습니다.";
}

function normalizePublicBattle(data, battleId) {
  const toIso = (value) => typeof value?.toDate === "function" ? value.toDate().toISOString() : value || null;
  return {
    ...data,
    battleId,
    deadlineAt: toIso(data.deadlineAt),
    selectionOpensAt: toIso(data.selectionOpensAt),
    presentationEndsAt: toIso(data.presentationEndsAt),
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
  const [clockMs, setClockMs] = useState(Date.now());
  const [optimisticAction, setOptimisticAction] = useState(null);
  const [selectionSavingCount, setSelectionSavingCount] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState("");
  const timeoutStartedRef = useRef("");
  const restoreStartedRef = useRef(false);
  const selectionRevisionRef = useRef(0);
  const activeRoundRef = useRef(null);

  const setBattleId = useCallback((value) => {
    setBattleIdState(value);
    try {
      if (value) sessionStorage.setItem(SESSION_KEY, value);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (error) { /* 탐색 보조값 저장 실패는 게임 상태에 영향을 주지 않는다. */ }
  }, []);

  const applyPayload = useCallback((payload) => {
    let roundChanged = false;
    if (payload?.battle) {
      roundChanged = activeRoundRef.current !== null && activeRoundRef.current !== payload.battle.round;
      activeRoundRef.current = payload.battle.round;
      setBattle(payload.battle);
      setBattleId(payload.battle.battleId);
      if (roundChanged) {
        setOptimisticAction(null);
        selectionRevisionRef.current = 0;
      }
    }
    if (payload?.viewer) {
      setViewer((previous) => {
        if (
          !roundChanged &&
          previous?.role === payload.viewer.role &&
          Number(previous.selectionRevision || 0) > Number(payload.viewer.selectionRevision || 0)
        ) return previous;
        return payload.viewer;
      });
    }
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
      setRoomsError(roomError?.code === "ARENA_INTERNAL_ERROR"
        ? "대기 중인 방을 불러오지 못했습니다. 잠시 후 새로고침해 주세요."
        : roomError.message);
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
    setRecovering(true);
    try { return await runCommand("restore"); }
    finally {
      restoreStartedRef.current = false;
      setRecovering(false);
    }
  }, [battleId, currentUser, runCommand]);

  useEffect(() => {
    if (!db || !currentUser || !battleId) return undefined;
    const unsubscribe = onSnapshot(
      doc(db, "realtimeArenaBattles", battleId),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const next = normalizePublicBattle(snapshot.data(), snapshot.id);
        activeRoundRef.current = next.round;
        setBattle((previous) => {
          if (previous?.round !== next.round) {
            setViewer((value) => value ? { ...value, hasSubmitted: false, selectedAction: null, selectionRevision: 0 } : value);
            setOptimisticAction(null);
            selectionRevisionRef.current = 0;
          }
          return next;
        });
      },
      () => setError("실시간 배틀 상태를 불러오지 못했습니다.")
    );
    void restore().catch(() => {});
    return unsubscribe;
  }, [battleId, currentUser, restore]);

  useEffect(() => {
    if (!currentUser || battleId) return;
    void refreshRooms();
  }, [battleId, currentUser, refreshRooms]);

  useEffect(() => {
    const shouldTick = battle?.status === "selecting" || Boolean(
      battle?.status === "finished" && battle.presentationEndsAt && new Date(battle.presentationEndsAt).getTime() > Date.now()
    );
    if (!shouldTick) {
      setRemainingMs(0);
      return undefined;
    }
    const tick = () => {
      const now = Date.now();
      setClockMs(now);
      setRemainingMs(battle?.deadlineAt ? Math.max(0, new Date(battle.deadlineAt).getTime() - now) : 0);
    };
    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [battle?.deadlineAt, battle?.presentationEndsAt, battle?.status]);

  useEffect(() => {
    selectionRevisionRef.current = Math.max(selectionRevisionRef.current, Number(viewer?.selectionRevision || 0));
    if (viewer?.selectedAction) setOptimisticAction(viewer.selectedAction);
  }, [viewer?.selectedAction, viewer?.selectionRevision]);

  useEffect(() => {
    if (
      battle?.status !== "selecting" ||
      !battle.deadlineAt ||
      new Date(battle.deadlineAt).getTime() > Date.now()
    ) return;
    const key = `${battle.battleId}:${battle.round}`;
    if (timeoutStartedRef.current === key) return;
    timeoutStartedRef.current = key;
    const requestId = createRequestId();
    const resolveTimeout = async () => {
      try {
        await runCommand("resolve-timeout", { round: battle.round }, requestId);
      } catch (timeoutError) {
        // 개발 프론트엔드가 구형 운영 API를 바라보는 동안만 구형식 요청으로 한 번 재시도한다.
        if (!isLegacyResolveTimeoutContractError(timeoutError)) return;
        await runCommand("resolve-timeout", {}, requestId);
      }
    };
    void resolveTimeout().catch(() => {});
  }, [battle, remainingMs, runCommand]);

  useEffect(() => {
    const recover = () => { if (!document.hidden) void restore().catch(() => {}); };
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", recover);
    };
  }, [restore]);

  const createBattleForMode = useCallback(async (mode) => {
    setBusy(true);
    setError("");
    try { return applyPayload(await createRealtimeArenaBattle(currentUser, { requestId: createRequestId(), slotId, mode })); }
    catch (createError) { setError(createError.message); throw createError; }
    finally { setBusy(false); }
  }, [applyPayload, currentUser, slotId]);

  const createBattle = useCallback(() => createBattleForMode("pvp"), [createBattleForMode]);
  const createCpuBattle = useCallback(() => createBattleForMode("cpu"), [createBattleForMode]);

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
    setOptimisticAction(null);
    selectionRevisionRef.current = 0;
    activeRoundRef.current = null;
  }, [setBattleId]);

  const selectAction = useCallback(async (action) => {
    if (!currentUser || !battleId || !battle || battle.status !== "selecting") return null;
    const selectionRevision = selectionRevisionRef.current + 1;
    selectionRevisionRef.current = selectionRevision;
    setOptimisticAction(action);
    setSelectionSavingCount((count) => count + 1);
    setError("");
    try {
      return applyPayload(await sendRealtimeArenaCommand(currentUser, battleId, {
        command: "submit-action",
        requestId: createRequestId(),
        round: battle.round,
        expectedStateVersion: battle.stateVersion,
        action,
        selectionRevision,
      }));
    } catch (selectionError) {
      setError(selectionError.message);
      if (selectionRevision === selectionRevisionRef.current) setOptimisticAction(viewer?.selectedAction || null);
      throw selectionError;
    } finally {
      setSelectionSavingCount((count) => Math.max(0, count - 1));
    }
  }, [applyPayload, battle, battleId, currentUser, viewer?.selectedAction]);

  const presentationEndsAtMs = battle?.presentationEndsAt ? new Date(battle.presentationEndsAt).getTime() : 0;
  const presentationActive = Boolean(
    presentationEndsAtMs > clockMs && (battle?.resolvedRounds?.length || 0) > 0
  );
  const selectionOpen = Boolean(
    battle?.status === "selecting" &&
    (!battle.selectionOpensAt || new Date(battle.selectionOpensAt).getTime() <= clockMs)
  );

  return {
    battleId,
    battle,
    viewer,
    busy,
    error,
    remainingMs,
    rooms,
    roomsLoading,
    roomsError,
    refreshRooms,
    createBattle,
    createCpuBattle,
    joinBattle,
    runCommand,
    restore,
    closeSession,
    selectAction,
    selectedAction: optimisticAction || viewer?.selectedAction || null,
    selectionSaving: selectionSavingCount > 0,
    recovering,
    presentationActive,
    selectionOpen,
    clockMs,
  };
}
