// src/components/DigimonMasterDataPanel.jsx
// 디지몬 마스터 데이터 표/편집 패널

import React, { useEffect, useMemo, useState } from "react";
import { useMasterData } from "../contexts/MasterDataContext";
import {
  buildMasterRowDraft,
  buildMasterRowOverrideFromDraft,
  buildMasterTableRows,
  getMasterDataVersionKey,
} from "../utils/masterDataUtils";

function SpritePreview({ src, alt }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-600 bg-slate-800 text-[10px] text-slate-400">
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

function FieldLabel({ children }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-300">
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder = "", type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
    />
  );
}

export default function DigimonMasterDataPanel() {
  const {
    isMasterDataReady,
    masterDataOverrides,
    masterDataRevision,
    saveDigimonOverride,
    resetDigimonOverride,
    refreshMasterData,
  } = useMasterData();

  const [selectedVersion, setSelectedVersion] = useState("Ver.1");
  const [query, setQuery] = useState("");
  const [selectedDigimonId, setSelectedDigimonId] = useState("");
  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [feedback, setFeedback] = useState("");

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
  }, [query, selectedVersion, masterDataRevision]);

  const versionKey = getMasterDataVersionKey(selectedVersion);
  const selectedRowHasOverride = Boolean(
    selectedDigimonId && masterDataOverrides?.[versionKey]?.[selectedDigimonId]
  );

  useEffect(() => {
    if (!rows.length) {
      setSelectedDigimonId("");
      setDraft(null);
      return;
    }

    const rowExists = rows.some((row) => row.id === selectedDigimonId);
    if (!rowExists) {
      setSelectedDigimonId(rows[0].id);
    }
  }, [rows, selectedDigimonId, selectedVersion]);

  useEffect(() => {
    if (!selectedDigimonId) {
      return;
    }

    setDraft(buildMasterRowDraft(selectedDigimonId, selectedVersion));
  }, [selectedDigimonId, selectedVersion, masterDataRevision]);

  const handleSelectRow = (digimonId) => {
    setSelectedDigimonId(digimonId);
    setDraft(buildMasterRowDraft(digimonId, selectedVersion));
    setFeedback("");
  };

  const handleDraftChange = (field) => (event) => {
    const nextValue = event.target.value;
    setDraft((prev) => ({
      ...prev,
      [field]: nextValue,
    }));
  };

  const handleSave = async () => {
    if (!draft?.id) {
      return;
    }

    setIsSaving(true);
    setFeedback("");

    try {
      const overrideValue = buildMasterRowOverrideFromDraft(draft, selectedVersion);
      await saveDigimonOverride(selectedVersion, draft.id, overrideValue);
      setFeedback(`저장 완료: ${draft.name || draft.id}`);
    } catch (error) {
      setFeedback(`저장 실패: ${error.message || "알 수 없는 오류"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetOverride = async () => {
    if (!selectedDigimonId) {
      return;
    }

    if (!window.confirm("이 디지몬의 오버라이드를 원본 값으로 되돌릴까요?")) {
      return;
    }

    setIsResetting(true);
    setFeedback("");

    try {
      await resetDigimonOverride(selectedVersion, selectedDigimonId);
      setFeedback(`오버라이드 초기화: ${selectedDigimonId}`);
    } catch (error) {
      setFeedback(`초기화 실패: ${error.message || "알 수 없는 오류"}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-slate-100 shadow-inner">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">디지몬 마스터 데이터</h3>
            <p className="text-sm text-slate-400">
              원본 JS 데이터 위에 오버라이드 값을 덮어쓰는 방식입니다. 저장 후 현재 게임 화면에 즉시 반영됩니다.
            </p>
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

            <TextInput
              value={query}
              placeholder="ID, 이름, 단계 검색"
              onChange={(event) => setQuery(event.target.value)}
            />

            <button
              type="button"
              onClick={() => refreshMasterData()}
              className="rounded-md border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              다시 불러오기
            </button>
          </div>
        </div>

        {!isMasterDataReady ? (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900 px-4 py-10 text-center text-sm text-slate-400">
            마스터 데이터 초기화 중...
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
            <div className="overflow-hidden rounded-xl border border-slate-700">
              <div className="max-h-[65vh] overflow-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-900 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    <tr>
                      <th className="px-3 py-3 text-left">Edit</th>
                      <th className="px-3 py-3 text-left">ID</th>
                      <th className="px-3 py-3 text-left">이름</th>
                      <th className="px-3 py-3 text-left">Sprite</th>
                      <th className="px-3 py-3 text-left">Attack</th>
                      <th className="px-3 py-3 text-left">Stage</th>
                      <th className="px-3 py-3 text-right">EvoTime</th>
                      <th className="px-3 py-3 text-right">Hunger</th>
                      <th className="px-3 py-3 text-right">Strength</th>
                      <th className="px-3 py-3 text-right">Poop</th>
                      <th className="px-3 py-3 text-right">Heal</th>
                      <th className="px-3 py-3 text-right">MinWeight</th>
                      <th className="px-3 py-3 text-right">MaxEnergy</th>
                      <th className="px-3 py-3 text-right">Power</th>
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
                              onClick={() => handleSelectRow(row.id)}
                              className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                                isSelected
                                  ? "border-cyan-400 bg-cyan-500 text-slate-950"
                                  : "border-slate-600 text-slate-200 hover:bg-slate-800"
                              }`}
                            >
                              {hasOverride ? "수정중" : "편집"}
                            </button>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-300">{row.id}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span>{row.name}</span>
                              {hasOverride && (
                                <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                  OVERRIDE
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <SpritePreview src={row.spriteSrc} alt={`${row.name} sprite`} />
                          </td>
                          <td className="px-3 py-2">
                            <SpritePreview src={row.attackSpriteSrc} alt={`${row.name} attack`} />
                          </td>
                          <td className="px-3 py-2 text-slate-300">{row.stage}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.timeToEvolveSeconds}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.hungerCycle}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.strengthCycle}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.poopCycle}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.healDoses}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.minWeight}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.maxEnergy}</td>
                          <td className="px-3 py-2 text-right font-mono">{row.basePower}</td>
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
            </div>

            <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/90 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Selected
                  </p>
                  <h4 className="text-xl font-bold text-white">
                    {draft?.name || "선택된 디지몬 없음"}
                  </h4>
                  {draft?.id && (
                    <p className="text-sm text-slate-400">
                      {draft.id} · {draft.stage}
                    </p>
                  )}
                </div>

                {selectedRowHasOverride && (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                    오버라이드 적용 중
                  </span>
                )}
              </div>

              {draft ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldLabel>
                      이름
                      <TextInput value={draft.name} onChange={handleDraftChange("name")} />
                    </FieldLabel>
                    <FieldLabel>
                      단계
                      <TextInput value={draft.stage} onChange={handleDraftChange("stage")} />
                    </FieldLabel>
                    <FieldLabel>
                      스프라이트 ID
                      <TextInput value={draft.sprite} onChange={handleDraftChange("sprite")} type="number" />
                    </FieldLabel>
                    <FieldLabel>
                      공격 스프라이트 ID
                      <TextInput
                        value={draft.attackSprite}
                        onChange={handleDraftChange("attackSprite")}
                        placeholder="비우면 기본 sprite"
                        type="number"
                      />
                    </FieldLabel>
                    <FieldLabel>
                      진화 시간(초)
                      <TextInput
                        value={draft.timeToEvolveSeconds}
                        onChange={handleDraftChange("timeToEvolveSeconds")}
                        type="number"
                      />
                    </FieldLabel>
                    <FieldLabel>
                      수면 시간(HH:MM)
                      <TextInput
                        value={draft.sleepTime}
                        onChange={handleDraftChange("sleepTime")}
                        placeholder="예: 23:00"
                      />
                    </FieldLabel>
                    <FieldLabel>
                      배고픔 주기(분)
                      <TextInput
                        value={draft.hungerCycle}
                        onChange={handleDraftChange("hungerCycle")}
                        type="number"
                      />
                    </FieldLabel>
                    <FieldLabel>
                      힘 주기(분)
                      <TextInput
                        value={draft.strengthCycle}
                        onChange={handleDraftChange("strengthCycle")}
                        type="number"
                      />
                    </FieldLabel>
                    <FieldLabel>
                      배변 주기(분)
                      <TextInput
                        value={draft.poopCycle}
                        onChange={handleDraftChange("poopCycle")}
                        type="number"
                      />
                    </FieldLabel>
                    <FieldLabel>
                      치료 횟수
                      <TextInput
                        value={draft.healDoses}
                        onChange={handleDraftChange("healDoses")}
                        type="number"
                      />
                    </FieldLabel>
                    <FieldLabel>
                      최소 체중
                      <TextInput
                        value={draft.minWeight}
                        onChange={handleDraftChange("minWeight")}
                        type="number"
                      />
                    </FieldLabel>
                    <FieldLabel>
                      최대 에너지
                      <TextInput
                        value={draft.maxEnergy}
                        onChange={handleDraftChange("maxEnergy")}
                        type="number"
                      />
                    </FieldLabel>
                    <FieldLabel>
                      기본 파워
                      <TextInput
                        value={draft.basePower}
                        onChange={handleDraftChange("basePower")}
                        type="number"
                      />
                    </FieldLabel>
                    <FieldLabel>
                      최대 오버피드
                      <TextInput
                        value={draft.maxOverfeed}
                        onChange={handleDraftChange("maxOverfeed")}
                        type="number"
                      />
                    </FieldLabel>
                    <FieldLabel>
                      속성
                      <TextInput
                        value={draft.type}
                        onChange={handleDraftChange("type")}
                        placeholder="Free / Vaccine / Data / Virus"
                      />
                    </FieldLabel>
                    <FieldLabel>
                      Sprite Base Path
                      <TextInput
                        value={draft.spriteBasePath}
                        onChange={handleDraftChange("spriteBasePath")}
                        placeholder={selectedVersion === "Ver.2" ? "/Ver2_Mod_Kor" : "/images"}
                      />
                    </FieldLabel>
                  </div>

                  <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-400">
                    현재 스키마 기준으로 실제 게임에서 쓰는 핵심 종 데이터만 편집합니다. 캔버스/배틀/도감은 동일한 오버라이드 값을 공유합니다.
                  </div>

                  {feedback && (
                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                      {feedback}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? "저장 중..." : "오버라이드 저장"}
                    </button>

                    <button
                      type="button"
                      onClick={handleResetOverride}
                      disabled={!selectedRowHasOverride || isResetting}
                      className="rounded-md border border-rose-400/40 px-4 py-2 text-sm font-bold text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isResetting ? "되돌리는 중..." : "오버라이드 초기화"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-400">
                  왼쪽 표에서 디지몬을 선택해 주세요.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
