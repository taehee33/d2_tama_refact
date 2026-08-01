import React from "react";

const ACTIONS = [
  { id: "attack", label: "공격", icon: "⚔️" },
  { id: "guard", label: "방어", icon: "🛡️" },
  { id: "special_attack", label: "특수공격", icon: "✨" },
];

export default function RealtimeArenaActionPanel({ disabled, selectedAction, saving, onSubmit }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2" aria-label="배틀 행동 선택">
        {ACTIONS.map((action) => {
          const selected = selectedAction === action.id;
          return (
            <button
              key={action.id}
              type="button"
              className={`realtime-arena-action ${selected ? "is-selected" : ""}`}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => { void Promise.resolve(onSubmit(action.id)).catch(() => {}); }}
            >
              <span aria-hidden="true">{action.icon}</span>
              <span>{action.label}</span>
              <small>{selected ? "✓ 선택됨" : "선택"}</small>
            </button>
          );
        })}
      </div>
      <p className={`text-center text-xs font-semibold ${saving ? "text-amber-600" : selectedAction ? "text-emerald-700" : "text-slate-500"}`} aria-live="polite">
        {saving ? "선택 저장 중..." : selectedAction ? "선택 저장 완료 · 마감 전까지 변경할 수 있습니다." : "시간 안에 선택하지 않으면 행동이 자동으로 선택됩니다."}
      </p>
    </div>
  );
}
