import { digimonDataVer1 } from "./v1/digimons";
import { digimonDataVer2 } from "./v2modkor/digimons";
import { digimonDataVer3 } from "./v3/digimons";
import { digimonDataVer4 } from "./v4/digimons";
import { digimonDataVer5 } from "./v5/digimons";

function getTargetName(entry, targetId) {
  return entry.evolutions.find((evolution) => evolution.targetId === targetId)?.targetName;
}

describe("디지몬 버전별 한글 이름", () => {
  test("Ver.1과 Ver.2의 버전 표기를 대괄호 형식으로 사용한다", () => {
    expect(digimonDataVer1.Digitama.name).toBe("디지타마 [Ver.1]");
    expect(digimonDataVer1.BlitzGreymon.name).toBe("블리츠그레이몬 [Ver.1]");
    expect(getTargetName(digimonDataVer1.MetalGreymonVirus, "BlitzGreymon")).toBe(
      "블리츠그레이몬 [Ver.1]"
    );
    expect(digimonDataVer1.OmegamonAlterSV1.name).toBe("오메가몬 Alter-S [Ver.1]");
    expect(getTargetName(digimonDataVer1.BlitzGreymon, "OmegamonAlterSV1")).toBe(
      "오메가몬 Alter-S [Ver.1]"
    );

    expect(digimonDataVer2.DigitamaV2.name).toBe("디지타마 [Ver.2]");
    expect(digimonDataVer2.CresGarurumonV2.name).toBe("크레스가루루몬 [Ver.2]");
    expect(getTargetName(digimonDataVer2.MetalMammemon, "CresGarurumonV2")).toBe(
      "크레스가루루몬 [Ver.2]"
    );
    expect(digimonDataVer2.OmegamonAlterSV2.name).toBe("오메가몬 Alter-S [Ver.2]");
    expect(getTargetName(digimonDataVer2.CresGarurumonV2, "OmegamonAlterSV2")).toBe(
      "오메가몬 Alter-S [Ver.2]"
    );
  });

  test("Ver.3 디지몬 이름과 진화 대상 이름을 함께 변경한다", () => {
    const expectedNames = {
      DigitamaV3: "디지타마 [Ver.3]",
      Patamon: "파닥몬",
      Kunemon: "꿈틀몬",
      Centaurmon: "켄터스몬",
      Ogremon: "우가몬",
      Bakemon: "고스몬",
      Drimogemon: "두리몬",
      Giromon: "째리몬",
      Chaosmon: "카오스몬 [Ver.3]",
      Millenniumon: "밀레니엄몬 [Ver.3]",
    };

    Object.entries(expectedNames).forEach(([id, name]) => {
      expect(digimonDataVer3[id].name).toBe(name);
    });

    const expectedTargetNames = [
      ["Tokomon", "Patamon", "파닥몬"],
      ["Tokomon", "Kunemon", "꿈틀몬"],
      ["Patamon", "Centaurmon", "켄터스몬"],
      ["Patamon", "Ogremon", "우가몬"],
      ["Patamon", "Bakemon", "고스몬"],
      ["Kunemon", "Drimogemon", "두리몬"],
      ["Kunemon", "Ogremon", "우가몬"],
      ["Kunemon", "Bakemon", "고스몬"],
      ["Centaurmon", "Giromon", "째리몬"],
      ["Bakemon", "Giromon", "째리몬"],
      ["Drimogemon", "Giromon", "째리몬"],
      ["BanchoLeomon", "Chaosmon", "카오스몬 [Ver.3]"],
      ["Chimairamon", "Millenniumon", "밀레니엄몬 [Ver.3]"],
    ];

    expectedTargetNames.forEach(([sourceId, targetId, name]) => {
      expect(getTargetName(digimonDataVer3[sourceId], targetId)).toBe(name);
    });

    expect(
      getTargetName(digimonDataVer3.Chimairamon, "Millenniumon")
    ).toBe("밀레니엄몬 [Ver.3]");
    expect(
      digimonDataVer3.Chimairamon.evolutions.find(
        ({ targetId }) => targetId === "Millenniumon"
      ).jogress.partnerName
    ).toBe("파워드라몬");
  });

  test("Ver.4 디지몬 이름과 진화 대상 이름을 함께 변경한다", () => {
    const expectedNames = {
      DigitamaV4: "디지타마 [Ver.4]",
      Tanemon: "시드몬",
      Coelamon: "실리컨몬(씨라몬)",
      Mojyamon: "모털몬",
      Kuwagamon: "쿠가몬",
      Kokatorimon: "꼬끼몬",
      Nanimon: "모야몬",
      Piccolomon: "피콜몬",
      Digitamamon: "디지타몬",
      Gankoomon: "간쿠몬",
      Chaosmon: "카오스몬 [Ver.4]",
      Chaosdramon: "카오스드라몬 [Ver.4]",
    };

    Object.entries(expectedNames).forEach(([id, name]) => {
      expect(digimonDataVer4[id].name).toBe(name);
    });

    const expectedTargetNames = [
      ["Yuramon", "Tanemon", "시드몬"],
      ["Piyomon", "Kokatorimon", "꼬끼몬"],
      ["Piyomon", "Kuwagamon", "쿠가몬"],
      ["Piyomon", "Nanimon", "모야몬"],
      ["Palmon", "Coelamon", "실리컨몬(씨라몬)"],
      ["Palmon", "Mojyamon", "모털몬"],
      ["Palmon", "Kuwagamon", "쿠가몬"],
      ["Palmon", "Nanimon", "모야몬"],
      ["Kokatorimon", "Piccolomon", "피콜몬"],
      ["Kuwagamon", "Piccolomon", "피콜몬"],
      ["Mojyamon", "Piccolomon", "피콜몬"],
      ["Nanimon", "Digitamamon", "디지타몬"],
      ["Digitamamon", "Gankoomon", "간쿠몬"],
      ["Darkdramon", "Chaosmon", "카오스몬 [Ver.4]"],
      ["Darkdramon", "Chaosdramon", "카오스드라몬 [Ver.4]"],
    ];

    expectedTargetNames.forEach(([sourceId, targetId, name]) => {
      expect(getTargetName(digimonDataVer4[sourceId], targetId)).toBe(name);
    });
    expect(
      digimonDataVer4.Darkdramon.evolutions.find(
        ({ targetId }) => targetId === "Chaosdramon"
      ).jogress.partnerName
    ).toBe("파워드라몬");
  });

  test("Ver.5 디지몬 이름과 진화 대상 이름을 함께 변경한다", () => {
    const expectedNames = {
      DigitamaV5: "디지타마 [Ver.5]",
      Zurumon: "즈루몬",
      Pagumon: "퍼그몬",
      Gazimon: "가지몬",
      Devidramon: "데블드라몬",
      Cyclomon: "사이크로몬",
      Tuskmon: "태스크몬",
      Nanomon: "데이터몬",
      Mugendramon: "파워드라몬",
      Gaioumon: "가이온몬",
      Millenniumon: "밀레니엄몬 [Ver.5]",
      Chaosdramon: "카오스드라몬 [Ver.5]",
    };

    Object.entries(expectedNames).forEach(([id, name]) => {
      expect(digimonDataVer5[id].name).toBe(name);
    });

    const expectedTargetNames = [
      ["DigitamaV5", "Zurumon", "즈루몬"],
      ["Zurumon", "Pagumon", "퍼그몬"],
      ["Pagumon", "Gazimon", "가지몬"],
      ["Gazimon", "Cyclomon", "사이크로몬"],
      ["Gazimon", "Devidramon", "데블드라몬"],
      ["Gazimon", "Tuskmon", "태스크몬"],
      ["Gizamon", "Devidramon", "데블드라몬"],
      ["Gizamon", "Tuskmon", "태스크몬"],
      ["Cyclomon", "Nanomon", "데이터몬"],
      ["Tuskmon", "Nanomon", "데이터몬"],
      ["Deltamon", "Nanomon", "데이터몬"],
      ["MetalTyranomon", "Mugendramon", "파워드라몬"],
      ["ExTyranomon", "Gaioumon", "가이온몬"],
      ["Mugendramon", "Millenniumon", "밀레니엄몬 [Ver.5]"],
      ["Mugendramon", "Chaosdramon", "카오스드라몬 [Ver.5]"],
    ];

    expectedTargetNames.forEach(([sourceId, targetId, name]) => {
      expect(getTargetName(digimonDataVer5[sourceId], targetId)).toBe(name);
    });
  });
});
