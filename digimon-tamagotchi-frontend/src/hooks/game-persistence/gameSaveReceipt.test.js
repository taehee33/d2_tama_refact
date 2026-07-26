import {
  GAME_SAVE_BLOCKED_REASON,
  GAME_SAVE_LOCAL_CLEANUP,
  createGameSaveReceipt,
  normalizeGameSaveErrorCode,
  resolveGameplayWriteBlockedReason,
} from "./gameSaveReceipt";

describe("gameSaveReceipt", () => {
  test("receipt의 공개 필드를 항상 같은 형태로 반환한다", () => {
    expect(createGameSaveReceipt({
      status: "synced",
      commandId: "command-1",
      mutationId: "mutation-1",
      localCleanup: GAME_SAVE_LOCAL_CLEANUP.COMPLETE,
    })).toEqual({
      status: "synced",
      commandId: "command-1",
      mutationId: "mutation-1",
      blockedReason: null,
      localCleanup: "complete",
      errorCode: null,
    });
  });

  test.each([
    ["인증 없음", { currentUid: null }, GAME_SAVE_BLOCKED_REASON.AUTH_UNAVAILABLE],
    [
      "사용자 변경",
      { currentUid: "user-2", saveContext: { uid: "user-1" } },
      GAME_SAVE_BLOCKED_REASON.USER_CHANGED,
    ],
    [
      "슬롯 변경",
      { currentUid: "user-1", currentSlotId: 2, saveContext: { uid: "user-1", slotId: 1 } },
      GAME_SAVE_BLOCKED_REASON.SLOT_CHANGED,
    ],
    [
      "세대 변경",
      {
        currentUid: "user-1",
        currentSlotId: 1,
        currentGeneration: 4,
        saveContext: { uid: "user-1", slotId: 1, generation: 3 },
      },
      GAME_SAVE_BLOCKED_REASON.GENERATION_CHANGED,
    ],
  ])("%s 차단 사유를 구분한다", (_label, input, expected) => {
    expect(resolveGameplayWriteBlockedReason(input)).toBe(expected);
  });

  test("오류 코드는 기존 code를 보존하고 없으면 UNKNOWN을 사용한다", () => {
    expect(normalizeGameSaveErrorCode({ code: "unavailable" })).toBe("unavailable");
    expect(normalizeGameSaveErrorCode(new Error("offline"))).toBe("UNKNOWN");
  });
});
