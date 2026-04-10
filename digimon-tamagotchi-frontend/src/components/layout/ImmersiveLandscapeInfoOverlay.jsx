import React, { useEffect } from "react";

function ImmersiveLandscapeInfoOverlay({
  isOpen = false,
  isMobile = false,
  onClose,
  statusNode = null,
  supportActionsNode = null,
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className={`immersive-landscape-info-backdrop ${
          isOpen ? "immersive-landscape-info-backdrop--open" : ""
        }`.trim()}
        onClick={() => onClose?.()}
        aria-label="가로 상세 정보 닫기"
        aria-hidden={!isOpen}
        tabIndex={-1}
      />
      <aside
        className={`immersive-landscape-info-overlay ${
          isOpen ? "immersive-landscape-info-overlay--open" : ""
        } ${isMobile ? "immersive-landscape-info-overlay--mobile" : ""}`.trim()}
        role="dialog"
        aria-labelledby="immersive-landscape-info-overlay-title"
        aria-modal="false"
        aria-hidden={!isOpen}
      >
        <div className="immersive-landscape-info-overlay__header">
          <div className="immersive-landscape-info-overlay__title">
            <p className="service-section-label">가로 상세 보기</p>
            <h3 id="immersive-landscape-info-overlay-title">디지바이스 정보</h3>
          </div>
          <button
            type="button"
            className="immersive-landscape-info-overlay__close"
            onClick={() => onClose?.()}
          >
            닫기
          </button>
        </div>
        <div className="immersive-landscape-info-overlay__body">
          {statusNode ? (
            <div className="immersive-landscape-info-overlay__status">{statusNode}</div>
          ) : null}
          {supportActionsNode ? (
            <div className="immersive-landscape-info-overlay__support">
              {supportActionsNode}
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}

export default ImmersiveLandscapeInfoOverlay;
