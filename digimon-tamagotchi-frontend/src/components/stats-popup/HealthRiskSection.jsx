import React, { useState } from "react";
import { formatTimestamp as formatTimestampUtil } from "../../utils/dateUtils";
import { getDisplayInjuryEntries } from "../../logic/stats/injuryHistory";
import { toEpochMs } from "../../utils/time";
import {
  formatStatsPopupDuration,
  getStatsPopupElapsedTimeExcludingFridge as getElapsedTimeExcludingFridge,
} from "./statsPopupViewModel";
import DiagnosticNotice from "./DiagnosticNotice";

const formatTimestamp = formatTimestampUtil;

function ensureTimestamp(value) {
  return toEpochMs(value);
}

/**
 * 부상 이력 아코디언 컴포넌트
 * activityLogs / battleLogs를 이번 생 기준으로 정규화해 부상 카운터와 범위를 맞춘다.
 */
function InjuryHistory({
  activityLogs,
  battleLogs = [],
  formatTimestamp,
  currentLifeStartedAt = null,
  selectedDigimonId = null,
  slotVersion = "Ver.1",
  digimonDataMap = null,
  injuryLogs = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const displayLogs =
    injuryLogs ||
    getDisplayInjuryEntries({
      activityLogs,
      battleLogs,
      currentLifeStartedAt,
      currentDigimonId: selectedDigimonId,
      slotVersion,
      digimonDataMap,
    });

  return (
    <div className="mt-2 border-t pt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left flex items-center justify-between py-1 px-2 hover:bg-gray-100 rounded transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">
            부상 이력 ({displayLogs.length}건)
          </span>
          <span className="text-[10px] text-gray-400">이번 생 기준</span>
        </div>
        <span className="text-gray-500 text-xs">
          {isOpen ? '▲ 접기' : '▼ 펼치기'}
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
          {displayLogs.length === 0 ? (
            <div className="text-xs p-2 bg-gray-50 border border-gray-200 rounded text-gray-600">
              이번 생 부상 이력이 없습니다. (로그가 아직 기록되지 않았을 수 있습니다)
            </div>
          ) : (
            displayLogs.map((log, index) => {
              const timestamp = ensureTimestamp(log.timestamp);
              const formattedTime = timestamp ? formatTimestamp(timestamp) : '시간 정보 없음';
              const digimonLabel = log.digimonName || log.digimonId || "확인 불가";

              // 부상 원인 추출
              let injuryType = '부상 발생';
              let bgColor = 'bg-red-50';
              let borderColor = 'border-red-200';
              let textColor = 'text-red-700';

              if (log.normalizedReason === 'poop') {
                injuryType = '💩 똥 8개로 인한 부상';
                bgColor = 'bg-brown-50';
                borderColor = 'border-brown-200';
                textColor = 'text-brown-700';
              } else if (log.normalizedReason === 'battle') {
                injuryType = '⚔️ 배틀로 인한 부상';
                bgColor = 'bg-purple-50';
                borderColor = 'border-purple-200';
                textColor = 'text-purple-700';
              }

              return (
                <div
                  key={index}
                  className={`text-xs p-2 ${bgColor} border ${borderColor} rounded`}
                >
                  <div className={`font-semibold ${textColor}`}>
                    {injuryType}
                  </div>
                  <div className={`${textColor} mt-1 text-[10px]`}>
                    {log.text}
                  </div>
                  <div className={`${textColor.replace('700', '600')} mt-1 text-[10px]`}>
                    {formattedTime}
                  </div>
                  <div className={`${textColor.replace('700', '600')} mt-1 text-[10px]`}>
                    당시 디지몬: {digimonLabel}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/** StatsPopup의 사망·질병 위험과 부상 이력을 표시하는 프레젠터입니다. */
export default function HealthRiskSection({
  currentStats,
  stats,
  displayActivityLogs,
  currentLifeStartedAt,
  selectedDigimonId,
  slotVersion,
  digimonDataMap,
  injuryHistoryEntries,
  injuryDiagnosticMessage,
}) {
  const {
    fullness,
    lifespanSeconds,
    isDead,
    deathReason = null,
    strength,
    poopCount = 0,
    poopReachedMaxAt: rawPoopReachedMaxAt = null,
    lastPoopPenaltyAt: rawLastPoopPenaltyAt = null,
    lastMaxPoopTime: legacyLastMaxPoopTime = null,
    lastHungerZeroAt = null,
    hungerZeroFrozenDurationMs = 0,
    lastStrengthZeroAt = null,
    strengthZeroFrozenDurationMs = 0,
    isInjured = false,
    injuredAt = null,
    injuryFrozenDurationMs = 0,
    injuries = 0,
    isFrozen = false,
    frozenAt = null,
    takeOutAt = null,
    poopPenaltyFrozenDurationMs = 0,
  } = currentStats || {};
  const poopReachedMaxAt = rawPoopReachedMaxAt ?? legacyLastMaxPoopTime;
  const lastPoopPenaltyAt = rawLastPoopPenaltyAt ?? poopReachedMaxAt;

  return (
      <div className="pb-2">
        <h3 className="font-bold text-base mb-2 text-red-700 flex items-center">
          <span className="mr-2">⚠️</span> 8. 사망/질병 카운터
        </h3>
        <ul className="space-y-3 text-sm">
          {/* 배고픔 0 사망 카운터 - 항상 표시 */}
          {(() => {
            const hungerZeroTime = ensureTimestamp(lastHungerZeroAt);
            const isActive = fullness === 0 && hungerZeroTime;
            const isDeadFromStarvation = isDead && deathReason === 'STARVATION (굶주림)';

            return (
              <li className={`border-l-4 pl-2 p-2 rounded ${isActive || isDeadFromStarvation ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50 opacity-60'}`}>
                <div className={`font-semibold mb-1 ${isActive || isDeadFromStarvation ? 'text-red-600' : 'text-gray-500'}`}>
                  🍖 배고픔 0 지속:
                </div>
                <div className="space-y-1 text-xs">
                  {hungerZeroTime ? (
                    <>
                      <div className="text-gray-600">
                        배고픔 0 발생 시간: <span className="font-mono">{formatTimestamp(hungerZeroTime)}</span>
                      </div>
                      {isDeadFromStarvation ? (
                        <div className="text-red-800 font-bold">💀 사망 (카운터 정지)</div>
                      ) : isActive ? (() => {
                        const nowMs = Date.now();
                        const elapsedMs = getElapsedTimeExcludingFridge(hungerZeroTime, nowMs, frozenAt, takeOutAt, hungerZeroFrozenDurationMs);
                        const elapsed = Math.floor(elapsedMs / 1000);
                        const threshold = 43200; // 12시간(초)
                        const remaining = Math.max(0, threshold - elapsed);
                        const deathDeadlineMs = hungerZeroTime + threshold * 1000;
                        if (isFrozen) {
                          return (
                            <div className="text-blue-600 font-semibold">
                              🧊 냉장고에 넣어서 얼어서 멈춤
                              <div className="text-[10px] text-blue-500 mt-1">
                                (냉장고에서 꺼내면 타이머가 다시 시작됩니다)
                              </div>
                            </div>
                          );
                        }
                        return remaining > 0 ? (
                          <div className="text-red-600 font-mono">
                            {Math.floor(remaining / 3600)}시간 {Math.floor((remaining % 3600) / 60)}분 {remaining % 60}초 남음
                            <div className="text-[10px] text-red-500 mt-1">(12시간 초과 시 사망)</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">데드라인: {formatTimestamp(deathDeadlineMs)}</div>
                          </div>
                        ) : (
                          <div className="text-red-800 font-bold">⚠️ 사망 위험!</div>
                        );
                      })(                      ) : (
                        <div className="text-gray-500">
                          ✓ 조건 미충족 (현재 배고픔: {fullness})
                          {isFrozen && (
                            <div className="text-blue-600 font-semibold mt-1">
                              🧊 냉장고에 넣어서 얼어서 멈춤 (타이머가 멈춰있습니다)
                            </div>
                          )}
                        </div>
                      )}
                      {(isActive || isDeadFromStarvation) && (
                        <>
                          <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mt-2 mb-1">
                            {(() => {
                              const nowMs = Date.now();
                              return [...Array(12)].map((_, i) => {
                                const elapsedMs = isDeadFromStarvation
                                  ? 43200 * 1000
                                  : getElapsedTimeExcludingFridge(hungerZeroTime, nowMs, frozenAt, takeOutAt, hungerZeroFrozenDurationMs);
                              const hourElapsed = Math.floor(elapsedMs / 1000 / 3600);
                              const isFilled = i < hourElapsed;
                              return (
                                <div
                                  key={i}
                                  className={`flex-1 border-r border-white last:border-0 ${
                                    isFilled
                                      ? hourElapsed >= 12
                                        ? 'bg-red-700'
                                        : hourElapsed >= 10
                                        ? 'bg-red-600'
                                        : hourElapsed >= 8
                                        ? 'bg-red-500'
                                        : 'bg-red-400'
                                      : 'bg-gray-300'
                                  }`}
                                  title={`${i + 1}시간 경과`}
                                />
                              );
                            });
                            })()}
                          </div>
                          <div className="text-[10px] text-gray-500">12시간 게이지 (각 박스 = 1시간)</div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-gray-500 mb-2">
                        조건 미충족 (배고픔 0 발생 이력 없음)
                        {isFrozen && (
                          <div className="text-blue-600 font-semibold mt-1">
                            🧊 냉장고에 넣어서 얼어서 멈춤 (타이머가 멈춰있습니다)
                          </div>
                        )}
                      </div>
                      {/* 조건 미충족 시에도 게이지 표시 (모두 회색) */}
                      <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mb-1">
                        {[...Array(12)].map((_, i) => (
                          <div
                            key={i}
                            className="flex-1 border-r border-white last:border-0 bg-gray-300"
                            title={`${i + 1}시간`}
                          />
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-500">12시간 게이지 (각 박스 = 1시간)</div>
                    </>
                  )}
                </div>
              </li>
            );
          })()}

          {/* 힘 0 사망 카운터 - 항상 표시 */}
          {(() => {
            const strengthZeroTime = ensureTimestamp(lastStrengthZeroAt);
            const isActive = strength === 0 && strengthZeroTime;
            const isDeadFromExhaustion = isDead && deathReason === 'EXHAUSTION (힘 소진)';

            return (
              <li className={`border-l-4 pl-2 p-2 rounded ${isActive || isDeadFromExhaustion ? 'border-orange-500 bg-orange-50' : 'border-gray-300 bg-gray-50 opacity-60'}`}>
                <div className={`font-semibold mb-1 ${isActive || isDeadFromExhaustion ? 'text-orange-600' : 'text-gray-500'}`}>
                  💪 힘 0 지속:
                </div>
                <div className="space-y-1 text-xs">
                  {strengthZeroTime ? (
                    <>
                      <div className="text-gray-600">
                        힘 0 발생 시간: <span className="font-mono">{formatTimestamp(strengthZeroTime)}</span>
                      </div>
                      {isDeadFromExhaustion ? (
                        <div className="text-orange-800 font-bold">💀 사망 (카운터 정지)</div>
                      ) : isActive ? (() => {
                        const nowMs = Date.now();
                        const elapsedMs = getElapsedTimeExcludingFridge(strengthZeroTime, nowMs, frozenAt, takeOutAt, strengthZeroFrozenDurationMs);
                        const elapsed = Math.floor(elapsedMs / 1000);
                        const threshold = 43200; // 12시간(초)
                        const remaining = Math.max(0, threshold - elapsed);
                        const deathDeadlineMs = strengthZeroTime + threshold * 1000;
                        if (isFrozen) {
                          return (
                            <div className="text-blue-600 font-semibold">
                              🧊 냉장고에 넣어서 얼어서 멈춤
                              <div className="text-[10px] text-blue-500 mt-1">
                                (냉장고에서 꺼내면 타이머가 다시 시작됩니다)
                              </div>
                            </div>
                          );
                        }
                        return remaining > 0 ? (
                          <div className="text-orange-600 font-mono">
                            {Math.floor(remaining / 3600)}시간 {Math.floor((remaining % 3600) / 60)}분 {remaining % 60}초 남음
                            <div className="text-[10px] text-orange-500 mt-1">(12시간 초과 시 사망)</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">데드라인: {formatTimestamp(deathDeadlineMs)}</div>
                          </div>
                        ) : (
                          <div className="text-orange-800 font-bold">⚠️ 사망 위험!</div>
                        );
                      })(                      ) : (
                        <div className="text-gray-500">
                          ✓ 조건 미충족 (현재 힘: {strength})
                          {isFrozen && (
                            <div className="text-blue-600 font-semibold mt-1">
                              🧊 냉장고에 넣어서 얼어서 멈춤 (타이머가 멈춰있습니다)
                            </div>
                          )}
                        </div>
                      )}
                      {(isActive || isDeadFromExhaustion) && (
                        <>
                          <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mt-2 mb-1">
                            {(() => {
                              const nowMs = Date.now();
                              return [...Array(12)].map((_, i) => {
                                const elapsedMs = isDeadFromExhaustion
                                  ? 43200 * 1000
                                  : getElapsedTimeExcludingFridge(strengthZeroTime, nowMs, frozenAt, takeOutAt, strengthZeroFrozenDurationMs);
                                const hourElapsed = Math.floor(elapsedMs / 1000 / 3600);
                                const isFilled = i < hourElapsed;
                                return (
                                  <div
                                    key={i}
                                    className={`flex-1 border-r border-white last:border-0 ${
                                      isFilled
                                        ? hourElapsed >= 12
                                          ? 'bg-orange-700'
                                          : hourElapsed >= 10
                                          ? 'bg-orange-600'
                                          : hourElapsed >= 8
                                          ? 'bg-orange-500'
                                          : 'bg-orange-400'
                                        : 'bg-gray-300'
                                    }`}
                                    title={`${i + 1}시간 경과`}
                                  />
                                );
                              });
                            })()}
                          </div>
                          <div className="text-[10px] text-gray-500">12시간 게이지 (각 박스 = 1시간)</div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-gray-500 mb-2">
                        조건 미충족 (힘 0 발생 이력 없음)
                        {isFrozen && (
                          <div className="text-blue-600 font-semibold mt-1">
                            🧊 냉장고에 넣어서 얼어서 멈춤 (타이머가 멈춰있습니다)
                          </div>
                        )}
                      </div>
                      {/* 조건 미충족 시에도 게이지 표시 (모두 회색) */}
                      <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mb-1">
                        {[...Array(12)].map((_, i) => (
                          <div
                            key={i}
                            className="flex-1 border-r border-white last:border-0 bg-gray-300"
                            title={`${i + 1}시간`}
                          />
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-500">12시간 게이지 (각 박스 = 1시간)</div>
                    </>
                  )}
                </div>
              </li>
            );
          })()}

          {/* 똥 가득참 부상 발생 시간 카운터 - 조건 충족 시 배고픔/힘처럼 진하게 표시 */}
          {(() => {
            const poopReachedTime = ensureTimestamp(poopReachedMaxAt);
            const poopPenaltyTime = ensureTimestamp(lastPoopPenaltyAt) || poopReachedTime;
            const isActive = poopCount >= 8 && poopReachedTime;

            return (
              <li className={`border-l-4 pl-2 p-2 rounded ${isActive ? 'border-amber-600 bg-amber-50' : 'border-gray-300 bg-gray-50 opacity-60'}`}>
                <div className={`font-semibold mb-1 ${isActive ? 'text-amber-800' : 'text-gray-500'}`}>
                  💩 똥 가득참 (8개):
                </div>
                <div className="space-y-1 text-xs">
                  {isActive ? (
                    <>
                      <div className={isActive ? 'text-amber-700' : 'text-gray-600'}>
                        즉시 부상 발생 시간: <span className="font-mono">{formatTimestamp(poopReachedTime)}</span>
                      </div>
                      {(() => {
                        if (!poopPenaltyTime) return null;

                        const nowMs = Date.now();
                        const elapsedMs = getElapsedTimeExcludingFridge(poopPenaltyTime, nowMs, frozenAt, takeOutAt, poopPenaltyFrozenDurationMs);
                        const elapsed = Math.max(0, Math.floor(elapsedMs / 1000));
                        const threshold = 28800; // 8시간 = 28800초
                        const nextInjuryIn = Math.max(0, threshold - (elapsed % threshold));
                        const hours = Math.floor(nextInjuryIn / 3600);
                        const minutes = Math.floor((nextInjuryIn % 3600) / 60);
                        const seconds = nextInjuryIn % 60;

                        // 냉장고 상태일 때 표시
                        if (isFrozen) {
                          return (
                            <>
                              <div className="text-blue-600 font-semibold">
                                🧊 냉장고에 넣어서 얼어서 멈춤
                                <div className="text-[10px] text-blue-500 mt-1">
                                  (냉장고에서 꺼내면 타이머가 다시 시작됩니다)
                                </div>
                              </div>
                              <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mt-2 mb-1">
                                {[...Array(8)].map((_, i) => {
                                  const hourElapsed = Math.floor((elapsed % threshold) / 3600);
                                  const isFilled = i < hourElapsed;
                                  return (
                                    <div
                                      key={i}
                                      className={`flex-1 border-r border-white last:border-0 ${
                                        isFilled
                                          ? hourElapsed >= 8
                                            ? 'bg-amber-700'
                                            : hourElapsed >= 6
                                            ? 'bg-amber-600'
                                            : hourElapsed >= 4
                                            ? 'bg-amber-500'
                                            : 'bg-amber-400'
                                          : 'bg-gray-300'
                                      }`}
                                      title={`${i + 1}시간 경과`}
                                    />
                                  );
                                })}
                              </div>
                              <div className="text-[10px] text-amber-600">
                                8시간 게이지 (각 박스 = 1시간, 8시간마다 추가 부상 발생)
                              </div>
                            </>
                          );
                        }

                        // 냉장고 상태가 아닐 때 정상 표시 (다음 부상 데드라인 = 현재 + nextInjuryIn)
                        const nextInjuryDeadlineMs = nowMs + nextInjuryIn * 1000;
                        return (
                          <>
                            <div className="text-amber-700 font-mono font-semibold">
                              다음 추가 부상까지: {hours}시간 {minutes}분 {seconds}초
                              <div className="text-[10px] text-amber-600 mt-0.5 font-normal">데드라인: {formatTimestamp(nextInjuryDeadlineMs)}</div>
                            </div>
                            <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mt-2 mb-1">
                              {[...Array(8)].map((_, i) => {
                                const hourElapsed = Math.floor((elapsed % threshold) / 3600);
                                const isFilled = i < hourElapsed;
                                return (
                                  <div
                                    key={i}
                                    className={`flex-1 border-r border-white last:border-0 ${
                                      isFilled
                                        ? hourElapsed >= 8
                                          ? 'bg-amber-700'
                                          : hourElapsed >= 6
                                          ? 'bg-amber-600'
                                          : hourElapsed >= 4
                                          ? 'bg-amber-500'
                                          : 'bg-amber-400'
                                        : 'bg-gray-300'
                                    }`}
                                    title={`${i + 1}시간 경과`}
                                  />
                                );
                              })}
                            </div>
                            <div className="text-[10px] text-amber-600">
                              8시간 게이지 (각 박스 = 1시간, 8시간마다 추가 부상 발생)
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <div className="text-gray-500 mb-2">
                        조건 미충족 (현재 똥: {poopCount || 0}/8)
                        {isFrozen && (
                          <div className="text-blue-600 font-semibold mt-1">
                            🧊 냉장고에 넣어서 얼어서 멈춤 (타이머가 멈춰있습니다)
                          </div>
                        )}
                      </div>
                      {/* 조건 미충족 시에도 게이지 표시 (모두 회색) */}
                      <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mb-1">
                        {[...Array(8)].map((_, i) => (
                          <div
                            key={i}
                            className="flex-1 border-r border-white last:border-0 bg-gray-300"
                            title={`${i + 1}시간`}
                          />
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-500">8시간 게이지 (각 박스 = 1시간)</div>
                    </>
                  )}
                </div>
              </li>
            );
          })()}

          {/* 부상 방치 사망 카운터 - 항상 표시 */}
          {(() => {
            const injuredTime = ensureTimestamp(injuredAt);
            const isActive = isInjured && injuredTime;
            const isDeadFromInjuryNeglect = isDead && deathReason === 'INJURY NEGLECT (부상 방치: 6시간)';

            return (
              <li className={`border-l-4 pl-2 p-2 rounded ${isActive || isDeadFromInjuryNeglect ? 'border-red-600 bg-red-50' : 'border-gray-300 bg-gray-50 opacity-60'}`}>
                <div className={`font-semibold mb-1 ${isActive || isDeadFromInjuryNeglect ? 'text-red-700' : 'text-gray-500'}`}>
                  🏥 부상 방치 (6시간):
                </div>
                <div className="space-y-1 text-xs">
                  {injuredTime ? (
                    <>
                      <div className="text-gray-600">
                        부상 발생 시간: <span className="font-mono">{formatTimestamp(injuredTime)}</span>
                      </div>
                      {isDeadFromInjuryNeglect ? (
                        <div className="text-red-800 font-bold">💀 사망 (6시간 방치)</div>
                      ) : isActive ? (() => {
                        // 부상 방치 경과: 매 렌더 시점의 현재 시각 사용(줄어들지 않는 버그 방지)
                        const nowMs = Date.now();
                        const elapsedMs = getElapsedTimeExcludingFridge(injuredTime, nowMs, frozenAt, takeOutAt, injuryFrozenDurationMs);
                        const elapsed = Math.floor(elapsedMs / 1000);
                        const threshold = 21600; // 6시간 = 21600초
                        const remaining = Math.max(0, threshold - elapsed);
                        const neglectDeadlineMs = injuredTime + threshold * 1000;
                        if (isFrozen) {
                          return (
                            <div className="text-blue-600 font-semibold">
                              🧊 냉장고에 넣어서 얼어서 멈춤
                              <div className="text-[10px] text-blue-500 mt-1">
                                (냉장고에서 꺼내면 타이머가 다시 시작됩니다)
                              </div>
                            </div>
                          );
                        }
                        return remaining > 0 ? (
                          <div className="text-red-600 font-mono">
                            {Math.floor(remaining / 3600)}시간 {Math.floor((remaining % 3600) / 60)}분 {remaining % 60}초 남음
                            <div className="text-[10px] text-red-500 mt-1">(6시간 초과 시 사망)</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">데드라인: {formatTimestamp(neglectDeadlineMs)}</div>
                          </div>
                        ) : (
                          <div className="text-red-800 font-bold">⚠️ 사망 위험!</div>
                        );
                      })(                      ) : (
                        <div className="text-gray-500">
                          ✓ 조건 미충족 (현재 부상 상태 아님)
                          {isFrozen && (
                            <div className="text-blue-600 font-semibold mt-1">
                              🧊 냉장고에 넣어서 얼어서 멈춤 (타이머가 멈춰있습니다)
                            </div>
                          )}
                        </div>
                      )}
                      {(isActive || isDeadFromInjuryNeglect) && (
                        <>
                          <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mt-2 mb-1">
                            {[...Array(6)].map((_, i) => {
                              const nowMs = Date.now();
                              const elapsedMs = isDeadFromInjuryNeglect
                                ? 21600 * 1000
                                : getElapsedTimeExcludingFridge(injuredTime, nowMs, frozenAt, takeOutAt, injuryFrozenDurationMs);
                              const hourElapsed = Math.floor(elapsedMs / 1000 / 3600);
                              const isFilled = i < hourElapsed;
                              return (
                                <div
                                  key={i}
                                  className={`flex-1 border-r border-white last:border-0 ${
                                    isFilled
                                      ? hourElapsed >= 6
                                        ? 'bg-red-700'
                                        : hourElapsed >= 5
                                        ? 'bg-red-600'
                                        : hourElapsed >= 4
                                        ? 'bg-red-500'
                                        : 'bg-red-400'
                                      : 'bg-gray-300'
                                  }`}
                                  title={`${i + 1}시간 경과`}
                                />
                              );
                            })}
                          </div>
                          <div className="text-[10px] text-gray-500">6시간 게이지 (각 박스 = 1시간)</div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-gray-500 mb-2">
                        조건 미충족 (부상 발생 이력 없음)
                        {isFrozen && (
                          <div className="text-blue-600 font-semibold mt-1">
                            🧊 냉장고에 넣어서 얼어서 멈춤 (타이머가 멈춰있습니다)
                          </div>
                        )}
                      </div>
                      {/* 조건 미충족 시에도 게이지 표시 (모두 회색) */}
                      <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mb-1">
                        {[...Array(6)].map((_, i) => (
                          <div
                            key={i}
                            className="flex-1 border-r border-white last:border-0 bg-gray-300"
                            title={`${i + 1}시간`}
                          />
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-500">6시간 게이지 (각 박스 = 1시간)</div>
                    </>
                  )}
                </div>
              </li>
            );
          })()}

          {/* 부상 과다 사망 카운터 - 항상 표시 */}
          {(() => {
            const isActive = (injuries || 0) >= 15;
            const isDeadFromInjuryOverload = isDead && deathReason === 'INJURY OVERLOAD (부상 과다: 15회)';

            return (
              <li className={`border-l-4 pl-2 p-2 rounded ${isActive || isDeadFromInjuryOverload ? 'border-red-600 bg-red-50' : 'border-gray-300 bg-gray-50 opacity-60'}`}>
                <div className={`font-semibold mb-1 ${isActive || isDeadFromInjuryOverload ? 'text-red-700' : 'text-gray-500'}`}>
                  🩹 부상 과다 (15회):
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-center mb-2">
                    <span className={`font-bold text-lg ${isActive || isDeadFromInjuryOverload ? 'text-red-700' : injuries >= 12 ? 'text-red-600' : injuries >= 10 ? 'text-orange-600' : 'text-gray-500'}`}>
                      {injuries || 0} / 15 회
                    </span>
                    {(isActive || isDeadFromInjuryOverload || injuries >= 12) && (
                      <span className="text-xs text-red-500 animate-pulse font-bold">⚠️ 경고!</span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 mb-2">
                    이번 생 누적 부상 횟수
                  </div>
                  {/* 부상 과다 게이지 */}
                  <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mb-1">
                    {[...Array(15)].map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 border-r border-white last:border-0 ${
                          i < (injuries || 0)
                            ? injuries >= 15
                              ? 'bg-red-700'
                              : injuries >= 12
                              ? 'bg-red-600'
                              : injuries >= 10
                              ? 'bg-orange-500'
                              : 'bg-red-400'
                            : 'bg-gray-300'
                        }`}
                        title={`부상 ${i + 1}회`}
                      />
                    ))}
                  </div>
                  {isDeadFromInjuryOverload ? (
                    <div className="text-red-800 font-bold">💀 사망 (부상 15회 도달)</div>
                  ) : isActive ? (
                    <div className="text-red-700 font-bold">⚠️ 사망 위험! (부상 15회 도달)</div>
                  ) : injuries >= 12 ? (
                    <div className="text-red-600 font-semibold">⚠️ 경고: 부상 횟수가 한도에 도달했습니다. 사망 위험이 매우 높습니다!</div>
                  ) : injuries >= 10 ? (
                    <div className="text-orange-500">※ 주의: 부상 횟수가 증가하고 있습니다.</div>
                  ) : (
                    <div className="text-gray-500">
                      조건 미충족 (이번 생 누적 부상: {injuries || 0}/15)
                    </div>
                  )}

                  {/* 부상 이력 아코디언 - 항상 표시 */}
                  <div className="mt-2">
                    <InjuryHistory
                      activityLogs={displayActivityLogs}
                      battleLogs={currentStats?.battleLogs || stats?.battleLogs || []}
                      formatTimestamp={formatTimestamp}
                      currentLifeStartedAt={currentLifeStartedAt}
                      selectedDigimonId={selectedDigimonId}
                      slotVersion={slotVersion}
                      digimonDataMap={digimonDataMap}
                      injuryLogs={injuryHistoryEntries}
                    />
                  </div>
                  <DiagnosticNotice>{injuryDiagnosticMessage}</DiagnosticNotice>
                </div>
              </li>
            );
          })()}

          {/* 수명 표시 (사망 기능 제거됨) */}
          {(() => {
            // 수명은 가변적이므로, 현재 수명을 기준으로 게이지 표시 (최대 20일 기준)
            const currentLifespan = lifespanSeconds || 0;
            const lifespanDays = Math.floor(currentLifespan / 86400);
            const maxDaysForDisplay = 20;

            return (
              <li className="border-l-4 pl-2 p-2 rounded border-gray-300 bg-gray-50">
                <div className="font-semibold mb-1 text-gray-500">
                  ⏰ 수명 :
                </div>
                <div className="space-y-1 text-xs">
                  <div className="text-gray-500 mb-2">
                    현재 수명: {formatStatsPopupDuration(currentLifespan)}
                    {isFrozen && (
                      <div className="text-blue-600 font-semibold mt-1">
                        🧊 냉장고에 넣어서 얼어서 멈춤 (수명이 증가하지 않습니다)
                      </div>
                    )}
                  </div>
                  {currentLifespan > 0 && (
                    <>
                      <div className="w-full bg-gray-200 h-3 rounded-full flex overflow-hidden mb-1">
                        {[...Array(maxDaysForDisplay)].map((_, i) => {
                          const isFilled = i < Math.min(lifespanDays, maxDaysForDisplay);
                          return (
                            <div
                              key={i}
                              className={`flex-1 border-r border-white last:border-0 ${
                                isFilled
                                  ? lifespanDays >= maxDaysForDisplay
                                    ? 'bg-gray-600'
                                    : lifespanDays >= 15
                                    ? 'bg-gray-500'
                                    : lifespanDays >= 10
                                    ? 'bg-gray-400'
                                    : 'bg-gray-300'
                                  : 'bg-gray-200'
                              }`}
                              title={`${i + 1}일 경과`}
                            />
                          );
                        })}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        수명 게이지 (현재: {lifespanDays}일, 최대 표시: 20일)
                        {isFrozen && <span className="text-blue-600 ml-1">🧊 멈춤</span>}
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })()}

        </ul>
      </div>

  );
}
