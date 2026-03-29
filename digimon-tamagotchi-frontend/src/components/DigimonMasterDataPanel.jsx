// src/components/DigimonMasterDataPanel.jsx
// 디지몬 마스터 데이터 전역 편집 패널

import React, { useEffect, useMemo, useState } from "react";
import { useMasterData } from "../contexts/MasterDataContext";
import {
  buildMasterRowDraft,
  buildMasterRowOverrideFromDraft,
  buildMasterTableRows,
  formatDraftTime,
  formatMasterTimestamp,
  formatSnapshotAction,
  getChangedFieldKeysBetweenDrafts,
  getMasterDataVersionKey,
  getMasterRowComparison,
  parseMasterDataImportText,
} from "../utils/masterDataUtils";

const FIELD_LABELS = {
  name: "이름",
  stage: "단계",
  sprite: "스프라이트 ID",
  spriteBasePath: "스프라이트 경로",
  attackSprite: "공격 스프라이트",
  altAttackSprite: "대체 공격 스프라이트",
  hungerCycle: "배고픔 주기",
  strengthCycle: "힘 주기",
  poopCycle: "배변 주기",
  healDoses: "회복량",
  maxOverfeed: "과식 한도",
  minWeight: "최소 체중",
  maxEnergy: "최대 에너지",
  basePower: "기본 파워",
  type: "속성",
  timeToEvolveSeconds: "진화 시간(초)",
};

const BASIC_FIELDS = [
  { key: "name", type: "text" },
  { key: "stage", type: "text" },
  { key: "sprite", type: "number" },
  { key: "spriteBasePath", type: "text" },
  { key: "attackSprite", type: "number" },
  { key: "altAttackSprite", type: "number" },
  { key: "type", type: "text" },
];

const STAT_FIELDS = [
  { key: "timeToEvolveSeconds", type: "number" },
  { key: "hungerCycle", type: "number" },
  { key: "strengthCycle", type: "number" },
  { key: "poopCycle", type: "number" },
  { key: "healDoses", type: "number" },
  { key: "maxOverfeed", type: "number" },
  { key: "minWeight", type: "number" },
  { key: "maxEnergy", type: "number" },
  { key: "basePower", type: "number" },
];

function formatActor(actor) {
  if (!actor) {
    return "기록 없음";
  }

  return actor.displayName || actor.email || actor.uid || "알 수 없음";
}

function formatValue(value) {
  if (value === "" || value === null || value === undefined) {
    return "미설정";
  }

  return String(value);
}

function SpritePreview({ src, alt }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-[10px] text-slate-400">
        N/A
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-16 w-16 object-contain"
      style={{ imageRendering: "pixelated" }}
      onError={() => setFailed(true)}
    />
  );
}

function getDigimonSpriteSrcFromDraft(draftLike) {
  const spriteId = draftLike?.sprite;
  if (spriteId === "" || spriteId === null || spriteId === undefined) {
    return null;
  }

  return `${draftLike?.spriteBasePath || "/images"}/${spriteId}.png`;
}

function getAttackSpriteSrc(spriteId) {
  if (spriteId === "" || spriteId === null || spriteId === undefined) {
    return null;
  }

  return `/images/${spriteId}.png`;
}

function SmallSpritePreview({ src, alt }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-700 bg-slate-900 text-[9px] text-slate-500">
        N/A
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-10 w-10 object-contain"
      style={{ imageRendering: "pixelated" }}
      onError={() => setFailed(true)}
    />
  );
}

function CurrentSpritePreview({ fieldKey, currentDraft }) {
  return (
    <div className="mb-3 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        현재 미리보기
      </p>
      <div className="flex items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <SpritePreview
            src={getDigimonSpriteSrcFromDraft(currentDraft)}
            alt="current digimon sprite"
          />
          <span className="text-xs text-slate-400">본체</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <SpritePreview
            src={getAttackSpriteSrc(currentDraft?.[fieldKey])}
            alt="current attack sprite"
          />
          <span className="text-xs text-slate-400">
            {fieldKey === "altAttackSprite" ? "대체 공격" : "공격"}
          </span>
        </div>
      </div>
    </div>
  );
}

function TextInput({ value, onChange, type = "text", placeholder = "" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
    />
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-cyan-500 text-slate-950"
          : "border border-slate-700 text-slate-300 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function FieldCompareCard({
  label,
  fieldKey,
  type,
  draft,
  baseDraft,
  currentDraft,
  onChange,
  placeholder = "",
}) {
  const isChanged = baseDraft?.[fieldKey] !== currentDraft?.[fieldKey];
  const isEditing = currentDraft?.[fieldKey] !== draft?.[fieldKey];
  const showSpriteCompare =
    fieldKey === "attackSprite" || fieldKey === "altAttackSprite";

  return (
    <div
      className={`rounded-xl border p-3 ${
        isEditing
          ? "border-amber-400/60 bg-amber-500/10"
          : isChanged
          ? "border-emerald-400/40 bg-emerald-500/10"
          : "border-slate-700 bg-slate-950/60"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-100">{label}</span>
        <div className="flex items-center gap-1">
          {isChanged && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              변경됨
            </span>
          )}
          {isEditing && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-200">
              편집중
            </span>
          )}
        </div>
      </div>

      {showSpriteCompare && (
        <CurrentSpritePreview
          fieldKey={fieldKey}
          currentDraft={currentDraft}
        />
      )}

      <TextInput
        value={draft?.[fieldKey] ?? ""}
        onChange={onChange}
        type={type}
        placeholder={placeholder}
      />

      <div className="mt-3 space-y-1 text-[11px] text-slate-400">
        <p>기본값: {formatValue(baseDraft?.[fieldKey])}</p>
        <p>현재값: {formatValue(currentDraft?.[fieldKey])}</p>
      </div>
    </div>
  );
}

function TimeCompareCard({
  title,
  baseDraft,
  currentDraft,
  draft,
  hourKey,
  minuteKey,
  onChange,
}) {
  const baseValue = formatDraftTime(baseDraft?.[hourKey], baseDraft?.[minuteKey]);
  const currentValue = formatDraftTime(currentDraft?.[hourKey], currentDraft?.[minuteKey]);
  const draftValue = formatDraftTime(draft?.[hourKey], draft?.[minuteKey]);
  const isChanged = baseValue !== currentValue;
  const isEditing = currentValue !== draftValue;

  return (
    <div
      className={`rounded-xl border p-3 ${
        isEditing
          ? "border-amber-400/60 bg-amber-500/10"
          : isChanged
          ? "border-emerald-400/40 bg-emerald-500/10"
          : "border-slate-700 bg-slate-950/60"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-100">{title}</span>
        <div className="flex items-center gap-1">
          {isChanged && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              변경됨
            </span>
          )}
          {isEditing && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-200">
              편집중
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <TextInput
          value={draft?.[hourKey] ?? ""}
          onChange={onChange(hourKey)}
          type="number"
          placeholder="시"
        />
        <TextInput
          value={draft?.[minuteKey] ?? ""}
          onChange={onChange(minuteKey)}
          type="number"
          placeholder="분"
        />
      </div>

      <div className="mt-3 space-y-1 text-[11px] text-slate-400">
        <p>기본값: {baseValue}</p>
        <p>현재값: {currentValue}</p>
      </div>
    </div>
  );
}

export default function DigimonMasterDataPanel() {
  const {
    canPersistMasterData,
    isMasterDataReady,
    masterDataMeta,
    masterDataOverrides,
    masterDataRevision,
    masterDataSnapshots,
    snapshotsLoading,
    masterDataError,
    refreshMasterData,
    saveDigimonOverride,
    importDigimonOverrides,
    resetDigimonOverride,
    resetAllDigimonOverrides,
    restoreMasterDataSnapshot,
  } = useMasterData();

  const [selectedVersion, setSelectedVersion] = useState("Ver.1");
  const [selectedTab, setSelectedTab] = useState("edit");
  const [selectedDigimonId, setSelectedDigimonId] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(null);
  const [actionNote, setActionNote] = useState("");
  const [importText, setImportText] = useState("");
  const [importFormat, setImportFormat] = useState("json");
  const [feedback, setFeedback] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const versionKey = getMasterDataVersionKey(selectedVersion);

  const rows = useMemo(() => {
    const revisionKey = masterDataRevision;
    void revisionKey;
    const loweredQuery = query.trim().toLowerCase();

    return buildMasterTableRows(selectedVersion).filter((row) => {
      if (!loweredQuery) {
        return true;
      }

      return [row.id, row.name, row.stage]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(loweredQuery));
    });
  }, [masterDataRevision, query, selectedVersion]);

  useEffect(() => {
    if (!rows.length) {
      setSelectedDigimonId("");
      setDraft(null);
      return;
    }

    const exists = rows.some((row) => row.id === selectedDigimonId);
    if (!exists) {
      setSelectedDigimonId(rows[0].id);
    }
  }, [rows, selectedDigimonId]);

  useEffect(() => {
    if (!selectedDigimonId) {
      return;
    }

    setDraft(buildMasterRowDraft(selectedDigimonId, selectedVersion));
  }, [selectedDigimonId, selectedVersion, masterDataRevision]);

  const comparison = useMemo(() => {
    const revisionKey = masterDataRevision;
    void revisionKey;

    if (!selectedDigimonId) {
      return null;
    }

    return getMasterRowComparison(selectedDigimonId, selectedVersion);
  }, [masterDataRevision, selectedDigimonId, selectedVersion]);

  const baseDraft = comparison?.baseDraft || null;
  const currentDraft = comparison?.currentDraft || null;
  const changedFieldKeys = comparison?.changedFieldKeys || [];
  const unsavedFieldKeys = useMemo(() => {
    if (!currentDraft || !draft) {
      return [];
    }

    return getChangedFieldKeysBetweenDrafts(currentDraft, draft);
  }, [currentDraft, draft]);

  const selectedRowHasOverride = Boolean(
    selectedDigimonId && masterDataOverrides?.[versionKey]?.[selectedDigimonId]
  );

  const overrideCounts = useMemo(
    () => ({
      ver1: Object.keys(masterDataOverrides?.ver1 || {}).length,
      ver2: Object.keys(masterDataOverrides?.ver2 || {}).length,
    }),
    [masterDataOverrides]
  );

  const parsedImportState = useMemo(() => {
    try {
      return {
        rows: parseMasterDataImportText(importText, importFormat, selectedVersion),
        error: null,
      };
    } catch (error) {
      return {
        rows: [],
        error: error.message || "가져오기 파싱 오류",
      };
    }
  }, [importFormat, importText, selectedVersion]);

  const handleDraftChange = (fieldKey) => (event) => {
    const nextValue = event.target.value;
    setDraft((prev) => ({
      ...prev,
      [fieldKey]: nextValue,
    }));
  };

  const handleRefresh = async () => {
    setFeedback("");

    try {
      await refreshMasterData();
      setFeedback("전역 마스터 데이터를 다시 불러왔습니다.");
    } catch (error) {
      setFeedback(`다시 불러오기 실패: ${error.message || "알 수 없는 오류"}`);
    }
  };

  const handleSave = async () => {
    if (!draft?.id || !currentDraft) {
      return;
    }

    if (!unsavedFieldKeys.length) {
      setFeedback("편집 중인 변경 사항이 없습니다.");
      return;
    }

    const shouldSave = window.confirm(
      `${draft.name || draft.id} 저장할까요?\n변경 필드: ${unsavedFieldKeys.length}개`
    );
    if (!shouldSave) {
      return;
    }

    setIsProcessing(true);
    setFeedback("");

    try {
      const overrideValue = buildMasterRowOverrideFromDraft(draft, selectedVersion);
      await saveDigimonOverride(
        selectedVersion,
        draft.id,
        overrideValue,
        actionNote.trim()
      );
      setFeedback(`전역 저장 완료: ${draft.name || draft.id}`);
    } catch (error) {
      setFeedback(`저장 실패: ${error.message || "알 수 없는 오류"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetRow = async () => {
    if (!selectedDigimonId) {
      return;
    }

    if (!selectedRowHasOverride) {
      setFeedback("이 디지몬은 현재 기본값 상태입니다.");
      return;
    }

    const shouldReset = window.confirm(
      `${selectedDigimonId}의 현재 전역 오버라이드를 기본값으로 되돌릴까요?`
    );
    if (!shouldReset) {
      return;
    }

    setIsProcessing(true);
    setFeedback("");

    try {
      await resetDigimonOverride(selectedVersion, selectedDigimonId, actionNote.trim());
      setFeedback(`기본값 복원 완료: ${selectedDigimonId}`);
    } catch (error) {
      setFeedback(`복원 실패: ${error.message || "알 수 없는 오류"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetAll = async () => {
    const shouldReset = window.confirm(
      "모든 전역 마스터 데이터를 기본값으로 되돌릴까요?\n모든 사용자와 모든 슬롯에 바로 적용됩니다."
    );
    if (!shouldReset) {
      return;
    }

    setIsProcessing(true);
    setFeedback("");

    try {
      await resetAllDigimonOverrides(actionNote.trim());
      setFeedback("전체 마스터 데이터를 기본값으로 복원했습니다.");
    } catch (error) {
      setFeedback(`전체 복원 실패: ${error.message || "알 수 없는 오류"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!parsedImportState.rows.length) {
      setFeedback("가져올 데이터가 없습니다.");
      return;
    }

    const shouldImport = window.confirm(
      `${selectedVersion}에 ${parsedImportState.rows.length}개 행을 전역 저장할까요?`
    );
    if (!shouldImport) {
      return;
    }

    setIsProcessing(true);
    setFeedback("");

    try {
      await importDigimonOverrides(
        selectedVersion,
        parsedImportState.rows,
        actionNote.trim()
      );
      setFeedback(`일괄 가져오기 완료: ${parsedImportState.rows.length}개`);
      setSelectedTab("edit");
    } catch (error) {
      setFeedback(`일괄 저장 실패: ${error.message || "알 수 없는 오류"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreSnapshot = async (snapshot) => {
    const shouldRestore = window.confirm(
      `${formatMasterTimestamp(snapshot.createdAt)} 저장 상태로 되돌릴까요?\n현재 전역 상태를 덮어씁니다.`
    );
    if (!shouldRestore) {
      return;
    }

    setIsProcessing(true);
    setFeedback("");

    try {
      await restoreMasterDataSnapshot(snapshot.id, actionNote.trim());
      setFeedback("스냅샷 복원을 완료했습니다.");
    } catch (error) {
      setFeedback(`스냅샷 복원 실패: ${error.message || "알 수 없는 오류"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedRow = rows.find((row) => row.id === selectedDigimonId) || null;

  return (
    <div className="space-y-4 text-slate-100">
      <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-inner">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div>
              <h3 className="text-xl font-bold text-white">디지몬 마스터 데이터</h3>
              <p className="text-sm text-slate-400">
                전역 Firestore 기준으로만 저장됩니다. 저장 성공 후에만 모든 사용자와 모든 슬롯에 반영됩니다.
              </p>
            </div>

            <div className="grid gap-2 text-xs text-slate-300 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                활성 스냅샷: {masterDataMeta.activeSnapshotId || "없음"}
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                마지막 저장: {formatMasterTimestamp(masterDataMeta.updatedAt)}
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                저장자: {formatActor(masterDataMeta.updatedBy)}
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                활성 오버라이드: Ver.1 {overrideCounts.ver1} / Ver.2 {overrideCounts.ver2}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-1">
              {["Ver.1", "Ver.2"].map((version) => (
                <button
                  key={version}
                  type="button"
                  onClick={() => setSelectedVersion(version)}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                    selectedVersion === version
                      ? "bg-cyan-500 text-slate-950"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {version}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-md border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              다시 불러오기
            </button>

            <button
              type="button"
              onClick={handleResetAll}
              disabled={isProcessing || (!overrideCounts.ver1 && !overrideCounts.ver2)}
              className="rounded-md border border-rose-400/40 px-3 py-2 text-sm font-bold text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              기본으로 전체 되돌리기
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-700">
            <div className="border-b border-slate-700 bg-slate-900 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <TextInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ID, 이름, 단계 검색"
                />
                <div className="text-xs text-slate-400">
                  참고 표와 같은 흐름으로 항목을 다시 배치했습니다. 가로 스크롤로 전체 값을 확인할 수 있습니다.
                </div>
              </div>
            </div>

            {!isMasterDataReady ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                마스터 데이터를 불러오는 중...
              </div>
            ) : (
              <div className="max-h-[70vh] overflow-auto">
                <table className="min-w-[2600px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-900 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    <tr>
                      <th className="px-3 py-3 text-left">Edit</th>
                      <th className="px-3 py-3 text-left">No.</th>
                      <th className="px-3 py-3 text-left">Sprite</th>
                      <th className="px-3 py-3 text-left">AtkSprite</th>
                      <th className="px-3 py-3 text-left">AltAtkSprite</th>
                      <th className="px-3 py-3 text-right">SpriteID</th>
                      <th className="px-3 py-3 text-left">Stage</th>
                      <th className="px-3 py-3 text-right">MaxStamina</th>
                      <th className="px-3 py-3 text-right">MinWeight</th>
                      <th className="px-3 py-3 text-right">EvoTime</th>
                      <th className="px-3 py-3 text-right">SleepHour</th>
                      <th className="px-3 py-3 text-right">SleepMin</th>
                      <th className="px-3 py-3 text-right">WakeHour</th>
                      <th className="px-3 py-3 text-right">WakeMin</th>
                      <th className="px-3 py-3 text-right">HungerTimer</th>
                      <th className="px-3 py-3 text-right">StrengthDecayTimer</th>
                      <th className="px-3 py-3 text-right">PoopTimer</th>
                      <th className="px-3 py-3 text-right">HealAmount</th>
                      <th className="px-3 py-3 text-left">Attribute</th>
                      <th className="px-3 py-3 text-right">Power</th>
                      <th className="px-3 py-3 text-right">AttackSprite</th>
                      <th className="px-3 py-3 text-right">AltAttackSprite</th>
                      <th className="px-3 py-3 text-right">변경</th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-950 text-slate-200">
                    {rows.map((row) => {
                      const isSelected = row.id === selectedDigimonId;
                      const hasOverride = Boolean(masterDataOverrides?.[versionKey]?.[row.id]);

                      return (
                        <tr
                          key={row.id}
                          className={`border-t border-slate-800 transition ${
                            isSelected ? "bg-slate-800/80" : "hover:bg-slate-900/70"
                          }`}
                        >
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setSelectedDigimonId(row.id)}
                              className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                                isSelected
                                  ? "border-cyan-400 bg-cyan-500 text-slate-950"
                                  : "border-slate-600 text-slate-200 hover:bg-slate-800"
                              }`}
                            >
                              {isSelected ? "선택됨" : "편집"}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-mono text-base text-slate-200">
                              {row.displayId}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <SmallSpritePreview src={row.spriteSrc} alt={`${row.name} sprite`} />
                          </td>
                          <td className="px-3 py-2">
                            <SmallSpritePreview
                              src={row.attackSpriteSrc}
                              alt={`${row.name} attack sprite`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <SmallSpritePreview
                              src={row.altAttackSpriteSrc}
                              alt={`${row.name} alt attack sprite`}
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-base">{row.sprite}</td>
                          <td className="px-3 py-2 text-slate-300">
                            {row.stage || "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-base">
                            {row.maxEnergy}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-base">
                            {row.minWeight}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {row.timeToEvolveMinutes}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {row.sleepHour === "" ? 0 : row.sleepHour}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {row.sleepMin === "" ? 0 : row.sleepMin}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {row.wakeHour === "" ? 0 : row.wakeHour}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {row.wakeMin === "" ? 0 : row.wakeMin}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {row.hungerCycle}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {row.strengthCycle}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {row.poopCycle}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {row.healDoses}
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {row.type || "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-base">
                            {row.basePower}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {row.attackSprite}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {row.altAttackSprite}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex flex-col items-end gap-1">
                              {hasOverride && (
                                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                  OVR
                                </span>
                              )}
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                  row.changedFieldCount > 0
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {row.changedFieldCount}개
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {!rows.length && (
                  <div className="px-4 py-10 text-center text-sm text-slate-400">
                    검색 결과가 없습니다.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Selected
                </p>
                <h4 className="text-xl font-bold text-white">
                  {selectedRow?.name || draft?.name || "선택된 디지몬 없음"}
                </h4>
                {selectedDigimonId && (
                  <p className="text-sm text-slate-400">
                    {selectedDigimonId} · {selectedRow?.stage || draft?.stage || "-"}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <TabButton active={selectedTab === "edit"} onClick={() => setSelectedTab("edit")}>
                  편집
                </TabButton>
                <TabButton
                  active={selectedTab === "history"}
                  onClick={() => setSelectedTab("history")}
                >
                  이력
                </TabButton>
                <TabButton
                  active={selectedTab === "import"}
                  onClick={() => setSelectedTab("import")}
                >
                  가져오기
                </TabButton>
              </div>
            </div>

            {!canPersistMasterData && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
                Firebase 로그인 상태에서만 전역 저장할 수 있습니다. 읽기만 가능한 상태입니다.
              </div>
            )}

            {masterDataError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
                마스터 데이터 오류: {masterDataError.message || "알 수 없는 오류"}
              </div>
            )}

            {feedback && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-3 text-sm text-cyan-100">
                {feedback}
              </div>
            )}

            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                저장 메모
              </label>
              <TextInput
                value={actionNote}
                onChange={(event) => setActionNote(event.target.value)}
                placeholder="예: 밸런스 조정 / Ver.2 아침 기상 시간 수정"
              />
            </div>

            {selectedTab === "edit" && (
              <>
                {draft && baseDraft && currentDraft ? (
                  <>
                    <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        현재 적용 중인 본체 스프라이트
                      </p>
                      <div className="mt-3 flex flex-col items-center justify-center gap-3">
                        <SpritePreview
                          src={`${currentDraft.spriteBasePath || "/images"}/${currentDraft.sprite}.png`}
                          alt="current sprite"
                        />
                        <div className="text-center">
                          <p className="text-lg font-semibold text-white">{currentDraft.name}</p>
                          <p className="text-sm text-slate-400">{currentDraft.stage}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-300">
                      <p>
                        기본 대비 현재 변경 필드:{" "}
                        <span className="font-bold text-emerald-300">{changedFieldKeys.length}개</span>
                      </p>
                      <p className="mt-1">
                        {changedFieldKeys.length
                          ? changedFieldKeys
                              .map((fieldKey) => FIELD_LABELS[fieldKey] || fieldKey)
                              .join(", ")
                          : "현재는 기본값과 동일합니다."}
                      </p>
                      <p className="mt-2 text-slate-400">
                        저장 전 편집 필드:{" "}
                        {unsavedFieldKeys.length
                          ? unsavedFieldKeys
                              .map((fieldKey) => FIELD_LABELS[fieldKey] || fieldKey)
                              .join(", ")
                          : "없음"}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-sm font-bold text-white">기본 정보</h5>
                      <div className="grid gap-3 md:grid-cols-2">
                        {BASIC_FIELDS.map((field) => (
                          <FieldCompareCard
                            key={field.key}
                            label={FIELD_LABELS[field.key] || field.key}
                            fieldKey={field.key}
                            type={field.type}
                            draft={draft}
                            baseDraft={baseDraft}
                            currentDraft={currentDraft}
                            onChange={handleDraftChange(field.key)}
                            placeholder={
                              field.key === "spriteBasePath"
                                ? selectedVersion === "Ver.2"
                                  ? "/Ver2_Mod_Kor"
                                  : "/images"
                                : ""
                            }
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-sm font-bold text-white">수면 스케줄</h5>
                      <div className="grid gap-3 md:grid-cols-2">
                        <TimeCompareCard
                          title="수면 시간"
                          baseDraft={baseDraft}
                          currentDraft={currentDraft}
                          draft={draft}
                          hourKey="sleepHour"
                          minuteKey="sleepMin"
                          onChange={handleDraftChange}
                        />
                        <TimeCompareCard
                          title="기상 시간"
                          baseDraft={baseDraft}
                          currentDraft={currentDraft}
                          draft={draft}
                          hourKey="wakeHour"
                          minuteKey="wakeMin"
                          onChange={handleDraftChange}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-sm font-bold text-white">능력치/타이머</h5>
                      <div className="grid gap-3 md:grid-cols-2">
                        {STAT_FIELDS.map((field) => (
                          <FieldCompareCard
                            key={field.key}
                            label={FIELD_LABELS[field.key] || field.key}
                            fieldKey={field.key}
                            type={field.type}
                            draft={draft}
                            baseDraft={baseDraft}
                            currentDraft={currentDraft}
                            onChange={handleDraftChange(field.key)}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isProcessing || !canPersistMasterData}
                        className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isProcessing ? "저장 중..." : "전역 저장"}
                      </button>
                      <button
                        type="button"
                        onClick={handleResetRow}
                        disabled={isProcessing || !selectedRowHasOverride || !canPersistMasterData}
                        className="rounded-md border border-rose-400/40 px-4 py-2 text-sm font-bold text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        기본으로 돌리기
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-400">
                    왼쪽 표에서 디지몬을 선택해 주세요.
                  </div>
                )}
              </>
            )}

            {selectedTab === "history" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-3 text-sm text-slate-300">
                  저장 이력은 각 저장 시점의 전체 활성 상태를 기준으로 남습니다. 원하는 시점으로 되돌리면 새로운 복원 스냅샷이 추가됩니다.
                </div>

                {snapshotsLoading ? (
                  <div className="rounded-xl border border-slate-700 px-4 py-10 text-center text-sm text-slate-400">
                    스냅샷을 불러오는 중...
                  </div>
                ) : masterDataSnapshots.length ? (
                  <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
                    {masterDataSnapshots.map((snapshot) => {
                      const summary = snapshot.changeSummary || { totalCount: 0, ver1: [], ver2: [] };
                      const previewIds = [
                        ...(summary.ver1 || []).map((id) => `V1:${id}`),
                        ...(summary.ver2 || []).map((id) => `V2:${id}`),
                      ].slice(0, 8);

                      return (
                        <div
                          key={snapshot.id}
                          className="rounded-xl border border-slate-700 bg-slate-950/60 p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-200">
                                  {formatSnapshotAction(snapshot.actionType)}
                                </span>
                                {masterDataMeta.activeSnapshotId === snapshot.id && (
                                  <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-bold text-cyan-200">
                                    현재 적용 중
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-white">
                                {formatMasterTimestamp(snapshot.createdAt)}
                              </p>
                              <p className="text-xs text-slate-400">
                                저장자: {formatActor(snapshot.createdBy)}
                              </p>
                              <p className="text-xs text-slate-400">
                                변경 행 수: {summary.totalCount || 0}개
                              </p>
                              {snapshot.note && (
                                <p className="text-xs text-slate-300">메모: {snapshot.note}</p>
                              )}
                              {previewIds.length > 0 && (
                                <p className="text-xs text-slate-500">
                                  대상: {previewIds.join(", ")}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRestoreSnapshot(snapshot)}
                              disabled={isProcessing || !canPersistMasterData}
                              className="rounded-md border border-cyan-400/40 px-3 py-2 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              이 상태로 되돌리기
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-400">
                    저장 이력이 없습니다.
                  </div>
                )}
              </div>
            )}

            {selectedTab === "import" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-300">
                  JSON 또는 CSV를 붙여넣어 현재 선택한 버전에 일괄 반영할 수 있습니다. 저장은 Firestore에 성공해야만 적용됩니다.
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <TabButton active={importFormat === "json"} onClick={() => setImportFormat("json")}>
                    JSON
                  </TabButton>
                  <TabButton active={importFormat === "csv"} onClick={() => setImportFormat("csv")}>
                    CSV
                  </TabButton>
                </div>

                <textarea
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder={
                    importFormat === "json"
                      ? '[{"id":"Koromon","wakeHour":"8","wakeMin":"15","altAttackSprite":"65535"}]'
                      : "id,wakeHour,wakeMin,altAttackSprite\nKoromon,8,15,65535"
                  }
                  className="min-h-[220px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
                />

                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-300">
                  {parsedImportState.error ? (
                    <p className="text-rose-300">파싱 오류: {parsedImportState.error}</p>
                  ) : (
                    <>
                      <p>파싱 결과: {parsedImportState.rows.length}개 행</p>
                      {parsedImportState.rows.length > 0 && (
                        <p className="mt-1 text-xs text-slate-400">
                          미리보기:{" "}
                          {parsedImportState.rows
                            .slice(0, 8)
                            .map((row) => row.id)
                            .join(", ")}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleImport}
                  disabled={
                    isProcessing ||
                    !canPersistMasterData ||
                    !!parsedImportState.error ||
                    !parsedImportState.rows.length
                  }
                  className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isProcessing ? "저장 중..." : "일괄 저장"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
