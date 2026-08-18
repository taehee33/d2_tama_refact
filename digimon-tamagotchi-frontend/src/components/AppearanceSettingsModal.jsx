import React, { useEffect, useMemo, useState } from "react";
import {
  IMMERSIVE_SKINS,
  PIXEL_APPEARANCE_PRESETS,
  PIXEL_PORTRAIT_SKIN_IDS,
  PIXEL_SKIN_DEFAULT_APPEARANCE,
} from "../data/immersiveSettings";
import { normalizeAppearanceBySkin } from "../utils/immersiveSettings";
import "../styles/AppearanceSettingsModal.css";

const COLOR_FIELDS = [
  ["backgroundLeft", "배경 왼쪽"],
  ["backgroundRight", "배경 오른쪽"],
  ["device", "중앙 게임기"],
];

const PIXEL_SKINS = IMMERSIVE_SKINS.filter((skin) => skin.portraitPixel);

const AppearanceSettingsModal = ({ immersiveSettings, initialSkinId, onSave, onClose }) => {
  const initialAppearance = useMemo(
    () => normalizeAppearanceBySkin(immersiveSettings?.appearanceBySkin),
    [immersiveSettings]
  );
  const [activeSkinId, setActiveSkinId] = useState(
    PIXEL_PORTRAIT_SKIN_IDS.includes(initialSkinId) ? initialSkinId : PIXEL_PORTRAIT_SKIN_IDS[0]
  );
  const [draftBySkin, setDraftBySkin] = useState(initialAppearance);

  useEffect(() => setDraftBySkin(initialAppearance), [initialAppearance]);

  const activeSkin = PIXEL_SKINS.find((skin) => skin.id === activeSkinId) || PIXEL_SKINS[0];
  const draft = draftBySkin[activeSkinId];
  const previewStyle = {
    "--pixel-background-left": draft.backgroundLeft,
    "--pixel-background-right": draft.backgroundRight,
    "--pixel-device": draft.device,
  };
  const updateCurrentDraft = (nextAppearance) => {
    setDraftBySkin((previous) => ({ ...previous, [activeSkinId]: { ...nextAppearance } }));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-70 p-4">
      <section className="w-full max-w-lg overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-100 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="appearance-settings-title">
        <header className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
          <div>
            <h2 id="appearance-settings-title" className="text-xl font-black">외형 꾸미기</h2>
            <p className="mt-1 text-xs text-slate-300">저장하기 전에는 실제 화면에 반영되지 않아요.</p>
          </div>
          <button type="button" onClick={onClose} className="h-11 w-11 rounded-lg border border-slate-600 text-2xl" aria-label="닫기">×</button>
        </header>

        <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5">
          <div role="tablist" aria-label="꾸밀 스킨" className="grid grid-cols-3 gap-2">
            {PIXEL_SKINS.map((skin) => (
              <button key={skin.id} type="button" role="tab" aria-selected={activeSkinId === skin.id} onClick={() => setActiveSkinId(skin.id)} className={`min-h-11 rounded-lg border-2 px-2 py-2 text-xs font-black ${activeSkinId === skin.id ? "border-blue-600 bg-blue-100 text-blue-900" : "border-slate-300 bg-white text-slate-700"}`}>
                {skin.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[116px_1fr] items-center gap-4 rounded-xl bg-slate-900 p-4 text-white">
            <div className="appearance-preview" data-skin-id={activeSkinId} style={previewStyle} aria-label={`${activeSkin.name} 미리보기`}>
              <img src={activeSkin.portraitFrameSrc} alt="" aria-hidden="true" />
              <span className="appearance-preview__left" aria-hidden="true" />
              <span className="appearance-preview__right" aria-hidden="true" />
              <span className="appearance-preview__device" aria-hidden="true" />
            </div>
            <div>
              <strong className="block text-base">{activeSkin.name}</strong>
              <span className="mt-1 block text-xs text-slate-300">스킨별 색상 조합을 따로 기억합니다.</span>
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-2 font-black text-slate-800">색상</legend>
            {COLOR_FIELDS.map(([key, label]) => (
              <label key={key} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-slate-300 bg-white p-3 font-bold text-slate-800">
                <span>{label}</span>
                <span className="flex items-center gap-2">
                  <input type="color" aria-label={`${label} 색상`} value={draft[key]} onChange={(event) => updateCurrentDraft({ ...draft, [key]: event.target.value.toUpperCase() })} className="h-11 w-14 cursor-pointer rounded border-0 bg-transparent" />
                  <code className="w-[72px] text-xs">{draft[key]}</code>
                </span>
              </label>
            ))}
          </fieldset>

          <div>
            <h3 className="mb-2 font-black text-slate-800">원작풍 프리셋</h3>
            <div className="grid grid-cols-3 gap-2">
              {PIXEL_APPEARANCE_PRESETS.map((preset) => (
                <button key={preset.id} type="button" onClick={() => updateCurrentDraft(preset.appearance)} className="min-h-11 rounded-lg border-2 border-slate-300 bg-white px-2 py-2 text-xs font-black text-slate-700">{preset.name}</button>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => updateCurrentDraft(PIXEL_SKIN_DEFAULT_APPEARANCE[activeSkinId])} className="min-h-11 w-full rounded-lg border-2 border-slate-400 bg-slate-200 font-black text-slate-800">이 스킨 색상 초기화</button>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-300 bg-white p-4">
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg bg-slate-300 px-5 font-black text-slate-800">취소</button>
          <button type="button" onClick={() => onSave(draftBySkin)} className="min-h-11 rounded-lg bg-blue-600 px-5 font-black text-white">저장</button>
        </footer>
      </section>
    </div>
  );
};

export default AppearanceSettingsModal;
