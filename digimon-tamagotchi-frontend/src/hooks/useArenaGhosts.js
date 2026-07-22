import { useCallback, useEffect, useState } from "react";
import {
  deleteArenaGhost,
  fetchArenaGhosts,
  registerArenaGhost,
} from "../utils/arenaApi";

const EMPTY_CAPACITY = Object.freeze({ used: 0, limit: 3 });

export function getArenaGhostErrorNotice(error) {
  switch (error?.code) {
    case "ARENA_GHOST_ALREADY_REGISTERED":
      return "이 현재 형태는 이미 Ghost로 등록되어 있습니다.";
    case "ARENA_GHOST_LIMIT_REACHED":
      return "새 Ghost를 등록하려면 기존 Ghost를 직접 삭제해 주세요.";
    case "ARENA_GHOST_SYNC_PENDING":
      return "형태 전적 동기화가 끝난 뒤 Ghost를 삭제할 수 있습니다.";
    case "ARENA_MAINTENANCE":
      return "아레나 전환 작업 중입니다. 조회는 가능하지만 등록·삭제·배틀은 잠시 이용할 수 없습니다.";
    case "ARENA_SLOT_DEAD":
      return "사망한 디지몬은 Ghost로 등록할 수 없습니다.";
    case "ARENA_SLOT_STARTER":
      return "디지타마는 Ghost로 등록할 수 없습니다.";
    default:
      return error?.message || "Ghost 정보를 처리하지 못했습니다.";
  }
}

export function useArenaGhosts({ currentUser, isOnline, currentSlotId }) {
  const [myGhosts, setMyGhosts] = useState([]);
  const [opponents, setOpponents] = useState([]);
  const [capacity, setCapacity] = useState(EMPTY_CAPACITY);
  const [currentCombatIdentityId, setCurrentCombatIdentityId] = useState(null);
  const [currentFormRecord, setCurrentFormRecord] = useState(null);
  const [loading, setLoading] = useState(Boolean(currentUser && isOnline));
  const [mutationKey, setMutationKey] = useState(null);
  const [notice, setNotice] = useState("");
  const [highlightedGhostId, setHighlightedGhostId] = useState(null);

  const refresh = useCallback(async () => {
    if (!currentUser || !isOnline) {
      setMyGhosts([]);
      setOpponents([]);
      setCapacity(EMPTY_CAPACITY);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotice("");
    try {
      const [mine, opponentResult] = await Promise.all([
        fetchArenaGhosts(currentUser, { scope: "mine", slotId: currentSlotId }),
        fetchArenaGhosts(currentUser, { scope: "opponents", limit: 30 }),
      ]);
      setMyGhosts(Array.isArray(mine?.ghosts) ? mine.ghosts : []);
      setOpponents(Array.isArray(opponentResult?.ghosts) ? opponentResult.ghosts : []);
      setCapacity(mine?.capacity || EMPTY_CAPACITY);
      setCurrentCombatIdentityId(mine?.currentCombatIdentityId || null);
      setCurrentFormRecord(mine?.currentFormRecord || null);
    } catch (error) {
      setNotice(getArenaGhostErrorNotice(error));
    } finally {
      setLoading(false);
    }
  }, [currentSlotId, currentUser, isOnline]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const registerCurrentGhost = useCallback(async () => {
    if (!currentUser || !currentSlotId || mutationKey) return null;
    setMutationKey("register");
    setNotice("");
    try {
      const result = await registerArenaGhost(currentUser, currentSlotId);
      await refresh();
      setHighlightedGhostId(result?.ghost?.ghostId || null);
      setNotice("현재 형태를 Ghost로 등록했습니다.");
      return result;
    } catch (error) {
      const existingGhostId = error?.details?.existingGhostId || null;
      setHighlightedGhostId(existingGhostId);
      setNotice(getArenaGhostErrorNotice(error));
      return null;
    } finally {
      setMutationKey(null);
    }
  }, [currentSlotId, currentUser, mutationKey, refresh]);

  const removeGhost = useCallback(async (ghost) => {
    if (!currentUser || !ghost?.ghostId || mutationKey) return false;
    setMutationKey(`delete:${ghost.ghostId}`);
    setNotice("");
    try {
      await deleteArenaGhost(currentUser, ghost.ghostId);
      if (highlightedGhostId === ghost.ghostId) setHighlightedGhostId(null);
      await refresh();
      setNotice("Ghost를 삭제했습니다. 현재 디지몬에는 영향이 없습니다.");
      return true;
    } catch (error) {
      setNotice(getArenaGhostErrorNotice(error));
      return false;
    } finally {
      setMutationKey(null);
    }
  }, [currentUser, highlightedGhostId, mutationKey, refresh]);

  return {
    myGhosts,
    opponents,
    capacity,
    currentCombatIdentityId,
    currentFormRecord,
    loading,
    mutationKey,
    notice,
    highlightedGhostId,
    refresh,
    registerCurrentGhost,
    removeGhost,
  };
}
