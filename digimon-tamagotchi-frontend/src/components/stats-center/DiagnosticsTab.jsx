import React, { useState } from "react";
import OperatorStatsEditor from "./OperatorStatsEditor";

/** 운영자용 진단 정보와 제한된 1차 스탯 편집 경계를 표시합니다. */
export default function DiagnosticsTab({
  sections = [],
  stats = {},
  digimonData = null,
  onSaveOperatorStats,
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <OperatorStatsEditor
        stats={stats}
        digimonData={digimonData}
        onSavePatch={onSaveOperatorStats}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <section className="space-y-4">
      <div
        className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        role="note"
      >
        운영자용 진단 정보입니다. 스탯 수정은 1차 허용 항목으로만 제한됩니다.
      </div>

      {typeof onSaveOperatorStats === "function" && (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="w-full rounded border border-blue-500 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
        >
          스탯 수정
        </button>
      )}

      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`stats-center-${section.key}-title`}>
          <h3
            id={`stats-center-${section.key}-title`}
            className="mb-2 text-sm font-bold text-gray-900"
          >
            {section.title}
          </h3>
          <dl className="overflow-hidden rounded border border-gray-200 bg-gray-50">
            {section.items.map((item) => (
              <div
                key={item.label}
                className="flex items-start justify-between gap-4 border-b border-gray-200 px-3 py-2 last:border-b-0"
              >
                <dt className="text-xs text-gray-600">{item.label}</dt>
                <dd className="max-w-[55%] break-words text-right text-xs font-medium tabular-nums text-gray-900">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </section>
  );
}
