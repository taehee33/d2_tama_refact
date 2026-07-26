import React from "react";
import { formatTimestamp } from "../../utils/dateUtils";
import {
  formatStatsPopupDuration,
  formatStatsPopupValueWithOverflow,
} from "./statsPopupViewModel";

/**
 * Old 탭의 상태 표시와 개발자 편집 의도를 담당하는 프레젠터입니다.
 * 실제 상태 mutation과 저장 콜백 호출은 상위 컨트롤러가 수행합니다.
 */
export default function DeveloperStatsSection({
  stats,
  sourceStats,
  devMode = false,
  canEdit = false,
  onNumericChange,
  onBooleanChange,
}) {
  const {
    age, sprite, evolutionStage, strength, energy, effort, winRate, careMistakes,
    lifespanSeconds, timeToEvolveSeconds, fullness, weight, maxOverfeed, isDead,
    hungerTimer, strengthTimer, poopTimer, maxEnergy, maxStamina, minWeight,
    healing, attribute, power, attackSprite, altAttackSprite, trainings,
    poopCount = 0, poopReachedMaxAt: rawPoopReachedMaxAt = null,
    lastPoopPenaltyAt: rawLastPoopPenaltyAt = null, lastMaxPoopTime = null,
    isInjured = false, injuredAt = null, injuries = 0, healedDosesCurrent = 0,
  } = stats || {};
  const poopReachedMaxAt = rawPoopReachedMaxAt ?? lastMaxPoopTime;
  const lastPoopPenaltyAt = rawLastPoopPenaltyAt ?? poopReachedMaxAt;
  const persistedStats = sourceStats || {};

  const range = (end) => Array.from({ length: end + 1 }, (_, index) => index);
  const possibleFullness = range(5 + (maxOverfeed || 0));
  const possibleWeight = range(50);
  const possibleMistakes = range(9);
  const possiblePoop = range(8);
  const possibleStrength = range(33);
  const possibleInjuries = range(15);
  const possibleHealedDoses = range(5);
  const possibleEffort = range(5);
  const possibleEnergy = range(maxEnergy || maxStamina || 100);

  const numericIntent = (field) => (event) => {
    onNumericChange?.(field, parseInt(event.target.value, 10));
  };

  return (
    <>
      <ul className="text-sm space-y-1">
        <li>Age: {age || 0}</li>
        <li>Sprite: {sprite}</li>
        <li>Stage: {evolutionStage}</li>
        <li>Strength: {strength || 0}</li>
        <li>Energy (DP): {energy || 0}</li>
        <li>Effort: {effort || 0}</li>
        <li>WinRate: {winRate || 0}%</li>
        <li>CareMistakes: {careMistakes || 0} <span className="text-gray-500 text-xs">(진화 구간 기준)</span></li>

        <li>Lifespan: {formatStatsPopupDuration(lifespanSeconds)}</li>
        <li>TimeToEvolve: {formatStatsPopupDuration(timeToEvolveSeconds)}</li>
        <li>Fullness: {formatStatsPopupValueWithOverflow(fullness)}</li>
        <li>Weight: {weight || 0}</li>
        <li>MaxOverfeed: {maxOverfeed || 0}</li>
        <li>isDead: {isDead ? "Yes" : "No"}</li>

        <li>HungerTimer: {hungerTimer || 0} min</li>
        <li>StrengthTimer: {strengthTimer || 0} min</li>
        <li>PoopTimer: {poopTimer || 0} min</li>

        <li>MaxEnergy: {maxEnergy || maxStamina || 0}</li>
        <li>MinWeight: {minWeight || 0}</li>
        <li>Healing: {healing || 0}</li>
        <li>Attribute: {attribute || 0}</li>
        <li>Power: {power || 0}</li>
        <li>Attack Sprite: {attackSprite || 0}</li>
        <li>Alt Attack Sprite: {altAttackSprite || 0}</li>
        <li>Training: {trainings}회</li>

        <li>PoopCount: {poopCount}</li>
        <li>PoopReachedMaxAt: {formatTimestamp(poopReachedMaxAt)}</li>
        <li>LastPoopPenaltyAt: {formatTimestamp(lastPoopPenaltyAt)}</li>

        <li className="mt-2 pt-2 border-t border-gray-300">--- 부상 관련 필드 ---</li>
        <li>isInjured: {isInjured ? "Yes" : "No"}</li>
        <li>injuredAt: {formatTimestamp(injuredAt)}</li>
        <li>injuries: {injuries || 0}</li>
        <li>healedDosesCurrent: {healedDosesCurrent || 0}</li>

        <li className="mt-2 pt-2 border-t border-gray-300">--- 매뉴얼 기반 필드 ---</li>
        <li>Protein Overdose: {persistedStats.proteinOverdose || 0}</li>
        <li>Overfeeds: {persistedStats.overfeeds || 0}</li>
        <li>Battles: {persistedStats.battles || 0}</li>
        <li>Battles Won: {persistedStats.battlesWon || 0}</li>
        <li>Battles Lost: {persistedStats.battlesLost || 0}</li>
        <li>Battles for Evolution: {persistedStats.battlesForEvolution || 0}</li>
      </ul>

      {devMode && canEdit && (
        <div className="mt-2 border p-2 text-sm">
          <h3 className="font-bold mb-1">[Dev Mode] 스탯 수정</h3>

          <label className="block mt-1">
            Fullness:
            <select value={fullness} onChange={numericIntent("fullness")} className="border ml-2">
              {possibleFullness.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label className="block mt-1">
            Strength:
            <select value={strength || 0} onChange={numericIntent("strength")} className="border ml-2">
              {possibleStrength.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label className="block mt-1">
            Effort:
            <select value={effort || 0} onChange={numericIntent("effort")} className="border ml-2">
              {possibleEffort.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label className="block mt-1">
            Energy:
            <select value={energy || 0} onChange={numericIntent("energy")} className="border ml-2">
              {possibleEnergy.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label className="block mt-1">
            Weight:
            <select value={weight} onChange={numericIntent("weight")} className="border ml-2">
              {possibleWeight.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label className="block mt-1">
            CareMistakes:
            <select value={careMistakes || 0} onChange={numericIntent("careMistakes")} className="border ml-2">
              {possibleMistakes.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label className="block mt-1">
            PoopCount:
            <select value={poopCount} onChange={numericIntent("poopCount")} className="border ml-2">
              {possiblePoop.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <div className="mt-2 pt-2 border-t border-gray-300">
            <h4 className="font-bold text-xs mb-1">부상 상태 테스트</h4>
            <button
              type="button"
              onClick={() => onBooleanChange?.("isInjured", !(isInjured || false))}
              className={`mt-1 flex w-full items-center justify-between rounded border px-3 py-2 text-left transition-colors ${
                isInjured
                  ? "border-red-400 bg-red-50 text-red-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
              aria-pressed={isInjured || false}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg leading-none" aria-hidden="true">{isInjured ? "☑" : "☐"}</span>
                <span>isInjured (부상 상태)</span>
              </span>
              <span className="text-xs font-semibold">{isInjured ? "ON" : "OFF"}</span>
            </button>

            <label className="block mt-1">
              injuries (부상 횟수):
              <select value={injuries || 0} onChange={numericIntent("injuries")} className="border ml-2">
                {possibleInjuries.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>

            <label className="block mt-1">
              healedDosesCurrent (치료제 투여 횟수):
              <select value={healedDosesCurrent || 0} onChange={numericIntent("healedDosesCurrent")} className="border ml-2">
                {possibleHealedDoses.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}
    </>
  );
}
