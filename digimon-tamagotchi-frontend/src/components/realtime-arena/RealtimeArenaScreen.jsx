import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import useRealtimeArenaSession from "../../hooks/useRealtimeArenaSession";
import RealtimeArenaLobby from "./RealtimeArenaLobby";
import RealtimeArenaBattleBoard from "./RealtimeArenaBattleBoard";
import RealtimeArenaResult from "./RealtimeArenaResult";

export default function RealtimeArenaScreen({ currentSlotId, onClose }) {
  const { currentUser } = useAuth();
  const session = useRealtimeArenaSession({ currentUser, slotId: currentSlotId });
  const submit = (action) => session.runCommand("submit-action", { round: session.battle.round, expectedStateVersion: session.battle.stateVersion, action });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4" onClick={onClose}>
      <section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="realtime-arena-title" onClick={(event) => event.stopPropagation()}>
        <header className="mb-4 flex items-center justify-between">
          <h2 id="realtime-arena-title" className="text-xl font-black">실시간 배틀</h2>
          <button type="button" onClick={onClose} aria-label="실시간 배틀 닫기">✕</button>
        </header>
        {session.error && <p role="alert" className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{session.error}</p>}
        {!currentUser ? <p>로그인 후 실시간 배틀을 이용할 수 있습니다.</p> : session.battle?.status === "waiting" ? (
          <RealtimeArenaLobby battle={session.battle} viewer={session.viewer} busy={session.busy} rooms={session.rooms} roomsLoading={session.roomsLoading} roomsError={session.roomsError} onRefreshRooms={session.refreshRooms} onCreate={session.createBattle} onJoin={session.joinBattle} onReady={(ready) => session.runCommand("set-ready", { ready })} onLeave={() => session.runCommand("leave").then(session.closeSession)} onCancel={() => session.runCommand("cancel")} />
        ) : session.battle?.status === "selecting" ? (
          <RealtimeArenaBattleBoard battle={session.battle} viewer={session.viewer} remainingMs={session.remainingMs} busy={session.busy} onSubmit={submit} onForfeit={() => session.runCommand("forfeit")} />
        ) : session.battle?.status === "finished" ? (
          <RealtimeArenaResult battle={session.battle} onCloseSession={session.closeSession} />
        ) : session.battle?.status === "cancelled" || session.battle?.status === "expired" ? (
          <div className="space-y-3 text-center"><p>{session.battle.status === "expired" ? "배틀 방이 만료되었습니다." : "배틀 방이 취소되었습니다."}</p><button type="button" onClick={session.closeSession} className="rounded bg-slate-700 px-4 py-2 text-white">로비로 돌아가기</button></div>
        ) : (
          <RealtimeArenaLobby battle={null} viewer={session.viewer} busy={session.busy} rooms={session.rooms} roomsLoading={session.roomsLoading} roomsError={session.roomsError} onRefreshRooms={session.refreshRooms} onCreate={session.createBattle} onJoin={session.joinBattle} />
        )}
      </section>
    </div>
  );
}
