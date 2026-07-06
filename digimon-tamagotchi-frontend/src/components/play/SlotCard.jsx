import React, { useState } from "react";
import { formatSlotCreatedAt } from "../../utils/dateUtils";
import {
  getSlotDigimonData,
  getSlotDisplayName,
  getSlotSpriteSrc,
  getSlotStageLabel,
} from "../../utils/slotViewUtils";
import { getSlotStatusChips } from "../../utils/slotStatusChips";

function SlotCard({
  slot,
  variant = "detail",
  isNicknameOpen = false,
  nicknameValue = "",
  onToggleNickname,
  onNicknameChange,
  onNicknameSave,
  onNicknameReset,
  onContinue,
  onDelete,
}) {
  const slotDigimonData = getSlotDigimonData(slot);
  const statusChips = getSlotStatusChips(slot);
  const isCompact = variant === "compact";
  const visibleStatusChips = isCompact ? statusChips.slice(0, 1) : statusChips;
  const [isManageMenuOpen, setIsManageMenuOpen] = useState(false);

  const handleMenuAction = (action) => {
    setIsManageMenuOpen(false);
    action();
  };

  return (
    <article className={`service-slot-card service-slot-card--${isCompact ? "compact" : "detail"}`}>
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
              {isCompact
                ? `${getSlotStageLabel(slot)} · ${slot.version}`
                : `${getSlotStageLabel(slot)} · ${slot.device} / ${slot.version}`}
            </p>
          </div>
          <div className="service-slot-card__head-actions">
            <div className="service-slot-card__menu">
              <button
                type="button"
                className="service-slot-card__menu-trigger"
                aria-label={`슬롯 ${slot.id} 관리 메뉴`}
                aria-expanded={isManageMenuOpen}
                aria-haspopup="menu"
                onClick={() => setIsManageMenuOpen((prev) => !prev)}
              >
                <span aria-hidden="true">...</span>
              </button>
              {isManageMenuOpen && (
                <div className="service-slot-card__menu-panel" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="service-slot-card__menu-item"
                    onClick={() => handleMenuAction(onToggleNickname)}
                  >
                    별명 변경
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="service-slot-card__menu-item service-slot-card__menu-item--danger"
                    onClick={() => handleMenuAction(onDelete)}
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {!isCompact && (
          <p className="service-muted">
            생성일 {formatSlotCreatedAt(slot.createdAt)}
          </p>
        )}

        {visibleStatusChips.length > 0 && (
          <div className="service-status-chip-row" aria-label="슬롯 상태">
            {visibleStatusChips.map((chip) => (
              <span
                key={chip.id}
                className={`service-status-chip service-status-chip--${chip.tone}`}
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}

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
        </div>
      </div>
    </article>
  );
}

export default SlotCard;
