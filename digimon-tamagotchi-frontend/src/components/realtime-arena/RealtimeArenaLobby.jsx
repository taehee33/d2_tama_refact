import React, { useState } from "react";

export default function RealtimeArenaLobby({ battle, viewer, busy, onCreate, onJoin, onReady, onLeave, onCancel }) {
  const [joinId, setJoinId] = useState("");
  if (!battle) {
    return (
      <div className="space-y-4">
        <button type="button" className="w-full rounded-lg bg-purple-600 px-4 py-3 font-bold text-white disabled:opacity-50" onClick={onCreate} disabled={busy}>방 만들기</button>
        <label className="block text-sm font-semibold text-slate-700" htmlFor="realtime-arena-battle-id">초대받은 방 ID</label>
        <input id="realtime-arena-battle-id" className="w-full rounded-lg border px-3 py-2" value={joinId} onChange={(event) => setJoinId(event.target.value)} placeholder="rtb_..." />
        <button type="button" className="w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50" onClick={() => onJoin(joinId)} disabled={busy || !joinId.trim()}>방 참가</button>
      </div>
    );
  }
  const role = viewer?.role || (battle.hostUid ? "host" : null);
  const ready = Boolean(battle.lobby?.[role]?.ready);
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-100 p-3">
        <p className="text-sm font-semibold text-slate-600">방 ID</p>
        <p className="break-all font-mono text-xs" data-testid="realtime-battle-id">{battle.battleId}</p>
      </div>
      <p className="text-center font-semibold">{battle.guestUid ? "상대가 참가했습니다." : "상대 참가를 기다리는 중입니다."}</p>
      {battle.guestUid && (
        <button type="button" className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50" onClick={() => onReady(!ready)} disabled={busy}>{ready ? "준비 취소" : "준비 완료"}</button>
      )}
      {role === "guest" ? (
        <button type="button" className="w-full rounded-lg bg-slate-500 px-4 py-2 text-white" onClick={onLeave} disabled={busy}>방 나가기</button>
      ) : (
        <button type="button" className="w-full rounded-lg bg-red-600 px-4 py-2 text-white" onClick={onCancel} disabled={busy}>방 취소</button>
      )}
    </div>
  );
}
