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

export function ArenaPowerBreakdownDetails({ digimonStats, currentDigimonData, activeGhostCount }) {
  const power = useMemo(
    () => buildArenaPowerBreakdown(digimonStats, currentDigimonData, activeGhostCount),
    [digimonStats, currentDigimonData, activeGhostCount]
  );

  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <div className="rounded-lg bg-blue-50 p-3">
        <h4 className="mb-2 font-bold text-gray-800">현재 디지몬 Power 계산</h4>
        <div className="space-y-1">
          <div>Base Power: {power.details.basePower}</div>
          <BonusLine label="Strength 보너스" value={power.details.strengthBonus} />
          <BonusLine label="Traited Egg 보너스" value={power.details.traitedEggBonus} />
          <BonusLine label="Effort 보너스" value={power.details.effortBonus} />
          <div className="border-t border-blue-200 pt-1 font-bold">디지몬 Power = {power.digimonPower}</div>
        </div>
      </div>
      <div className="rounded-lg bg-blue-50 p-3">
        <h4 className="mb-2 font-bold text-gray-800">아레나 공격 보너스</h4>
        <div className="space-y-1">
          <div>활성 Ghost {power.ghostBonus}마리: +{power.ghostBonus}</div>
          <div className="text-gray-500">Ghost 보너스는 최대 +3</div>
          <div className="border-t border-blue-200 pt-1 font-bold text-blue-700">
            최종 공격 Power = {power.digimonPower} + {power.ghostBonus} = {power.effectivePower}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ArenaPowerBreakdown({
  digimonStats,
  currentDigimonData,
  activeGhostCount,
  onOpenDetails,
  compact = false,
  inlineSummary = false,
  mobileBadge = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const power = useMemo(
    () => buildArenaPowerBreakdown(digimonStats, currentDigimonData, activeGhostCount),
    [digimonStats, currentDigimonData, activeGhostCount]
  );

  if (inlineSummary) {
    return (
      <button
        type="button"
        onClick={onOpenDetails || (() => setExpanded((value) => !value))}
        aria-label="Power 상세 보기"
        aria-expanded={onOpenDetails ? undefined : expanded}
        aria-haspopup={onOpenDetails ? "dialog" : undefined}
        className={`flex h-full w-full min-w-0 flex-col justify-center rounded-lg border border-blue-200 bg-white/80 text-left hover:bg-blue-100 ${mobileBadge ? "min-h-14 px-2 py-1.5 sm:min-h-16 sm:px-3 sm:py-2" : "min-h-16 px-3 py-2"}`}
      >
        <span className="text-[10px] font-semibold leading-tight text-gray-600 sm:text-[11px]">최종 Power</span>
        <span aria-label={`최종 공격 Power ${power.effectivePower}`} className="text-xl font-bold leading-tight text-blue-700">
          {power.effectivePower}
        </span>
        <span className="truncate text-[10px] leading-tight text-gray-600 sm:text-[11px]">
          {power.digimonPower} + Ghost {power.ghostBonus}
        </span>
      </button>
    );
  }

  return (
    <div className={`${compact ? "mt-2 p-2" : "mt-3 p-3"} rounded-lg border border-blue-200 bg-white/80 text-sm`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">아레나 공격 Power</span>
        <span aria-label={`최종 공격 Power ${power.effectivePower}`} className="font-bold text-blue-700">
          {power.digimonPower} + Ghost {power.ghostBonus} = {power.effectivePower}
        </span>
        <button
          type="button"
          onClick={onOpenDetails || (() => setExpanded((value) => !value))}
          aria-expanded={onOpenDetails ? undefined : expanded}
          aria-haspopup={onOpenDetails ? "dialog" : undefined}
          className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-200"
        >
          Power 상세 {onOpenDetails ? "보기" : expanded ? "접기 ▲" : "펼치기 ▼"}
        </button>
      </div>

      {!compact && (
        <p className="mt-1 text-xs text-gray-600">
          현재 디지몬 Power {power.digimonPower} + 활성 Ghost 보너스 {power.ghostBonus} = 최종 공격 Power {power.effectivePower}
        </p>
      )}

      {!onOpenDetails && expanded && (
        <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs">
          <ArenaPowerBreakdownDetails
            digimonStats={digimonStats}
            currentDigimonData={currentDigimonData}
            activeGhostCount={activeGhostCount}
          />
        </div>
      )}
    </div>
  );
}
