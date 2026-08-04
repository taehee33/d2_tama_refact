import {
  cancelJogressRoomApi,
  createJogressRoomApi,
  JogressApiError,
} from "../utils/jogressApi";
import {
  normalizeDigimonVersionLabel,
  SUPPORTED_DIGIMON_VERSIONS,
} from "../utils/digimonVersionUtils";

export function isOnlineJogressSupported(versionLabel = "Ver.1") {
  return SUPPORTED_DIGIMON_VERSIONS.includes(normalizeDigimonVersionLabel(versionLabel));
}

function hasJogressEvolution(dataMap, digimonId) {
  return (dataMap?.[digimonId]?.evolutions || []).some((evolution) => evolution.jogress);
}

function showApiError(prefix, error) {
  console.error(prefix, error);
  alert(error instanceof JogressApiError ? error.message : "조그레스 요청 중 오류가 발생했습니다.");
}

export function useJogressRoomLifecycle({
  currentUser,
  slotId,
  selectedDigimon,
  slotEvolutionDataMap,
  flushOutbox,
  refreshGameRevision,
}) {
  async function currentExpectedRevision() {
    await flushOutbox?.();
    const refreshed = await refreshGameRevision?.();
    const revision = Number(refreshed?.revision ?? refreshed);
    return Number.isInteger(revision) ? revision : null;
  }

  async function createJogressRoom() {
    if (!currentUser?.uid || slotId == null) {
      alert("조그레스에는 로그인이 필요합니다.");
      return null;
    }
    if (!hasJogressEvolution(slotEvolutionDataMap, selectedDigimon)) {
      alert("현재 디지몬은 조그레스 진화가 불가능합니다.");
      return null;
    }
    try {
      const expectedRevision = await currentExpectedRevision();
      if (!Number.isInteger(expectedRevision)) throw new JogressApiError("현재 슬롯 동기화가 끝난 뒤 다시 시도해 주세요.");
      const result = await createJogressRoomApi(currentUser, { slotId, expectedRevision });
      return { roomId: result?.room?.id || null, room: result?.room, alreadyRegistered: result?.alreadyRegistered === true };
    } catch (error) {
      showApiError("[createJogressRoom]", error);
      return null;
    }
  }

  async function createJogressRoomForSlot(slot) {
    if (!currentUser?.uid || slot?.id == null) {
      alert("조그레스에는 로그인이 필요합니다.");
      return null;
    }
    try {
      if (String(slot.id) === String(slotId)) await flushOutbox?.();
      const expectedRevision = Number(slot.revision);
      if (!Number.isInteger(expectedRevision)) throw new JogressApiError("선택한 슬롯의 최신 상태를 다시 불러와 주세요.");
      const result = await createJogressRoomApi(currentUser, { slotId: slot.id, expectedRevision });
      return { roomId: result?.room?.id || null, room: result?.room, alreadyRegistered: result?.alreadyRegistered === true };
    } catch (error) {
      showApiError("[createJogressRoomForSlot]", error);
      return null;
    }
  }

  async function cancelJogressRoom(roomId) {
    if (!currentUser?.uid || !roomId) return null;
    try {
      return await cancelJogressRoomApi(currentUser, roomId);
    } catch (error) {
      showApiError("[cancelJogressRoom]", error);
      return null;
    }
  }

  async function cancelOwnedWaitingJogressRoomsForSlot() {
    // 형태가 바뀌어도 등록 당시 방은 1회용 Ghost로 유지한다.
    return 0;
  }

  async function applyHostJogressStatusFromRoom() {
    // paired 전이와 host jogressStatus 저장은 join 서버 transaction에서 함께 처리한다.
  }

  return {
    createJogressRoom,
    createJogressRoomForSlot,
    cancelJogressRoom,
    cancelOwnedWaitingJogressRoomsForSlot,
    applyHostJogressStatusFromRoom,
  };
}
