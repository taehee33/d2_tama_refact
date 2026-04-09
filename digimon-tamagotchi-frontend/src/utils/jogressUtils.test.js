import {
  getJogressPartnerDisplayName,
  getJogressSupportMessage,
  isJogressPartnerSupportedInApp,
} from "./jogressUtils";

describe("jogressUtils", () => {
  test("Ver.1/Ver.2 크로스 조그레스 파트너는 반대 버전 이름으로 표시한다", () => {
    expect(
      getJogressPartnerDisplayName(
        { partner: "CresGarurumonV2" },
        "Ver.1"
      )
    ).toBe("크레스가루루몬 Ver.2");
  });

  test("명시된 외부 버전 파트너 이름은 버전 suffix와 함께 표시한다", () => {
    expect(
      getJogressPartnerDisplayName(
        {
          partner: "Darkdramon",
          partnerName: "다크드라몬",
          partnerVersion: "Ver.4",
        },
        "Ver.3"
      )
    ).toBe("다크드라몬 Ver.4");
  });

  test("현재 앱에 포함된 Ver.5 파트너는 로컬 조그레스로 지원한다", () => {
    const jogress = {
      partner: "Mugendramon",
      partnerName: "무겐드라몬",
      partnerVersion: "Ver.5",
    };

    expect(isJogressPartnerSupportedInApp(jogress)).toBe(true);
    expect(getJogressSupportMessage(jogress)).toContain("로컬 조그레스");
  });
});
