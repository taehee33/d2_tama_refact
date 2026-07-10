import React from "react";
import { usePresenceContext } from "../../contexts/AblyContext";
import { CLOSE_NOTIFICATION_EVENT } from "../../contexts/NotificationCenterContext";
import PlayChatButton from "./PlayChatButton";

function PlayChatLauncher({ variant = "service" }) {
  const drawerId = "play-chat-drawer";
  const {
    isChatOpen,
    setIsChatOpen,
    unreadCount,
    presenceCount,
  } = usePresenceContext();

  const toggleDrawer = () => {
    const nextOpen = !isChatOpen;

    if (nextOpen) {
      window.dispatchEvent(new Event(CLOSE_NOTIFICATION_EVENT));
    }

    setIsChatOpen(nextOpen);
  };

  return (
    <PlayChatButton
      controlsId={drawerId}
      isOpen={isChatOpen}
      unreadCount={unreadCount}
      presenceCount={presenceCount || 0}
      onClick={toggleDrawer}
      variant={variant}
    />
  );
}

export default PlayChatLauncher;
