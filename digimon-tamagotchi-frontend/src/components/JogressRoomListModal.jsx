// src/components/JogressRoomListModal.jsx
// 온라인 조그레스: 내 조그레스 등록(상단) + 대기 중인 방 목록(하단), 아레나 UI 스타일

import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import { translateStage } from "../utils/stageTranslator";
import { getJogressResult } from "../logic/evolution/jogress";
import { V2_SPRITE_BASE } from "../data/v2modkor";

/**
 * 방 목록 모달 (온라인 조그레스)
 * @param {Object} currentUser - Firebase 현재 유저
 * @param {number|null} [currentSlotId] - 참가 시 선택 가능한 슬롯(현재 플레이 중인 슬롯만 가능)
 * @param {Object} digimonDataVer1 - v1 디지몬 데이터 맵
 * @param {Object} digimonDataVer2 - v2 디지몬 데이터 맵
 * @param {Function} onClose - 모달 닫기
 * @param {Function} onSelectRoomAndSlot - (room, guestSlot) => void
 * @param {Function} onCreateRoom - 방 만들기(현재 슬롯, 레거시)
 * @param {Function} onCreateRoomForSlot - 방 만들기 (지정 슬롯) (slot) => Promise<{ roomId }|null>
 * @param {Function} onCancelRoom - 내 방 취소 시 (roomId) => void
 * @param {string} [refreshTrigger] - 변경 시 방 목록 재조회
 * @param {Function} [onRefresh] - 방 생성 후 목록 재조회 요청 시 호출
 * @param {Function} [onHostEvolveFromRoom] - paired 방에서 진화 실행 (room) => Promise<void>
 */
const MAX_MY_ROOMS = 3;

export default function JogressRoomListModal({
  currentUser,
  currentSlotId = null,
  digimonDataVer1 = {},
  digimonDataVer2 = {},
  onClose,
  onSelectRoomAndSlot,
  onCreateRoom,
  onCreateRoomForSlot,
  onCancelRoom,
  refreshTrigger,
  onRefresh,
  onHostEvolveFromRoom,
}) {
  const [myRooms, setMyRooms] = useState([]); // 내가 만든 방: waiting + paired
  const [rooms, setRooms] = useState([]); // 대기 중인 방 (남의 방만, status===waiting)
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [mySlots, setMySlots] = useState([]);
  const [myAllSlots, setMyAllSlots] = useState([]); // 추가 등록용 전체 슬롯
  const [showSlotPickerForAdd, setShowSlotPickerForAdd] = useState(false);
  const selectedRoomId = selectedRoom?.id || null;
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!db || !currentUser?.uid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const roomsRef = collection(db, "jogress_rooms");
        let allWaiting = [];
        let myPaired = [];
        try {
          const qWaiting = query(
            roomsRef,
            where("status", "==", "waiting"),
            orderBy("createdAt", "desc"),
            limit(30)
          );
          const snapshot = await getDocs(qWaiting);
          allWaiting = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (idxErr) {
          console.warn("[JogressRoomList] 인덱스 오류, 전체 조회 후 필터:", idxErr);
          const all = await getDocs(roomsRef);
          allWaiting = all.docs
            .filter((d) => d.data().status === "waiting")
            .slice(0, 30)
            .map((d) => ({ id: d.id, ...d.data() }));
        }
        try {
          const all = await getDocs(roomsRef);
          myPaired = all.docs
            .filter((d) => {
              const data = d.data();
              return data.hostUid === currentUser.uid && data.status === "paired";
            })
            .map((d) => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn("[JogressRoomList] 내 paired 방 조회 오류:", e);
        }
        if (!cancelled) {
          const mineWaiting = allWaiting.filter((r) => r.hostUid === currentUser.uid);
          setMyRooms([...mineWaiting, ...myPaired]);
          setRooms(allWaiting.filter((r) => r.hostUid !== currentUser.uid));
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "방 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentUser?.uid, refreshTrigger]);

  useEffect(() => {
    if (!selectedRoomId || !db || !currentUser?.uid) {
      setMySlots([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingSlots(true);
      try {
        const slotsRef = collection(db, "users", currentUser.uid, "slots");
        const snapshot = await getDocs(slotsRef);
        const list = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            const id = parseInt(docSnap.id.replace("slot", ""), 10);
            return { id, ...data };
          })
          .filter((slot) => !slot.digimonStats?.isDead);
        if (!cancelled) setMySlots(list);
      } catch (err) {
        if (!cancelled) setError(err.message || "슬롯 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentUser?.uid, selectedRoomId]);

  // 추가 등록용: 내 슬롯 전체 로드 (방 목록 화면일 때)
  useEffect(() => {
    if (selectedRoomId || !db || !currentUser?.uid) {
      setMyAllSlots([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const slotsRef = collection(db, "users", currentUser.uid, "slots");
        const snapshot = await getDocs(slotsRef);
        const list = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            const id = parseInt(docSnap.id.replace("slot", ""), 10);
            return { id, ...data };
          })
          .filter((slot) => !slot.digimonStats?.isDead);
        if (!cancelled) setMyAllSlots(list);
      } catch (err) {
        if (!cancelled) setMyAllSlots([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentUser?.uid, myRooms.length, selectedRoomId]);

  const myWaitingRooms = myRooms.filter((r) => r.status === "waiting");
  const hostMap = selectedRoom?.hostSlotVersion === "Ver.2" ? digimonDataVer2 : digimonDataVer1;
  const getHostDigimonName = (room) => {
    const map = room.hostSlotVersion === "Ver.2" ? digimonDataVer2 : digimonDataVer1;
    const baseName = map?.[room.hostDigimonId]?.name || room.hostDigimonId;
    const nickname = room.hostDigimonNickname && room.hostDigimonNickname.trim();
    return nickname ? `${nickname}(${baseName})` : baseName;
  };
  const getHostDigimonData = (room) => {
    const map = room.hostSlotVersion === "Ver.2" ? digimonDataVer2 : digimonDataVer1;
    return map?.[room.hostDigimonId] || {};
  };
  const getSpritePath = (room) => {
    const data = getHostDigimonData(room);
    return data.spriteBasePath || (room.hostSlotVersion === "Ver.2" ? V2_SPRITE_BASE : "/images");
  };
  const getSprite = (room) => getHostDigimonData(room).sprite ?? 0;
  /** 게스트 디지몬 이름 (room.guestDigimonId + 버전) */
  const getGuestDigimonName = (room) => {
    const map = room.guestSlotVersion === "Ver.2" ? digimonDataVer2 : digimonDataVer1;
    const entry = map?.[room.guestDigimonId];
    return entry?.name || room.guestDigimonId || "";
  };
  /** paired 방용: "게스트명 / 별명(디지몬명)" 또는 "게스트명 / 디지몬명" */
  const getGuestDisplayLabel = (room) => {
    const tamer = room.guestTamerName || "참가자";
    const digimonName = getGuestDigimonName(room);
    const nick = room.guestDigimonNickname && room.guestDigimonNickname.trim();
    const digimonPart = nick ? `${nick}(${digimonName})` : digimonName;
    return `${tamer} / ${digimonPart}`;
  };
  const getDigimonData = (slot) => {
    const map = slot.version === "Ver.2" ? digimonDataVer2 : digimonDataVer1;
    return map?.[slot.selectedDigimon] || {};
  };
  const isJogressPossible = (slot) => {
    if (!selectedRoom?.hostDigimonId || !slot?.selectedDigimon) return false;
    return getJogressResult(selectedRoom.hostDigimonId, slot.selectedDigimon, hostMap).success;
  };

  /** 해당 슬롯 디지몬이 조그레스 진화 가능 여부 (등록 가능/불가 구분용) */
  const canRegisterJogress = (slot) => {
    if (!slot?.selectedDigimon) return false;
    const dataMap = slot.version === "Ver.2" ? digimonDataVer2 : digimonDataVer1;
    const evolutions = dataMap[slot.selectedDigimon]?.evolutions || [];
    return evolutions.some((e) => e.jogress);
  };

  /** 슬롯이 이미 조그레스 대기 방에 등록됐는지 (waiting만) */
  const isSlotAlreadyRegistered = (slotId) => myWaitingRooms.some((r) => r.hostSlotId === slotId);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-2"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border-4 border-blue-500 rounded-lg p-4 max-w-2xl w-full max-h-[90vh] flex flex-col pixel-art-modal overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3 flex-shrink-0">
          <h2 className="text-xl font-bold text-blue-400 pixel-art-text">
            {selectedRoom ? "참가할 슬롯 선택" : "온라인 조그레스"}
          </h2>
          <button
            onClick={() => {
              setSelectedRoom(null);
              if (!selectedRoom) onClose?.();
            }}
            className="text-white hover:text-red-400 text-2xl font-bold pixel-art-button"
          >
            ✕
          </button>
        </div>

        {!selectedRoom ? (
          <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
            {/* 내 조그레스 등록 (아레나 스타일: 카드 + 추가 등록 박스) */}
            <div className="flex-shrink-0 p-4 bg-blue-900/40 rounded-lg border-2 border-blue-400/50">
              <h3 className="text-xl font-bold text-blue-300 mb-3 pixel-art-text">
                내 조그레스 등록 ({myWaitingRooms.length}/{MAX_MY_ROOMS})
              </h3>
              <div className="flex flex-wrap gap-4 items-stretch" style={{ gap: "12px" }}>
                {myRooms.map((room) => (
                  <div key={room.id} className="flex-shrink-0 w-48 p-3 rounded-lg border-2 border-amber-500/70 bg-amber-900/30 relative">
                    {room.status === "waiting" && (
                      <button
                        type="button"
                        onClick={async () => {
                          await onCancelRoom?.(room.id);
                          setMyRooms((prev) => prev.filter((r) => r.id !== room.id));
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 z-10"
                        title="등록 해제"
                      >
                        ✕
                      </button>
                    )}
                    <div className="flex justify-center mb-2">
                      <img
                        src={`${getSpritePath(room)}/${getSprite(room)}.png`}
                        alt={getHostDigimonName(room)}
                        className="w-24 h-24 object-contain"
                        style={{ imageRendering: "pixelated" }}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    </div>
                    <p className="font-bold text-center text-sm text-white break-words min-h-[2.5rem] leading-tight">
                      {room.hostTamerName || "테이머"} — {getHostDigimonName(room)}
                    </p>
                    <p className="text-xs text-center text-amber-300">(슬롯{room.hostSlotId})</p>
                    {room.status === "paired" ? (
                      <>
                        <div className="mt-2 text-center">
                          <span className="inline-block px-2 py-0.5 rounded bg-green-600/90 text-white text-xs font-bold">조그레스 진화 완료!</span>
                        </div>
                        <p className="text-xs text-center text-amber-200 mt-1 break-words leading-tight font-bold bg-amber-900/40 py-1.5 px-2 rounded border border-amber-500/50" title={getGuestDisplayLabel(room)}>
                          with {getGuestDisplayLabel(room)}
                        </p>
                        {onHostEvolveFromRoom && (
                          <button
                            type="button"
                            onClick={async () => {
                              const confirmed = window.confirm(
                                "조그레스 진화에 성공하여 진화 가능합니다.\n정말로 진화하시겠습니까?"
                              );
                              if (!confirmed) return;
                              await onHostEvolveFromRoom(room);
                              onRefresh?.();
                            }}
                            className="mt-2 w-full py-1.5 px-2 rounded bg-green-600 hover:bg-green-500 text-white text-sm font-bold"
                          >
                            진화
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-center text-gray-400 mt-1">세대: {translateStage(getHostDigimonData(room).stage)}</p>
                        <div className="mt-2 text-center">
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-600/80 text-white text-xs font-bold">대기 중</span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {!showSlotPickerForAdd && myWaitingRooms.length < MAX_MY_ROOMS && (onCreateRoomForSlot || onCreateRoom) && (
                  <button
                    type="button"
                    onClick={() => setShowSlotPickerForAdd(true)}
                    className="flex-shrink-0 w-48 h-48 flex flex-col items-center justify-center bg-gray-700/50 rounded-lg border-2 border-dashed border-amber-500/50 text-amber-400 hover:bg-amber-900/30 transition-colors"
                  >
                    <span className="text-5xl">+</span>
                    <span className="text-sm mt-2 font-bold">추가 등록</span>
                  </button>
                )}
              </div>
            </div>

            {/* 등록할 슬롯 선택 모달 (아레나 스타일) */}
            {showSlotPickerForAdd && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-[60] p-4" onClick={() => setShowSlotPickerForAdd(false)}>
                <div className="bg-gray-800 border-2 border-amber-500/50 rounded-lg p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-xl font-bold text-amber-300 mb-4 pixel-art-text">등록할 슬롯 선택</h3>
                  {myAllSlots.length === 0 ? (
                    <p className="text-gray-400 py-4">등록 가능한 슬롯을 불러오는 중...</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {myAllSlots.map((slot) => {
                        const digimonData = getDigimonData(slot);
                        const baseName = digimonData?.name || slot.selectedDigimon;
                        const displayName = (slot.digimonNickname && slot.digimonNickname.trim())
                          ? `${slot.digimonNickname.trim()}(${baseName})`
                          : baseName;
                        const power = digimonData?.stats?.basePower ?? 0;
                        const spritePath = digimonData.spriteBasePath || (slot.version === "Ver.2" ? V2_SPRITE_BASE : "/images");
                        const sprite = digimonData.sprite ?? 0;
                        const alreadyRegistered = isSlotAlreadyRegistered(slot.id);
                        const canRegister = canRegisterJogress(slot);
                        const clickable = !alreadyRegistered && canRegister && onCreateRoomForSlot;
                        let statusLabel = "";
                        let statusClass = "";
                        if (alreadyRegistered) {
                          statusLabel = "이미 등록됨";
                          statusClass = "bg-gray-600 text-gray-300";
                        } else if (!canRegister) {
                          statusLabel = "조그레스 불가";
                          statusClass = "bg-red-900/80 text-red-200";
                        } else {
                          statusLabel = "등록 가능";
                          statusClass = "bg-green-600/90 text-white";
                        }
                        return (
                          <div
                            key={slot.id}
                            onClick={clickable ? async () => {
                              setShowSlotPickerForAdd(false);
                              const result = await onCreateRoomForSlot?.(slot);
                              if (result?.roomId) onRefresh?.();
                            } : undefined}
                            className={`p-4 rounded-lg border-2 transition-colors ${
                              clickable
                                ? "bg-amber-900/40 border-amber-500/50 cursor-pointer hover:bg-amber-800/50"
                                : "bg-gray-700/50 border-gray-600 cursor-not-allowed opacity-80"
                            }`}
                          >
                            <div className="flex justify-center mb-2">
                              <img
                                src={`${spritePath}/${sprite}.png`}
                                alt={displayName}
                                className="w-20 h-20 object-contain"
                                style={{ imageRendering: "pixelated" }}
                                onError={(e) => { e.target.style.display = "none"; }}
                              />
                            </div>
                            <p className="text-xs text-center text-gray-400 mb-1">슬롯{slot.id}</p>
                            <p className="font-bold text-center text-sm text-white truncate" title={displayName}>{displayName}</p>
                            <p className="text-xs text-center text-gray-500 mb-2">Power: {power}</p>
                            <span className={`inline-block w-full text-center px-2 py-1 rounded text-xs font-bold ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowSlotPickerForAdd(false)}
                    className="mt-4 w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 대기 중인 방 */}
            <div className="flex-shrink-0 p-3 bg-gray-800/60 rounded-lg border border-gray-600">
              <h3 className="text-lg font-bold text-gray-300 mb-2 pixel-art-text">대기 중인 방</h3>
              <p className="text-gray-400 text-xs mb-2">참가할 방을 선택하세요. (선택한 슬롯의 디지몬은 데이터가 되어 사라집니다)</p>
              {loading && <p className="text-gray-400 py-2">방 목록 불러오는 중...</p>}
              {error && <p className="text-red-400 py-2 text-sm">{error}</p>}
              {!loading && !error && rooms.length === 0 && (
                <p className="text-gray-500 py-4 text-sm">대기 중인 방이 없습니다.</p>
              )}
              {!loading && !error && rooms.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {rooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => setSelectedRoom(room)}
                      className="flex-shrink-0 w-40 p-3 rounded-lg border-2 border-amber-500/50 bg-gray-700 hover:bg-amber-800/40 text-left transition-colors"
                    >
                      <div className="flex justify-center mb-2">
                        <img
                          src={`${getSpritePath(room)}/${getSprite(room)}.png`}
                          alt={getHostDigimonName(room)}
                          className="w-20 h-20 object-contain"
                          style={{ imageRendering: "pixelated" }}
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                      </div>
                      <p className="font-bold text-sm text-white truncate">
                        {room.hostTamerName || "테이머"}
                      </p>
                      <p className="text-xs text-amber-200 truncate">{getHostDigimonName(room)}</p>
                      <p className="text-xs text-gray-500">(슬롯{room.hostSlotId})</p>
                      <p className="text-xs text-gray-400 mt-1">세대: {translateStage(getHostDigimonData(room).stage)}</p>
                      <div className="mt-2 text-center">
                        <span className="text-xs text-green-400 font-bold">참가</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="text-gray-300 text-sm mb-3 flex-shrink-0">
              {selectedRoom.hostTamerName || "테이머"}님의 {getHostDigimonName(selectedRoom)}와(과) 조그레스 진화합니다. (현재 슬롯만 선택가능)
            </p>
            <div className="overflow-y-auto flex-1 min-h-0">
              {loadingSlots && <p className="text-gray-400 py-4">슬롯 목록 불러오는 중...</p>}
              {!loadingSlots && mySlots.length === 0 && (
                <p className="text-gray-400 py-4">사용 가능한 슬롯이 없습니다.</p>
              )}
              {!loadingSlots && mySlots.length > 0 && (() => {
                const currentSlot = mySlots.find((s) => s.id === currentSlotId);
                const otherSlots = mySlots.filter((s) => s.id !== currentSlotId);
                /** canSelect: 이 슬롯으로 참가 선택 가능 여부(현재 슬롯만 true 가능) / showPossible: 조그레스 가능 여부 표시(가능/불가능 뱃지) */
                const renderSlotItem = (slot, canSelect, showPossible) => {
                  const digimonData = getDigimonData(slot);
                  const name = digimonData?.name || slot.selectedDigimon;
                  const stage = translateStage(digimonData?.stage);
                  const slotLabel = slot.slotName || `슬롯 ${slot.id}`;
                  return (
                    <li key={slot.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!canSelect) return;
                          const confirmed = window.confirm(
                            "정말 조그레스 진화를 하시겠습니까?\n\n온라인으로 조그레스 진화 할 때에는 두 디지몬 모두 사라지지 않습니다."
                          );
                          if (!confirmed) return;
                          onSelectRoomAndSlot?.(selectedRoom, slot);
                          onClose?.();
                        }}
                        disabled={!canSelect}
                        className={`w-full text-left px-4 py-3 border rounded pixel-art-button flex items-center justify-between gap-2 ${
                          canSelect
                            ? "bg-gray-700 hover:bg-amber-700/30 border-amber-500/50 text-white"
                            : "bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        <span>
                          <span className="font-bold">{name}</span>
                          <span className="text-gray-400 text-sm ml-2">
                            ({slotLabel} · {stage})
                          </span>
                        </span>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded text-sm font-bold ${
                            showPossible ? "bg-green-600/90 text-white" : "bg-red-900/80 text-red-200"
                          }`}
                        >
                          {showPossible ? "가능" : "불가능"}
                        </span>
                      </button>
                    </li>
                  );
                };
                return (
                  <>
                    {currentSlot != null && (
                      <div className="mb-3">
                        <p className="text-amber-400 font-bold text-sm mb-2 pixel-art-text">현재 슬롯</p>
                        <ul className="space-y-2">
                          {renderSlotItem(currentSlot, isJogressPossible(currentSlot), isJogressPossible(currentSlot))}
                        </ul>
                      </div>
                    )}
                    {otherSlots.length > 0 && (
                      <div>
                        <p className="text-gray-400 font-bold text-sm mb-2 pixel-art-text">나머지 슬롯</p>
                        <ul className="space-y-2">
                          {otherSlots.map((slot) => renderSlotItem(slot, false, isJogressPossible(slot)))}
                        </ul>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
