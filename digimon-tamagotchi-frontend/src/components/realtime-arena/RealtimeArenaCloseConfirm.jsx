import React from "react";

export default function RealtimeArenaCloseConfirm({ action, busy, error, onCancel, onConfirm }) {
  const isForfeit = action === "forfeit";
  const title = isForfeit ? "배틀 종료" : "대기방 종료";
  const description = isForfeit
    ? "진행 중인 배틀을 포기하고 로비로 돌아갈까요? 포기하면 상대의 승리로 처리됩니다."
    : "현재 대기방을 종료하고 로비로 돌아갈까요?";
  const confirmLabel = isForfeit ? "배틀 포기" : "대기방 종료";

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-6" role="presentation" onClick={onCancel}>
      <section
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="realtime-arena-close-confirm-title"
        aria-describedby="realtime-arena-close-confirm-description"
        aria-busy={busy}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="realtime-arena-close-confirm-title" className="text-lg font-black text-slate-900">{title}</h3>
        <p id="realtime-arena-close-confirm-description" className="text-sm leading-6 text-slate-600">{description}</p>
        {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 font-bold text-slate-700 disabled:opacity-50" onClick={onCancel} disabled={busy}>계속하기</button>
          <button type="button" className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white disabled:opacity-50" onClick={onConfirm} disabled={busy}>{busy ? "처리 중..." : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
