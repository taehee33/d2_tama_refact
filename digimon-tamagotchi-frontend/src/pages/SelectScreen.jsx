// src/pages/SelectScreen.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { doc, setDoc, updateDoc, collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import { deleteSlotWithSubcollections } from "../utils/firestoreHelpers";
import { getAchievementsAndMaxSlots, getMaxSlots, ACHIEVEMENT_VER1_MASTER, ACHIEVEMENT_VER2_MASTER } from "../utils/userProfileUtils";
import { digimonDataVer1 } from "../data/v1/digimons";
import { digimonDataVer2 } from "../data/v2modkor";
import { getTamerName } from "../utils/tamerNameUtils";
import { formatSlotCreatedAt } from "../utils/dateUtils";
import { translateStage } from "../utils/stageTranslator";
import AdBanner from "../components/AdBanner";
import KakaoAd from "../components/KakaoAd";
import AccountSettingsModal from "../components/AccountSettingsModal";
import OnlineUsersCount from "../components/OnlineUsersCount";

function SelectScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout, isFirebaseAvailable } = useAuth();
  
  // v1·v2 병합 없이 슬롯 버전에 따라 해당 버전 데이터만 사용
  const getDigimonDataForSlot = (digimonId, slotVersion) =>
    slotVersion === "Ver.2" ? digimonDataVer2[digimonId] : digimonDataVer1[digimonId];
  
  const [slots, setSlots] = useState([]);
  /** Firestore 모드에서 사용자별 최대 슬롯 수 (기본 10, 도감 마스터당 +5 반영) */
  const [maxSlots, setMaxSlots] = useState(10);
  /** Firestore 모드에서 도감 마스터 칭호 (ver1_master, ver2_master) — +5 슬롯 안내용 */
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 새 다마고치 만들 때 선택할 기종/버전
  const [device, setDevice] = useState("Digital Monster Color 25th");
  const [version, setVersion] = useState("Ver.1");
  
  // 디지몬 별명 변경
  // 각 슬롯별로 input value 관리 -> local state
  const [digimonNicknameEdits, setDigimonNicknameEdits] = useState({});
  // 별명 변경 패널이 열린 슬롯 ID (null이면 모두 닫힘)
  const [openNicknameSlotId, setOpenNicknameSlotId] = useState(null);

  // 순서변경 모달 상태
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderedSlots, setOrderedSlots] = useState([]);
  const [initialOrderedSlots, setInitialOrderedSlots] = useState([]); // 초기 순서 저장 (변경사항 확인용)
  const [highlightedSlotId, setHighlightedSlotId] = useState(null); // 이동된 슬롯 하이라이트용 
  
  // 테이머명 상태
  const [tamerName, setTamerName] = useState("");
  
  // 계정 설정 모달 상태
  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState(false);
  
  // 프로필 드롭다운 메뉴 상태
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // 새 다마고치 시작 모달 상태
  const [showNewTamaModal, setShowNewTamaModal] = useState(false);
  
  // localStorage 모드 제거: Firebase 로그인 필수
  useEffect(() => {
    if (!isFirebaseAvailable || !currentUser) {
      navigate("/");
    }
  }, [isFirebaseAvailable, currentUser, navigate]);

  // 테이머명 로드
  useEffect(() => {
    const loadTamerName = async () => {
      if (currentUser) {
        try {
          const name = await getTamerName(currentUser.uid, currentUser.displayName);
          setTamerName(name);
        } catch (error) {
          console.error("테이머명 로드 오류:", error);
          setTamerName(currentUser.displayName || currentUser.email?.split('@')[0] || "익명의 테이머");
        }
      }
    };
    loadTamerName();
  }, [currentUser]);

  // 슬롯 목록 재로드 (Firestore의 /users/{uid}/slots 컬렉션에서 직접 가져오기)
  const loadSlots = async () => {
    // Firebase 로그인 필수
    if (!isFirebaseAvailable || !currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Firebase 로그인 필수
      if (isFirebaseAvailable && currentUser) {
        // db가 null인지 확인
        if (!db) {
          throw new Error("Firestore가 초기화되지 않았습니다.");
        }
        
        // Firestore: 사용자별 maxSlots·칭호(도감 마스터 반영) 조회
        const { maxSlots: userMaxSlots, achievements: userAchievements } = await getAchievementsAndMaxSlots(currentUser.uid);
        setMaxSlots(userMaxSlots);
        setAchievements(userAchievements || []);
        const slotsRef = collection(db, 'users', currentUser.uid, 'slots');
        const q = query(slotsRef, orderBy('createdAt', 'desc'), limit(userMaxSlots));
        const querySnapshot = await getDocs(q);
        
        const userSlots = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          // 문서 ID에서 slotId 추출 (예: "slot1" -> 1)
          const slotId = parseInt(doc.id.replace('slot', ''));
          return {
            id: slotId,
            displayOrder: data.displayOrder,
            ...data,
            // 냉장고 상태 정보 추가
            isFrozen: data.digimonStats?.isFrozen || false,
          };
        });
        
        // displayOrder가 없는 슬롯들을 생성일 기준으로 정렬 (최신이 위로)
        const slotsWithoutOrder = userSlots.filter(s => s.displayOrder === undefined);
        const slotsWithOrder = userSlots.filter(s => s.displayOrder !== undefined);
        
        // displayOrder가 없는 슬롯들을 생성일 기준 내림차순 정렬 (최신이 위로)
        slotsWithoutOrder.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime; // 최신이 위로
        });
        
        // displayOrder가 없는 슬롯들에 순서 부여 (최신이 1부터 시작)
        // 기존 displayOrder가 있는 슬롯들의 최대값을 찾아서 그 다음부터 시작
        const maxExistingOrder = slotsWithOrder.length > 0 
          ? Math.max(...slotsWithOrder.map(s => s.displayOrder))
          : 0;
        
        slotsWithoutOrder.forEach((slot, index) => {
          slot.displayOrder = maxExistingOrder + index + 1;
        });
        
        // 모든 슬롯을 displayOrder 기준으로 정렬 (1이 가장 위)
        const allSlots = [...slotsWithOrder, ...slotsWithoutOrder];
        allSlots.sort((a, b) => a.displayOrder - b.displayOrder);
        
        setSlots(allSlots);
      }
    } catch (err) {
      console.error("슬롯 로드 오류:", err);
      console.error("에러 코드:", err.code);
      console.error("에러 메시지:", err.message);
      
      // Firestore 권한 오류인 경우 특별 처리
      if (err.code === 'permission-denied') {
        setError("Firestore 권한 오류가 발생했습니다. Firebase Console에서 보안 규칙을 설정해주세요. (자세한 내용은 FIRESTORE_RULES.md 참고)");
      } else {
        setError(`슬롯을 불러오는 중 오류가 발생했습니다: ${err.message || err.code || '알 수 없는 오류'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 마운트 시
  useEffect(() => {
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFirebaseAvailable, currentUser]);

  // 로컬 저장소 모드로 새 다마고치 시작 (현재 사용되지 않음)
  // const handleNewTamaLocal = async () => {
  //   try {
  //     let slotId;
  //     
  //     // localStorage 모드: 빈 슬롯 찾기
  //     for (let i = 1; i <= MAX_SLOTS; i++) {
  //       const existing = localStorage.getItem(`slot${i}_selectedDigimon`);
  //       if (!existing) {
  //         slotId = i;
  //         break;
  //       }
  //     }
  //     
  //     if (!slotId) {
  //       alert("슬롯이 모두 찼습니다!");
  //       return;
  //     }

  //     console.log("새 슬롯 ID (localStorage):", slotId);

  //     // 기존 슬롯들의 displayOrder를 모두 +1 (새 슬롯이 맨 위로 오도록)
  //     for (let i = 1; i <= MAX_SLOTS; i++) {
  //       const existingOrder = localStorage.getItem(`slot${i}_displayOrder`);
  //       if (existingOrder) {
  //         const newOrder = parseInt(existingOrder) + 1;
  //         localStorage.setItem(`slot${i}_displayOrder`, newOrder.toString());
  //       }
  //     }

  //     // localStorage에 저장
  //     localStorage.setItem(`slot${slotId}_selectedDigimon`, "Digitama");
  //     localStorage.setItem(`slot${slotId}_digimonStats`, JSON.stringify({}));
  //     localStorage.setItem(`slot${slotId}_device`, device);
  //     localStorage.setItem(`slot${slotId}_version`, version);
  //     const slotName = `슬롯${slotId}`;
  //     localStorage.setItem(`slot${slotId}_slotName`, slotName);
  //     const now = new Date();
  //     const createdAtStr = now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  //     localStorage.setItem(`slot${slotId}_createdAt`, createdAtStr);
  //     localStorage.setItem(`slot${slotId}_displayOrder`, "1"); // 새 슬롯은 항상 맨 위에
  //     console.log("localStorage 저장 완료");

  //     console.log("게임 화면으로 이동 (로컬 모드):", slotId);
  //     navigate(`/game/${slotId}`);
  //   } catch (err) {
  //     console.error("새 다마고치 생성 오류:", err);
  //     alert(`다마고치 생성에 실패했습니다.\n에러: ${err.message || '알 수 없는 오류'}`);
  //   }
  // };

  // 새 다마고치 시작 (모달에서 호출)
  const handleNewTama = async () => {
    // 모달 닫기
    setShowNewTamaModal(false);
    console.log("새 다마고치 시작 버튼 클릭");
    console.log("isFirebaseAvailable:", isFirebaseAvailable);
    console.log("currentUser:", currentUser);
    
    // Firebase가 설정되어 있지만 로그인하지 않았으면 localStorage 모드 사용
    // 로그인하지 않은 경우에도 게임을 시작할 수 있도록 함

    try {
      let slotId;
      let saveSuccess = false;
      
      if (isFirebaseAvailable && currentUser) {
        console.log("Firestore 모드로 슬롯 생성 시도");
        
        // db가 null인지 확인
        if (!db) {
          throw new Error("Firestore가 초기화되지 않았습니다. Firebase 설정을 확인하세요.");
        }
        
        // Firestore 모드: 사용자별 maxSlots만큼만 조회 후 빈 슬롯 찾기
        const userMaxSlots = await getMaxSlots(currentUser.uid);
        const slotsRef = collection(db, 'users', currentUser.uid, 'slots');
        const q = query(slotsRef, orderBy('createdAt', 'desc'), limit(userMaxSlots));
        const querySnapshot = await getDocs(q);
        console.log("기존 슬롯 개수:", querySnapshot.docs.length, "최대:", userMaxSlots);
        
        const usedSlots = new Set(
          querySnapshot.docs.map(doc => parseInt(doc.id.replace('slot', '')))
        );
        console.log("사용 중인 슬롯:", Array.from(usedSlots));
        
        // 기존 슬롯 데이터 가져오기 (displayOrder 계산용)
        const existingSlots = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          const slotId = parseInt(doc.id.replace('slot', ''));
          return {
            id: slotId,
            displayOrder: data.displayOrder !== undefined ? data.displayOrder : slotId,
            ...data,
          };
        });
        
        // 빈 슬롯 찾기 (1 ~ userMaxSlots)
        for (let i = 1; i <= userMaxSlots; i++) {
          if (!usedSlots.has(i)) {
            slotId = i;
            break;
          }
        }
        
        if (!slotId) {
          alert("슬롯이 모두 찼습니다!");
          return;
        }

        console.log("새 슬롯 ID:", slotId);

        // 생성일 (숫자 ms 저장 → 정렬·비교 용이, 표시 시 포맷)
        const now = new Date();
        const createdAtMs = now.getTime();
        const slotName = `슬롯${slotId}`;

        // Firestore의 /users/{uid}/slots/{slotId}에 새 슬롯 저장
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        console.log("Firestore에 슬롯 저장 시도:", slotRef.path);
        
        // 새 슬롯은 항상 displayOrder = 1로 설정하고, 기존 슬롯들의 displayOrder를 모두 +1
        const updatePromises = existingSlots.map((slot) => {
          const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slot.id}`);
          const newOrder = (slot.displayOrder || 0) + 1;
          return updateDoc(slotRef, {
            displayOrder: newOrder,
            updatedAt: new Date(),
          });
        });
        
        // 기존 슬롯들의 displayOrder 업데이트
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
        }

        // Ver.2 선택 시 디지타마(DigitamaV2)로 시작, Ver.1은 Digitama (v1·v2 동일하게 알부터 시작)
        const startingDigimon = version === "Ver.2" ? "DigitamaV2" : "Digitama";
        
        // 새 슬롯 저장 (displayOrder = 1, 최신이 위로)
        await setDoc(slotRef, {
          selectedDigimon: startingDigimon,
          digimonStats: {},
          slotName,
          digimonNickname: null, // 디지몬 별명 (기본값: null, 디지몬 이름 사용)
          createdAt: createdAtMs, // 숫자(ms) 저장 — 정렬·비교 효율, 표시 시 toLocaleString
          device,
          version,
          displayOrder: 1, // 새 슬롯은 항상 맨 위에
          updatedAt: new Date(),
        });
        
        console.log("Firestore 슬롯 저장 완료");
        saveSuccess = true;
      } else {
        throw new Error("Firebase 로그인이 필요합니다.");
      }

      // 데이터 저장이 성공한 경우에만 게임 화면으로 이동
      if (saveSuccess && slotId) {
        console.log("게임 화면으로 이동:", slotId);
        navigate(`/game/${slotId}`);
      } else {
        throw new Error("슬롯 저장에 실패했습니다.");
      }
    } catch (err) {
      console.error("새 다마고치 생성 오류:", err);
      console.error("에러 상세:", err.message, err.code);
      
      // Firestore 권한 오류인 경우 특별 처리
      if (err.code === 'permission-denied') {
        alert(`Firestore 권한 오류가 발생했습니다.\n\nFirebase Console에서 보안 규칙을 설정해주세요:\n1. Firebase Console 접속\n2. Firestore Database → Rules\n3. FIRESTORE_RULES.md 파일 참고하여 규칙 설정\n4. 게시 버튼 클릭`);
      } else {
        alert(`다마고치 생성에 실패했습니다.\n에러: ${err.message || err.code || '알 수 없는 오류'}`);
      }
      // 에러 발생 시 페이지 이동하지 않음
      return;
    }
  };

  // 이어하기
  const handleContinue = (slotId) => {
    navigate(`/game/${slotId}`);
  };

  // 슬롯 삭제
  const handleDeleteSlot = async (slotId) => {
    // Firebase 로그인 필수
    if (!isFirebaseAvailable || !currentUser) {
      return;
    }

    if (window.confirm(`슬롯 ${slotId}을 정말 삭제하시겠습니까?`)) {
      try {
        // 서브컬렉션(logs, battleLogs) 포함 삭제 — 문서만 지우면 로그가 남아 재생성 시 옛 이력이 보임
        await deleteSlotWithSubcollections(db, currentUser.uid, slotId);
        loadSlots();
      } catch (err) {
        console.error("슬롯 삭제 오류:", err);
        alert("슬롯 삭제에 실패했습니다.");
      }
    }
  };

  // 디지몬 별명 입력 변화 시
  const handleDigimonNicknameChange = (slotId, newNickname) => {
    setDigimonNicknameEdits((prev) => ({
      ...prev,
      [slotId]: newNickname,
    }));
  };

  // 디지몬 별명 "수정" 버튼
  const handleSaveDigimonNickname = async (slotId) => {
    // Firebase 로그인 필수
    if (!isFirebaseAvailable || !currentUser) {
      return;
    }

    const newNickname = digimonNicknameEdits[slotId];
    // 빈 문자열도 허용 (기본값으로 복구)
    const trimmedNickname = newNickname !== undefined ? newNickname.trim() : "";

    try {
      const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
      await updateDoc(slotRef, {
        digimonNickname: trimmedNickname || null,
        updatedAt: new Date(),
      });
      // 해당 슬롯으로 만든 조그레스 방의 별명도 동기화 (변경 시 반영)
      const roomsRef = collection(db, "jogress_rooms");
      const q = query(roomsRef, where("hostUid", "==", currentUser.uid), where("hostSlotId", "==", slotId));
      const snap = await getDocs(q);
      const now = new Date();
      snap.docs.forEach((d) => {
        updateDoc(doc(db, "jogress_rooms", d.id), {
          hostDigimonNickname: trimmedNickname || null,
          updatedAt: now,
        }).catch((e) => console.warn("[별명 동기화] 조그레스 방 업데이트 실패:", e));
      });
      loadSlots();
    } catch (err) {
      console.error("디지몬 별명 저장 오류:", err);
      alert("디지몬 별명 저장에 실패했습니다.");
    }
  };

  // 디지몬 별명 기본값 복구
  const handleResetDigimonNickname = async (slotId, defaultDigimonName) => {
    // Firebase 로그인 필수
    if (!isFirebaseAvailable || !currentUser) {
      return;
    }

    try {
      const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
      await updateDoc(slotRef, {
        digimonNickname: null,
        updatedAt: new Date(),
      });
      const roomsRef = collection(db, "jogress_rooms");
      const q = query(roomsRef, where("hostUid", "==", currentUser.uid), where("hostSlotId", "==", slotId));
      const snap = await getDocs(q);
      const now = new Date();
      snap.docs.forEach((d) => {
        updateDoc(doc(db, "jogress_rooms", d.id), {
          hostDigimonNickname: null,
          updatedAt: now,
        }).catch((e) => console.warn("[별명 동기화] 조그레스 방 업데이트 실패:", e));
      });
      setDigimonNicknameEdits((prev) => ({
        ...prev,
        [slotId]: defaultDigimonName,
      }));
      loadSlots();
    } catch (err) {
      console.error("디지몬 별명 복구 오류:", err);
      alert("디지몬 별명 복구에 실패했습니다.");
    }
  };

  // 로그아웃 (Firebase 모드)
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error("로그아웃 오류:", err);
    }
  };

  // 로컬 모드 로그아웃 (로컬 모드 종료)

  // 순서가 변경되었는지 확인
  const hasOrderChanged = () => {
    if (orderedSlots.length !== initialOrderedSlots.length) return false;
    return orderedSlots.some((slot, index) => {
      const initialSlot = initialOrderedSlots[index];
      return !initialSlot || slot.id !== initialSlot.id;
    });
  };

  // 순서변경 모달 열기
  const handleOpenOrderModal = () => {
    // 현재 슬롯 목록을 복사하여 모달 상태에 설정
    const initialSlots = [...slots];
    setOrderedSlots(initialSlots);
    setInitialOrderedSlots(initialSlots.map(s => ({ ...s }))); // 깊은 복사
    setIsOrderModalOpen(true);
    setHighlightedSlotId(null);
  };

  // 순서변경 모달 닫기 (변경사항 확인)
  const handleCloseOrderModal = () => {
    if (hasOrderChanged()) {
      if (window.confirm("순서가 변경되었습니다. 변경사항을 저장하시겠습니까?")) {
        // 저장 후 닫기
        handleSaveOrder();
      } else {
        // 저장하지 않고 닫기
        setIsOrderModalOpen(false);
        setOrderedSlots([]);
        setInitialOrderedSlots([]);
        setHighlightedSlotId(null);
      }
    } else {
      // 변경사항이 없으면 바로 닫기
      setIsOrderModalOpen(false);
      setOrderedSlots([]);
      setInitialOrderedSlots([]);
      setHighlightedSlotId(null);
    }
  };

  // 슬롯 순서 위로 이동
  const handleMoveUp = (index) => {
    if (index === 0) return; // 첫 번째 항목은 위로 이동 불가
    const newOrderedSlots = [...orderedSlots];
    const movedSlot = newOrderedSlots[index];
    [newOrderedSlots[index - 1], newOrderedSlots[index]] = [newOrderedSlots[index], newOrderedSlots[index - 1]];
    setOrderedSlots(newOrderedSlots);
    
    // 이동된 슬롯 하이라이트
    setHighlightedSlotId(movedSlot.id);
    setTimeout(() => {
      setHighlightedSlotId(null);
    }, 1000); // 1초 후 하이라이트 제거
  };

  // 슬롯 순서 아래로 이동
  const handleMoveDown = (index) => {
    if (index === orderedSlots.length - 1) return; // 마지막 항목은 아래로 이동 불가
    const newOrderedSlots = [...orderedSlots];
    const movedSlot = newOrderedSlots[index];
    [newOrderedSlots[index], newOrderedSlots[index + 1]] = [newOrderedSlots[index + 1], newOrderedSlots[index]];
    setOrderedSlots(newOrderedSlots);
    
    // 이동된 슬롯 하이라이트
    setHighlightedSlotId(movedSlot.id);
    setTimeout(() => {
      setHighlightedSlotId(null);
    }, 1000); // 1초 후 하이라이트 제거
  };

  // 순서 변경 저장
  const handleSaveOrder = async () => {
    try {
      // displayOrder 업데이트
      const updatedSlots = orderedSlots.map((slot, index) => ({
        ...slot,
        displayOrder: index + 1,
      }));

      if (isFirebaseAvailable && currentUser) {
        // Firestore: 각 슬롯의 displayOrder 업데이트
        const updatePromises = updatedSlots.map((slot) => {
          const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slot.id}`);
          return updateDoc(slotRef, {
            displayOrder: slot.displayOrder,
            updatedAt: new Date(),
          });
        });
        await Promise.all(updatePromises);
      }

      // 슬롯 목록 다시 로드
      await loadSlots();
      setIsOrderModalOpen(false);
      setOrderedSlots([]);
      setInitialOrderedSlots([]);
      setHighlightedSlotId(null);
      alert("순서가 변경되었습니다.");
    } catch (err) {
      console.error("순서 변경 저장 오류:", err);
      alert("순서 변경 저장에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // Firebase 로그인 필수: 조건부 렌더링
  if (!isFirebaseAvailable || !currentUser) {
    return null;
  }

  return (
    <div className="p-4">
        {/* 상단: 오른쪽 UI만 (접속 수, 프로필) - 제목/버튼과 겹치지 않도록 별도 행 */}
        <div className="flex justify-end items-center mb-2">
          {isFirebaseAvailable && currentUser ? (
            <div className="flex items-center space-x-4">
              {/* 접속 중인 테이머 수 */}
              <OnlineUsersCount />
              
              {/* 프로필 UI - 드롭다운 메뉴 */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded pixel-art-button"
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="프로필"
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-semibold text-gray-700">
                      {currentUser.displayName?.[0] || currentUser.email?.[0] || 'U'}
                    </span>
                  )}
                  <span className="text-sm text-gray-700 whitespace-nowrap truncate max-w-[120px] sm:max-w-none flex items-center gap-1 flex-wrap">
                    <span>테이머: {tamerName || currentUser.displayName || currentUser.email?.split('@')[0]}</span>
                    {achievements.includes(ACHIEVEMENT_VER1_MASTER) && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium shrink-0">👑 Ver.1</span>
                    )}
                    {achievements.includes(ACHIEVEMENT_VER2_MASTER) && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-medium shrink-0">👑 Ver.2</span>
                    )}
                  </span>
                  <span className="text-xs text-gray-500">▼</span>
                </button>
                
                {/* 드롭다운 메뉴 */}
                {showProfileMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <div className="absolute right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-[200px] w-max max-w-[min(90vw,280px)]">
                      <div className="px-3 py-2 border-b border-gray-200">
                        <p className="text-sm font-semibold text-gray-700 whitespace-nowrap truncate flex flex-wrap items-center gap-1">
                          <span>테이머: {tamerName || currentUser.displayName || currentUser.email}</span>
                          {achievements.includes(ACHIEVEMENT_VER1_MASTER) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">👑 Ver.1</span>
                          )}
                          {achievements.includes(ACHIEVEMENT_VER2_MASTER) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-medium">👑 Ver.2</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {currentUser.email}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowAccountSettingsModal(true);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 pixel-art-button"
                      >
                        계정 설정/로그아웃
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* 제목과 새 다마고치 버튼 - 오른쪽 UI 아래에 배치 */}
        <div className="mb-4">
          <h1 className="text-xl font-bold mb-3">Select Tamagotchi</h1>
          <button
            onClick={() => setShowNewTamaModal(true)}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
          >
            새 다마고치 시작
          </button>
        </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mb-2">
        <h2 className="font-semibold">슬롯 목록 (현재 {slots.length}개 / 최대 {maxSlots}개)</h2>
        {slots.length > 0 && (
          <button
            onClick={handleOpenOrderModal}
            className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm"
          >
            순서변경
          </button>
        )}
      </div>
      {achievements.length > 0 && (
        <p className="text-sm text-gray-600 mb-2">
          도감 완성 보너스: {achievements.includes(ACHIEVEMENT_VER1_MASTER) && "👑Ver.1 마스터 +5 슬롯"}
          {achievements.includes(ACHIEVEMENT_VER1_MASTER) && achievements.includes(ACHIEVEMENT_VER2_MASTER) && ", "}
          {achievements.includes(ACHIEVEMENT_VER2_MASTER) && "Ver.2 마스터 +5 슬롯"}
          {(achievements.includes(ACHIEVEMENT_VER1_MASTER) || achievements.includes(ACHIEVEMENT_VER2_MASTER)) && " 적용됨"}
        </p>
      )}
      {slots.length === 0 && <p>등록된 다마고치가 없습니다.</p>}

      {slots.map((slot) => {
        const slotDigimonData = getDigimonDataForSlot(slot.selectedDigimon, slot.version);
        const spriteBasePath = slotDigimonData?.spriteBasePath || '/images';
        const spriteNum = slotDigimonData?.sprite ?? 0;
        return (
        <div key={slot.id} className="border p-4 mb-4 flex gap-4 items-start">
          {/* 디지몬 썸네일 */}
          <div className="flex-shrink-0 flex flex-col items-center justify-center">
            <img
              src={`${spriteBasePath}/${spriteNum}.png`}
              alt={slotDigimonData?.name || slot.selectedDigimon || '디지몬'}
              className="w-24 h-24 object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
            <p className="font-bold text-base mt-2 text-center">
              {slot.digimonNickname?.trim() ? `${slot.digimonNickname}(${slotDigimonData?.name || slot.selectedDigimon})` : (slotDigimonData?.name || slot.selectedDigimon)}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              세대: {translateStage(slotDigimonData?.stage)}
            </p>
          </div>

          <div className="flex-1 min-w-0">
          <div className="mt-2">
            <p className="text-sm text-gray-600 mb-1">슬롯: {slot.slotName || `슬롯${slot.id}`}</p>
            <p className="font-bold flex flex-wrap items-center gap-2">
              <span>
                {(() => {
                  const digimonName = slotDigimonData?.name || slot.selectedDigimon;
                  const nickname = slot.digimonNickname;
                  if (nickname && nickname.trim()) {
                    return `${nickname}(${digimonName})`;
                  }
                  return digimonName;
                })()}
              </span>
              <button
                type="button"
                onClick={() => setOpenNicknameSlotId(openNicknameSlotId === slot.id ? null : slot.id)}
                className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
              >
                별명 변경
              </button>
              {slot.isFrozen && (
                <span className="text-cyan-600 font-semibold text-sm" title="냉장고에 보관 중">
                  🧊 냉장고
                </span>
              )}
            </p>
            {/* 별명 변경 패널 (버튼 클릭 시에만 표시) */}
            {openNicknameSlotId === slot.id && (
              <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                <label className="text-sm text-gray-600 block mb-1">디지몬 별명</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={digimonNicknameEdits[slot.id] !== undefined 
                      ? digimonNicknameEdits[slot.id] 
                      : (slot.digimonNickname || slotDigimonData?.name || slot.selectedDigimon || "")}
                    onChange={(e) => handleDigimonNicknameChange(slot.id, e.target.value)}
                    placeholder={slotDigimonData?.name || slot.selectedDigimon || "디지몬 이름"}
                    className="border p-1.5 flex-1 min-w-[120px] text-sm rounded"
                  />
                  <button
                    onClick={() => {
                      handleSaveDigimonNickname(slot.id);
                      setOpenNicknameSlotId(null);
                    }}
                    className="px-2 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => {
                      handleResetDigimonNickname(slot.id, slotDigimonData?.name || slot.selectedDigimon);
                      setOpenNicknameSlotId(null);
                    }}
                    className="px-2 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                  >
                    기본값
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenNicknameSlotId(null)}
                    className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-500 mt-1">생성일: {formatSlotCreatedAt(slot.createdAt)}</p>
            <p className="text-sm text-gray-500">
              기종: {slot.device} / 버전: {slot.version}
            </p>
            <div className="flex items-center space-x-2 mt-2">
              <button
                onClick={() => handleDeleteSlot(slot.id)}
                className="px-4 py-2 bg-red-500 text-white rounded"
              >
                삭제
              </button>
              <button
                onClick={() => handleContinue(slot.id)}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                이어하기
              </button>
            </div>
          </div>
          </div>
        </div>
        );
      })}

      {/* 순서변경 모달 */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">슬롯 순서 변경</h3>
              <button
                onClick={handleCloseOrderModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-2 mb-4">
              {orderedSlots.map((slot, index) => (
                <div
                  key={slot.id}
                  className={`border p-3 rounded flex items-center justify-between transition-all duration-300 ${
                    highlightedSlotId === slot.id
                      ? 'bg-blue-100 border-blue-400 shadow-lg transform scale-105'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded">
                        {index + 1}.
                      </span>
                      <p className="text-xs text-gray-500 mb-1">슬롯: {slot.slotName || `슬롯${slot.id}`}</p>
                      <p className="font-bold flex items-center gap-2">
                        <span>
                          {(() => {
                            const digimonName = getDigimonDataForSlot(slot.selectedDigimon, slot.version)?.name || slot.selectedDigimon;
                            const nickname = slot.digimonNickname;
                            if (nickname && nickname.trim()) {
                              return `${nickname}(${digimonName})`;
                            }
                            return digimonName;
                          })()}
                        </span>
                        {slot.isFrozen && (
                          <span className="text-cyan-600 font-semibold text-sm" title="냉장고에 보관 중">
                            🧊 냉장고
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      생성일: {formatSlotCreatedAt(slot.createdAt)}
                    </p>
                    <p className="text-sm text-gray-500">
                      기종: {slot.device} / 버전: {slot.version}
                    </p>
                  </div>
                  <div className="flex flex-col space-y-1 ml-4">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className={`px-3 py-1 rounded text-sm font-bold transition-all ${
                        index === 0
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600 text-white hover:scale-110 active:scale-95'
                      }`}
                      title="위로 이동"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === orderedSlots.length - 1}
                      className={`px-3 py-1 rounded text-sm font-bold transition-all ${
                        index === orderedSlots.length - 1
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600 text-white hover:scale-110 active:scale-95'
                      }`}
                      title="아래로 이동"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCloseOrderModal}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded"
              >
                취소
              </button>
              <button
                onClick={handleSaveOrder}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Google AdSense 광고 */}
      <AdBanner />
      
      {/* 카카오 애드핏 광고 */}
      <KakaoAd />
      
      {/* 실시간 채팅 및 접속자 목록 */}
      {/* ChatRoom은 App.jsx에서 전역으로 렌더링됨 */}
      
      {/* 계정 설정 모달 */}
      {showAccountSettingsModal && (
        <AccountSettingsModal
          onClose={() => setShowAccountSettingsModal(false)}
          onLogout={handleLogout}
          tamerName={tamerName}
          setTamerName={setTamerName}
          slotCount={slots.length}
        />
      )}
      
      {/* 새 다마고치 시작 모달 */}
      {showNewTamaModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowNewTamaModal(false)}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">새 다마고치 시작</h3>
              <button
                onClick={() => setShowNewTamaModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              {/* 기종 선택 */}
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">
                  기종(Device):
                </label>
                <select
                  value={device}
                  onChange={(e) => setDevice(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="Digital Monster Color 25th">
                    Digital Monster Color 25th
                  </option>
                  <option value="기타기종" disabled>기타기종</option>
                </select>
              </div>
              
              {/* 버전 선택 */}
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">
                  버전(Version):
                </label>
                <select
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="Ver.1">Ver.1</option>
                  <option value="Ver.2">Ver.2</option>
                  <option value="Ver.3" disabled>Ver.3 (준비 중)</option>
                  <option value="Ver.4" disabled>Ver.4 (준비 중)</option>
                  <option value="Ver.5" disabled>Ver.5 (준비 중)</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowNewTamaModal(false)}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded text-sm transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleNewTama}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded text-sm transition-colors"
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SelectScreen;