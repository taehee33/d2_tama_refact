import React from "react";

const ACTIONS = [
  { id: "attack", label: "속공", description: "필살기를 끊음", icon: "⚔️" },
  { id: "guard", label: "방어", description: "속공 차단 · 성공 시 HP +1", icon: "🛡️" },
  { id: "special_attack", label: "필살기", description: "방어 관통", icon: "✨" },
];

export default function RealtimeArenaActionPanel({ disabled, selectedAction, saving, remainingMs, onSubmit }) {
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const urgent = remainingSeconds <= 3;
  const statusMessage = saving
    ? "선택 저장 중..."
    : selectedAction
      ? "선택 저장 완료 · 마감 전까지 변경할 수 있습니다."
      : "시간 안에 선택하지 않으면 행동이 자동으로 선택됩니다.";

  return (
    <div className="space-y-2" role="region" aria-label="행동 선택 영역">
      <div
        className={`realtime-arena-selection-status ${urgent ? "is-urgent" : ""}`}
        role="status"
        aria-label="선택 안내"
        aria-live="polite"
      >
        <strong className="realtime-arena-selection-status__timer" aria-label={`남은 선택 시간 ${remainingSeconds}초`}>
          {remainingSeconds}초
        </strong>
        <p className={saving ? "is-saving" : selectedAction ? "is-saved" : ""}>{statusMessage}</p>
      </div>
      <p className="text-center text-xs font-semibold leading-5 text-slate-500">
        속공은 필살기를 끊습니다. 방어는 속공을 막고 HP를 1 회복합니다. 필살기는 방어를 관통합니다.
      </p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="배틀 행동 선택">
        {ACTIONS.map((action) => {
          const selected = selectedAction === action.id;
          return (
            <button
              key={action.id}
              type="button"
              className={`realtime-arena-action ${selected ? "is-selected" : ""}`}
              aria-pressed={selected}
              aria-label={`${action.label} 선택`}
              disabled={disabled}
              onClick={() => { void Promise.resolve(onSubmit(action.id)).catch(() => {}); }}
            >
              <span aria-hidden="true">{action.icon}</span>
              <span>{action.label}</span>
              <small>{action.description}</small>
              <small>{selected ? "✓ 선택됨" : "선택"}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
