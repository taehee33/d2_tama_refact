export function normalizeChatCursor(cursor) {
  if (!cursor || typeof cursor !== "object") {
    return null;
  }

  const messageId =
    typeof cursor.messageId === "string" && cursor.messageId.trim()
      ? cursor.messageId.trim()
      : null;
  const timestamp = Number(cursor.timestamp);

  if (!messageId || !Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }

  return { messageId, timestamp };
}

export function getLatestReadableCursor(chatLog = []) {
  if (!Array.isArray(chatLog) || chatLog.length === 0) {
    return null;
  }

  for (let index = chatLog.length - 1; index >= 0; index -= 1) {
    const cursor = normalizeChatCursor({
      messageId: chatLog[index]?.id,
      timestamp: chatLog[index]?.timestamp,
    });

    if (cursor) {
      return cursor;
    }
  }

  return null;
}

export function isChatCursorNewer(nextCursor, currentCursor) {
  const normalizedNext = normalizeChatCursor(nextCursor);
  const normalizedCurrent = normalizeChatCursor(currentCursor);

  if (!normalizedNext) {
    return false;
  }

  if (!normalizedCurrent) {
    return true;
  }

  if (normalizedNext.timestamp !== normalizedCurrent.timestamp) {
    return normalizedNext.timestamp > normalizedCurrent.timestamp;
  }

  return normalizedNext.messageId !== normalizedCurrent.messageId;
}

export function getUnreadChatCount(chatLog = [], lastReadCursor, ownClientId) {
  if (!Array.isArray(chatLog) || chatLog.length === 0) {
    return 0;
  }

  const normalizedCursor = normalizeChatCursor(lastReadCursor);
  if (!normalizedCursor) {
    return 0;
  }

  const ownName =
    typeof ownClientId === "string" && ownClientId.trim()
      ? ownClientId.trim()
      : null;

  const isUnreadMessage = (message) => {
    const messageTimestamp = Number(message?.timestamp);
    if (!Number.isFinite(messageTimestamp)) {
      return false;
    }

    if (ownName && message?.user === ownName) {
      return false;
    }

    return true;
  };

  const cursorIndex = chatLog.findIndex(
    (message) => message?.id === normalizedCursor.messageId
  );

  if (cursorIndex >= 0) {
    return chatLog
      .slice(cursorIndex + 1)
      .filter((message) => isUnreadMessage(message)).length;
  }

  return chatLog.filter((message) => {
    const messageTimestamp = Number(message?.timestamp);
    if (!Number.isFinite(messageTimestamp) || messageTimestamp <= normalizedCursor.timestamp) {
      return false;
    }

    return isUnreadMessage(message);
  }).length;
}
