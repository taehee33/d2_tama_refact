import React, { useState } from "react";

const CLASSIFICATION_DESCRIPTIONS = {
  UNSENT_LOCAL_SAVE: "이 기기에 서버로 전송되지 않은 게임 상태가 남아 있습니다.",
  TRUE_REMOTE_CONFLICT: "서버가 이 기기의 저장 기준 이후에 변경되었습니다.",
  INVALID_LOCAL_SNAPSHOT: "이 기기의 임시 저장 형식을 안전하게 확인할 수 없습니다.",
  TERMINAL_STATE_MISMATCH: "생존·사망·환생 상태가 서버와 일치하지 않습니다.",
  FORM_MISMATCH: "현재 디지몬 형태 또는 개체 정보가 서버와 일치하지 않습니다.",
};

function formatLocalSavedAt(value) {
  if (value == null || value === "") return "정보 없음";
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return "정보 없음";
  return new Date(timestamp).toLocaleString("ko-KR");
}

export function buildSyncConflictDiagnostic(conflict, persistencePhase) {
  return {
    slotId: conflict?.identity?.slotId ?? null,
    loadGeneration: conflict?.identity?.generation ?? null,
    persistencePhase: persistencePhase ?? null,
    classification: conflict?.classification ?? "TRUE_REMOTE_CONFLICT",
    localBaseRevision: conflict?.expectedRevision ?? null,
    serverRevision: conflict?.actualRevision ?? null,
    localSavedAt: conflict?.localSavedAt ?? null,
    recoveryResult: conflict?.recoveryResult ?? "pending",
    errorCode: conflict?.errorCode ?? null,
  };
}

async function copyDiagnostic(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const didCopy = document.execCommand?.("copy");
  document.body.removeChild(textarea);
  if (!didCopy) throw new Error("clipboard unavailable");
}

function GameSyncConflictDialog({ conflict, onResolve, persistencePhase }) {
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  if (!conflict) return null;

  const classification = conflict.classification || "TRUE_REMOTE_CONFLICT";
  const classificationDescription =
    CLASSIFICATION_DESCRIPTIONS[classification] ||
    "서버와 이 기기의 상태 차이를 자동으로 해결할 수 없습니다.";

  const resolve = async () => {
    const message = "서버에서 최신 상태를 다시 불러오고 이 기기의 미전송 게임 상태를 폐기할까요? 활동·배틀·먹이 기록은 보존됩니다.";
    if (!window.confirm(message)) return;

    setIsResolving(true);
    setResolutionError("");
    try {
      const didResolve = await onResolve?.("server");
      if (didResolve === false) throw new Error("현재 충돌 정보를 다시 확인해야 합니다.");
    } catch (error) {
      console.error("동기화 충돌 해결 오류:", error);
      setResolutionError("동기화에 실패했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setIsResolving(false);
    }
  };

  const copyConflictDiagnostic = async () => {
    setCopyStatus("");
    try {
      const diagnostic = buildSyncConflictDiagnostic(conflict, persistencePhase);
      await copyDiagnostic(JSON.stringify(diagnostic, null, 2));
      setCopyStatus("진단 정보를 복사했습니다.");
    } catch (error) {
      console.error("동기화 진단 정보 복사 오류:", error);
      setCopyStatus("진단 정보를 복사하지 못했습니다.");
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
          게임 상태 확인 필요
        </h2>
        <p className="mt-3 text-sm text-slate-700">
          {classificationDescription} 자동으로 덮어쓰지 않고 안전하게 보류했습니다.
        </p>
        <p className="mt-2 text-xs font-semibold text-slate-600">분류: {classification}</p>
        <p className="mt-2 text-xs text-slate-500">
          서버 revision {conflict.actualRevision ?? 0} · 이 기기 기준 {conflict.expectedRevision ?? 0}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          기기 저장 시각: {formatLocalSavedAt(conflict.localSavedAt)}
        </p>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          서버에서 다시 불러오면 이 기기의 미전송 게임 상태만 폐기됩니다. 활동·배틀·먹이 기록은 보존됩니다.
        </p>
        {resolutionError ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
            {resolutionError}
          </p>
        ) : null}
        {copyStatus ? (
          <p role="status" className="mt-3 text-xs text-slate-600">
            {copyStatus}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={copyConflictDiagnostic}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            진단 정보 복사
          </button>
          <button
            type="button"
            disabled={isResolving}
            onClick={resolve}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isResolving ? "서버에서 불러오는 중..." : "서버에서 다시 불러오기"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameSyncConflictDialog;
