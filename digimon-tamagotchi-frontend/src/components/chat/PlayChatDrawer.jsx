import React, { useEffect } from "react";
import ChatRoom from "../ChatRoom";
import { usePresenceContext } from "../../contexts/AblyContext";
import PlayChatButton from "./PlayChatButton";

function PlayChatDrawer() {
  const drawerId = "play-chat-drawer";
  const drawerTitleId = "play-chat-drawer-title";
  const {
    isChatOpen,
    setIsChatOpen,
    unreadCount,
    presenceCount,
  } = usePresenceContext();

  useEffect(() => {
    return () => {
      setIsChatOpen(false);
    };
  }, [setIsChatOpen]);

  useEffect(() => {
    if (!isChatOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsChatOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isChatOpen, setIsChatOpen]);

  useEffect(() => {
    if (!isChatOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isChatOpen]);

  const toggleDrawer = () => {
    setIsChatOpen(!isChatOpen);
  };

  return (
    <>
      <PlayChatButton
        controlsId={drawerId}
        isOpen={isChatOpen}
        unreadCount={unreadCount}
        presenceCount={presenceCount || 0}
        onClick={toggleDrawer}
      />

      <button
        type="button"
        className={`play-chat-backdrop${isChatOpen ? " play-chat-backdrop--open" : ""}`}
        onClick={() => setIsChatOpen(false)}
        aria-label="채팅 닫기"
        aria-hidden={!isChatOpen}
        tabIndex={-1}
      />

      <aside
        id={drawerId}
        className={`play-chat-drawer${isChatOpen ? " play-chat-drawer--open" : ""}`}
        role="dialog"
        aria-labelledby={drawerTitleId}
        aria-modal="false"
        aria-hidden={!isChatOpen}
      >
        <div className="play-chat-drawer__header">
          <div className="play-chat-drawer__title">
            <p className="service-section-label">실시간 로비</p>
            <h3 id={drawerTitleId}>테이머 채팅</h3>
          </div>
          <button
            type="button"
            className="service-button service-button--ghost play-chat-drawer__close"
            onClick={() => setIsChatOpen(false)}
          >
            닫기
          </button>
        </div>

        <div className="play-chat-drawer__body">
          <div className="play-chat-drawer__content">
            <ChatRoom variant="drawer" />
          </div>
        </div>
      </aside>
    </>
  );
}

export default PlayChatDrawer;
