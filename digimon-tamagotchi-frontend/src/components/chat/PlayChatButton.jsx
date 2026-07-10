import React from "react";

function PlayChatButton({
  controlsId,
  isOpen,
  unreadCount,
  presenceCount,
  onClick,
  variant = "service",
}) {
  const buttonLabel = isOpen ? "채팅 닫기" : "채팅";
  const variantClassName = `play-chat-fab--${variant}`;
  const isCompact = variant === "game-compact" || variant === "topnav";
  const accessibleLabel = `${buttonLabel}, 현재 ${presenceCount}명 접속 중`;

  return (
    <button
      type="button"
      className={`play-chat-fab ${variantClassName}${isOpen ? " play-chat-fab--active" : ""}`}
      onClick={onClick}
      aria-expanded={isOpen}
      aria-controls={controlsId}
      aria-haspopup="dialog"
      aria-label={accessibleLabel}
    >
      <span className="play-chat-fab__icon-wrap" aria-hidden="true">
        <span className="play-chat-fab__icon">💬</span>
        {unreadCount > 0 ? (
          <span className="play-chat-fab__badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </span>
      {isCompact ? null : <span className="play-chat-fab__label">{buttonLabel}</span>}
      <span className="play-chat-fab__presence">{`${presenceCount}명`}</span>
    </button>
  );
}

export default PlayChatButton;
