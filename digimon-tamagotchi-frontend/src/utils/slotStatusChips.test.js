import { getSlotStatusChips } from "./slotStatusChips";

describe("getSlotStatusChips", () => {
  test("사망 상태를 최우선 칩으로 반환한다", () => {
    expect(getSlotStatusChips({ digimonStats: { isDead: true } })).toEqual([
      { id: "dead", label: "사망", tone: "danger" },
    ]);
  });

  test("냉장고, 치료, 배변, 진화 가능 상태를 칩으로 변환한다", () => {
    expect(getSlotStatusChips({ digimonStats: { isFrozen: true } })[0]).toMatchObject({
      id: "frozen",
      label: "냉장고 보관",
    });
    expect(getSlotStatusChips({ digimonStats: { isInjured: true } })[0]).toMatchObject({
      id: "injured",
      label: "치료 필요",
    });
    expect(getSlotStatusChips({ digimonStats: { poopCount: 6 } })[0]).toMatchObject({
      id: "poop",
      label: "배변 주의",
    });
    expect(
      getSlotStatusChips({
        selectedDigimon: "Punimon",
        version: "Ver.2",
        digimonStats: { timeToEvolveSeconds: 0 },
      })[0]
    ).toMatchObject({
      id: "evolution",
      label: "진화 가능",
    });
  });

  test("여러 상태가 있으면 우선순위대로 최대 2개만 반환한다", () => {
    expect(
      getSlotStatusChips({
        digimonStats: {
          isDead: true,
          isFrozen: true,
          isInjured: true,
          poopCount: 8,
          timeToEvolveSeconds: -1,
        },
        selectedDigimon: "Punimon",
        version: "Ver.2",
      })
    ).toEqual([
      { id: "dead", label: "사망", tone: "danger" },
      { id: "frozen", label: "냉장고 보관", tone: "cool" },
    ]);
  });

  test("상태가 없으면 칩을 반환하지 않는다", () => {
    expect(getSlotStatusChips({ digimonStats: {} })).toEqual([]);
    expect(getSlotStatusChips(null)).toEqual([]);
  });

  test("최종 단계 디지몬은 timeToEvolveSeconds가 0이어도 진화 가능 칩을 표시하지 않는다", () => {
    expect(
      getSlotStatusChips({
        selectedDigimon: "OmegamonAlterSV2",
        version: "Ver.2",
        digimonStats: { timeToEvolveSeconds: 0 },
      })
    ).toEqual([]);
  });
});
