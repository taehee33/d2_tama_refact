import { clearDeletedSlotOutbox } from "./slotOutboxLifecycle";

describe("clearDeletedSlotOutbox", () => {
  it("삭제된 슬롯의 정확한 slotInstanceId scope만 정리한다", async () => {
    const outbox = { clearSlotInstanceScope: jest.fn().mockResolvedValue(2) };

    await expect(clearDeletedSlotOutbox({
      outbox,
      uid: "user-1",
      slotId: 4,
      slotData: {
        slotInstanceIdSchemaVersion: 1,
        slotInstanceId: "slot-instance-old",
      },
    })).resolves.toBe(true);

    expect(outbox.clearSlotInstanceScope).toHaveBeenCalledWith({
      uid: "user-1",
      slotId: 4,
      slotInstanceId: "slot-instance-old",
    });
  });

  it("legacy 슬롯은 추측한 scope를 지우지 않는다", async () => {
    const outbox = { clearSlotInstanceScope: jest.fn() };

    await expect(clearDeletedSlotOutbox({
      outbox,
      uid: "user-1",
      slotId: 4,
      slotData: {},
    })).resolves.toBe(false);
    expect(outbox.clearSlotInstanceScope).not.toHaveBeenCalled();
  });
});
