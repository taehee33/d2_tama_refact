import React from "react";
import { formatTimestamp } from "../../utils/dateUtils";
import {
  formatStatsPopupDuration,
  formatStatsPopupValueWithOverflow,
} from "./statsPopupViewModel";

/** StatsPopup New 탭의 개요, 진화 및 내부 카운터 프레젠터입니다. */
export default function StatsOverviewSection({
  stats,
  sourceStats,
  overview,
  isSleepingLikeStatus,
  part = "all",
}) {
  const {
    age, weight, fullness, strength, energy, winRate, isInjured, isDead,
    poopCount = 0, maxEnergy, maxStamina, minWeight, careMistakes,
    trainings = 0, overfeeds = 0, sleepDisturbances = 0, battles = 0,
    battlesWon = 0, battlesLost = 0, totalBattles = 0, totalBattlesWon = 0,
    totalBattlesLost = 0, totalReincarnations = 0, normalReincarnations = 0,
    perfectReincarnations = 0, isFrozen = false,
    poopReachedMaxAt: rawPoopReachedMaxAt = null,
    lastPoopPenaltyAt: rawLastPoopPenaltyAt = null,
    lastMaxPoopTime = null, lifespanSeconds, timeToEvolveSeconds,
  } = stats || {};
  const persistedStats = sourceStats || {};
  const poopReachedMaxAt = rawPoopReachedMaxAt ?? lastMaxPoopTime;
  const lastPoopPenaltyAt = rawLastPoopPenaltyAt ?? poopReachedMaxAt;
  const {
    speciesData, sleepTime, speciesHungerTimer, speciesStrengthTimer,
    speciesPower, speciesHealDoses, wakeEnergyRecoveryText,
    nextEnergyRecoveryText, hungerTimerDisplay, strengthTimerDisplay,
    poopTimerDisplay,
  } = overview;

  return (
    <>
      {part !== "counters" && (
        <>
      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">1. 종(Species) 고정 파라미터</h3>
        <ul className="space-y-1">
          <li>Power: {speciesPower}</li>
          <li>Min Weight: {speciesData.minWeight || minWeight || 0}</li>
          <li>Sleep Time: {sleepTime}</li>
          <li>Heal Doses: {speciesHealDoses}</li>
          <li>Energy (DP): {speciesData.maxEnergy || maxEnergy || maxStamina || 0}</li>
          <li>Hunger Loss: {speciesHungerTimer} Minutes</li>
          <li>Strength Loss: {speciesStrengthTimer} Minutes</li>
        </ul>
      </div>

      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">2. 개체(Instance) 상태값</h3>
        <ul className="space-y-1">
          <li>Age: {age || 0} days</li>
          <li>Weight: {weight || 0}g</li>
          <li>Hunger (Fullness): {formatStatsPopupValueWithOverflow(fullness)}/5</li>
          <li>Strength: {formatStatsPopupValueWithOverflow(strength || 0)}/5</li>
          <li className="ml-4 text-xs text-gray-600">
            • Protein Overdose: {persistedStats.proteinOverdose || 0}/7
            {persistedStats.proteinOverdose > 0 && (
              <span className="text-red-600 ml-1">
                (배틀 패배 시 부상 확률: {10 + (persistedStats.proteinOverdose || 0) * 10}%)
              </span>
            )}
          </li>
          <li>Energy (Current): {energy || 0}/{maxEnergy || maxStamina || 0}</li>
          <li className="ml-4 text-xs text-gray-600">• 기상 시간 회복 (max): {wakeEnergyRecoveryText}</li>
          <li className="ml-4 text-xs text-gray-600">• 30분마다 회복 (+1): {nextEnergyRecoveryText}</li>
          <li>Win Ratio: {winRate || 0}%</li>
          <li className="mt-2 pt-1 border-t">Flags:</li>
          <li>- isSleeping: {isSleepingLikeStatus ? "Yes" : "No"}</li>
          <li>- isInjured: {isInjured ? "Yes" : "No"}</li>
          <li>- isDead: {isDead ? "Yes" : "No"}</li>
          <li>- PoopCount: {poopCount}/8</li>
          <li>- Sick: {isInjured ? "Yes" : "No"}</li>
        </ul>
      </div>

      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">3. 행동 델타 규칙 (Action Delta)</h3>
        <ul className="space-y-1 font-mono text-xs">
          <li>Food: W+1, Hun+1</li>
          <li>Protein: W+2, Str+1, En+1</li>
          <li>Train: W-2, En-1, Str+1(Success)</li>
          <li>Battle: W-4, En-1</li>
        </ul>
      </div>

        </>
      )}

      {part !== "summary" && (
        <>

      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">6. 진화 판정 카운터</h3>
        <ul className="space-y-1">
          <li title="현재 시스템에서는 아직 해소되지 않은 케어미스 수를 표시합니다. 놀아주기/간식주기로 감소할 수 있으며, 진화 판정도 현재 값을 그대로 사용합니다.">
            Care Mistakes: {careMistakes || 0}
            <span className="text-gray-500 text-xs font-normal ml-1">(현재 활성 기준, 감소 가능)</span>
          </li>
          <li>Training Count: {trainings || 0}</li>
          <li>Overfeeds: {overfeeds || 0}</li>
          <li title="실제로 잠든 상태에서 강제로 깨운 횟수만 집계됩니다.">Sleep Disturbances: {sleepDisturbances || 0} (진화 구간 기준)</li>
          <li className="mt-2 pt-1 border-t"><strong>배틀 기록 (현재 디지몬):</strong></li>
          <li className="ml-2">배틀: {battles || 0} (승: {battlesWon || 0}, 패: {battlesLost || 0})</li>
          <li className="ml-2">승률: {battles > 0 ? Math.round((battlesWon / battles) * 100) : 0}%</li>
          <li className="mt-2 pt-1 border-t"><strong>배틀 기록 (이번 생애):</strong></li>
          <li className="ml-2">총 배틀: {totalBattles || 0} (승: {totalBattlesWon || 0}, 패: {totalBattlesLost || 0})</li>
          <li className="ml-2">총 승률: {totalBattles > 0 ? Math.round((totalBattlesWon / totalBattles) * 100) : 0}%</li>
          <li className="mt-2 pt-1 border-t"><strong>환생 기록:</strong></li>
          <li className="ml-2">토탈 환생 횟수: {totalReincarnations || 0}회</li>
          <li className="ml-2">일반 사망 환생: {normalReincarnations || 0}회</li>
          <li className="ml-2">Perfect 이상 환생: {perfectReincarnations || 0}회</li>
        </ul>
      </div>

      <div className="border-b pb-2">
        <h3 className="font-bold text-base mb-2">7. 내부/고급 카운터</h3>
        {isFrozen && (
          <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded">
            <div className="text-blue-600 font-semibold text-sm">🧊 냉장고에 넣어서 얼어서 멈춤</div>
            <div className="text-[10px] text-blue-500 mt-1">모든 타이머가 멈춰있습니다. 냉장고에서 꺼내면 타이머가 다시 시작됩니다.</div>
          </div>
        )}
        <ul className="space-y-1">
          <li>HungerTimer: {hungerTimerDisplay.label}{hungerTimerDisplay.showCountdown ? ` (남은 시간: ${hungerTimerDisplay.countdownLabel})` : ""}{isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
          <li>StrengthTimer: {strengthTimerDisplay.label}{strengthTimerDisplay.showCountdown ? ` (남은 시간: ${strengthTimerDisplay.countdownLabel})` : ""}{isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
          <li>PoopTimer: {poopTimerDisplay.label}{poopTimerDisplay.showCountdown ? ` (남은 시간: ${poopTimerDisplay.countdownLabel})` : ""}{isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
          <li>PoopCount: {poopCount}/8 {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
          <li>PoopReachedMaxAt: {formatTimestamp(poopReachedMaxAt)}</li>
          <li>LastPoopPenaltyAt: {formatTimestamp(lastPoopPenaltyAt)}</li>
          <li>Lifespan: {formatStatsPopupDuration(lifespanSeconds)} {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
          <li>Time to Evolve: {formatStatsPopupDuration(timeToEvolveSeconds)} {isFrozen && <span className="text-blue-600 text-xs">🧊 멈춤</span>}</li>
        </ul>
      </div>
        </>
      )}
    </>
  );
}
