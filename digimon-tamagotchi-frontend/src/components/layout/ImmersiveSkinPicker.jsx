import React from "react";
import { IMMERSIVE_SKINS } from "../../data/immersiveSettings";

function ImmersiveSkinPicker({
  isOpen = false,
  activeSkinId,
  onSelectSkin,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <section className="immersive-skin-picker" aria-label="몰입형 스킨 선택">
      <div className="immersive-skin-picker__header">
        <strong>다마고치 스킨</strong>
        <span>슬롯별로 마지막 선택을 저장합니다.</span>
      </div>
      <div className="immersive-skin-picker__grid">
        {IMMERSIVE_SKINS.map((skin) => (
          <button
            key={skin.id}
            type="button"
            onClick={() => onSelectSkin?.(skin.id)}
            className={`immersive-skin-picker__option ${
              activeSkinId === skin.id
                ? "immersive-skin-picker__option--active"
                : ""
            }`}
            aria-pressed={activeSkinId === skin.id}
          >
            <span className="immersive-skin-picker__swatch" data-skin-id={skin.id} />
            <span className="immersive-skin-picker__copy">
              <span className="immersive-skin-picker__name-row">
                <strong>{skin.name}</strong>
                {skin.landscapeOnly ? (
                  <span className="immersive-skin-picker__badge">가로 전용</span>
                ) : null}
              </span>
              <span>{skin.description}</span>
              {skin.landscapeOnly ? (
                <span className="immersive-skin-picker__hint">
                  세로 몰입형에서는 기본 화면을 유지합니다.
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default ImmersiveSkinPicker;
