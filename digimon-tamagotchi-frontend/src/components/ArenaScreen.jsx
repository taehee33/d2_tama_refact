// src/components/ArenaScreen.jsx
// Arena 모드: 디지몬 등록 및 비동기 대전 목록

import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  serverTimestamp,
  increment
} from "firebase/firestore";
import { db } from "../firebase";
import { digimonDataVer1 } from "../data/v1/digimons";
import { calculatePower } from "../logic/battle/hitrate";
import "../styles/Battle.css";

const MAX_ENTRIES = 3;

export default function ArenaScreen({ onClose, onStartBattle, currentSlotId, mode }) {
  const { currentUser, isFirebaseAvailable } = useAuth();
  const [myEntries, setMyEntries] = useState([]);
  const [challengers, setChallengers] = useState([]);
  const [battleLogs, setBattleLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [showSlotSelection, setShowSlotSelection] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [activeTab, setActiveTab] = useState('challengers'); // 'challengers' | 'battleLog'
  const [logFilter, setLogFilter] = useState('all'); // 'all' | entryId
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (isFirebaseAvailable && currentUser && mode !== 'local') {
      loadMyEntries();
      loadChallengers();
    } else {
      setLoading(false);
    }
  }, [currentUser, isFirebaseAvailable, mode]);

  useEffect(() => {
    if (activeTab === 'battleLog' && isFirebaseAvailable && currentUser && mode !== 'local') {
      loadBattleLogs();
    }
  }, [activeTab, currentUser, isFirebaseAvailable, mode]);

  // 내 등록된 디지몬 목록 로드
  const loadMyEntries = async () => {
    if (!isFirebaseAvailable || !currentUser || mode === 'local') return;
    
    try {
      const entriesRef = collection(db, 'arena_entries');
      const q = query(entriesRef, where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      
      const entries = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // createdAt 기준으로 정렬 (최신순)
      entries.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });
      
      setMyEntries(entries);
    } catch (error) {
      console.error("내 엔트리 로드 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  // 챌린저 목록 로드
  const loadChallengers = async () => {
    if (!isFirebaseAvailable || !currentUser || mode === 'local') return;
    
    try {
      const entriesRef = collection(db, 'arena_entries');
      const q = query(
        entriesRef,
        where('userId', '!=', currentUser.uid),
        orderBy('userId'), // userId로 정렬 (다른 사용자만)
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const challengersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      setChallengers(challengersList);
    } catch (error) {
      console.error("챌린저 로드 오류:", error);
      // 복합 인덱스 오류 시 userId로만 필터링
      try {
        const entriesRef = collection(db, 'arena_entries');
        const allDocs = await getDocs(entriesRef);
        const challengersList = allDocs.docs
          .filter(doc => doc.data().userId !== currentUser.uid)
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
        setChallengers(challengersList);
      } catch (fallbackError) {
        console.error("챌린저 로드 fallback 오류:", fallbackError);
      }
    }
  };

  // 배틀 로그 로드 (방어 기록)
  const loadBattleLogs = async () => {
    if (!isFirebaseAvailable || !currentUser || mode === 'local') return;
    
    try {
      setLoadingLogs(true);
      const logsRef = collection(db, 'arena_battle_logs');
      const q = query(
        logsRef,
        where('defenderId', '==', currentUser.uid),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const logs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      setBattleLogs(logs);
    } catch (error) {
      console.error("배틀 로그 로드 오류:", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  // 사용 가능한 슬롯 로드
  const loadAvailableSlots = async () => {
    try {
      setLoading(true);
      const slots = [];
      
      if (isFirebaseAvailable && currentUser && mode !== 'local') {
        const slotsRef = collection(db, 'users', currentUser.uid, 'slots');
        const querySnapshot = await getDocs(slotsRef);
        
        for (const docSnap of querySnapshot.docs) {
          const data = docSnap.data();
          const slotId = parseInt(docSnap.id.replace('slot', ''));
          
          // 이미 등록된 슬롯은 제외
          const isRegistered = myEntries.some(entry => 
            entry.digimonSnapshot?.slotId === slotId
          );
          
          if (!isRegistered && data.selectedDigimon && data.selectedDigimon !== "Digitama") {
            slots.push({
              id: slotId,
              slotName: data.slotName || `슬롯${slotId}`,
              selectedDigimon: data.selectedDigimon,
              digimonStats: data.digimonStats || {},
            });
          }
        }
      } else {
        // localStorage 모드
        for (let i = 1; i <= 10; i++) {
          const digimonName = localStorage.getItem(`slot${i}_selectedDigimon`);
          if (digimonName && digimonName !== "Digitama") {
            const statsJson = localStorage.getItem(`slot${i}_digimonStats`);
            const digimonStats = statsJson ? JSON.parse(statsJson) : {};
            
            slots.push({
              id: i,
              slotName: localStorage.getItem(`slot${i}_slotName`) || `슬롯${i}`,
              selectedDigimon: digimonName,
              digimonStats,
            });
          }
        }
      }
      
      setAvailableSlots(slots);
      setShowSlotSelection(true);
    } catch (error) {
      console.error("슬롯 로드 오류:", error);
      alert(`슬롯 로드 중 오류가 발생했습니다.\n${error.message || error.code || "알 수 없는 오류"}`);
    } finally {
      setLoading(false);
    }
  };

  // 등록 제한 체크
  const checkRegistrationLimit = async () => {
    if (!isFirebaseAvailable || !currentUser || mode === 'local') return 0;
    
    try {
      const entriesRef = collection(db, 'arena_entries');
      const q = query(entriesRef, where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.length;
    } catch (error) {
      console.error("등록 제한 체크 오류:", error);
      return 0;
    }
  };

  // 디지몬 스냅샷 생성 (Deep Copy)
  const createDigimonSnapshot = (slot) => {
    const digimonData = digimonDataVer1[slot.selectedDigimon] || {};
    const stats = slot.digimonStats || {};
    
    return {
      digimonId: slot.selectedDigimon,
      digimonName: slot.selectedDigimon,
      sprite: digimonData.sprite || 0,
      attackSprite: digimonData.stats?.attackSprite || digimonData.sprite || 0,
      stage: digimonData.stage || "Unknown",
      stats: {
        power: stats.power || calculatePower(stats, digimonData) || digimonData.stats?.basePower || 0,
        type: digimonData.stats?.type || null,
        ...stats, // 모든 스탯 포함
      },
      image: digimonData.sprite || 0, // 이미지도 포함
      slotId: slot.id,
      slotName: slot.slotName,
    };
  };

  // 등록 처리
  const handleRegister = async (slot) => {
    if (!isFirebaseAvailable || !currentUser || mode === 'local') {
      alert("Arena 모드는 Firebase 로그인이 필요합니다.");
      return;
    }
    
    try {
      setRegistering(true);
      const currentCount = await checkRegistrationLimit();
      if (currentCount >= MAX_ENTRIES) {
        alert("최대 3마리까지만 등록할 수 있습니다.");
        setRegistering(false);
        return;
      }
      
      const snapshot = createDigimonSnapshot(slot);
      const tamerName = currentUser.displayName || slot.slotName || `슬롯${slot.id}`;
      
      const entryData = {
        userId: currentUser.uid,
        tamerName: tamerName,
        digimonSnapshot: snapshot,
        record: { wins: 0, losses: 0 },
        createdAt: serverTimestamp(),
      };
      
      const entriesRef = collection(db, 'arena_entries');
      const docRef = await addDoc(entriesRef, entryData);
      console.log("등록 완료, 문서 ID:", docRef.id);
      
      setTimeout(async () => {
        await loadMyEntries();
      }, 500);
      
      setShowSlotSelection(false);
      alert("Arena에 등록되었습니다!");
    } catch (error) {
      console.error("등록 오류:", error);
      alert(`등록 중 오류가 발생했습니다.\n${error.message || error.code || "알 수 없는 오류"}`);
    } finally {
      setRegistering(false);
    }
  };

  // 등록 해제
  const handleDeleteEntry = async (entryId) => {
    if (!isFirebaseAvailable || !currentUser || mode === 'local') return;
    
    if (!window.confirm("정말 등록을 해제하시겠습니까?")) return;
    
    try {
      const entryRef = doc(db, 'arena_entries', entryId);
      await deleteDoc(entryRef);
      await loadMyEntries();
      alert("등록이 해제되었습니다.");
    } catch (error) {
      console.error("등록 해제 오류:", error);
      alert(`등록 해제 중 오류가 발생했습니다.\n${error.message || error.code || "알 수 없는 오류"}`);
    }
  };

  // 엔트리 클릭 (상세 정보)
  const handleEntryClick = (entry, isMyEntry) => {
    setSelectedEntry({ ...entry, isMyEntry });
    setShowDetailModal(true);
  };

  // 배틀 시작
  const handleStartArenaBattle = (challenger) => {
    if (!challenger.id) {
      console.error("Arena Challenger에 Document ID가 없습니다:", challenger);
      alert("배틀을 시작할 수 없습니다. Challenger 데이터에 문제가 있습니다.");
      return;
    }
    
    // 내 엔트리 ID 찾기 (현재 슬롯과 매칭되는 엔트리)
    const myEntry = myEntries.find(entry => 
      entry.digimonSnapshot?.slotId === currentSlotId
    );
    const myEntryId = myEntry?.id || null;
    
    onStartBattle(challenger, myEntryId);
  };

  // 승률 계산
  const calculateWinRate = (record) => {
    const total = record.wins + record.losses;
    if (total === 0) return 0;
    return Math.round((record.wins / total) * 100);
  };

  // 시간 경과 계산
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "알 수 없음";
    
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp.toMillis) {
      date = new Date(timestamp.toMillis());
    } else {
      date = new Date(timestamp);
    }
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    if (minutes > 0) return `${minutes}분 전`;
    return "방금 전";
  };

  // 필터링된 로그
  const filteredLogs = logFilter === 'all' 
    ? battleLogs 
    : battleLogs.filter(log => log.defenderEntryId === logFilter);

  if (loading && myEntries.length === 0 && challengers.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white p-6 rounded-lg">
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Arena Mode</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            닫기
          </button>
        </div>

        {/* My Arena Entries */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
          <h3 className="text-xl font-bold mb-3">My Arena Entries ({myEntries.length}/{MAX_ENTRIES})</h3>
          <div className="flex overflow-x-auto space-x-4 pb-2">
            {myEntries.length === 0 ? (
              <p className="text-gray-700">등록된 디지몬이 없습니다.</p>
            ) : (
              myEntries.map((entry) => (
                <div key={entry.id} className="flex-shrink-0 w-48 p-3 bg-blue-100 rounded-lg border border-blue-300 relative">
                  <div onClick={() => handleEntryClick(entry, true)} className="cursor-pointer">
                    <div className="flex justify-center mb-2">
                      <img
                        src={`/images/${entry.digimonSnapshot?.sprite || 0}.png`}
                        alt={entry.digimonSnapshot?.digimonName || "Unknown"}
                        className="w-24 h-24"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </div>
                    <p className="font-bold text-center text-sm mb-1">
                      {entry.tamerName || entry.trainerName || 'Unknown'} - {entry.digimonSnapshot?.digimonName || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500 text-center">Stage: {entry.digimonSnapshot?.stage || "Unknown"}</p>
                    <p className="text-xs text-gray-500 text-center">
                      {entry.record.wins}승 {entry.record.losses}패 ({calculateWinRate(entry.record)}%)
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    title="등록 해제"
                  >
                    X
                  </button>
                </div>
              ))
            )}
            {myEntries.length < MAX_ENTRIES && (
              <button
                onClick={loadAvailableSlots}
                className="flex-shrink-0 w-48 h-48 flex flex-col items-center justify-center bg-gray-100 rounded-lg border-2 border-dashed border-gray-400 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <span className="text-5xl">+</span>
                <span className="text-sm mt-2">추가 등록</span>
              </button>
            )}
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div className="flex space-x-4 mb-4 border-b">
          <button
            onClick={() => setActiveTab('challengers')}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === 'challengers'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Challengers
          </button>
          <button
            onClick={() => setActiveTab('battleLog')}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === 'battleLog'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Battle Log
          </button>
        </div>

        {/* Challengers 탭 */}
        {activeTab === 'challengers' && (
          <div>
            <h3 className="text-xl font-bold mb-3">Challengers</h3>
            {challengers.length === 0 ? (
              <p className="text-gray-600">등록된 챌린저가 없습니다.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {challengers.map((challenger) => (
                  <div
                    key={challenger.id}
                    className="p-4 bg-gray-100 rounded-lg border-2 border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleEntryClick(challenger, false)}
                  >
                    <div className="flex justify-center mb-2">
                      {/* Blind Pick: 이미지 마스킹 */}
                      <div className="w-24 h-24 bg-gray-300 rounded-lg flex items-center justify-center text-4xl text-gray-500">
                        ?
                      </div>
                    </div>
                    <p className="font-bold text-center mb-1">
                      {challenger.tamerName || challenger.trainerName || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500 text-center mb-1">
                      Stage: {challenger.digimonSnapshot?.stage || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500 text-center mb-2">
                      {challenger.record.wins}승 {challenger.record.losses}패 ({calculateWinRate(challenger.record)}%)
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartArenaBattle(challenger);
                      }}
                      className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
                    >
                      Battle
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Battle Log 탭 */}
        {activeTab === 'battleLog' && (
          <div>
            <h3 className="text-xl font-bold mb-3">Battle Log (방어 기록)</h3>

            {/* 필터 버튼 */}
            {!loadingLogs && battleLogs.length > 0 && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    onClick={() => setLogFilter('all')}
                    className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                      logFilter === 'all'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    전체 보기
                  </button>
                  {myEntries.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setLogFilter(entry.id)}
                      className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                        logFilter === entry.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {entry.digimonSnapshot?.digimonName || 'Unknown'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loadingLogs ? (
              <p className="text-gray-600">로딩 중...</p>
            ) : filteredLogs.length === 0 ? (
              <p className="text-gray-600">
                {logFilter === 'all' ? '방어 기록이 없습니다.' : '해당 디지몬의 방어 기록이 없습니다.'}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => {
                  const isDefenseSuccess = log.winnerId === currentUser?.uid;
                  let timestamp = null;
                  if (log.timestamp) {
                    if (log.timestamp.toDate) {
                      timestamp = log.timestamp.toDate();
                    } else if (log.timestamp.seconds) {
                      timestamp = new Date(log.timestamp.seconds * 1000);
                    } else if (log.timestamp.toMillis) {
                      timestamp = new Date(log.timestamp.toMillis());
                    }
                  }
                  const timeAgo = timestamp ? getTimeAgo(log.timestamp) : "알 수 없음";

                  const myDefendingDigimon = myEntries.find(entry => entry.id === log.defenderEntryId);
                  const myDefendingDigimonName = myDefendingDigimon?.digimonSnapshot?.digimonName || 'Unknown Digimon';

                  return (
                    <div
                      key={log.id}
                      className={`p-4 rounded-lg border-2 ${
                        isDefenseSuccess
                          ? 'bg-green-50 border-green-300'
                          : 'bg-red-50 border-red-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-bold text-lg mb-1">
                            {log.attackerName}의 공격
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            {log.attackerName} → {myDefendingDigimonName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {timeAgo}
                          </p>
                        </div>
                        <div className="ml-4">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-bold ${
                              isDefenseSuccess
                                ? 'bg-green-500 text-white'
                                : 'bg-red-500 text-white'
                            }`}
                          >
                            {isDefenseSuccess ? 'DEFENSE SUCCESS (WIN)' : 'DEFEATED (LOSS)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 슬롯 선택 모달 */}
        {showSlotSelection && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-60">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">등록할 슬롯 선택</h3>
              {availableSlots.length === 0 ? (
                <p className="text-gray-600">등록 가능한 슬롯이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {availableSlots.map((slot) => {
                    const digimonData = digimonDataVer1[slot.selectedDigimon] || {};
                    const power = slot.digimonStats?.power 
                      || calculatePower(slot.digimonStats || {}, digimonData) 
                      || digimonData.stats?.basePower || 0;
                    
                    return (
                      <div
                        key={slot.id}
                        className="p-4 bg-gray-100 rounded-lg border-2 border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors"
                        onClick={() => handleRegister(slot)}
                      >
                        <div className="flex justify-center mb-2">
                          <img
                            src={`/images/${digimonData.sprite || 0}.png`}
                            alt={slot.selectedDigimon}
                            className="w-20 h-20"
                            style={{ imageRendering: "pixelated" }}
                          />
                        </div>
                        <p className="font-bold text-center text-sm mb-1">{slot.slotName}</p>
                        <p className="text-xs text-gray-500 text-center mb-1">{slot.selectedDigimon}</p>
                        <p className="text-xs text-gray-500 text-center">Power: {power}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                onClick={() => setShowSlotSelection(false)}
                className="mt-4 w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 상세 정보 모달 */}
        {showDetailModal && selectedEntry && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-60">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full m-4">
              <h3 className="text-xl font-bold mb-4">상세 정보</h3>
              <div className="flex justify-center mb-4">
                <img
                  src={`/images/${selectedEntry.isMyEntry 
                    ? (selectedEntry.digimonSnapshot?.sprite || 0)
                    : 0 // Blind Pick: 내 디지몬이 아니면 마스킹
                  }.png`}
                  alt={selectedEntry.digimonSnapshot?.digimonName || "Unknown"}
                  className="w-32 h-32"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <p className="font-bold text-center mb-2">
                {selectedEntry.isMyEntry
                  ? selectedEntry.digimonSnapshot?.digimonName || "Unknown"
                  : "Unknown Digimon" // Blind Pick
                }
              </p>
              <p className="text-sm text-gray-600 text-center mb-2">
                Tamer: {selectedEntry.tamerName || selectedEntry.trainerName || 'Unknown'}
              </p>
              <p className="text-sm text-gray-600 text-center mb-2">
                Stage: {selectedEntry.digimonSnapshot?.stage || "Unknown"}
              </p>
              {selectedEntry.isMyEntry && (
                <>
                  <p className="text-sm text-gray-600 text-center mb-2">
                    Type: {selectedEntry.digimonSnapshot?.stats?.type || "Unknown"}
                  </p>
                  <p className="text-sm text-gray-600 text-center mb-2">
                    Power: {selectedEntry.digimonSnapshot?.stats?.power || 0}
                  </p>
                </>
              )}
              <p className="text-sm text-gray-600 text-center mb-4">
                {selectedEntry.record.wins}승 {selectedEntry.record.losses}패 ({calculateWinRate(selectedEntry.record)}%)
              </p>
              {!selectedEntry.isMyEntry && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleStartArenaBattle(selectedEntry);
                  }}
                  className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors mb-2"
                >
                  Battle
                </button>
              )}
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedEntry(null);
                }}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

