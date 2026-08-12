import React from "react";

/** 일반 사용자에게 공개하는 최소 현재 상태 필드만 표시합니다. */
export default function StatusTab({ items = [] }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-gray-900">현재 상태</h3>
        <p className="mt-1 text-xs text-gray-500">
          현재 저장된 핵심 스탯을 읽기 전용으로 표시합니다.
        </p>
      </div>

      <dl className="overflow-hidden rounded border border-gray-200 bg-white">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-4 border-b border-gray-100 px-3 py-2.5 last:border-b-0"
          >
            <dt className="text-sm text-gray-600">{item.label}</dt>
            <dd className="text-right text-sm font-bold tabular-nums text-gray-900">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
