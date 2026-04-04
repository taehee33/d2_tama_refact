import React from "react";
import { formatSlotCreatedAt } from "../../utils/dateUtils";
import { getSlotDisplayName, getSlotSpriteSrc } from "../../utils/slotViewUtils";

function SlotOrderModal({
  open,
  orderedSlots,
  highlightedSlotId,
  onMoveUp,
  onMoveDown,
  onClose,
  onSave,
  isSaving = false,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="service-modal-backdrop" onClick={onClose}>
      <div className="service-modal service-modal--wide" onClick={(event) => event.stopPropagation()}>
        <div className="service-modal__header">
          <div>
            <p className="service-section-label">정렬</p>
            <h3>디지몬 슬롯 순서</h3>
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

        <div className="service-modal__body service-order-list">
          {orderedSlots.map((slot, index) => (
            <div
              key={slot.id}
              className={`service-order-item${
                highlightedSlotId === slot.id ? " service-order-item--highlighted" : ""
              }`}
            >
              <div className="service-order-item__main">
                <div className="service-order-item__identity">
                  <p className="service-order-item__index">정렬 {index + 1}</p>
                  <div className="service-order-item__sprite-shell">
                    <img
                      src={getSlotSpriteSrc(slot)}
                      alt={`${getSlotDisplayName(slot)} 썸네일`}
                      className="service-order-item__sprite"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                  <div className="service-order-item__copy">
                    <div className="service-order-item__title-row">
                      <h4>{getSlotDisplayName(slot)}</h4>
                      <span className="service-order-item__slot-badge">{`슬롯 ${slot.id}`}</span>
                    </div>
                    <p className="service-muted">
                      생성일 {formatSlotCreatedAt(slot.createdAt)} · {slot.device} / {slot.version}
                    </p>
                  </div>
                </div>
              </div>
              <div className="service-order-item__actions">
                <button
                  type="button"
                  className="service-order-action service-order-action--up"
                  onClick={() => onMoveUp(index)}
                  disabled={index === 0}
                  aria-label={`슬롯 ${slot.id}을 위로 이동`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="service-order-action service-order-action--down"
                  onClick={() => onMoveDown(index)}
                  disabled={index === orderedSlots.length - 1}
                  aria-label={`슬롯 ${slot.id}을 아래로 이동`}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="service-modal__footer">
          <button type="button" className="service-button service-button--ghost" onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            className="service-button service-button--primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? "저장 중..." : "순서 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SlotOrderModal;
