import React from "react";

const OUTCOME_LABELS = { host_win: "호스트 승리", guest_win: "게스트 승리", draw: "무승부" };
const REASON_LABELS = { ko: "KO", simultaneous_ko: "동시 KO", max_round: "최대 라운드", forfeit: "포기", timeout: "연속 시간 초과", double_timeout: "양쪽 연속 시간 초과" };

export default function RealtimeArenaResult({ battle, onCloseSession }) {
  const cpuMode = battle.mode === "cpu";
  const outcomeLabel = cpuMode
    ? { host_win: "승리", guest_win: "패배", draw: "무승부" }[battle.result?.outcome]
    : OUTCOME_LABELS[battle.result?.outcome];
  return (
    <div className="space-y-4 text-center">
      <h3 className="text-2xl font-black">{outcomeLabel || "배틀 종료"}</h3>
      <p>{REASON_LABELS[battle.result?.reason] || "친선 배틀이 종료되었습니다."}</p>
      <p className="text-sm text-slate-500">랭크, 보상 및 육성 전적에는 반영되지 않습니다.</p>
      <button type="button" className="w-full rounded-lg bg-slate-700 px-4 py-3 font-bold text-white" onClick={onCloseSession}>로비로 돌아가기</button>
    </div>
  );
}
