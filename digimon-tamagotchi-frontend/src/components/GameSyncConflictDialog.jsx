import React, { useState } from "react";

function GameSyncConflictDialog({ conflict, onResolve }) {
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState("");
  if (!conflict) return null;

  const resolve = async (choice) => {
    const message = choice === "local"
      ? "이 기기의 상태로 서버 최신 상태를 덮어씁니다. 계속할까요?"
      : "서버 최신 상태를 사용하고 이 기기의 미전송 상태를 버릴까요?";
    if (!window.confirm(message)) return;

    setIsResolving(true);
    setResolutionError("");
    try {
      await onResolve?.(choice);
    } catch (error) {
      console.error("동기화 충돌 해결 오류:", error);
      setResolutionError("동기화에 실패했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-conflict-title"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-red-300 bg-white p-5 shadow-2xl">
        <h2 id="sync-conflict-title" className="text-lg font-bold text-red-700">
          다른 기기의 변경사항 확인 필요
        </h2>
        <p className="mt-3 text-sm text-slate-700">
          서버와 이 기기에서 같은 슬롯이 변경되었습니다. 자동으로 덮어쓰지 않고 안전하게 보류했습니다.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          서버 revision {conflict.actualRevision ?? 0} · 이 기기 기준 {conflict.expectedRevision ?? 0}
        </p>
        {resolutionError ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
            {resolutionError}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isResolving}
            onClick={() => resolve("server")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            서버 상태 사용
          </button>
          <button
            type="button"
            disabled={isResolving}
            onClick={() => resolve("local")}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            이 기기 상태 사용
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameSyncConflictDialog;
