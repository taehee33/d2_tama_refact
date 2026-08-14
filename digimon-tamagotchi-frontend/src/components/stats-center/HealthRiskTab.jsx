import React from "react";

const RISK_STYLES = Object.freeze({
  inactive: {
    card: "border-gray-200 bg-gray-50 opacity-70",
    accent: "bg-gray-300",
    badge: "bg-gray-200 text-gray-600",
  },
  active: {
    card: "border-amber-200 bg-amber-50",
    accent: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800",
  },
  paused: {
    card: "border-blue-200 bg-blue-50",
    accent: "bg-blue-500",
    badge: "bg-blue-100 text-blue-800",
  },
  danger: {
    card: "border-red-300 bg-red-50",
    accent: "bg-red-600",
    badge: "bg-red-100 text-red-800",
  },
  dead: {
    card: "border-red-400 bg-red-50",
    accent: "bg-red-800",
    badge: "bg-red-200 text-red-900",
  },
});

function RiskGauge({ item }) {
  const { gauge } = item;
  const styles = RISK_STYLES[item.state] || RISK_STYLES.inactive;

  if (gauge.available === false) {
    return (
      <p className="mt-3 text-[10px] font-medium text-gray-500">
        시간 기록 없음 · 게이지를 계산할 수 없습니다.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-label={`${item.title} ${gauge.label}`}
        aria-valuemin="0"
        aria-valuemax={gauge.max}
        aria-valuenow={gauge.value}
      >
        {Array.from({ length: gauge.segmentCount }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={`min-w-0 flex-1 border-r border-white last:border-r-0 ${
              index < gauge.filledSegments ? styles.accent : "bg-gray-300"
            }`}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-gray-500">{gauge.label}</p>
    </div>
  );
}

function RiskCard({ item }) {
  const styles = RISK_STYLES[item.state] || RISK_STYLES.inactive;

  return (
    <article className={`overflow-hidden rounded border ${styles.card}`}>
      <div className="flex items-start gap-3 p-3">
        <span className={`mt-0.5 h-10 w-1 flex-shrink-0 rounded-full ${styles.accent}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-gray-900">{item.title}</h4>
              <p className="mt-0.5 text-[11px] text-gray-600">{item.rule}</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${styles.badge}`}>
              {item.statusText}
            </span>
          </div>

          <dl className="mt-3 space-y-1.5">
            {item.details.map((detail) => (
              <div key={detail.label} className="flex items-start justify-between gap-3 text-xs">
                <dt className="flex-shrink-0 text-gray-500">{detail.label}</dt>
                <dd className="break-words text-right font-medium tabular-nums text-gray-800">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>

          <RiskGauge item={item} />
        </div>
      </div>
    </article>
  );
}

/** 사망·질병 위험 카운터와 상한 없는 누적 수명을 읽기 전용으로 표시합니다. */
export default function HealthRiskTab({ items = [], lifespanInfo = null }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-gray-900">사망·질병 위험</h3>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          위험 조건의 현재 진행도입니다. 이 화면은 값을 변경하거나 저장하지 않습니다.
        </p>
      </div>

      {lifespanInfo && (
        <aside
          className={`rounded border px-3 py-3 ${
            lifespanInfo.state === "paused"
              ? "border-blue-200 bg-blue-50"
              : lifespanInfo.state === "dead"
                ? "border-red-200 bg-red-50"
              : "border-gray-200 bg-white"
          }`}
          aria-label="누적 수명 참고 정보"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-gray-500">{lifespanInfo.label}</p>
              <p className="mt-1 text-base font-bold tabular-nums text-gray-900">
                {lifespanInfo.value}
              </p>
            </div>
            <p className={`text-xs font-bold ${
              lifespanInfo.state === "paused"
                ? "text-blue-700"
                : lifespanInfo.state === "dead"
                  ? "text-red-700"
                  : "text-gray-500"
            }`}>
              {lifespanInfo.statusText}
            </p>
          </div>
          {lifespanInfo.stoppedAtLabel && (
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-red-100 pt-2 text-[11px]">
              <span className="text-gray-500">{lifespanInfo.stoppedAtLabel}</span>
              <span className="font-medium tabular-nums text-gray-700">
                {lifespanInfo.stoppedAtValue}
              </span>
            </div>
          )}
        </aside>
      )}

      <div className="space-y-3">
        {items.map((item) => <RiskCard key={item.key} item={item} />)}
      </div>
    </section>
  );
}
