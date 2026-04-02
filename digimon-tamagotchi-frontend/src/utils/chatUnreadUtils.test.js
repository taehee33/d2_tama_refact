import {
  getLatestReadableCursor,
  getUnreadChatCount,
  isChatCursorNewer,
  normalizeChatCursor,
} from "./chatUnreadUtils";

describe("chatUnreadUtils", () => {
  test("정상 커서만 정규화한다", () => {
    expect(normalizeChatCursor({ messageId: "msg-1", timestamp: 1234 })).toEqual({
      messageId: "msg-1",
      timestamp: 1234,
    });
    expect(normalizeChatCursor({ messageId: "", timestamp: 1234 })).toBeNull();
    expect(normalizeChatCursor({ messageId: "msg-1", timestamp: 0 })).toBeNull();
    expect(normalizeChatCursor(null)).toBeNull();
  });

  test("최신 메시지 커서를 마지막 메시지에서 찾는다", () => {
    expect(
      getLatestReadableCursor([
        { id: "msg-1", timestamp: 1000 },
        { id: "msg-2", timestamp: 2000 },
      ])
    ).toEqual({ messageId: "msg-2", timestamp: 2000 });
  });

  test("마지막으로 읽은 메시지 뒤의 타인 메시지만 unread 로 계산한다", () => {
    const chatLog = [
      { id: "msg-1", timestamp: 1000, user: "A" },
      { id: "msg-2", timestamp: 2000, user: "ME" },
      { id: "msg-3", timestamp: 3000, user: "B" },
      { id: "msg-4", timestamp: 4000, user: "C" },
    ];

    expect(
      getUnreadChatCount(chatLog, { messageId: "msg-2", timestamp: 2000 }, "ME")
    ).toBe(2);
  });

  test("커서 메시지가 현재 창에 없으면 timestamp fallback 으로 unread 를 계산한다", () => {
    const chatLog = [
      { id: "msg-3", timestamp: 3000, user: "B" },
      { id: "msg-4", timestamp: 4000, user: "ME" },
      { id: "msg-5", timestamp: 5000, user: "C" },
    ];

    expect(
      getUnreadChatCount(chatLog, { messageId: "msg-1", timestamp: 3000 }, "ME")
    ).toBe(1);
  });

  test("커서가 없으면 과거 히스토리를 unread 로 세지 않는다", () => {
    const chatLog = [
      { id: "msg-1", timestamp: 1000, user: "A" },
      { id: "msg-2", timestamp: 2000, user: "B" },
    ];

    expect(getUnreadChatCount(chatLog, null, "ME")).toBe(0);
  });

  test("같은 timestamp 에서는 messageId 가 다르면 더 최신 커서로 본다", () => {
    expect(
      isChatCursorNewer(
        { messageId: "msg-2", timestamp: 2000 },
        { messageId: "msg-1", timestamp: 2000 }
      )
    ).toBe(true);
    expect(
      isChatCursorNewer(
        { messageId: "msg-1", timestamp: 2000 },
        { messageId: "msg-1", timestamp: 2000 }
      )
    ).toBe(false);
  });
});
