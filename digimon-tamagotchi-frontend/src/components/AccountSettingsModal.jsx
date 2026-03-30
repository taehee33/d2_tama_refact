import React, { useState } from "react";
import AccountSettingsPanel from "./panels/AccountSettingsPanel";

function AccountSettingsModal({
  onClose,
  onLogout,
  tamerName,
  setTamerName,
  refreshProfile,
  slotCount,
}) {
  const [modalMode, setModalMode] = useState("menu");

  const titleMap = {
    menu: "계정 설정",
    settings: "계정 설정",
    logout: "로그아웃 확인",
  };

  const handleLogout = async () => {
    if (typeof onLogout === "function") {
      await onLogout();
    }

    if (typeof onClose === "function") {
      onClose();
    }
  };

  return (
    <div className="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50">
      <div className="flex max-h-[90vh] w-96 max-w-[92vw] flex-col rounded-lg bg-white shadow-lg">
        <div className="border-b border-gray-200 p-6 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{titleMap[modalMode]}</h2>
            {modalMode !== "menu" ? (
              <button
                type="button"
                onClick={() => setModalMode("menu")}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← 뒤로
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {modalMode === "menu" ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setModalMode("settings")}
                className="pixel-art-button w-full rounded bg-blue-500 px-4 py-3 text-left font-semibold text-white hover:bg-blue-600"
              >
                계정 설정
              </button>
              <button
                type="button"
                onClick={() => setModalMode("logout")}
                className="pixel-art-button w-full rounded bg-red-500 px-4 py-3 text-left font-semibold text-white hover:bg-red-600"
              >
                로그아웃
              </button>
            </div>
          ) : null}

          {modalMode === "settings" ? (
            <AccountSettingsPanel
              slotCount={slotCount}
              tamerName={tamerName}
              setTamerName={setTamerName}
              refreshProfile={refreshProfile}
            />
          ) : null}

          {modalMode === "logout" ? (
            <div className="space-y-4">
              <div className="rounded border border-yellow-300 bg-yellow-50 p-4">
                <p className="mb-2 text-center font-semibold text-gray-800">
                  정말 로그아웃 하시겠습니까?
                </p>
                <p className="text-center text-sm text-gray-600">
                  로그아웃하면 다시 로그인해야 합니다.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalMode("menu")}
                  className="pixel-art-button flex-1 rounded bg-gray-300 px-4 py-2 font-semibold text-gray-800 hover:bg-gray-400"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="pixel-art-button flex-1 rounded bg-red-500 px-4 py-2 font-semibold text-white hover:bg-red-600"
                >
                  로그아웃
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-gray-200 p-6 pt-4">
          <button
            type="button"
            className="pixel-art-button rounded bg-gray-300 px-4 py-2 text-gray-800 hover:bg-gray-400"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccountSettingsModal;
