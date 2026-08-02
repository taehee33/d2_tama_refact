import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import useRealtimeArenaSession from "../../hooks/useRealtimeArenaSession";
import RealtimeArenaLobby from "./RealtimeArenaLobby";
import RealtimeArenaBattleBoard from "./RealtimeArenaBattleBoard";
import RealtimeArenaResult from "./RealtimeArenaResult";
import "../../styles/RealtimeArenaBattle.css";

export default function RealtimeArenaScreen({ currentSlotId, onClose }) {
  const { currentUser } = useAuth();
  const session = useRealtimeArenaSession({ currentUser, slotId: currentSlotId });
  const handleAsync = (callback) => (...args) => {
    void Promise.resolve().then(() => callback(...args)).catch(() => {});
  };
  return (
    <div className="realtime-arena-overlay fixed inset-0 z-50 flex justify-center bg-black bg-opacity-60" onClick={onClose}>
      <section className="realtime-arena-dialog w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="realtime-arena-title" onClick={(event) => event.stopPropagation()}>
        <header className="realtime-arena-dialog__header mb-4 flex items-center justify-between">
          <h2 id="realtime-arena-title" className="text-xl font-black">실시간 배틀</h2>
          <button type="button" onClick={onClose} aria-label="실시간 배틀 닫기">✕</button>
        </header>
        <div className="realtime-arena-dialog__body">
          {session.error && <p role="alert" className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{session.error}</p>}
          {!currentUser ? <p>로그인 후 실시간 배틀을 이용할 수 있습니다.</p> : session.battle?.status === "waiting" ? (
            <RealtimeArenaLobby battle={session.battle} viewer={session.viewer} busy={session.busy} rooms={session.rooms} roomsLoading={session.roomsLoading} roomsError={session.roomsError} onRefreshRooms={handleAsync(session.refreshRooms)} onCreate={handleAsync(session.createBattle)} onCreateCpu={handleAsync(session.createCpuBattle)} onJoin={handleAsync(session.joinBattle)} onReady={handleAsync((ready) => session.runCommand("set-ready", { ready }))} onLeave={handleAsync(() => session.runCommand("leave").then(session.closeSession))} onCancel={handleAsync(() => session.runCommand("cancel"))} />
          ) : session.battle?.status === "selecting" || session.presentationActive ? (
            <RealtimeArenaBattleBoard
              battle={session.battle}
              viewer={session.viewer}
              remainingMs={session.remainingMs}
              busy={session.busy}
              selectedAction={session.selectedAction}
              selectionSaving={session.selectionSaving}
              recovering={session.recovering}
              presentationActive={session.presentationActive}
              selectionOpen={session.selectionOpen}
              clockMs={session.clockMs}
              onSubmit={handleAsync(session.selectAction)}
              onForfeit={handleAsync(() => session.runCommand("forfeit"))}
            />
          ) : session.battle?.status === "finished" ? (
            <RealtimeArenaResult battle={session.battle} onCloseSession={session.closeSession} />
          ) : session.battle?.status === "cancelled" || session.battle?.status === "expired" ? (
            <div className="space-y-3 text-center"><p>{session.battle.status === "expired" ? "배틀 방이 만료되었습니다." : "배틀 방이 취소되었습니다."}</p><button type="button" onClick={session.closeSession} className="rounded bg-slate-700 px-4 py-2 text-white">로비로 돌아가기</button></div>
          ) : (
            <RealtimeArenaLobby battle={null} viewer={session.viewer} busy={session.busy} rooms={session.rooms} roomsLoading={session.roomsLoading} roomsError={session.roomsError} onRefreshRooms={handleAsync(session.refreshRooms)} onCreate={handleAsync(session.createBattle)} onCreateCpu={handleAsync(session.createCpuBattle)} onJoin={handleAsync(session.joinBattle)} />
          )}
        </div>
      </section>
    </div>
  );
}
