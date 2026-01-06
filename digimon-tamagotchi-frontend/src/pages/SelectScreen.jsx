// src/pages/SelectScreen.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import { digimonDataVer1 } from "../data/v1/digimons";

const MAX_SLOTS = 10; // 10개로 늘림

function SelectScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout, isFirebaseAvailable } = useAuth();
  
  // location.state에서 mode 가져오기
  const mode = location.state?.mode || (isFirebaseAvailable && currentUser ? 'firebase' : 'local');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 새 다마고치 만들 때 선택할 기종/버전
  const [device, setDevice] = useState("Digital Monster Color 25th");
  const [version, setVersion] = useState("Ver.1");

  // Firebase 모드에서 전역 인증 상태 구독하여 로그인 체크
  // AuthContext의 onAuthStateChanged 리스너가 currentUser를 업데이트하면 자동으로 반영됨
  useEffect(() => {
    // 로컬 모드로 온 경우는 체크하지 않음
    if (mode === 'local') {
      return;
    }
    
    // Firebase 모드로 명시적으로 온 경우에만 로그인 체크
    // (location.state에서 mode: 'firebase'로 전달된 경우)
    // 로그인하지 않았으면 localStorage 모드로 자동 전환 (리디렉션 없음)
    if (mode === 'firebase' && isFirebaseAvailable && !currentUser) {
      // Firebase 모드로 명시적으로 요청했지만 로그인하지 않았으면
      // 로그인 페이지로 리디렉션
      navigate("/");
    }
  }, [currentUser, navigate, isFirebaseAvailable, mode]);

  // 슬롯 목록 재로드 (Firestore의 /users/{uid}/slots 컬렉션에서 직접 가져오기)
  const loadSlots = async () => {
    // Firebase 모드인데 로그인하지 않았으면 슬롯 로드 건너뛰기
    // 하지만 로컬 모드일 때는 Firebase가 설정되어 있어도 localStorage에서 로드해야 함
    if (mode === 'firebase' && isFirebaseAvailable && !currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      if (isFirebaseAvailable && currentUser && mode !== 'local') {
        // db가 null인지 확인
        if (!db) {
          throw new Error("Firestore가 초기화되지 않았습니다.");
        }
        
        // Firestore 모드: /users/{uid}/slots 컬렉션에서 직접 가져오기
        const slotsRef = collection(db, 'users', currentUser.uid, 'slots');
        const q = query(slotsRef, orderBy('createdAt', 'desc'), limit(MAX_SLOTS));
        const querySnapshot = await getDocs(q);
        
        const userSlots = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          // 문서 ID에서 slotId 추출 (예: "slot1" -> 1)
          const slotId = parseInt(doc.id.replace('slot', ''));
          return {
            id: slotId,
            ...data,
          };
        });
        
        setSlots(userSlots);
      } else {
        // localStorage 모드
        const arr = [];
        for (let i = 1; i <= MAX_SLOTS; i++) {
          const digimonName = localStorage.getItem(`slot${i}_selectedDigimon`);
          if (digimonName) {
            const slotName = localStorage.getItem(`slot${i}_slotName`) || `슬롯${i}`;
            const createdAt = localStorage.getItem(`slot${i}_createdAt`) || "";
            const dev = localStorage.getItem(`slot${i}_device`) || "";
            const ver = localStorage.getItem(`slot${i}_version`) || "";
            arr.push({
              id: i,
              slotName,
              selectedDigimon: digimonName,
              createdAt,
              device: dev,
              version: ver,
            });
          }
        }
        setSlots(arr);
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
  }, [isFirebaseAvailable, currentUser, mode]);

  // 로컬 저장소 모드로 새 다마고치 시작
  const handleNewTamaLocal = async () => {
    try {
      let slotId;
      
      // localStorage 모드: 빈 슬롯 찾기
      for (let i = 1; i <= MAX_SLOTS; i++) {
        const existing = localStorage.getItem(`slot${i}_selectedDigimon`);
        if (!existing) {
          slotId = i;
          break;
        }
      }
      
      if (!slotId) {
        alert("슬롯이 모두 찼습니다!");
        return;
      }

      console.log("새 슬롯 ID (localStorage):", slotId);

      // localStorage에 저장
      localStorage.setItem(`slot${slotId}_selectedDigimon`, "Digitama");
      localStorage.setItem(`slot${slotId}_digimonStats`, JSON.stringify({}));
      localStorage.setItem(`slot${slotId}_device`, device);
      localStorage.setItem(`slot${slotId}_version`, version);
      const slotName = `슬롯${slotId}`;
      localStorage.setItem(`slot${slotId}_slotName`, slotName);
      const now = new Date();
      const createdAtStr = now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
      localStorage.setItem(`slot${slotId}_createdAt`, createdAtStr);
      console.log("localStorage 저장 완료");

      console.log("게임 화면으로 이동 (로컬 모드):", slotId);
      navigate(`/game/${slotId}`, { state: { mode: 'local' } });
    } catch (err) {
      console.error("새 다마고치 생성 오류:", err);
      alert(`다마고치 생성에 실패했습니다.\n에러: ${err.message || '알 수 없는 오류'}`);
    }
  };

  // 새 다마고치 시작
  const handleNewTama = async () => {
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
        
        // Firestore 모드: /users/{uid}/slots 컬렉션에서 빈 슬롯 찾기
        const slotsRef = collection(db, 'users', currentUser.uid, 'slots');
        const querySnapshot = await getDocs(slotsRef);
        console.log("기존 슬롯 개수:", querySnapshot.docs.length);
        
        const usedSlots = new Set(
          querySnapshot.docs.map(doc => parseInt(doc.id.replace('slot', '')))
        );
        console.log("사용 중인 슬롯:", Array.from(usedSlots));
        
        // 빈 슬롯 찾기
        for (let i = 1; i <= MAX_SLOTS; i++) {
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

        // 생성일
        const now = new Date();
        const createdAtStr = now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
        const slotName = `슬롯${slotId}`;

        // Firestore의 /users/{uid}/slots/{slotId}에 새 슬롯 저장
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        console.log("Firestore에 슬롯 저장 시도:", slotRef.path);
        
        await setDoc(slotRef, {
          selectedDigimon: "Digitama",
          digimonStats: {},
          slotName,
          createdAt: createdAtStr,
          device,
          version,
          updatedAt: new Date(),
        });
        
        console.log("Firestore 슬롯 저장 완료");
        saveSuccess = true;
      } else {
        console.log("localStorage 모드로 슬롯 생성 시도");
        // localStorage 모드
        for (let i = 1; i <= MAX_SLOTS; i++) {
          const existing = localStorage.getItem(`slot${i}_selectedDigimon`);
          if (!existing) {
            slotId = i;
            break;
          }
        }
        
        if (!slotId) {
          alert("슬롯이 모두 찼습니다!");
          return;
        }

        console.log("새 슬롯 ID (localStorage):", slotId);

        // localStorage에 저장
        try {
          localStorage.setItem(`slot${slotId}_selectedDigimon`, "Digitama");
          localStorage.setItem(`slot${slotId}_digimonStats`, JSON.stringify({}));
          localStorage.setItem(`slot${slotId}_device`, device);
          localStorage.setItem(`slot${slotId}_version`, version);
          const slotName = `슬롯${slotId}`;
          localStorage.setItem(`slot${slotId}_slotName`, slotName);
          const now = new Date();
          const createdAtStr = now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
          localStorage.setItem(`slot${slotId}_createdAt`, createdAtStr);
          console.log("localStorage 저장 완료");
          saveSuccess = true;
        } catch (storageErr) {
          throw new Error(`localStorage 저장 실패: ${storageErr.message}`);
        }
      }

      // 데이터 저장이 성공한 경우에만 게임 화면으로 이동
      if (saveSuccess && slotId) {
        console.log("게임 화면으로 이동:", slotId);
        // Firebase 모드인지 localStorage 모드인지 결정
        const gameMode = (isFirebaseAvailable && currentUser) ? 'firebase' : 'local';
        navigate(`/game/${slotId}`, { state: { mode: gameMode } });
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
    // 현재 모드에 따라 state 전달
    const mode = (isFirebaseAvailable && currentUser) ? 'firebase' : 'local';
    navigate(`/game/${slotId}`, { state: { mode } });
  };

  // 슬롯 삭제
  const handleDeleteSlot = async (slotId) => {
    // Firebase 모드로 명시적으로 요청한 경우에만 로그인 체크
    // 로컬 모드에서는 Firebase가 설정되어 있어도 삭제 가능
    if (mode === 'firebase' && isFirebaseAvailable && !currentUser) {
      return;
    }

    if (window.confirm(`슬롯 ${slotId}을 정말 삭제하시겠습니까?`)) {
      try {
        if (isFirebaseAvailable && currentUser && mode !== 'local') {
          // Firestore의 /users/{uid}/slots/{slotId}에서 삭제
          const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
          await deleteDoc(slotRef);
        } else {
          // localStorage 모드
          localStorage.removeItem(`slot${slotId}_selectedDigimon`);
          localStorage.removeItem(`slot${slotId}_digimonStats`);
          localStorage.removeItem(`slot${slotId}_device`);
          localStorage.removeItem(`slot${slotId}_version`);
          localStorage.removeItem(`slot${slotId}_slotName`);
          localStorage.removeItem(`slot${slotId}_createdAt`);
        }
        loadSlots();
      } catch (err) {
        console.error("슬롯 삭제 오류:", err);
        alert("슬롯 삭제에 실패했습니다.");
      }
    }
  };

  // 슬롯 이름 변경
  // 각 슬롯별로 input value 관리 -> local state
  const [slotNameEdits, setSlotNameEdits] = useState({}); 

  // 입력 변화 시
  const handleNameChange = (slotId, newName) => {
    setSlotNameEdits((prev) => ({
      ...prev,
      [slotId]: newName,
    }));
  };

  // "수정" 버튼
  const handleSaveName = async (slotId) => {
    // Firebase 모드로 명시적으로 요청한 경우에만 로그인 체크
    // 로컬 모드에서는 Firebase가 설정되어 있어도 이름 변경 가능
    if (mode === 'firebase' && isFirebaseAvailable && !currentUser) {
      return;
    }

    const newName = slotNameEdits[slotId] || "";
    if (!newName.trim()) {
      alert("이름이 비어있습니다.");
      return;
    }

    try {
      if (isFirebaseAvailable && currentUser && mode !== 'local') {
        // Firestore의 /users/{uid}/slots/{slotId}에서 슬롯 이름 업데이트
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        await updateDoc(slotRef, {
          slotName: newName,
          updatedAt: new Date(),
        });
      } else {
        // localStorage 모드
        localStorage.setItem(`slot${slotId}_slotName`, newName);
      }
      loadSlots();
      alert(`슬롯 ${slotId} 이름을 "${newName}" 로 변경했습니다.`);
    } catch (err) {
      console.error("슬롯 이름 변경 오류:", err);
      alert("슬롯 이름 변경에 실패했습니다.");
    }
  };

  // 로그아웃
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error("로그아웃 오류:", err);
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

  return (
    <div className="p-4">
        <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Select Tamagotchi</h1>
        <div className="flex items-center space-x-4">
          {isFirebaseAvailable && currentUser && (
            <>
              <div className="flex items-center space-x-2">
                {currentUser.photoURL && (
                  <img
                    src={currentUser.photoURL}
                    alt="프로필"
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-600">{currentUser.displayName || currentUser.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm"
              >
                로그아웃
              </button>
            </>
          )}
          {!isFirebaseAvailable && (
            <span className="text-sm text-gray-500">localStorage 모드</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* 기종/버전 */}
      <div className="mb-4">
        <label className="block mb-1">기종(Device):</label>
        <select
          value={device}
          onChange={(e) => setDevice(e.target.value)}
          className="border p-2"
        >
          <option value="Digital Monster Color 25th">
            Digital Monster Color 25th
          </option>
          <option value="기타기종">기타기종</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="block mb-1">버전(Version):</label>
        <select
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          className="border p-2"
        >
          <option value="Ver.1">Ver.1</option>
          <option value="Ver.2" disabled>Ver.2 (준비 중)</option>
          <option value="Ver.3" disabled>Ver.3 (준비 중)</option>
          <option value="Ver.4" disabled>Ver.4 (준비 중)</option>
          <option value="Ver.5" disabled>Ver.5 (준비 중)</option>
        </select>
      </div>

      <button
        onClick={handleNewTama}
        className="px-4 py-2 bg-green-500 text-white rounded mb-4"
      >
        새 다마고치 시작
      </button>

      <h2 className="font-semibold mb-2">슬롯 목록 (최대 {MAX_SLOTS}개)</h2>
      {slots.length === 0 && <p>등록된 다마고치가 없습니다.</p>}

      {slots.map((slot) => (
        <div key={slot.id} className="border p-2 mb-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleContinue(slot.id)}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              이어하기
            </button>
            <button
              onClick={() => handleDeleteSlot(slot.id)}
              className="px-4 py-2 bg-red-500 text-white rounded"
            >
              삭제
            </button>
          </div>

          <div className="mt-2">
            <p className="font-bold">
              슬롯 {slot.id} - {digimonDataVer1[slot.selectedDigimon]?.name || slot.selectedDigimon}
            </p>
            <p>생성일: {slot.createdAt}</p>
            <p>
              기종: {slot.device} / 버전: {slot.version}
            </p>
          </div>

          <div className="mt-2">
            <label>슬롯 이름: </label>
            <input
              type="text"
              defaultValue={slot.slotName}
              onChange={(e) => handleNameChange(slot.id, e.target.value)}
              className="border p-1 mr-2"
            />
            <button
              onClick={() => handleSaveName(slot.id)}
              className="px-2 py-1 bg-gray-300 rounded"
            >
              수정
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default SelectScreen;