import React from "react";

function PlayChatButton({ controlsId, isOpen, unreadCount, presenceCount, onClick }) {
  const buttonLabel = isOpen ? "채팅 닫기" : "채팅";

  return (
    <button
      type="button"
      className={`play-chat-fab${isOpen ? " play-chat-fab--active" : ""}`}
      onClick={onClick}
      aria-expanded={isOpen}
      aria-controls={controlsId}
      aria-haspopup="dialog"
      aria-label={buttonLabel}
    >
      <span className="play-chat-fab__icon-wrap" aria-hidden="true">
        <span className="play-chat-fab__icon">💬</span>
        {unreadCount > 0 ? (
          <span className="play-chat-fab__badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </span>
      <span className="play-chat-fab__label">{buttonLabel}</span>
      <span className="play-chat-fab__presence">{`${presenceCount}명`}</span>
    </button>
  );
}

export default PlayChatButton;
