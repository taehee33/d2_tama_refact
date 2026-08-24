import React from "react";
import { getSlotPrimaryInfo } from "../../utils/slotInfoUtils";
import { getSlotStatusChips } from "../../utils/slotStatusChips";
import {
  getSlotDisplayName,
  getSlotSpriteSrc,
} from "../../utils/slotViewUtils";

export function SlotStatusChipRow({ slot, label = "슬롯 상태", chips: providedChips }) {
  const chips = providedChips || getSlotStatusChips(slot);

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="service-status-chip-row" aria-label={label}>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className={`service-status-chip service-status-chip--${chip.tone}`}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

function RecentSlotPresenter({
  slot,
  supplementaryInfo = [],
  onContinue,
  onImmersive,
}) {
  if (!slot) {
    return null;
  }

  const displayName = getSlotDisplayName(slot);
  const infoItems = Array.isArray(supplementaryInfo)
    ? supplementaryInfo.filter(Boolean)
    : [supplementaryInfo].filter(Boolean);

  return (
    <article className="service-recent-slot">
      <div className="service-slot-card__media service-recent-slot__media">
        <img
          src={getSlotSpriteSrc(slot)}
          alt={`${displayName} 대표 스프라이트`}
          className="service-slot-card__sprite"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <div className="service-recent-slot__body">
        <p className="service-section-label">{`슬롯 ${slot.id}`}</p>
        <h2>{displayName}</h2>
        <div className="service-slot-meta">
          <p className="service-slot-meta__item">{getSlotPrimaryInfo(slot)}</p>
          {infoItems.map((info, index) => (
            <p className="service-slot-meta__item" key={`${info}-${index}`}>
              {info}
            </p>
          ))}
        </div>
        <SlotStatusChipRow slot={slot} label="최근 슬롯 상태" />
        <div className="service-inline-actions service-inline-actions--primary">
          <button
            type="button"
            className="service-button service-button--primary"
            onClick={onContinue}
          >
            이어하기
          </button>
          {onImmersive ? (
            <button
              type="button"
              className="service-button service-button--ghost"
              onClick={onImmersive}
            >
              몰입형 화면
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default RecentSlotPresenter;
