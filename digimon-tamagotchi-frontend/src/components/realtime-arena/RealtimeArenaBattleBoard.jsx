import React from "react";
import RealtimeArenaActionPanel from "./RealtimeArenaActionPanel";

function Fighter({ label, data, hp }) {
  const ratio = Math.max(0, Math.min(100, (hp / data.maxHp) * 100));
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="font-bold">{data.digimonName}</p>
      <p className="text-sm">HP {hp} / {data.maxHp}</p>
      <div className="mt-1 h-2 overflow-hidden rounded bg-slate-200"><div className="h-full bg-emerald-500" style={{ width: `${ratio}%` }} /></div>
    </div>
  );
}
export default function RealtimeArenaBattleBoard({ battle, viewer, remainingMs, busy, onSubmit, onForfeit }) {
  const latest = battle.resolvedRounds?.[battle.resolvedRounds.length - 1];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><strong>라운드 {battle.round} / {battle.maxRounds}</strong><span className="font-mono text-lg font-bold" aria-label="남은 시간">{Math.ceil(remainingMs / 1000)}초</span></div>
      <div className="grid grid-cols-2 gap-3">
        <Fighter label="호스트" data={battle.participants.host} hp={battle.currentHp.host} />
        <Fighter label="게스트" data={battle.participants.guest} hp={battle.currentHp.guest} />
      </div>
      {latest && <p className="rounded bg-slate-100 p-2 text-center text-sm">이전 라운드: 호스트 {latest.hostDamageTaken} 피해 · 게스트 {latest.guestDamageTaken} 피해</p>}
      <RealtimeArenaActionPanel disabled={busy} submitted={viewer?.hasSubmitted} onSubmit={onSubmit} />
      <button type="button" className="w-full rounded border border-red-500 px-3 py-2 text-red-600 disabled:opacity-50" onClick={onForfeit} disabled={busy}>포기</button>
    </div>
  );
}
