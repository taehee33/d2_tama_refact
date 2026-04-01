import React, { useEffect, useId } from "react";

function CommunityDialog({
  open,
  title,
  eyebrow,
  onClose,
  children,
  footer = null,
  className = "",
  size = "md",
  headerAction = null,
  hideCloseButton = false,
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="community-dialog-backdrop" onClick={onClose}>
      <section
        className={`community-dialog community-dialog--${size} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="community-dialog__header">
          <div className="community-dialog__title">
            {eyebrow ? <p className="service-section-label">{eyebrow}</p> : null}
            <h2 id={titleId}>{title}</h2>
          </div>
          <div className="community-dialog__header-actions">
            {headerAction}
            {!hideCloseButton ? (
              <button
                type="button"
                className="community-dialog__close"
                onClick={onClose}
                aria-label="닫기"
              >
                ×
              </button>
            ) : null}
          </div>
        </header>

        <div className="community-dialog__body">{children}</div>

        {footer ? <footer className="community-dialog__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

export default CommunityDialog;
