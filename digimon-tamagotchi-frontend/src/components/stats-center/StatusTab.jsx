import React, { useState } from "react";

/** 일반 사용자에게 공개하는 최소 현재 상태 필드만 표시합니다. */
export default function StatusTab({
  items = [],
  sleepDisturbanceHistory = {},
}) {
  const [isSleepHistoryOpen, setIsSleepHistoryOpen] = useState(false);
  const {
    counter = 0,
    detailCount = 0,
    hasMissingDetails = false,
    isLegacyRange = false,
    entries = [],
  } = sleepDisturbanceHistory || {};
  const canExpandSleepHistory = counter > 0;
  const historyPanelId = "stats-center-sleep-disturbance-history";

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-gray-900">현재 상태</h3>
        <p className="mt-1 text-xs text-gray-500">
          현재 저장된 핵심 스탯을 읽기 전용으로 표시합니다.
        </p>
      </div>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        {items.map((item) => {
          if (item.key !== "sleepDisturbances" || !canExpandSleepHistory) {
            return (
              <div
                key={item.key}
                className="flex items-center justify-between gap-4 border-b border-gray-100 px-3 py-2.5 last:border-b-0"
              >
                <span className="text-sm text-gray-600">{item.label}</span>
                <span className="text-right text-sm font-bold tabular-nums text-gray-900">
                  {item.value}
                </span>
              </div>
            );
          }

          return (
            <div key={item.key} className="border-b border-gray-100 last:border-b-0">
              <button
                type="button"
                onClick={() => setIsSleepHistoryOpen((isOpen) => !isOpen)}
                aria-expanded={isSleepHistoryOpen}
                aria-controls={historyPanelId}
                className="flex w-full items-center justify-between gap-4 px-3 py-2.5 text-left hover:bg-gray-50"
              >
                <span className="text-sm text-gray-600">{item.label}</span>
                <span className="flex items-center gap-2 text-right text-sm font-bold tabular-nums text-gray-900">
                  <span>{item.value}</span>
                  <span className="text-xs text-gray-500" aria-hidden="true">
                    {isSleepHistoryOpen ? "▲" : "▼"}
                  </span>
                </span>
              </button>

              {isSleepHistoryOpen && (
                <div
                  id={historyPanelId}
                  role="region"
                  aria-label="수면 방해 이력"
                  className="space-y-2 border-t border-gray-100 bg-gray-50 px-3 py-3"
                >
                  <div className="text-xs font-bold text-gray-700">수면 방해 이력</div>
                  {hasMissingDetails && (
                    <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                      카운트 {counter}회 · 상세 기록 {detailCount}건
                    </p>
                  )}
                  {isLegacyRange && (
                    <p className="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">
                      단계 시작 시각이 없어 보유 중인 수면 방해 기록을 모두 표시합니다.
                    </p>
                  )}
                  {entries.length === 0 ? (
                    <p className="rounded border border-gray-200 bg-white p-2 text-xs text-gray-600">
                      수면 방해 상세 기록이 없습니다. (보관 한도 또는 레거시 데이터)
                    </p>
                  ) : (
                    <div className="max-h-52 space-y-2 overflow-y-auto">
                      {entries.map((entry) => (
                        <article
                          key={entry.id}
                          className="rounded border border-orange-200 bg-white p-2 text-xs"
                        >
                          <div className="font-semibold text-orange-700">{entry.text}</div>
                          <div className="mt-1 text-gray-500">{entry.timestampLabel}</div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
