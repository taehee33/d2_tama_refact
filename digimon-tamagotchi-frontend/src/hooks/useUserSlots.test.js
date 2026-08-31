import { deleteSlotByCareSchema } from "./useUserSlots";

const currentUser = { uid: "alice" };

test("V2 슬롯은 trusted delete 완료를 기다리고 legacy delete를 호출하지 않는다", async () => {
  const deleteV2 = jest.fn(async () => ({ status: "complete" }));
  const deleteLegacy = jest.fn();
  await expect(deleteSlotByCareSchema({
    currentUser,
    slotId: 4,
    slotData: {
      revision: 8,
      slotInstanceId: "slot-life-a",
      careMistakeState: { schemaVersion: 2 },
    },
    deleteV2,
    deleteLegacy,
  })).resolves.toEqual({ status: "complete" });
  expect(deleteV2).toHaveBeenCalledWith(currentUser, 4, {
    slotInstanceId: "slot-life-a",
    expectedRevision: 8,
  });
  expect(deleteLegacy).not.toHaveBeenCalled();
});

test("V2 삭제가 in_progress이면 성공으로 처리하지 않는다", async () => {
  await expect(deleteSlotByCareSchema({
    currentUser,
    slotId: 4,
    slotData: {
      revision: 8,
      slotInstanceId: "slot-life-a",
      careMistakeState: { schemaVersion: 2 },
    },
    deleteV2: jest.fn(async () => ({ status: "in_progress" })),
    deleteLegacy: jest.fn(),
  })).rejects.toMatchObject({ code: "SLOT_DELETION_IN_PROGRESS" });
});

test("V1 슬롯은 기존 repository 삭제 경로를 유지한다", async () => {
  const deleteLegacy = jest.fn(async () => {});
  const deleteV2 = jest.fn();
  await deleteSlotByCareSchema({
    currentUser,
    slotId: 3,
    slotData: { revision: 2 },
    deleteV2,
    deleteLegacy,
  });
  expect(deleteLegacy).toHaveBeenCalledWith("alice", 3);
  expect(deleteV2).not.toHaveBeenCalled();
});
