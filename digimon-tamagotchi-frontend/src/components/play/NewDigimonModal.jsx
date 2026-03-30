import React, { useState } from "react";

function NewDigimonModal({ open, onClose, onStart, isSubmitting = false }) {
  const [device, setDevice] = useState("Digital Monster Color 25th");
  const [version, setVersion] = useState("Ver.1");

  if (!open) {
    return null;
  }

  const handleStart = async () => {
    await onStart({ device, version });
  };

  return (
    <div className="service-modal-backdrop" onClick={onClose}>
      <div className="service-modal" onClick={(event) => event.stopPropagation()}>
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
              <option value="Ver.1">Ver.1</option>
              <option value="Ver.2">Ver.2</option>
              <option value="Ver.3" disabled>Ver.3 (준비 중)</option>
              <option value="Ver.4" disabled>Ver.4 (준비 중)</option>
            </select>
          </label>
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
