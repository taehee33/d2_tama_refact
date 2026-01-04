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
  increment,
  limit,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { digimonDataVer1 } from "../data/v1/digimons";
import { calculatePower } from "../logic/battle/hitrate";
import "../styles/Battle.css";

const MAX_ENTRIES = 3;
const CURRENT_SEASON_ID = 1;
const LEADERBOARD_LIMIT = 20;

export default function ArenaScreen({ onClose, onStartBattle, currentSlotId, mode, currentSeasonId = CURRENT_SEASON_ID, isDevMode = false, onOpenAdmin }) {
  // 배경 스크롤 방지
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;
    const scrollY = window.scrollY;
    
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;
    
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);
  
  const { currentUser, isFirebaseAvailable } = useAuth();
  const [myEntries, setMyEntries] = useState([]);
  const [challengers, setChallengers] = useState([]);
  const [battleLogs, setBattleLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [showSlotSelection, setShowSlotSelection] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [activeTab, setActiveTab] = useState('challengers'); // 'challengers' | 'battleLog' | 'leaderboard'
  const [logFilter, setLogFilter] = useState('all'); // 'all' | entryId
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedBattleLog, setSelectedBattleLog] = useState(null);
  const [showBattleLogReview, setShowBattleLogReview] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  // leaderboardMode: 'current' | 'all' | 'past'
  const [leaderboardMode, setLeaderboardMode] = useState('current');
  const [seasonDurationText, setSeasonDurationText] = useState("");
  const [seasonName, setSeasonName] = useState(`Season ${currentSeasonId}`);
  const [archivesList, setArchivesList] = useState([]);
  const [selectedArchiveId, setSelectedArchiveId] = useState("");
  const [archiveLoading, setArchiveLoading] = useState(false);

  useEffect(() => {
    if (isFirebaseAvailable && currentUser && mode !== 'local') {
      loadMyEntries();
      loadChallengers();
      loadArenaConfig();
      loadArchivesList();
    } else {
      setLoading(false);
    }
  }, [currentUser, isFirebaseAvailable, mode]);

  // 배틀 완료 후 엔트리 목록 새로고침 (승패 기록 반영)
  useEffect(() => {
    // activeTab이 변경되거나 모달이 다시 열릴 때 엔트리 목록 새로고침
    if (isFirebaseAvailable && currentUser && mode !== 'local' && !loading) {
      loadMyEntries();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'battleLog' && isFirebaseAvailable && currentUser && mode !== 'local') {
      loadBattleLogs();
    }
    if (activeTab === 'leaderboard' && isFirebaseAvailable && currentUser && mode !== 'local') {
      if (leaderboardMode === 'past') {
        // 과거 시즌: 아카이브 선택 시 로드, 아니라면 목록만 유지
        if (selectedArchiveId) {
          loadArchiveEntries(selectedArchiveId);
        }
      } else {
        loadLeaderboard(leaderboardMode);
      }
    }
  }, [activeTab, currentUser, isFirebaseAvailable, mode, leaderboardMode, selectedArchiveId]);

  // 시즌 설정 로드
  const loadArenaConfig = async () => {
    if (!isFirebaseAvailable || !currentUser || mode === 'local') return;
    try {
      const configRef = doc(db, 'game_settings', 'arena_config');
      const snap = await getDoc(configRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.seasonDuration) setSeasonDurationText(data.seasonDuration);
        if (data.seasonName) setSeasonName(data.seasonName);
      }
    } catch (error) {
      console.error("Arena 설정 로드 오류:", error);
    }
  };

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

  // 배틀 로그 로드 (공격 기록 + 방어 기록)
  const loadBattleLogs = async () => {
    if (!isFirebaseAvailable || !currentUser || mode === 'local') return;
    
    try {
      setLoadingLogs(true);
      const logsRef = collection(db, 'arena_battle_logs');
      
      let attackLogs = [];
      let defenseLogs = [];
      
      // 공격 기록 로드
      try {
        const attackQuery = query(
          logsRef,
          where('attackerId', '==', currentUser.uid),
          orderBy('timestamp', 'desc')
        );
        const attackSnapshot = await getDocs(attackQuery);
        attackLogs = attackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isAttack: true }));
        console.log("✅ 공격 기록 로드 완료:", attackLogs.length, "개");
      } catch (attackError) {
        console.error("❌ 공격 기록 로드 오류:", attackError);
        if (attackError.code === 'failed-precondition') {
          console.warn("⚠️ attackerId 인덱스가 필요합니다. Firestore 콘솔에서 인덱스를 생성해주세요.");
        }
      }
      
      // 방어 기록 로드
      try {
        const defenseQuery = query(
          logsRef,
          where('defenderId', '==', currentUser.uid),
          orderBy('timestamp', 'desc')
        );
        const defenseSnapshot = await getDocs(defenseQuery);
        defenseLogs = defenseSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isAttack: false }));
        console.log("✅ 방어 기록 로드 완료:", defenseLogs.length, "개");
      } catch (defenseError) {
        console.error("❌ 방어 기록 로드 오류:", defenseError);
        if (defenseError.code === 'failed-precondition') {
          console.warn("⚠️ defenderId 인덱스가 필요합니다. Firestore 콘솔에서 인덱스를 생성해주세요.");
          // 인덱스 오류 메시지에 링크가 있으면 표시
          if (defenseError.message && defenseError.message.includes('https://')) {
            const linkMatch = defenseError.message.match(/https:\/\/[^\s]+/);
            if (linkMatch) {
              console.log("🔗 인덱스 생성 링크:", linkMatch[0]);
            }
          }
        }
      }
      
      // 두 쿼리 결과를 합치고 중복 제거 (같은 배틀에서 공격자와 방어자가 모두 나일 수 있음)
      const allLogs = [...attackLogs, ...defenseLogs];
      
      // 중복 제거 (같은 문서 ID를 가진 로그는 하나만 유지)
      const uniqueLogs = allLogs.reduce((acc, log) => {
        if (!acc.find(l => l.id === log.id)) {
          acc.push(log);
        }
        return acc;
      }, []);
      
      // timestamp 기준으로 정렬 (최신순)
      uniqueLogs.sort((a, b) => {
        const aTime = a.timestamp?.toDate?.() || new Date(0);
        const bTime = b.timestamp?.toDate?.() || new Date(0);
        return bTime - aTime;
      });
      
      console.log("✅ 배틀 로그 통합 완료:", uniqueLogs.length, "개");
      setBattleLogs(uniqueLogs);
    } catch (error) {
      console.error("배틀 로그 로드 오류:", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  // 리더보드 로드
  const loadLeaderboard = async (modeType = 'all') => {
    if (!isFirebaseAvailable || mode === 'local') return;

    try {
      setLeaderboardLoading(true);
      const entriesRef = collection(db, 'arena_entries');

      let q;
      if (modeType === 'current') {
        // 현재 시즌 랭킹: seasonId == currentSeasonId, seasonWins 내림차순
        q = query(
          entriesRef,
          where('record.seasonId', '==', currentSeasonId || CURRENT_SEASON_ID),
          orderBy('record.seasonWins', 'desc'),
          limit(LEADERBOARD_LIMIT)
        );
      } else {
        // 전체 랭킹: wins 내림차순
        q = query(
          entriesRef,
          orderBy('record.wins', 'desc'),
          limit(LEADERBOARD_LIMIT)
        );
      }

      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLeaderboardEntries(list);
    } catch (error) {
      console.error("리더보드 로드 오류:", error);
      console.error("복합 인덱스 오류가 발생할 수 있습니다. Firestore 콘솔에서 제안 링크를 따라 인덱스를 생성하세요.");
    } finally {
      setLeaderboardLoading(false);
    }
  };

  // 아카이브 목록 로드
  const loadArchivesList = async () => {
    if (!isFirebaseAvailable || mode === 'local') return;
    try {
      setArchiveLoading(true);
      const colRef = collection(db, 'season_archives');
      const q = query(colRef, orderBy('seasonId', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setArchivesList(list);
    } catch (error) {
      console.error("아카이브 목록 로드 오류:", error);
    } finally {
      setArchiveLoading(false);
    }
  };

  // 과거 시즌 아카이브 항목 로드
  const loadArchiveEntries = async (archiveId) => {
    if (!archiveId) return;
    try {
      setLeaderboardLoading(true);
      const arcRef = doc(db, 'season_archives', archiveId);
      const snap = await getDoc(arcRef);
      if (snap.exists()) {
        const data = snap.data();
        const entries = data.entries || [];
        setLeaderboardEntries(entries);
      } else {
        setLeaderboardEntries([]);
      }
    } catch (error) {
      console.error("과거 시즌 로드 오류:", error);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  // 사용 가능한 슬롯 로드
  const loadAvailableSlots = async () => {
    try {
      setLoading(true);
      const slots = [];
      
      // myEntries를 최신 상태로 다시 로드 (타이밍 이슈 방지)
      let currentMyEntries = myEntries;
      let currentSlotEntry = null; // 현재 슬롯의 등록 정보
      
      if (isFirebaseAvailable && currentUser && mode !== 'local') {
        try {
          const entriesRef = collection(db, 'arena_entries');
          const q = query(entriesRef, where('userId', '==', currentUser.uid));
          const querySnapshot = await getDocs(q);
          currentMyEntries = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          
          // 현재 슬롯이 이미 등록되어 있는지 확인
          if (currentSlotId) {
            currentSlotEntry = currentMyEntries.find(entry => 
              entry.digimonSnapshot?.slotId === currentSlotId
            );
          }
          
          console.log("[Arena] 등록된 엔트리:", currentMyEntries.map(e => ({
            id: e.id,
            slotId: e.digimonSnapshot?.slotId,
            digimonName: e.digimonSnapshot?.digimonName
          })));
          
          // 현재 슬롯이 이미 등록되어 있으면 즉시 알림
          if (currentSlotEntry) {
            const currentDigimonName = currentSlotEntry.digimonSnapshot?.digimonName || "현재 디지몬";
            alert(`현재 슬롯(슬롯${currentSlotId})은 이미 아레나에 등록되어 있습니다.\n\n등록된 디지몬: ${currentDigimonName}\n\n다시 등록하려면 "My Arena Entries"에서 기존 등록을 해제한 후 등록해주세요.`);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error("등록된 엔트리 로드 오류:", error);
        }
      }
      
      if (isFirebaseAvailable && currentUser && mode !== 'local') {
        // 현재 슬롯만 로드
        if (!currentSlotId) {
          alert("현재 슬롯 정보를 찾을 수 없습니다.");
          setLoading(false);
          return;
        }
        
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${currentSlotId}`);
        const slotSnap = await getDoc(slotRef);
        
        if (!slotSnap.exists()) {
          alert(`슬롯${currentSlotId}를 찾을 수 없습니다.`);
          setLoading(false);
          return;
        }
        
        const data = slotSnap.data();
        const slotId = currentSlotId;
        
        console.log(`[Arena] 현재 슬롯 ${slotId} 체크:`, {
          selectedDigimon: data.selectedDigimon,
          isDigitama: data.selectedDigimon === "Digitama",
          slotName: data.slotName
        });
        
        // 이미 등록된 슬롯은 제외
        const isRegistered = currentMyEntries.some(entry => {
          const entrySlotId = entry.digimonSnapshot?.slotId;
          const matches = entrySlotId === slotId;
          if (matches) {
            console.log(`[Arena] 슬롯 ${slotId}는 이미 등록됨 (엔트리 ID: ${entry.id})`);
          }
          return matches;
        });
        
        if (!isRegistered && data.selectedDigimon && data.selectedDigimon !== "Digitama") {
          console.log(`[Arena] 현재 슬롯 ${slotId} 추가됨`);
          slots.push({
            id: slotId,
            slotName: data.slotName || `슬롯${slotId}`,
            selectedDigimon: data.selectedDigimon,
            digimonStats: data.digimonStats || {},
          });
        } else {
          console.log(`[Arena] 현재 슬롯 ${slotId} 제외됨:`, {
            isRegistered,
            hasDigimon: !!data.selectedDigimon,
            isDigitama: data.selectedDigimon === "Digitama"
          });
        }
      } else {
        // localStorage 모드 - 현재 슬롯만
        if (!currentSlotId) {
          alert("현재 슬롯 정보를 찾을 수 없습니다.");
          setLoading(false);
          return;
        }
        
        const digimonName = localStorage.getItem(`slot${currentSlotId}_selectedDigimon`);
        if (digimonName && digimonName !== "Digitama") {
          const statsJson = localStorage.getItem(`slot${currentSlotId}_digimonStats`);
          const digimonStats = statsJson ? JSON.parse(statsJson) : {};
          
          // 이미 등록된 슬롯은 제외
          const isRegistered = currentMyEntries.some(entry => 
            entry.digimonSnapshot?.slotId === currentSlotId
          );
          
          if (!isRegistered) {
            slots.push({
              id: currentSlotId,
              slotName: localStorage.getItem(`slot${currentSlotId}_slotName`) || `슬롯${currentSlotId}`,
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
    
    // 디버깅: 내 엔트리 찾기 결과 확인
    console.log("🔍 [Arena Battle Start] 디버깅 정보:", {
      currentSlotId,
      myEntriesCount: myEntries.length,
      myEntries: myEntries.map(e => ({
        id: e.id,
        slotId: e.digimonSnapshot?.slotId,
        digimonName: e.digimonSnapshot?.digimonName
      })),
      foundMyEntry: myEntry ? {
        id: myEntry.id,
        slotId: myEntry.digimonSnapshot?.slotId,
        digimonName: myEntry.digimonSnapshot?.digimonName
      } : null,
      myEntryId
    });
    
    if (!myEntryId) {
      console.warn("⚠️ 현재 슬롯과 매칭되는 아레나 엔트리를 찾을 수 없습니다!");
      alert("⚠️ 경고: 현재 슬롯이 아레나에 등록되어 있지 않습니다.\n\n승패 기록이 저장되지 않을 수 있습니다. 아레나에 등록 후 배틀을 시작해주세요.");
    }
    
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
    : battleLogs.filter(log => {
        // 공격 기록인 경우 myEntryId로 필터링, 방어 기록인 경우 defenderEntryId로 필터링
        if (log.isAttack) {
          return log.myEntryId === logFilter;
        } else {
          return log.defenderEntryId === logFilter;
        }
      });

  if (loading && myEntries.length === 0 && challengers.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50" modal-overlay-mobile>
        <div className="bg-white p-6 rounded-lg">
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 modal-overlay-mobile" style={{ paddingTop: '80px', paddingBottom: '80px', overflow: 'hidden' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full m-4 flex flex-col" style={{ maxHeight: 'calc(100vh - 160px)', height: 'auto' }}>
        {/* 스크롤 가능한 콘텐츠 영역 */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}>
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200">
            <h2 className="text-2xl font-bold">Arena Mode</h2>
          </div>

        {/* My Arena Entries */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
          <h3 className="text-xl font-bold mb-3">My Arena Entries ({myEntries.length}/{MAX_ENTRIES})</h3>
          <div className="flex overflow-x-hidden space-x-4 pb-2" style={{ flexWrap: 'wrap', gap: '8px' }}>
            {myEntries.length === 0 ? (
              <p className="text-gray-700">등록된 디지몬이 없습니다.</p>
            ) : (
              myEntries.map((entry) => {
                const isCurrentSlot = entry.digimonSnapshot?.slotId === currentSlotId;
                return (
                <div 
                  key={entry.id} 
                  className={`flex-shrink-0 w-48 p-3 rounded-lg border relative ${
                    isCurrentSlot 
                      ? 'bg-blue-200 border-blue-500 border-2 ring-2 ring-blue-300' 
                      : 'bg-blue-100 border-blue-300'
                  }`}
                >
                  {isCurrentSlot && (
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold z-10">
                      현재 플레이 중
                    </div>
                  )}
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
                );
              })
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
        <div className="flex space-x-2 sm:space-x-4 mb-4 border-b overflow-x-hidden">
          <button
            onClick={() => setActiveTab('challengers')}
            className={`px-2 sm:px-4 py-2 text-xs sm:text-base font-bold transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === 'challengers'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Challengers
          </button>
          <button
            onClick={() => setActiveTab('battleLog')}
            className={`px-2 sm:px-4 py-2 text-xs sm:text-base font-bold transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === 'battleLog'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Battle Log
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-2 sm:px-4 py-2 text-xs sm:text-base font-bold transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === 'leaderboard'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Leaderboard
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
            <h3 className="text-xl font-bold mb-3">Battle Log</h3>

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
                      {entry.digimonSnapshot?.digimonName || 'Unknown'} (슬롯{entry.digimonSnapshot?.slotId || '?'})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loadingLogs ? (
              <p className="text-gray-600">로딩 중...</p>
            ) : filteredLogs.length === 0 ? (
              <p className="text-gray-600">
                {logFilter === 'all' ? '배틀 기록이 없습니다.' : '해당 디지몬의 배틀 기록이 없습니다.'}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => {
                  // 공격 기록인지 방어 기록인지에 따라 승패 판단
                  const isWin = log.isAttack 
                    ? log.winnerId === currentUser?.uid  // 공격 기록: 내가 이겼으면 승리
                    : log.winnerId === currentUser?.uid; // 방어 기록: 내가 이겼으면 승리
                  
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
                  
                  // 실제 시간 포맷팅 (예: 2026.01.04 오후 12:49)
                  const formatDateTime = (timestamp) => {
                    if (!timestamp) return "";
                    let date;
                    if (timestamp.toDate) {
                      date = timestamp.toDate();
                    } else if (timestamp.seconds) {
                      date = new Date(timestamp.seconds * 1000);
                    } else if (timestamp.toMillis) {
                      date = new Date(timestamp.toMillis());
                    } else {
                      return "";
                    }
                    
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = date.getHours();
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const ampm = hours >= 12 ? '오후' : '오전';
                    const displayHours = hours % 12 || 12;
                    
                    return `${year}.${month}.${day} ${ampm} ${displayHours}:${minutes}`;
                  };
                  
                  const dateTime = formatDateTime(log.timestamp);

                  // 공격 기록인 경우: 내 엔트리 정보 찾기
                  // 방어 기록인 경우: 방어한 디지몬 정보 찾기
                  let myDigimonName = 'Unknown Digimon';
                  let mySlotId = null;
                  
                  if (log.isAttack) {
                    // 공격 기록: 내가 공격자
                    const myAttackingDigimon = myEntries.find(entry => entry.id === log.myEntryId);
                    myDigimonName = myAttackingDigimon?.digimonSnapshot?.digimonName || 'Unknown Digimon';
                    mySlotId = myAttackingDigimon?.digimonSnapshot?.slotId || null;
                  } else {
                    // 방어 기록: 내가 방어자
                    const myDefendingDigimon = myEntries.find(entry => entry.id === log.defenderEntryId);
                    myDigimonName = myDefendingDigimon?.digimonSnapshot?.digimonName || 'Unknown Digimon';
                    mySlotId = myDefendingDigimon?.digimonSnapshot?.slotId || null;
                  }

                  return (
                    <div
                      key={log.id}
                      className={`p-4 rounded-lg border-2 ${log.logs && log.logs.length > 0 ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''} ${
                        isWin
                          ? 'bg-green-50 border-green-300'
                          : 'bg-red-50 border-red-300'
                      }`}
                      onClick={() => {
                        if (log.logs && log.logs.length > 0) {
                          setSelectedBattleLog(log);
                          setShowBattleLogReview(true);
                        }
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-bold text-lg mb-1">
                            {log.isAttack ? '내 공격' : `${log.attackerName}의 공격`}
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            {log.isAttack 
                              ? `${myDigimonName}${mySlotId ? ` (슬롯${mySlotId})` : ''} → ${log.defenderName}${log.defenderDigimonName ? `의 ${log.defenderDigimonName}` : ''}`
                              : `${log.attackerName}${log.attackerDigimonName ? `의 ${log.attackerDigimonName}` : ''} → ${myDigimonName}${mySlotId ? ` (슬롯${mySlotId})` : ''}`
                            }
                          </p>
                          <p className="text-xs text-gray-500 mb-1">
                            {timeAgo}
                          </p>
                          {dateTime && (
                            <p className="text-xs text-gray-400">
                              {dateTime}
                            </p>
                          )}
                          {log.logs && log.logs.length > 0 && (
                            <p className="text-xs text-blue-600 mt-2 font-semibold">
                              📖 배틀 로그 다시보기
                            </p>
                          )}
                        </div>
                        <div className="ml-4">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-bold ${
                              isWin
                                ? 'bg-green-500 text-white'
                                : 'bg-red-500 text-white'
                            }`}
                          >
                            {log.isAttack 
                              ? (isWin ? 'ATTACK SUCCESS (WIN)' : 'ATTACK FAILED (LOSS)')
                              : (isWin ? 'DEFENSE SUCCESS (WIN)' : 'DEFEATED (LOSS)')
                            }
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

        {/* Leaderboard 탭 */}
        {activeTab === 'leaderboard' && (
          <div className="w-full overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-bold break-words">Leaderboard</h3>
                <p className="text-xs text-gray-500 break-words">
                  {seasonName} {seasonDurationText ? `(${seasonDurationText})` : ""}
                </p>
              </div>
              {isDevMode && (
                <button
                  onClick={onOpenAdmin}
                  className="px-2 sm:px-3 py-1 bg-gray-700 text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-gray-800 transition-colors flex-shrink-0"
                >
                  ⚙️ Arena Admin
                </button>
              )}
            </div>

            {/* 토글: 전체 / 시즌 */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => {
                  setLeaderboardMode('current');
                  setSelectedArchiveId("");
                }}
                className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                  leaderboardMode === 'current'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📅 Current
              </button>
              <button
                onClick={() => {
                  setLeaderboardMode('all');
                  setSelectedArchiveId("");
                }}
                className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                  leaderboardMode === 'all'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🏆 All-Time
              </button>
              <button
                onClick={() => setLeaderboardMode('past')}
                className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                  leaderboardMode === 'past'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📚 Past
              </button>
            </div>

            {leaderboardMode === 'past' && (
              <div className="mb-4">
                {archiveLoading ? (
                  <p className="text-gray-600">과거 시즌 목록 로딩 중...</p>
                ) : archivesList.length === 0 ? (
                  <p className="text-gray-600">No archived seasons found</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Select Season:</label>
                    <select
                      className="border rounded px-3 py-2"
                      value={selectedArchiveId}
                      onChange={(e) => setSelectedArchiveId(e.target.value)}
                    >
                      <option value="">-- 선택 --</option>
                      {archivesList.map((arc) => (
                        <option key={arc.id} value={arc.id}>
                          {arc.seasonName || arc.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {leaderboardLoading ? (
              <p className="text-gray-600">로딩 중...</p>
            ) : leaderboardEntries.length === 0 ? (
              <p className="text-gray-600">랭킹 데이터가 없습니다.</p>
            ) : (
              <div className="space-y-2 w-full overflow-x-hidden">
                {leaderboardEntries.map((entry, idx) => {
                  const rank = idx + 1;
                  const record = entry.record || { wins: 0, losses: 0, seasonWins: 0, seasonLosses: 0 };
                  const wins = leaderboardMode === 'season' ? (record.seasonWins || 0) : (record.wins || 0);
                  const losses = leaderboardMode === 'season' ? (record.seasonLosses || 0) : (record.losses || 0);
                  const total = wins + losses;
                  const winRate = total === 0 ? 0 : Math.round((wins / total) * 100);
                  const digimonName = entry.digimonSnapshot?.digimonName || 'Unknown';

                  const rankClass =
                    rank === 1 ? 'bg-yellow-100 border-yellow-300'
                    : rank === 2 ? 'bg-gray-100 border-gray-300'
                    : rank === 3 ? 'bg-amber-100 border-amber-300'
                    : 'bg-white border-gray-200';

                  return (
                    <div
                      key={entry.id}
                      className={`p-2 sm:p-3 border-2 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${rankClass}`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="text-base sm:text-lg font-bold w-6 sm:w-8 text-center flex-shrink-0">
                          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm sm:text-base break-words">
                            {entry.tamerName || entry.trainerName || 'Unknown'} - {digimonName}
                          </p>
                          <p className="text-xs text-gray-600">
                            Wins: {wins} / Win Rate: {winRate}%
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-xs text-gray-500 mt-4">
              * 복합 인덱스(seasonId + seasonWins) 필요 시 Firestore 콘솔의 제안 링크로 생성하세요.
            </p>
          </div>
        )}

        {/* 슬롯 선택 모달 */}
        {showSlotSelection && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-60" modal-overlay-mobile>
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">등록할 슬롯 선택</h3>
              {availableSlots.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-2">등록 가능한 슬롯이 없습니다.</p>
                  {currentSlotId && myEntries.some(entry => entry.digimonSnapshot?.slotId === currentSlotId) && (
                    <p className="text-sm text-blue-600 mt-2">
                      💡 현재 슬롯(슬롯{currentSlotId})은 이미 등록되어 있습니다.<br/>
                      다시 등록하려면 "My Arena Entries"에서 기존 등록을 해제해주세요.
                    </p>
                  )}
                </div>
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

        {/* 배틀 로그 다시보기 모달 */}
        {showBattleLogReview && selectedBattleLog && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-60" modal-overlay-mobile>
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">배틀 로그 리뷰</h3>
              {selectedBattleLog.logs && selectedBattleLog.logs.length > 0 ? (
                <div className="bg-gray-100 p-4 rounded max-h-96 overflow-y-auto mb-4">
                  {selectedBattleLog.logs.map((logEntry, idx) => {
                    const logClass = logEntry.attacker === "user" 
                      ? (logEntry.hit ? "text-green-700 font-bold" : "text-gray-600")
                      : (logEntry.hit ? "text-red-700 font-bold" : "text-gray-600");
                    
                    return (
                      <div key={idx} className={`text-sm mb-2 p-2 rounded ${logClass}`}>
                        <div className="font-medium">{idx + 1}. {logEntry.message}</div>
                        {logEntry.formula && (
                          <div className="ml-4 text-gray-700 font-mono text-xs mt-1">
                            {logEntry.formula}
                          </div>
                        )}
                        {logEntry.comparison && (
                          <div className="ml-4 text-gray-600 font-mono text-xs mt-1 font-bold">
                            {logEntry.comparison}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-600 mb-4">배틀 로그가 저장되지 않았습니다.</p>
              )}
              <button
                onClick={() => {
                  setShowBattleLogReview(false);
                  setSelectedBattleLog(null);
                }}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 상세 정보 모달 */}
        {showDetailModal && selectedEntry && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-60" modal-overlay-mobile>
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
        
        {/* 하단 고정 버튼 영역 */}
        <div className="flex-shrink-0 bg-white border-t-2 border-gray-200 px-4 sm:px-6 py-3">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-bold"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

