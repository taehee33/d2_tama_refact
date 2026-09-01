import {
  buildNativeSlotInitializationData,
  deleteSlotByCareSchema,
} from "./useUserSlots";
import {
  SUPPORTED_DIGIMON_VERSIONS,
  getStarterDigimonId,
} from "../utils/digimonVersionUtils";

const currentUser = { uid: "alice" };

test.each(SUPPORTED_DIGIMON_VERSIONS)(
  "%s 신규 슬롯 payload는 기존 초기화 원본과 하나의 createdAt을 사용한다",
  (version) => {
    const createdAt = 1_777_000_000_123;
    const result = buildNativeSlotInitializationData({
      version,
      device: "DMC",
      createdAt,
      slotIdentity: { slotInstanceIdSchemaVersion: 1, slotInstanceId: "slot-life" },
      combatIdentity: {
        arenaIdentitySchemaVersion: 1,
        digimonInstanceId: "digimon-life",
        combatRevision: 1,
      },
    });

    expect(result.selectedDigimon).toBe(getStarterDigimonId(version));
    expect(result.createdAt).toBe(createdAt);
    expect(result.lastSavedAt).toBe(createdAt);
    expect(result.digimonStats).toEqual(expect.objectContaining({
      birthTime: createdAt,
      evolutionStageStartedAt: createdAt,
      lastSavedAt: createdAt,
      lifespanSeconds: 0,
    }));
    expect(result.digimonStats.timeToEvolveSeconds).toBeGreaterThanOrEqual(0);
    [
      "hungerTimer",
      "hungerCountdown",
      "strengthTimer",
      "strengthCountdown",
      "poopTimer",
      "poopCountdown",
    ].forEach((field) => {
      expect(Number.isFinite(result.digimonStats[field])).toBe(true);
      expect(result.digimonStats[field]).toBeGreaterThanOrEqual(0);
    });
  }
);

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
