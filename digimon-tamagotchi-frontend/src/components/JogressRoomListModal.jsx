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
 * @param {Object} digimonDataVer1 - v1 디지몬 데이터 맵
 * @param {Object} digimonDataVer2 - v2 디지몬 데이터 맵
 * @param {Function} onClose - 모달 닫기
 * @param {Function} onSelectRoomAndSlot - (room, guestSlot) => void
 * @param {Function} onCreateRoom - 방 만들기(내 디지몬 등록) 클릭 시
 * @param {Function} onCancelRoom - 내 방 취소 시 (roomId) => void
 * @param {string} [refreshTrigger] - 변경 시 방 목록 재조회 (예: 방 생성 후 myJogressRoomId)
 */
export default function JogressRoomListModal({
  currentUser,
  digimonDataVer1 = {},
  digimonDataVer2 = {},
  onClose,
  onSelectRoomAndSlot,
  onCreateRoom,
  onCancelRoom,
  refreshTrigger,
}) {
  const [myRoom, setMyRoom] = useState(null); // 내가 만든 대기 방 (1개)
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [mySlots, setMySlots] = useState([]);
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
        try {
          const q = query(
            roomsRef,
            where("status", "==", "waiting"),
            orderBy("createdAt", "desc"),
            limit(30)
          );
          const snapshot = await getDocs(q);
          allWaiting = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (idxErr) {
          console.warn("[JogressRoomList] 인덱스 오류, 전체 조회 후 필터:", idxErr);
          const all = await getDocs(roomsRef);
          allWaiting = all.docs
            .filter((d) => d.data().status === "waiting")
            .slice(0, 30)
            .map((d) => ({ id: d.id, ...d.data() }));
        }
        if (!cancelled) {
          const mine = allWaiting.find((r) => r.hostUid === currentUser.uid);
          setMyRoom(mine || null);
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
    if (!selectedRoom || !db || !currentUser?.uid) {
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
  }, [selectedRoom?.id, currentUser?.uid]);

  const hostMap = selectedRoom?.hostSlotVersion === "Ver.2" ? digimonDataVer2 : digimonDataVer1;
  const getHostDigimonName = (room) => {
    const map = room.hostSlotVersion === "Ver.2" ? digimonDataVer2 : digimonDataVer1;
    return map?.[room.hostDigimonId]?.name || room.hostDigimonId;
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
  const getDigimonData = (slot) => {
    const map = slot.version === "Ver.2" ? digimonDataVer2 : digimonDataVer1;
    return map?.[slot.selectedDigimon] || {};
  };
  const isJogressPossible = (slot) => {
    if (!selectedRoom?.hostDigimonId || !slot?.selectedDigimon) return false;
    return getJogressResult(selectedRoom.hostDigimonId, slot.selectedDigimon, hostMap).success;
  };

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
            {/* 내 조그레스 등록 (아레나 스타일) */}
            <div className="flex-shrink-0 p-3 bg-blue-900/40 rounded-lg border-2 border-blue-400/50">
              <h3 className="text-lg font-bold text-blue-300 mb-2 pixel-art-text">
                내 조그레스 등록 ({myRoom ? "1/1" : "0/1"})
              </h3>
              <div className="flex flex-wrap gap-3 items-stretch">
                {myRoom ? (
                  <div className="flex-shrink-0 w-40 p-3 rounded-lg border-2 border-amber-500/70 bg-amber-900/30 relative">
                    <button
                      type="button"
                      onClick={async () => {
                        await onCancelRoom?.(myRoom.id);
                        setMyRoom(null);
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 z-10"
                      title="등록 해제"
                    >
                      ✕
                    </button>
                    <div className="flex justify-center mb-2">
                      <img
                        src={`${getSpritePath(myRoom)}/${getSprite(myRoom)}.png`}
                        alt={getHostDigimonName(myRoom)}
                        className="w-20 h-20 object-contain"
                        style={{ imageRendering: "pixelated" }}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    </div>
                    <p className="font-bold text-center text-sm text-white">
                      {myRoom.hostTamerName || "테이머"} — {getHostDigimonName(myRoom)}
                    </p>
                    <p className="text-xs text-center text-amber-300">(슬롯{myRoom.hostSlotId})</p>
                    <p className="text-xs text-center text-gray-400 mt-1">세대: {translateStage(getHostDigimonData(myRoom).stage)}</p>
                    <div className="mt-2 text-center">
                      <span className="inline-block px-2 py-0.5 rounded bg-amber-600/80 text-white text-xs font-bold">대기 중</span>
                    </div>
                  </div>
                ) : (
                  onCreateRoom && (
                    <button
                      type="button"
                      onClick={() => onCreateRoom?.()}
                      className="flex-shrink-0 w-40 min-h-[10rem] flex flex-col items-center justify-center bg-gray-700/50 rounded-lg border-2 border-dashed border-amber-500/50 text-amber-400 hover:bg-amber-900/30 transition-colors"
                    >
                      <span className="text-4xl">+</span>
                      <span className="text-sm mt-2 font-bold">내 디지몬 조그레스 등록</span>
                      <span className="text-xs text-gray-400 mt-1">방 만들기 · 파트너 대기</span>
                    </button>
                  )
                )}
              </div>
            </div>

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
              {selectedRoom.hostTamerName || "테이머"}님의 {getHostDigimonName(selectedRoom)}와(과) 합체할 내 슬롯을 선택하세요.
            </p>
            <div className="overflow-y-auto flex-1 min-h-0">
              {loadingSlots && <p className="text-gray-400 py-4">슬롯 목록 불러오는 중...</p>}
              {!loadingSlots && mySlots.length === 0 && (
                <p className="text-gray-400 py-4">사용 가능한 슬롯이 없습니다.</p>
              )}
              {!loadingSlots && mySlots.length > 0 && (
                <ul className="space-y-2">
                  {mySlots.map((slot) => {
                    const digimonData = getDigimonData(slot);
                    const name = digimonData?.name || slot.selectedDigimon;
                    const stage = translateStage(digimonData?.stage);
                    const slotLabel = slot.slotName || `슬롯 ${slot.id}`;
                    const possible = isJogressPossible(slot);
                    return (
                      <li key={slot.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!possible) return;
                            const confirmed = window.confirm(
                              "정말 조그레스 진화를 하시겠습니까?\n\n진화할 경우 선택한 슬롯의 파트너 디지몬은 데이터가 되어 사라집니다."
                            );
                            if (!confirmed) return;
                            onSelectRoomAndSlot?.(selectedRoom, slot);
                            onClose?.();
                          }}
                          disabled={!possible}
                          className={`w-full text-left px-4 py-3 border rounded pixel-art-button flex items-center justify-between gap-2 ${
                            possible
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
                              possible ? "bg-green-600/90 text-white" : "bg-red-900/80 text-red-200"
                            }`}
                          >
                            {possible ? "가능" : "불가능"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
