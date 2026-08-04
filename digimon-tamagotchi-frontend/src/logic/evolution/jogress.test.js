import { resolveOnlineJogressPair } from "./jogress";

describe("resolveOnlineJogressPair", () => {
  test.each([
    ["Ver.3", "Chimairamon", "Ver.5", "Mugendramon", "Millenniumon", "Millenniumon"],
    ["Ver.5", "Mugendramon", "Ver.3", "Chimairamon", "Millenniumon", "Millenniumon"],
    ["Ver.3", "BanchoLeomon", "Ver.4", "Darkdramon", "Chaosmon", "Chaosmon"],
    ["Ver.4", "Darkdramon", "Ver.3", "BanchoLeomon", "Chaosmon", "Chaosmon"],
    ["Ver.4", "Darkdramon", "Ver.5", "Mugendramon", "Chaosdramon", "Chaosdramon"],
    ["Ver.5", "Mugendramon", "Ver.4", "Darkdramon", "Chaosdramon", "Chaosdramon"],
  ])(
    "%s %s + %s %s의 양쪽 결과를 각 버전 맵에서 찾는다",
    (hostVersion, hostDigimonId, guestVersion, guestDigimonId, hostTargetId, guestTargetId) => {
      const result = resolveOnlineJogressPair({
        hostVersion,
        hostDigimonId,
        guestVersion,
        guestDigimonId,
      });

      expect(result).toMatchObject({
        success: true,
        hostVersion,
        guestVersion,
        hostTargetId,
        guestTargetId,
      });
      expect(result.hostTargetEntry?.id).toBe(hostTargetId);
      expect(result.guestTargetEntry?.id).toBe(guestTargetId);
    }
  );

  test("Ver.1과 Ver.2의 기존 접미사 조합을 유지한다", () => {
    expect(
      resolveOnlineJogressPair({
        hostVersion: "Ver.1",
        hostDigimonId: "BlitzGreymon",
        guestVersion: "Ver.2",
        guestDigimonId: "CresGarurumonV2",
      })
    ).toMatchObject({
      success: true,
      hostTargetId: "OmegamonAlterSV1",
      guestTargetId: "OmegamonAlterSV2",
    });
  });

  test("partnerVersion이 다른 조합은 거부한다", () => {
    expect(
      resolveOnlineJogressPair({
        hostVersion: "Ver.3",
        hostDigimonId: "BanchoLeomon",
        guestVersion: "Ver.5",
        guestDigimonId: "Mugendramon",
      })
    ).toMatchObject({ success: false });
  });

  test("한쪽 결과 데이터가 누락되면 거부한다", () => {
    const maps = {
      "Ver.3": {
        BanchoLeomon: {
          id: "BanchoLeomon",
          evolutions: [{
            targetId: "Chaosmon",
            jogress: { partner: "Darkdramon", partnerVersion: "Ver.4" },
          }],
        },
        Chaosmon: { id: "Chaosmon", name: "카오스몬 [Ver.3]" },
      },
      "Ver.4": {
        Darkdramon: {
          id: "Darkdramon",
          evolutions: [{
            targetId: "Chaosmon",
            jogress: { partner: "BanchoLeomon", partnerVersion: "Ver.3" },
          }],
        },
      },
    };

    const result = resolveOnlineJogressPair(
      {
        hostVersion: "Ver.3",
        hostDigimonId: "BanchoLeomon",
        guestVersion: "Ver.4",
        guestDigimonId: "Darkdramon",
      },
      { getDataMapByVersion: (version) => maps[version] || {} }
    );

    expect(result).toEqual({
      success: false,
      reason: "조그레스 결과 디지몬 데이터를 찾을 수 없습니다.",
    });
  });
});
