import React, { useEffect, useState } from "react";

function remainingMinutes(expiresAt, now = Date.now()) {
  const remainingMs = new Date(expiresAt).getTime() - now;
  return Math.max(0, Math.ceil(remainingMs / 60000));
}

export default function RealtimeArenaLobby({ battle, viewer, busy, rooms = [], roomsLoading = false, roomsError = "", onRefreshRooms, onCreate, onJoin, onReady, onLeave, onCancel }) {
  const [joinId, setJoinId] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!battle?.expiresAt) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, [battle?.expiresAt]);
  if (!battle) {
    return (
      <div className="space-y-4">
        <button type="button" className="w-full rounded-lg bg-purple-600 px-4 py-3 font-bold text-white disabled:opacity-50" onClick={onCreate} disabled={busy}>방 만들기</button>
        <section className="space-y-2" aria-labelledby="realtime-waiting-rooms-title">
          <div className="flex items-center justify-between">
            <h3 id="realtime-waiting-rooms-title" className="font-bold text-slate-800">대기 중인 방</h3>
            <button type="button" className="rounded px-2 py-1 text-sm font-semibold text-blue-600 disabled:opacity-50" onClick={onRefreshRooms} disabled={roomsLoading || busy}>새로고침</button>
          </div>
          {roomsLoading ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">대기방을 불러오는 중입니다.</p> : null}
          {!roomsLoading && roomsError ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{roomsError}</p> : null}
          {!roomsLoading && !roomsError && rooms.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">아직 대기 중인 방이 없습니다. 직접 방을 만들어 첫 대결을 시작해 보세요.</p> : null}
          {!roomsLoading && rooms.map((room) => (
            <article key={room.battleId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-800">{room.ownerDisplayName || "알 수 없는 테이머"}의 ???</p>
                <p className="text-xs text-slate-500">
                  {room.expiresAt ? `${remainingMinutes(room.expiresAt)}분 남음` : "대기 시간 확인 불가"}
                </p>
              </div>
              <button type="button" className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:bg-slate-300" onClick={() => onJoin(room.battleId)} disabled={busy || room.isOwn}>{room.isOwn ? "내 방" : "참가"}</button>
            </article>
          ))}
        </section>
        <label className="block text-sm font-semibold text-slate-700" htmlFor="realtime-arena-battle-id">초대받은 방 ID</label>
        <input id="realtime-arena-battle-id" className="w-full rounded-lg border px-3 py-2" value={joinId} onChange={(event) => setJoinId(event.target.value)} placeholder="rtb_..." />
        <button type="button" className="w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50" onClick={() => onJoin(joinId)} disabled={busy || !joinId.trim()}>방 참가</button>
      </div>
    );
  }
  const role = viewer?.role || null;
  const ready = Boolean(battle.lobby?.[role]?.ready);
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-100 p-3">
        <p className="text-sm font-semibold text-slate-600">방 ID</p>
        <p className="break-all font-mono text-xs" data-testid="realtime-battle-id">{battle.battleId}</p>
      </div>
      <p className="text-center font-semibold">{battle.guestUid ? "상대가 참가했습니다." : "상대 참가를 기다리는 중입니다."}</p>
      {role === "host" && battle.expiresAt ? <p className="text-center text-sm font-semibold text-amber-700">방 만료까지 {remainingMinutes(battle.expiresAt, now)}분 남았습니다.</p> : null}
      {!role && <p className="text-center text-sm text-slate-500">참가자 정보를 복구하는 중입니다.</p>}
      {role && battle.guestUid && (
        <button type="button" className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50" onClick={() => onReady(!ready)} disabled={busy}>{ready ? "준비 취소" : "준비 완료"}</button>
      )}
      {role === "guest" ? (
        <button type="button" className="w-full rounded-lg bg-slate-500 px-4 py-2 text-white" onClick={onLeave} disabled={busy}>방 나가기</button>
      ) : role === "host" ? (
        <button type="button" className="w-full rounded-lg bg-red-600 px-4 py-2 text-white" onClick={onCancel} disabled={busy}>방 취소</button>
      ) : null}
    </div>
  );
}
