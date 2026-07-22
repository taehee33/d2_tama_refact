import React, { useMemo, useState } from "react";
import { calculatePower } from "../../logic/battle/hitrate";

export function buildArenaPowerBreakdown(digimonStats, currentDigimonData, activeGhostCount) {
  const hasPowerData = Boolean(currentDigimonData?.stats);
  const calculated = calculatePower(digimonStats || {}, currentDigimonData || {}, true);
  const digimonPower = Number(
    hasPowerData
      ? calculated?.power ?? 0
      : digimonStats?.power ?? currentDigimonData?.stats?.basePower ?? 0
  );
  const ghostBonus = Math.min(3, Math.max(0, Number(activeGhostCount) || 0));

  return {
    digimonPower,
    ghostBonus,
    effectivePower: digimonPower + ghostBonus,
    details: calculated?.details || {
      basePower: Number(currentDigimonData?.stats?.basePower || 0),
      strengthBonus: 0,
      traitedEggBonus: 0,
      effortBonus: 0,
    },
  };
}

function BonusLine({ label, value }) {
  const bonus = Number(value || 0);
  return (
    <div className={bonus > 0 ? "font-semibold text-emerald-700" : "text-gray-500"}>
      {label}: {bonus > 0 ? `+${bonus}` : "0"}
    </div>
  );
}

export default function ArenaPowerBreakdown({ digimonStats, currentDigimonData, activeGhostCount }) {
  const [expanded, setExpanded] = useState(false);
  const power = useMemo(
    () => buildArenaPowerBreakdown(digimonStats, currentDigimonData, activeGhostCount),
    [digimonStats, currentDigimonData, activeGhostCount]
  );

  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-white/80 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">아레나 공격 Power</span>
        <span aria-label={`최종 공격 Power ${power.effectivePower}`} className="font-bold text-blue-700">
          {power.digimonPower} + Ghost {power.ghostBonus} = {power.effectivePower}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-200"
        >
          Power 상세 {expanded ? "접기 ▲" : "펼치기 ▼"}
        </button>
      </div>

      <p className="mt-1 text-xs text-gray-600">
        현재 디지몬 Power {power.digimonPower} + 활성 Ghost 보너스 {power.ghostBonus} = 최종 공격 Power {power.effectivePower}
      </p>

      {expanded && (
        <div className="mt-3 grid gap-3 rounded-lg bg-blue-50 p-3 text-xs sm:grid-cols-2">
          <div>
            <h4 className="mb-1 font-bold text-gray-800">현재 디지몬 Power 계산</h4>
            <div className="space-y-1">
              <div>Base Power: {power.details.basePower}</div>
              <BonusLine label="Strength 보너스" value={power.details.strengthBonus} />
              <BonusLine label="Traited Egg 보너스" value={power.details.traitedEggBonus} />
              <BonusLine label="Effort 보너스" value={power.details.effortBonus} />
              <div className="border-t border-blue-200 pt-1 font-bold">디지몬 Power = {power.digimonPower}</div>
            </div>
          </div>
          <div>
            <h4 className="mb-1 font-bold text-gray-800">아레나 공격 보너스</h4>
            <div className="space-y-1">
              <div>활성 Ghost {power.ghostBonus}마리: +{power.ghostBonus}</div>
              <div className="text-gray-500">Ghost 보너스는 최대 +3</div>
              <div className="border-t border-blue-200 pt-1 font-bold text-blue-700">
                최종 공격 Power = {power.digimonPower} + {power.ghostBonus} = {power.effectivePower}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
