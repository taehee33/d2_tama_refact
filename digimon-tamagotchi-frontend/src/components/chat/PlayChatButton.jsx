import React from "react";

function PlayChatButton({ controlsId, isOpen, unreadCount, onClick }) {
  return (
    <button
      type="button"
      className={`play-chat-fab${isOpen ? " play-chat-fab--active" : ""}`}
      onClick={onClick}
      aria-expanded={isOpen}
      aria-controls={controlsId}
      aria-haspopup="dialog"
      aria-label={isOpen ? "채팅 닫기" : "채팅 열기"}
    >
      <span className="play-chat-fab__icon" aria-hidden="true">
        💬
      </span>
      <span className="play-chat-fab__label">{isOpen ? "채팅 닫기" : "로비 채팅"}</span>
      {unreadCount > 0 ? (
        <span className="play-chat-fab__badge">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}

export default PlayChatButton;
