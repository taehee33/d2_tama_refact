import React, { useMemo, useState } from "react";
import {
  SUPPORTED_DIGIMON_VERSIONS,
  getDigimonEntryByVersion,
  getSpriteBasePathByVersion,
  getStarterDigimonId,
} from "../../utils/digimonVersionUtils";

function NewDigimonModal({ open, onClose, onStart, isSubmitting = false }) {
  const [device, setDevice] = useState("Digital Monster Color 25th");
  const [version, setVersion] = useState("Ver.1");
  const preparingVersions = new Set(["Ver.4", "Ver.5"]);
  const digitamaPreviews = useMemo(
    () =>
      SUPPORTED_DIGIMON_VERSIONS.map((versionLabel) => {
        const starterId = getStarterDigimonId(versionLabel);
        const starter = getDigimonEntryByVersion(versionLabel, starterId) || {};
        const spriteBasePath = getSpriteBasePathByVersion(versionLabel);

        return {
          version: versionLabel,
          name: starter.name || `디지타마 ${versionLabel}`,
          spriteSrc: `${spriteBasePath}/${starter.sprite}.png`,
        };
      }),
    []
  );

  if (!open) {
    return null;
  }

  const handleStart = async () => {
    await onStart({ device, version });
  };

  return (
    <div className="service-modal-backdrop" onClick={onClose}>
      <div
        className="service-modal service-modal--new-digimon"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="service-modal__header">
          <div>
            <p className="service-section-label">새 디지몬</p>
            <h3>디지타마 준비</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="service-modal__close"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="service-modal__body">
          <label className="service-field">
            <span>기종</span>
            <select value={device} onChange={(event) => setDevice(event.target.value)}>
              <option value="Digital Monster Color 25th">Digital Monster Color 25th</option>
            </select>
          </label>

          <label className="service-field">
            <span>버전</span>
            <select value={version} onChange={(event) => setVersion(event.target.value)}>
              {SUPPORTED_DIGIMON_VERSIONS.map((versionLabel) => (
                <option key={versionLabel} value={versionLabel}>
                  {versionLabel}
                </option>
              ))}
            </select>
          </label>

          <section className="service-digitama-preview" aria-labelledby="digitama-preview-title">
            <div className="service-digitama-preview__header">
              <h4 id="digitama-preview-title">버전별 디지타마</h4>
              <p>카드를 선택하면 시작할 버전이 함께 바뀝니다.</p>
            </div>

            <div className="service-digitama-preview__grid">
              {digitamaPreviews.map((preview) => {
                const isSelected = preview.version === version;
                const isPreparing = preparingVersions.has(preview.version);

                return (
                  <button
                    key={preview.version}
                    type="button"
                    className={`service-digitama-preview__card ${
                      isSelected ? "service-digitama-preview__card--selected" : ""
                    }`}
                    onClick={() => setVersion(preview.version)}
                    aria-pressed={isSelected}
                    aria-label={`${preview.version} 디지타마 선택`}
                  >
                    <span className="service-digitama-preview__image-shell">
                      <img
                        src={preview.spriteSrc}
                        alt={`${preview.version} ${preview.name}`}
                        className="service-digitama-preview__image"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </span>
                    <span className="service-digitama-preview__version">
                      {preview.version}
                      {isPreparing ? (
                        <span className="service-digitama-preview__tag">(준비중)</span>
                      ) : null}
                    </span>
                    <span className="service-digitama-preview__name">{preview.name}</span>
                    {isSelected ? (
                      <span className="service-digitama-preview__selected">선택됨</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="service-modal__footer">
          <button type="button" className="service-button service-button--ghost" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="service-button service-button--primary"
            onClick={handleStart}
            disabled={isSubmitting}
          >
            {isSubmitting ? "준비 중..." : "시작하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewDigimonModal;
