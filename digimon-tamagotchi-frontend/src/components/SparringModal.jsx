// src/components/SparringModal.jsx
// Sparring (Self PvP) 슬롯 선택 모달

import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import { digimonDataVer1 } from "../data/v1/digimons";
import { calculatePower } from "../logic/battle/hitrate";
import "../styles/Battle.css";

const MAX_SLOTS = 10;

export default function SparringModal({ onClose, onSelectSlot, currentSlotId, mode }) {
  const { currentUser, isFirebaseAvailable } = useAuth();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isFirebaseAvailable, mode]);

  const loadSlots = async () => {
    try {
      setLoading(true);
      
      if (isFirebaseAvailable && currentUser && mode !== 'local') {
        // Firestore 모드
        const slotsRef = collection(db, 'users', currentUser.uid, 'slots');
        const q = query(slotsRef, orderBy('createdAt', 'desc'), limit(MAX_SLOTS));
        const querySnapshot = await getDocs(q);
        
        const userSlots = [];
        for (const docSnap of querySnapshot.docs) {
          const data = docSnap.data();
          const slotId = parseInt(docSnap.id.replace('slot', ''));
          
          // 현재 슬롯은 제외
          if (slotId === currentSlotId) continue;
          
          // 슬롯 데이터와 디지몬 스탯 가져오기
          const slotData = {
            id: slotId,
            slotName: data.slotName || `슬롯${slotId}`,
            selectedDigimon: data.selectedDigimon || "Digitama",
            digimonStats: data.digimonStats || {},
            createdAt: data.createdAt || "",
          };
          
          userSlots.push(slotData);
        }
        
        setSlots(userSlots);
      } else {
        // localStorage 모드
        const arr = [];
        for (let i = 1; i <= MAX_SLOTS; i++) {
          // 현재 슬롯은 제외
          if (i === currentSlotId) continue;
          
          const digimonName = localStorage.getItem(`slot${i}_selectedDigimon`);
          if (digimonName) {
            const slotName = localStorage.getItem(`slot${i}_slotName`) || `슬롯${i}`;
            const statsJson = localStorage.getItem(`slot${i}_digimonStats`);
            const digimonStats = statsJson ? JSON.parse(statsJson) : {};
            
            arr.push({
              id: i,
              slotName,
              selectedDigimon: digimonName,
              digimonStats,
              createdAt: localStorage.getItem(`slot${i}_createdAt`) || "",
            });
          }
        }
        setSlots(arr);
      }
    } catch (err) {
      console.error("슬롯 로드 오류:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="battle-modal bg-white p-6 rounded-lg shadow-xl">
          <p className="text-center">슬롯 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="battle-modal bg-white p-6 rounded-lg shadow-xl max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-center">Sparring (Self PvP)</h2>
        <p className="text-sm text-gray-600 mb-4 text-center">대전할 슬롯을 선택하세요</p>
        
        {slots.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">대전 가능한 슬롯이 없습니다.</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              닫기
            </button>
          </div>
        ) : (
          <div className="flex flex-col space-y-2 mb-4">
            {slots.map((slot) => {
              // 디지몬 데이터 가져오기
              const digimonData = digimonDataVer1[slot.selectedDigimon];
              // 실제 파워 계산 (digimonStats.power 또는 calculatePower 사용)
              const actualPower = slot.digimonStats?.power 
                || (digimonData ? calculatePower(slot.digimonStats || {}, digimonData) : 0)
                || digimonData?.stats?.basePower 
                || 0;
              
              return (
                <button
                  key={slot.id}
                  onClick={() => {
                    onSelectSlot(slot);
                    onClose();
                  }}
                  className="px-4 py-3 bg-blue-100 hover:bg-blue-200 rounded-lg text-left transition-colors"
                >
                  <div className="font-bold mb-1">{slot.slotName}</div>
                  <div className="text-sm font-semibold text-gray-800 mb-1">
                    "{digimonData?.name || slot.selectedDigimon}"
                  </div>
                  <div className="text-sm text-gray-600">
                    파워: {actualPower}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          뒤로
        </button>
      </div>
    </div>
  );
}

