import React from "react";
import { formatSlotCreatedAt } from "../../utils/dateUtils";
import {
  getSlotDigimonData,
  getSlotDisplayName,
  getSlotSpriteSrc,
  getSlotStageLabel,
} from "../../utils/slotViewUtils";

function SlotCard({
  slot,
  isNicknameOpen = false,
  nicknameValue = "",
  onToggleNickname,
  onNicknameChange,
  onNicknameSave,
  onNicknameReset,
  onContinue,
  onImmersive,
  onDelete,
}) {
  const slotDigimonData = getSlotDigimonData(slot);

  return (
    <article className="service-slot-card">
      <div className="service-slot-card__media">
        <img
          src={getSlotSpriteSrc(slot)}
          alt={slotDigimonData?.name || slot.selectedDigimon || "디지몬"}
          className="service-slot-card__sprite"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      <div className="service-slot-card__body">
        <div className="service-slot-card__head">
          <div>
            <p className="service-section-label">슬롯 {slot.id}</p>
            <h3>{getSlotDisplayName(slot)}</h3>
            <p className="service-muted">
              {getSlotStageLabel(slot)} · {slot.device} / {slot.version}
            </p>
          </div>
          {slot.isFrozen && <span className="service-badge service-badge--cool">냉장고 보관</span>}
        </div>

        <p className="service-muted">
          생성일 {formatSlotCreatedAt(slot.createdAt)} · {slot.slotName || `슬롯${slot.id}`}
        </p>

        <div className="service-inline-actions">
          <button
            type="button"
            className="service-button service-button--ghost"
            onClick={onToggleNickname}
          >
            별명 변경
          </button>
          <button
            type="button"
            className="service-button service-button--ghost"
            onClick={onDelete}
          >
            삭제
          </button>
        </div>

        {isNicknameOpen && (
          <div className="service-inline-panel">
            <label className="service-field">
              <span>디지몬 별명</span>
              <input
                type="text"
                value={nicknameValue}
                onChange={(event) => onNicknameChange(event.target.value)}
                placeholder={slotDigimonData?.name || slot.selectedDigimon}
              />
            </label>
            <div className="service-inline-actions">
              <button
                type="button"
                className="service-button service-button--primary"
                onClick={onNicknameSave}
              >
                저장
              </button>
              <button
                type="button"
                className="service-button service-button--ghost"
                onClick={onNicknameReset}
              >
                기본값
              </button>
            </div>
          </div>
        )}

        <div className="service-slot-card__footer">
          <button
            type="button"
            className="service-button service-button--primary"
            onClick={onContinue}
          >
            이어하기
          </button>
          <button
            type="button"
            className="service-button service-button--ghost"
            onClick={onImmersive}
          >
            몰입형 화면
          </button>
        </div>
      </div>
    </article>
  );
}

export default SlotCard;
