import React from "react";

const ACTIONS = [
  { id: "attack", label: "공격" },
  { id: "guard", label: "방어" },
  { id: "special_attack", label: "특수공격" },
];

export default function RealtimeArenaActionPanel({ disabled, submitted, onSubmit }) {
  if (submitted) return <p className="rounded-lg bg-emerald-50 p-3 text-center font-bold text-emerald-700">행동 제출 완료</p>;
  return (
    <div className="grid grid-cols-3 gap-2" aria-label="배틀 행동 선택">
      {ACTIONS.map((action) => (
        <button key={action.id} type="button" className="rounded-lg bg-purple-600 px-2 py-3 font-bold text-white disabled:opacity-50" disabled={disabled} onClick={() => onSubmit(action.id)}>{action.label}</button>
      ))}
    </div>
  );
}
