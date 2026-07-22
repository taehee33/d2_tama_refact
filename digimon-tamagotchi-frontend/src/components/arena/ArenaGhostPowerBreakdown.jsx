import React, { useState } from "react";

export function buildGhostDefensePower(snapshot) {
  const registeredPower = Math.max(0, Number(snapshot?.combatPowerAtCapture) || 0);
  const defenseBonus = 1;

  return {
    registeredPower,
    defenseBonus,
    effectiveDefensePower: registeredPower + defenseBonus,
  };
}

export default function ArenaGhostPowerBreakdown({ snapshot }) {
  const [expanded, setExpanded] = useState(false);
  const power = buildGhostDefensePower(snapshot);
  const ghostName = snapshot?.digimonName || snapshot?.digimonId || "Ghost";

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-700">등록 Power</span>
        <span className="font-bold text-blue-700">{power.registeredPower}</span>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={`${ghostName} Ghost Power 상세 ${expanded ? "접기" : "펼치기"}`}
          className="rounded bg-blue-100 px-2 py-1 font-semibold text-blue-800 hover:bg-blue-200"
        >
          상세 {expanded ? "▲" : "▼"}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-1 rounded bg-white p-2 text-gray-700">
          <div>등록 당시 Power: {power.registeredPower}</div>
          <div className="font-semibold text-emerald-700">Ghost 방어 보너스: +{power.defenseBonus}</div>
          <div className="border-t border-slate-200 pt-1 font-bold text-blue-700">
            최종 방어 Power = {power.registeredPower} + {power.defenseBonus} = {power.effectiveDefensePower}
          </div>
          <p className="text-[11px] text-gray-500">등록 당시 능력치는 고정되며 방어 배틀에 보너스 +1이 적용됩니다.</p>
        </div>
      )}
    </div>
  );
}
