import {
  buildJogressArchivePayload,
  buildJogressSummary,
} from "./jogressPresentationHelpers";

describe("jogressPresentationHelpers", () => {
  test("buildJogressSummary는 슬롯 라벨을 포함한 기본 요약을 만든다", () => {
    expect(
      buildJogressSummary({
        currentDisplayName: "아구몬",
        partnerDisplayName: "베타몬",
        resultDisplayName: "오메가몬",
        hostSlotLabel: "슬롯1",
        guestSlotLabel: "슬롯2",
      })
    ).toEqual({
      currentLabel: "아구몬(슬롯1)",
      partnerLabel: "베타몬(슬롯2)",
      resultName: "오메가몬",
    });
  });

  test("buildJogressSummary는 partner metadata를 선택적으로 포함한다", () => {
    expect(
      buildJogressSummary({
        currentDisplayName: "아구몬",
        partnerDisplayName: "베타몬",
        resultDisplayName: "오메가몬",
        hostSlotLabel: "내 슬롯",
        guestSlotLabel: "슬롯3",
        partnerTamerName: "게스트",
        includePartnerDigimonName: true,
      })
    ).toEqual({
      currentLabel: "아구몬(내 슬롯)",
      partnerLabel: "베타몬(슬롯3)",
      partnerTamerName: "게스트",
      partnerDigimonName: "베타몬",
      resultName: "오메가몬",
    });
  });

  test("buildJogressArchivePayload는 local payload를 만든다", () => {
    expect(
      buildJogressArchivePayload({
        mode: "local",
        hostUid: "user-1",
        hostTamerName: "테이머",
        hostSlotId: "1",
        hostDigimonName: "아구몬",
        hostSlotVersion: "Ver.1",
        guestUid: "user-1",
        guestTamerName: "테이머",
        guestSlotId: 2,
        guestDigimonName: "베타몬",
        guestSlotVersion: "Ver.1",
        targetId: "Omegamon",
        targetName: "오메가몬",
        isOnline: false,
        resultName: "오메가몬",
        hostSlotLabel: "슬롯1",
        guestSlotLabel: "슬롯2",
      })
    ).toEqual({
      hostUid: "user-1",
      hostTamerName: "테이머",
      hostSlotId: "1",
      hostDigimonName: "아구몬",
      hostSlotVersion: "Ver.1",
      guestUid: "user-1",
      guestTamerName: "테이머",
      guestSlotId: 2,
      guestDigimonName: "베타몬",
      guestSlotVersion: "Ver.1",
      targetId: "Omegamon",
      targetName: "오메가몬",
      isOnline: false,
      payload: {
        mode: "local",
        resultName: "오메가몬",
        hostSlotLabel: "슬롯1",
        guestSlotLabel: "슬롯2",
      },
    });
  });

  test("buildJogressArchivePayload는 roomId를 유지한 online payload를 만든다", () => {
    expect(
      buildJogressArchivePayload({
        mode: "online-room",
        hostUid: "user-1",
        hostTamerName: "호스트",
        hostSlotId: 7,
        hostDigimonName: "오메가몬",
        hostSlotVersion: "Ver.1",
        guestUid: "user-2",
        guestTamerName: "게스트",
        guestSlotId: 3,
        guestDigimonName: "베타몬",
        guestSlotVersion: "Ver.1",
        targetId: "Omegamon",
        targetName: "오메가몬",
        isOnline: true,
        resultName: "오메가몬",
        roomId: "room-3",
      })
    ).toEqual({
      hostUid: "user-1",
      hostTamerName: "호스트",
      hostSlotId: 7,
      hostDigimonName: "오메가몬",
      hostSlotVersion: "Ver.1",
      guestUid: "user-2",
      guestTamerName: "게스트",
      guestSlotId: 3,
      guestDigimonName: "베타몬",
      guestSlotVersion: "Ver.1",
      targetId: "Omegamon",
      targetName: "오메가몬",
      isOnline: true,
      payload: {
        mode: "online-room",
        resultName: "오메가몬",
        roomId: "room-3",
      },
    });
  });
});
