import React, { useEffect } from "react";
import { ChannelProvider } from "ably/react";
import ChatRoom from "../ChatRoom";

const CHANNEL_NAME = "tamer-lobby";

function ImmersiveChatOverlay({
  isOpen = false,
  isMobile = false,
  landscapeSide = "right",
  onClose,
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
        className={`immersive-chat-backdrop ${
          isOpen ? "immersive-chat-backdrop--open" : ""
        }`.trim()}
        onClick={() => onClose?.()}
        aria-label="채팅 닫기"
        aria-hidden={!isOpen}
        tabIndex={-1}
      />
      <aside
        className={`immersive-chat-overlay ${
          isOpen ? "immersive-chat-overlay--open" : ""
        } ${isMobile ? "immersive-chat-overlay--mobile" : ""}`.trim()}
        data-landscape-side={landscapeSide}
        role="dialog"
        aria-labelledby="immersive-chat-overlay-title"
        aria-modal="false"
        aria-hidden={!isOpen}
      >
        <div className="immersive-chat-overlay__header">
          <div className="immersive-chat-overlay__title">
            <p className="service-section-label">실시간 로비</p>
            <h3 id="immersive-chat-overlay-title">테이머 채팅</h3>
          </div>
          <button
            type="button"
            className="service-button service-button--ghost immersive-chat-overlay__close"
            onClick={() => onClose?.()}
          >
            닫기
          </button>
        </div>
        <div className="immersive-chat-overlay__body">
          <div className="immersive-chat-overlay__content">
            <ChannelProvider channelName={CHANNEL_NAME}>
              <ChatRoom variant="drawer" />
            </ChannelProvider>
          </div>
        </div>
      </aside>
    </>
  );
}

export default ImmersiveChatOverlay;
