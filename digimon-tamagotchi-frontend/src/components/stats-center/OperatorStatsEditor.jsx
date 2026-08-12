import React, { useMemo, useState } from "react";
import {
  buildChangedOperatorStatsPatch,
  buildOperatorStatsDraft,
  resolveOperatorMaxEnergy,
} from "../../logic/stats/operatorStatsEdit";

const NUMBER_FIELD_GROUPS = [
  {
    title: "기본 스탯",
    fields: [
      { field: "fullness", label: "배고픔", max: 5, suffix: "/5" },
      { field: "strength", label: "힘", max: 5, suffix: "/5" },
      { field: "energy", label: "에너지(DP)", dynamicMax: true },
      { field: "weight", label: "체중", suffix: "g" },
      { field: "poopCount", label: "배변 횟수", max: 8, suffix: "/8" },
    ],
  },
  {
    title: "관리·진화 카운터",
    fields: [
      { field: "careMistakes", label: "케어 미스", suffix: "회" },
      { field: "trainings", label: "훈련 횟수", suffix: "회" },
      { field: "overfeeds", label: "과식 횟수", suffix: "회" },
      { field: "proteinOverdose", label: "프로틴 과다 횟수", max: 7, suffix: "/7" },
      { field: "injuries", label: "부상 횟수", max: 15, suffix: "/15" },
    ],
  },
  {
    title: "현재 형태 배틀",
    fields: [
      { field: "battlesWon", label: "승리 횟수", suffix: "회" },
      { field: "battlesLost", label: "패배 횟수", suffix: "회" },
    ],
  },
];

export default function OperatorStatsEditor({
  stats = {},
  digimonData = null,
  onSavePatch,
  onCancel,
}) {
  const initialDraft = useMemo(
    () => buildOperatorStatsDraft(stats, digimonData),
    [digimonData, stats]
  );
  const maxEnergy = resolveOperatorMaxEnergy(stats, digimonData);
  const [draft, setDraft] = useState(initialDraft);
  const [touchedFields, setTouchedFields] = useState({});
  const [saveState, setSaveState] = useState({ status: "idle", message: "" });
  const isSaving = saveState.status === "saving";

  const handleNumberChange = (field) => (event) => {
    setDraft((previous) => ({ ...previous, [field]: event.target.value }));
    setTouchedFields((previous) => ({ ...previous, [field]: true }));
    setSaveState({ status: "idle", message: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const touchedDraft = Object.keys(touchedFields).reduce((nextDraft, field) => {
      nextDraft[field] = draft[field];
      return nextDraft;
    }, {});
    const patch = buildChangedOperatorStatsPatch(stats, touchedDraft, digimonData);
    if (Object.keys(patch).length === 0) {
      setSaveState({ status: "idle", message: "변경된 스탯이 없습니다." });
      return;
    }

    setSaveState({ status: "saving", message: "운영자 권한 확인 및 저장 중…" });
    try {
      await onSavePatch?.(patch);
      setDraft((previous) => ({ ...previous, ...patch }));
      setTouchedFields({});
      setSaveState({ status: "saved", message: "허용된 스탯을 저장했습니다." });
    } catch (error) {
      setSaveState({
        status: "failed",
        message: error?.message || "스탯을 저장하지 못했습니다.",
      });
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        아래 1차 허용 항목만 수정됩니다. 승률과 현재 형태 배틀 수는 승·패에서 자동 계산됩니다.
      </div>

      {NUMBER_FIELD_GROUPS.map((group) => (
        <fieldset key={group.title} className="overflow-hidden rounded border border-gray-200">
          <legend className="sr-only">{group.title}</legend>
          <div className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-800">
            {group.title}
          </div>
          {group.fields.map(({ field, label, max, dynamicMax, suffix }) => {
            const fieldMax = dynamicMax ? maxEnergy : max;
            return (
              <label
                key={field}
                className="flex items-center justify-between gap-3 border-t border-gray-200 px-3 py-2 text-xs"
              >
                <span className="text-gray-700">{label}</span>
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    aria-label={label}
                    min="0"
                    max={Number.isFinite(fieldMax) ? fieldMax : undefined}
                    step="1"
                    inputMode="numeric"
                    value={draft[field]}
                    disabled={isSaving}
                    onChange={handleNumberChange(field)}
                    className="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-right tabular-nums text-gray-900 disabled:bg-gray-100"
                  />
                  {(dynamicMax || suffix) && (
                    <span className="min-w-[2rem] text-gray-500">
                      {dynamicMax ? `/ ${maxEnergy}` : suffix}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>
      ))}

      <fieldset className="rounded border border-gray-200 px-3 py-2">
        <legend className="px-1 text-xs font-bold text-gray-800">상태 플래그</legend>
        <label className="flex items-center justify-between gap-3 text-xs text-gray-700">
          <span>부상 상태</span>
          <input
            type="checkbox"
            checked={Boolean(draft.isInjured)}
            disabled={isSaving}
            onChange={(event) => {
              setDraft((previous) => ({ ...previous, isInjured: event.target.checked }));
              setTouchedFields((previous) => ({ ...previous, isInjured: true }));
              setSaveState({ status: "idle", message: "" });
            }}
            className="h-4 w-4"
          />
        </label>
      </fieldset>

      {saveState.message && (
        <p
          role="status"
          className={`rounded px-3 py-2 text-xs ${
            saveState.status === "failed"
              ? "bg-red-50 text-red-700"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {saveState.message}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? "저장 중…" : "변경 저장"}
        </button>
      </div>
    </form>
  );
}
