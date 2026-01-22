import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { 
  getTamerName, 
  updateTamerName, 
  resetToDefaultTamerName, 
  checkNicknameAvailability 
} from "../utils/tamerNameUtils";

const AccountSettingsModal = ({ onClose, onLogout, tamerName: currentTamerName, setTamerName: setTamerNameParent }) => {
  const { currentUser } = useAuth();
  
  // 테이머명 관련 상태
  const [tamerName, setTamerName] = useState("");
  const [tamerNameInput, setTamerNameInput] = useState("");
  const [tamerNameLoading, setTamerNameLoading] = useState(false);
  const [tamerNameMessage, setTamerNameMessage] = useState("");
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  
  // 모달 모드: 'menu' (메뉴), 'settings' (계정 설정), 'logout' (로그아웃 확인)
  const [modalMode, setModalMode] = useState('menu');

  // 테이머명 로드
  useEffect(() => {
    const loadTamerName = async () => {
      if (currentUser) {
        try {
          const name = await getTamerName(currentUser.uid, currentUser.displayName);
          setTamerName(name);
          setTamerNameInput(name);
        } catch (error) {
          console.error("테이머명 로드 오류:", error);
        }
      }
    };
    loadTamerName();
  }, [currentUser]);

  // 테이머명 중복 확인
  const handleCheckAvailability = async () => {
    if (!tamerNameInput.trim()) {
      setTamerNameMessage("테이머명을 입력해주세요.");
      return;
    }

    setIsCheckingAvailability(true);
    setTamerNameMessage("");

    try {
      const result = await checkNicknameAvailability(tamerNameInput.trim(), tamerName);
      setTamerNameMessage(result.message);
    } catch (error) {
      setTamerNameMessage(`오류: ${error.message}`);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  // 테이머명 저장
  const handleSaveTamerName = async () => {
    if (!currentUser) return;

    setTamerNameLoading(true);
    setTamerNameMessage("");

    try {
      const oldName = tamerName;
      await updateTamerName(currentUser.uid, tamerNameInput.trim(), oldName);
      const newName = tamerNameInput.trim();
      setTamerName(newName);
      if (setTamerNameParent) {
        setTamerNameParent(newName);
      }
      setTamerNameMessage("테이머명이 저장되었습니다.");
      
      // 페이지 새로고침하여 모든 화면에 반영
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      setTamerNameMessage(`오류: ${error.message}`);
    } finally {
      setTamerNameLoading(false);
    }
  };

  // 기본값으로 복구
  const handleResetToDefault = async () => {
    if (!currentUser) return;

    setTamerNameLoading(true);
    setTamerNameMessage("");

    try {
      await resetToDefaultTamerName(
        currentUser.uid, 
        currentUser.displayName, 
        tamerName !== currentUser.displayName ? tamerName : null
      );
      const defaultName = currentUser.displayName || `Trainer_${currentUser.uid.slice(0, 6)}`;
      setTamerName(defaultName);
      setTamerNameInput(defaultName);
      if (setTamerNameParent) {
        setTamerNameParent(defaultName);
      }
      setTamerNameMessage("기본값으로 복구되었습니다.");
      
      // 페이지 새로고침하여 모든 화면에 반영
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      setTamerNameMessage(`오류: ${error.message}`);
    } finally {
      setTamerNameLoading(false);
    }
  };

  // 로그아웃 확인 처리
  const handleLogoutConfirm = () => {
    setModalMode('logout');
  };

  // 로그아웃 실행
  const handleLogout = () => {
    onLogout();
    onClose();
  };

  // 메뉴로 돌아가기
  const handleBackToMenu = () => {
    setModalMode('menu');
    setTamerNameMessage("");
  };

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-96 max-w-[90vw] flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="p-6 pb-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {modalMode === 'menu' && '계정 설정'}
              {modalMode === 'settings' && '계정 설정'}
              {modalMode === 'logout' && '로그아웃 확인'}
            </h2>
            {modalMode !== 'menu' && (
              <button
                onClick={handleBackToMenu}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ← 뒤로
              </button>
            )}
          </div>
        </div>

        {/* 컨텐츠 영역 */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {modalMode === 'menu' && (
            <div className="space-y-3">
              <button
                onClick={() => setModalMode('settings')}
                className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded font-semibold text-left pixel-art-button"
              >
                계정 설정
              </button>
              <button
                onClick={handleLogoutConfirm}
                className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded font-semibold text-left pixel-art-button"
              >
                로그아웃
              </button>
            </div>
          )}

          {modalMode === 'settings' && currentUser && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold mb-2">테이머명</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tamerNameInput}
                      onChange={(e) => {
                        setTamerNameInput(e.target.value);
                        setTamerNameMessage("");
                      }}
                      placeholder="테이머명을 입력하세요"
                      className="flex-1 p-2 border border-gray-300 rounded"
                      maxLength={20}
                    />
                    <button
                      onClick={handleCheckAvailability}
                      disabled={isCheckingAvailability || !tamerNameInput.trim()}
                      className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm pixel-art-button"
                    >
                      {isCheckingAvailability ? "확인 중..." : "중복 확인"}
                    </button>
                  </div>
                  {tamerNameMessage && (
                    <p className={`text-sm ${
                      tamerNameMessage.includes("오류") || 
                      tamerNameMessage.includes("이미 사용") || 
                      tamerNameMessage.includes("부족") 
                        ? "text-red-500" 
                        : tamerNameMessage.includes("저장") || 
                          tamerNameMessage.includes("복구") 
                        ? "text-green-500" 
                        : "text-gray-600"
                    }`}>
                      {tamerNameMessage}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveTamerName}
                      disabled={tamerNameLoading || tamerNameInput.trim() === tamerName || !tamerNameInput.trim()}
                      className="flex-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm pixel-art-button"
                    >
                      {tamerNameLoading ? "저장 중..." : "저장"}
                    </button>
                    <button
                      onClick={handleResetToDefault}
                      disabled={tamerNameLoading || tamerName === (currentUser.displayName || `Trainer_${currentUser.uid.slice(0, 6)}`)}
                      className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm pixel-art-button"
                    >
                      기본값 복구
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    현재 테이머명: <span className="font-semibold">{tamerName}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {modalMode === 'logout' && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-300 rounded">
                <p className="text-center font-semibold text-gray-800 mb-2">
                  정말 로그아웃 하시겠습니까?
                </p>
                <p className="text-sm text-gray-600 text-center">
                  로그아웃하면 다시 로그인해야 합니다.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBackToMenu}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded font-semibold pixel-art-button"
                >
                  취소
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded font-semibold pixel-art-button"
                >
                  로그아웃
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-6 pt-4 border-t border-gray-200 flex justify-end">
          <button 
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded pixel-art-button" 
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsModal;
