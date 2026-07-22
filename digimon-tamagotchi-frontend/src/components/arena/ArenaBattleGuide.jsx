import React, { useState } from "react";

export default function ArenaBattleGuide() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="mb-7 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">배틀 공식 및 규칙</h3>
          <p className="text-xs text-gray-600">Ghost 아레나 V2의 서버 확정 계산 기준입니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="shrink-0 rounded bg-emerald-200 px-3 py-1 text-sm font-semibold text-emerald-900 hover:bg-emerald-300"
        >
          {expanded ? "접기 ▲" : "펼치기 ▼"}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 grid gap-3 rounded-lg border border-emerald-200 bg-white p-3 text-sm text-gray-700 sm:grid-cols-2">
          <div>
            <h4 className="font-bold text-gray-900">배틀 규칙</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>라운드마다 공격자와 방어자가 한 번씩 공격</li>
              <li>먼저 3번 명중한 쪽이 승리</li>
              <li>최대 100라운드까지 서버에서 결과 확정</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-gray-900">Power 계산</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>공격: 현재 디지몬 Power + 활성 Ghost 수(최대 +3)</li>
              <li>방어: Ghost 등록 당시 Power + 고정 방어 보너스 1</li>
              <li>디지몬 Power: Base + Strength + Traited Egg + Effort</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-gray-900">히트레이트 계산</h4>
            <p className="mt-1 rounded bg-gray-50 p-2 font-mono text-xs">
              (공격자 Power × 100) ÷ (공격자 Power + 방어자 Power) + 속성 보너스
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Vaccine &gt; Virus &gt; Data &gt; Vaccine: 유리하면 +5%</li>
              <li>역속성은 -5%, Free 속성은 0%</li>
              <li>최종 히트레이트는 0~100% 범위로 제한</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-gray-900">배틀 후 반영</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Weight -4g, Energy -1</li>
              <li>현재 형태 공격 전적과 상대 Ghost 방어 전적 갱신</li>
              <li>승패·Power·주사위 결과는 서버가 결정</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
