import React, { useState } from "react";
import { toEpochMs } from "../../utils/time";
import DiagnosticNotice from "./DiagnosticNotice";

function renderCallDetail(call) {
  if (!call) return null;

  const statusClass = call.isPaused
    ? "text-blue-600"
    : call.type === "sleep"
      ? "text-amber-600"
      : "text-red-600";
  const riskClass = call.type === "sleep" ? "text-amber-700" : "text-red-600";

  return (
    <div className="ml-2">
      <div className="text-[11px] font-semibold text-red-500">호출 진행 중</div>
      <div className={`font-semibold ${statusClass}`}>{call.statusLabel}</div>
      <div className="mt-1 text-xs text-gray-600">{call.reason}</div>
      {call.pauseReason ? (
        <div className="mt-1 text-xs text-blue-600">{call.pauseReason}</div>
      ) : null}
      {call.deadlineText ? (
        <div className="mt-1 text-[10px] text-gray-500">{call.deadlineText}</div>
      ) : null}
      <div className={`mt-1 text-xs ${riskClass}`}>{call.riskText}</div>
    </div>
  );
}

function CareMistakeHistory({ entries, formatTimestamp }) {
  const [isOpen, setIsOpen] = useState(false);
  const sortedEntries = [...(entries || [])].sort(
    (a, b) => (b.occurredAt || 0) - (a.occurredAt || 0)
  );

  return (
    <div className="mt-2 border-t pt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left flex items-center justify-between py-1 px-2 hover:bg-gray-100 rounded transition-colors"
      >
        <span className="text-sm font-semibold text-gray-700">
          현재 활성 케어미스 이력 ({sortedEntries.length}건)
        </span>
        <span className="text-gray-500 text-xs">
          {isOpen ? "▲ 접기" : "▼ 펼치기"}
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
          {sortedEntries.length === 0 ? (
            <div className="text-xs p-2 bg-gray-50 border border-gray-200 rounded text-gray-600">
              현재 활성 케어미스 이력이 없습니다. (놀아주기/간식주기로 해소되었거나 로그가 아직 기록되지 않았을 수 있습니다)
            </div>
          ) : (
            sortedEntries.map((entry, index) => {
              const timestamp = toEpochMs(entry.occurredAt);
              const isLegacyRecovery =
                entry.source === "legacy_recovery" ||
                entry.originalOccurredAtKnown === false;
              const formattedTime = isLegacyRecovery
                ? "복구된 기록 · 실제 시각 알 수 없음"
                : timestamp
                  ? formatTimestamp(timestamp)
                  : "시간 정보 없음";
              const isSyncEntry = entry.source === "sync" || isLegacyRecovery;

              return (
                <div
                  key={index}
                  className={`text-xs p-2 border rounded ${isSyncEntry ? "bg-yellow-50 border-yellow-200" : "bg-orange-50 border-orange-200"}`}
                >
                  <div className={`font-semibold ${isSyncEntry ? "text-yellow-700" : "text-orange-700"}`}>
                    {entry.text || "케어미스 발생"}
                  </div>
                  <div className={`${isSyncEntry ? "text-yellow-700" : "text-orange-600"} mt-1`}>
                    {formattedTime}
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

export default function CareHistorySection({
  fullness,
  strength,
  lastHungerZeroAt,
  lastStrengthZeroAt,
  isFrozen,
  visibleSleepStatus,
  activeCallMap,
  isSleepLightCareMistakeProcessed,
  sleepStatusLabel,
  isLightsOn,
  careMistakeHistoryEntries,
  careMistakeDiagnosticMessage,
  formatTimestamp,
}) {
  return (
    <div className="border-b pb-2">
      <h3 className="font-bold text-base mb-2">5. 케어미스 발생 조건</h3>
      <ul className="space-y-2 text-sm">
        <li className="border-l-4 pl-2" style={{ borderColor: fullness === 0 ? "#ef4444" : "#e5e7eb" }}>
          <div className="font-semibold">🍖 Hunger Call (배고픔 호출)</div>
          <div className="text-xs text-gray-600 ml-2">조건: Fullness = 0</div>
          {fullness === 0 ? (
            activeCallMap.get("hunger") ? (
              renderCallDetail(activeCallMap.get("hunger"))
            ) : lastHungerZeroAt ? (
              <div className="text-amber-600 font-semibold ml-2">
                ⚠️ 케어미스 반영 후 호출 종료 - 현재 활성 케어미스는 없지만 0 상태 12시간 카운터는 계속 진행 중
              </div>
            ) : (
              <div className="text-yellow-600 ml-2">호출 대기 중...</div>
            )
          ) : (
            <div className="text-green-600 ml-2">✓ 조건 미충족 (Fullness: {fullness})</div>
          )}
        </li>

        <li className="border-l-4 pl-2" style={{ borderColor: strength === 0 ? "#ef4444" : "#e5e7eb" }}>
          <div className="font-semibold">💪 Strength Call (힘 호출)</div>
          <div className="text-xs text-gray-600 ml-2">조건: Strength = 0</div>
          {strength === 0 ? (
            activeCallMap.get("strength") ? (
              renderCallDetail(activeCallMap.get("strength"))
            ) : lastStrengthZeroAt ? (
              <div className="text-amber-600 font-semibold ml-2">
                ⚠️ 케어미스 반영 후 호출 종료 - 현재 활성 케어미스는 없지만 0 상태 12시간 카운터는 계속 진행 중
              </div>
            ) : (
              <div className="text-yellow-600 ml-2">호출 대기 중...</div>
            )
          ) : (
            <div className="text-green-600 ml-2">✓ 조건 미충족 (Strength: {strength})</div>
          )}
        </li>

        {isFrozen ? (
          <li className="border-l-4 pl-2 border-blue-300">
            <div className="font-semibold">💡 수면 조명 경고</div>
            <div className="text-blue-600 ml-2">🧊 냉장고 상태에서는 수면 개념이 없습니다</div>
          </li>
        ) : (
          <li
            className="border-l-4 pl-2"
            style={{ borderColor: visibleSleepStatus === "SLEEPING_LIGHT_ON" || activeCallMap.get("sleep") ? "#f59e0b" : "#e5e7eb" }}
          >
            <div className="font-semibold">💡 수면 조명 경고</div>
            <div className="text-xs text-gray-600 ml-2">조건: 수면 중 + 불 켜짐</div>
            {activeCallMap.get("sleep") ? (
              renderCallDetail(activeCallMap.get("sleep"))
            ) : isSleepLightCareMistakeProcessed ? (
              <div className="text-red-600 font-semibold ml-2">케어미스 처리됨 · 불은 아직 켜져 있음</div>
            ) : visibleSleepStatus === "SLEEPING_LIGHT_ON" ? (
              <div className="text-yellow-600 ml-2">호출 대기 중...</div>
            ) : (
              <div className="text-green-600 ml-2">
                ✓ 조건 미충족 (수면 상태: {sleepStatusLabel}, 불: {isLightsOn ? "켜짐" : "꺼짐"})
              </div>
            )}
          </li>
        )}
      </ul>

      <CareMistakeHistory
        entries={careMistakeHistoryEntries}
        formatTimestamp={formatTimestamp}
      />
      <DiagnosticNotice>{careMistakeDiagnosticMessage}</DiagnosticNotice>
    </div>
  );
}
