import {
  buildCompletedJogressRoomUpdate,
  buildCompletedJogressSlotUpdate,
  buildGuestPairingRoomUpdate,
  syncCurrentJogressSlot,
} from "./jogressPersistenceHelpers";

describe("jogressPersistenceHelpers", () => {
  test("buildGuestPairingRoomUpdate는 guest pairing payload를 만든다", () => {
    const payload = buildGuestPairingRoomUpdate({
      currentUser: {
        uid: "user-1",
        displayName: "디폴트 테이머",
      },
      tamerName: "게스트 테이머",
      guestSlot: {
        id: 2,
        selectedDigimon: "Betamon",
        digimonNickname: "  베타  ",
      },
      guestVersion: "Ver.2",
      hostTargetId: "Omegamon",
      serverTimestampValue: "SERVER_TS",
    });

    expect(payload).toEqual({
      status: "paired",
      guestUid: "user-1",
      guestTamerName: "게스트 테이머",
      guestSlotId: 2,
      guestDigimonId: "Betamon",
      guestDigimonNickname: "베타",
      guestSlotVersion: "Ver.2",
      targetId: "Omegamon",
      updatedAt: "SERVER_TS",
    });
  });

  test("buildCompletedJogressSlotUpdate는 기본적으로 jogressStatus를 비운다", () => {
    expect(
      buildCompletedJogressSlotUpdate({
        targetId: "Omegamon",
        statsForDb: { hp: 10 },
        nowMs: 123,
        serverTimestampValue: "SERVER_TS",
      })
    ).toEqual({
      selectedDigimon: "Omegamon",
      digimonStats: { hp: 10 },
      jogressStatus: {},
      lastSavedAt: 123,
      lastSavedAtServer: "SERVER_TS",
      updatedAt: "SERVER_TS",
    });
  });

  test("buildCompletedJogressSlotUpdate는 clearJogressStatus=false면 상태 비우기를 생략한다", () => {
    expect(
      buildCompletedJogressSlotUpdate({
        targetId: "Omegamon",
        statsForDb: { hp: 10 },
        nowMs: 123,
        serverTimestampValue: "SERVER_TS",
        clearJogressStatus: false,
      })
    ).toEqual({
      selectedDigimon: "Omegamon",
      digimonStats: { hp: 10 },
      lastSavedAt: 123,
      lastSavedAtServer: "SERVER_TS",
      updatedAt: "SERVER_TS",
    });
  });

  test("buildCompletedJogressRoomUpdate는 completed payload를 만든다", () => {
    expect(buildCompletedJogressRoomUpdate("SERVER_TS")).toEqual({
      status: "completed",
      completedAt: "SERVER_TS",
      updatedAt: "SERVER_TS",
    });
  });

  test("syncCurrentJogressSlot은 save-backed 모드에서 저장 핸들러를 사용한다", async () => {
    const setDigimonStatsAndSave = jest.fn().mockResolvedValue(undefined);
    const setSelectedDigimonAndSave = jest.fn().mockResolvedValue(undefined);

    const result = await syncCurrentJogressSlot({
      isCurrentSlot: true,
      targetId: "Omegamon",
      nextStatsWithLogs: { hp: 20 },
      updatedLogs: [{ type: "EVOLUTION" }],
      syncMode: "save-if-possible",
      setDigimonStatsAndSave,
      setSelectedDigimonAndSave,
    });

    expect(result).toBe(true);
    expect(setDigimonStatsAndSave).toHaveBeenCalledWith(
      { hp: 20 },
      [{ type: "EVOLUTION" }]
    );
    expect(setSelectedDigimonAndSave).toHaveBeenCalledWith("Omegamon");
  });

  test("syncCurrentJogressSlot은 local-only 모드에서 append log 후 로컬 상태를 맞춘다", async () => {
    const appendLogToSubcollection = jest.fn().mockResolvedValue(undefined);
    const setDigimonStats = jest.fn();
    const setSelectedDigimon = jest.fn();

    const result = await syncCurrentJogressSlot({
      isCurrentSlot: true,
      targetId: "Omegamon",
      nextStatsWithLogs: { hp: 20 },
      updatedLogs: [{ type: "EVOLUTION" }],
      appendLogToSubcollection,
      appendLogWhenCurrent: true,
      syncMode: "local-only",
      setDigimonStats,
      setSelectedDigimon,
    });

    expect(result).toBe(true);
    expect(appendLogToSubcollection).toHaveBeenCalledWith({
      type: "EVOLUTION",
    });
    expect(setDigimonStats).toHaveBeenCalledWith({ hp: 20 });
    expect(setSelectedDigimon).toHaveBeenCalledWith("Omegamon");
  });
});
