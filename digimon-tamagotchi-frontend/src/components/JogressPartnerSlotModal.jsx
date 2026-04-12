// src/components/JogressPartnerSlotModal.jsx
// 조그레스 진화(로컬): 파트너가 될 다른 슬롯 선택

import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { translateStage } from "../utils/stageTranslator";
import { getJogressResult } from "../logic/evolution/jogress";
import { getDigimonDataMapByVersion } from "../utils/digimonVersionUtils";

/**
 * 파트너 슬롯 선택 모달 (로컬 조그레스용)
 * @param {Object} currentUser - Firebase 현재 유저
 * @param {number} currentSlotId - 현재 플레이 중인 슬롯 ID (제외)
 * @param {string} currentDigimonId - 현재 슬롯 디지몬 ID (조그레스 가능 여부 판정용)
 * @param {string} currentSlotVersion - 현재 슬롯 버전 ("Ver.1" | "Ver.2")
 * @param {Function} onClose - 모달 닫기
 * @param {Function} onSelectPartner - 슬롯 선택 시 (slot) => void
 */
export default function JogressPartnerSlotModal({
  currentUser,
  currentSlotId,
  currentDigimonId,
  currentSlotVersion,
  onClose,
  onSelectPartner,
}) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
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
        const slotsRef = collection(db, "users", currentUser.uid, "slots");
        const snapshot = await getDocs(slotsRef);
        const list = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            const id = parseInt(docSnap.id.replace("slot", ""), 10);
            return { id, ...data };
          })
          .filter((slot) => slot.id !== currentSlotId && !slot.digimonStats?.isDead);
        if (!cancelled) setSlots(list);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "슬롯 목록을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentUser?.uid, currentSlotId]);

  const getDigimonData = (slot) => {
    const map = getDigimonDataMapByVersion(slot.version);
    return map?.[slot.selectedDigimon] || {};
  };

  // 현재 슬롯 버전 기준 데이터 맵 (조그레스 가능 여부 판정용)
  const currentSlotDataMap = getDigimonDataMapByVersion(currentSlotVersion);

  const isJogressPossible = (slot) => {
    if (!currentDigimonId || !slot?.selectedDigimon) return false;
    const result = getJogressResult(currentDigimonId, slot.selectedDigimon, currentSlotDataMap);
    return result.success;
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border-4 border-amber-500 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] flex flex-col pixel-art-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-amber-400 pixel-art-text">
            파트너 슬롯 선택
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-red-400 text-2xl font-bold pixel-art-button"
          >
            ✕
          </button>
        </div>

        <p className="text-gray-300 text-sm mb-3 flex-shrink-0">
          조그레스할 다른 슬롯을 선택하세요. (선택한 슬롯은 사망 처리됩니다)
        </p>

        <div className="overflow-y-auto flex-1 min-h-0">
          {loading && (
            <p className="text-gray-400 py-4">슬롯 목록 불러오는 중...</p>
          )}
          {error && (
            <p className="text-red-400 py-2">{error}</p>
          )}
          {!loading && !error && slots.length === 0 && (
            <p className="text-gray-400 py-4">
              조그레스할 수 있는 다른 슬롯이 없습니다.
            </p>
          )}
          {!loading && !error && slots.length > 0 && (
            <ul className="space-y-2">
              {slots.map((slot) => {
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
                          "정말 조그레스 진화를 하시겠습니까?\n\n진화할 경우 파트너 디지몬은 데이터가 되어 사라집니다."
                        );
                        if (!confirmed) return;
                        onSelectPartner?.(slot);
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
                          possible
                            ? "bg-green-600/90 text-white"
                            : "bg-red-900/80 text-red-200"
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
      </div>
    </div>
  );
}
